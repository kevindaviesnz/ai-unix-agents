/**
 * executor.js
 *
 * Translates tool calls from the AI into sanitized Unix commands and executes them.
 * All inputs are validated before execution to prevent shell injection attacks.
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT_MS = 15_000; // 15 seconds max per command
const MAX_OUTPUT_BYTES = 50_000; // Truncate very large outputs

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a path string is safe: no shell metacharacters, no null bytes,
 * no attempts to escape via semicolons, pipes, backticks, etc.
 */
function sanitizePath(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Path must be a non-empty string.");
  }
  // Allow: alphanumeric, spaces, dash, underscore, dot, forward slash, tilde, @
  if (/[^a-zA-Z0-9 \-_./@~]/.test(raw)) {
    throw new Error(
      `Unsafe characters detected in path: "${raw}". Only alphanumeric characters, spaces, dashes, underscores, dots, slashes, @, and ~ are allowed.`
    );
  }
  // Block traversal sequences beyond normal relative paths
  if (raw.includes("..") && raw.includes("/..")) {
    throw new Error("Path traversal sequences are not allowed.");
  }
  return raw.trim();
}

/**
 * Validates a grep/search pattern. We run grep with -F (fixed string) or -E
 * (extended regex), but we still want to prevent weird inputs.
 */
function sanitizePattern(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Pattern must be a non-empty string.");
  }
  if (raw.length > 200) {
    throw new Error("Pattern is too long (max 200 chars).");
  }
  // Disallow null bytes
  if (raw.includes("\0")) {
    throw new Error("Pattern contains null bytes.");
  }
  return raw;
}

/**
 * Validates a glob pattern used with --include in grep or -name in find.
 */
function sanitizeGlob(raw) {
  if (typeof raw !== "string") return null;
  if (/[^a-zA-Z0-9.*_\-]/.test(raw)) {
    throw new Error(`Unsafe glob pattern: "${raw}"`);
  }
  return raw;
}

/**
 * Truncates a string to MAX_OUTPUT_BYTES, appending a notice if truncated.
 */
function truncateOutput(output) {
  if (output.length > MAX_OUTPUT_BYTES) {
    return (
      output.slice(0, MAX_OUTPUT_BYTES) +
      `\n\n[... output truncated at ${MAX_OUTPUT_BYTES} bytes ...]`
    );
  }
  return output;
}

/**
 * Runs a command via execFile (no shell, prevents injection) and returns
 * { stdout, stderr, exitCode }. Never throws — errors are returned as output.
 */
async function run(bin, args) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: EXEC_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES * 2,
      // Do NOT use shell: true — this is the key security measure
    });
    return {
      stdout: truncateOutput(stdout || ""),
      stderr: truncateOutput(stderr || ""),
      exitCode: 0,
    };
  } catch (err) {
    // execFile throws on non-zero exit codes too
    return {
      stdout: truncateOutput(err.stdout || ""),
      stderr: truncateOutput(err.stderr || err.message || "Unknown error"),
      exitCode: err.code ?? 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool execution handlers
// ---------------------------------------------------------------------------

async function executeFindFiles({ path, name_pattern, type, max_depth }) {
  const safePath = sanitizePath(path);
  const args = [safePath];

  if (max_depth != null) {
    const depth = Math.min(Math.max(Math.floor(max_depth), 1), 10);
    args.push("-maxdepth", String(depth));
  }

  args.push("-type", type === "d" ? "d" : "f");

  if (name_pattern) {
    const safeGlob = sanitizeGlob(name_pattern);
    if (safeGlob) args.push("-name", safeGlob);
  }

  const result = await run("find", args);
  const lines = (result.stdout || result.stderr).trim().split("\n").filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "No files found matching criteria.";
}

async function executeCountLines({ path, mode }) {
  const safePath = sanitizePath(path);
  const flag =
    mode === "words" ? "-w" : mode === "bytes" ? "-c" : "-l";

  const result = await run("wc", [flag, safePath]);
  return result.exitCode === 0 ? result.stdout.trim() : `Error: ${result.stderr}`;
}

async function executeSearchPattern({
  pattern,
  path,
  file_pattern,
  case_insensitive,
  max_results,
}) {
  const safePattern = sanitizePattern(pattern);
  const safePath = sanitizePath(path);

  const args = [
    "-rn", // recursive, show line numbers
    "--color=never",
  ];

  if (case_insensitive) args.push("-i");
  if (max_results) args.push("-m", String(Math.min(Math.floor(max_results), 200)));
  if (file_pattern) {
    const safeGlob = sanitizeGlob(file_pattern);
    if (safeGlob) args.push(`--include=${safeGlob}`);
  }

  args.push(safePattern, safePath);

  const result = await run("grep", args);
  if (result.exitCode === 1 && !result.stdout && !result.stderr) {
    return "No matches found.";
  }
  if (result.exitCode > 1) return `Error: ${result.stderr}`;
  return result.stdout.trim() || "No matches found.";
}

async function executeDiskUsage({ path, depth, sort }) {
  const safePath = sanitizePath(path);
  const safeDepth = Math.min(Math.max(Math.floor(depth ?? 1), 1), 5);

  const duArgs = ["-h", `--max-depth=${safeDepth}`, safePath];
  const result = await run("du", duArgs);

  if (result.exitCode !== 0) return `Error: ${result.stderr}`;

  let output = result.stdout.trim();

  if (sort) {
    // Sort numerically by size using sort -h (human-readable)
    // We do this in JS to avoid spawning a shell pipeline
    const lines = output.split("\n").filter(Boolean);
    const parseSize = (line) => {
      const sizeStr = line.split("\t")[0];
      const units = { K: 1, M: 1024, G: 1024 * 1024, T: 1024 ** 3 };
      const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/);
      if (!match) return 0;
      return parseFloat(match[1]) * (units[match[2]] ?? 1);
    };
    lines.sort((a, b) => parseSize(b) - parseSize(a));
    output = lines.join("\n");
  }

  return output;
}

async function executeListDirectory({ path, show_hidden }) {
  const safePath = sanitizePath(path);
  const args = ["-lh"];
  if (show_hidden) args.push("-a");
  args.push(safePath);

  const result = await run("ls", args);
  return result.exitCode === 0 ? result.stdout.trim() : `Error: ${result.stderr}`;
}

async function executeReadFileHead({ path, lines }) {
  const safePath = sanitizePath(path);
  const safeLines = Math.min(Math.max(Math.floor(lines ?? 20), 1), 100);

  const result = await run("head", ["-n", String(safeLines), safePath]);
  return result.exitCode === 0 ? result.stdout : `Error: ${result.stderr}`;
}

async function executeSortAndUnique({ input, count_duplicates, numeric_sort, reverse }) {
  if (typeof input !== "string" || input.length === 0) {
    return "No input provided to sort.";
  }

  // Sort in JS to avoid piping through a shell
  let lines = input.split("\n").filter(Boolean);

  if (count_duplicates) {
    const counts = {};
    for (const line of lines) counts[line] = (counts[line] ?? 0) + 1;
    lines = Object.entries(counts).map(([line, count]) => `${count}\t${line}`);
    lines.sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return reverse ? na - nb : nb - na;
    });
  } else {
    lines = [...new Set(lines)];
    lines.sort((a, b) => {
      if (numeric_sort) {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return reverse ? nb - na : na - nb;
      }
      return reverse ? b.localeCompare(a) : a.localeCompare(b);
    });
  }

  return lines.join("\n") || "No output after sorting.";
}

// ---------------------------------------------------------------------------
// Dry-run formatter
// ---------------------------------------------------------------------------

function formatDryRun(toolName, input) {
  const descriptions = {
    find_files: () =>
      `find ${sanitizePath(input.path)} ${input.max_depth ? `-maxdepth ${input.max_depth}` : ""} -type ${input.type ?? "f"} ${input.name_pattern ? `-name "${input.name_pattern}"` : ""}`.trim(),
    count_lines: () => `wc ${input.mode === "words" ? "-w" : input.mode === "bytes" ? "-c" : "-l"} ${input.path}`,
    search_pattern: () =>
      `grep -rn${input.case_insensitive ? "i" : ""} ${input.max_results ? `-m ${input.max_results}` : ""} ${input.file_pattern ? `--include="${input.file_pattern}"` : ""} "${input.pattern}" ${input.path}`.trim(),
    disk_usage: () => `du -h --max-depth=${input.depth ?? 1} ${input.path}`,
    list_directory: () => `ls -lh${input.show_hidden ? "a" : ""} ${input.path}`,
    read_file_head: () => `head -n ${input.lines ?? 20} ${input.path}`,
    sort_and_unique: () =>
      `[in-memory sort/uniq]${input.count_duplicates ? " --count" : ""}${input.reverse ? " --reverse" : ""}`,
    summarize_report: () => "[agent producing final report]",
  };
  return descriptions[toolName]?.() ?? `[${toolName}]`;
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

/**
 * Executes a tool call by name with the given input object.
 * Returns a string result suitable for sending back to the AI.
 *
 * @param {string} toolName
 * @param {object} input
 * @param {boolean} dryRun - If true, simulate without executing
 */
export async function executeTool(toolName, input, dryRun = false) {
  if (dryRun) {
    return `[DRY RUN] Would execute: ${formatDryRun(toolName, input)}`;
  }

  switch (toolName) {
    case "find_files":        return executeFindFiles(input);
    case "count_lines":       return executeCountLines(input);
    case "search_pattern":    return executeSearchPattern(input);
    case "disk_usage":        return executeDiskUsage(input);
    case "list_directory":    return executeListDirectory(input);
    case "read_file_head":    return executeReadFileHead(input);
    case "sort_and_unique":   return executeSortAndUnique(input);
    case "summarize_report":  return input.summary; // handled specially in agent
    default:
      throw new Error(`Unknown tool: "${toolName}"`);
  }
}
