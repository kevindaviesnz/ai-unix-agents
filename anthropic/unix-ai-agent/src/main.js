/**
 * main.js
 *
 * Entry point for the Unix AI Agent — Codebase Health Checker.
 *
 * Usage:
 *   node src/main.js [target-path] [--provider anthropic|gemini] [--goal "..."] [--dry-run]
 *
 * Examples:
 *   node src/main.js .
 *   node src/main.js . --provider gemini
 *   node src/main.js ./src --provider anthropic --goal "Find hardcoded secrets"
 *   node src/main.js . --provider gemini --model gemini-1.5-flash --dry-run
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import { runAgent }                       from "./agent.js";
import { createProvider, PROVIDER_NAMES } from "./providers/index.js";
import { logger }                     from "./logger.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return null; // No key found — let validation handle the error message
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    targetPath: ".",
    provider:   null, // Resolved below after parsing flags
    model:      null,
    goal:       null,
    dryRun:     false,
    help:       false,
    maxIterations: null,
    output:     null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--dry-run" || arg === "--dry") {
      result.dryRun = true;
    } else if (arg === "--max-iterations" && args[i + 1]) {
      result.maxIterations = parseInt(args[++i], 10);
    } else if ((arg === "--output" || arg === "-o") && args[i + 1]) {
      result.output = args[++i];
    } else if ((arg === "--goal" || arg === "-g") && args[i + 1]) {
      result.goal = args[++i];
    } else if ((arg === "--provider" || arg === "-p") && args[i + 1]) {
      result.provider = args[++i];
    } else if (arg === "--model" && args[i + 1]) {
      result.model = args[++i];
    } else if (!arg.startsWith("--")) {
      result.targetPath = arg;
    }
  }

  // Explicit --provider flag wins; otherwise auto-detect from available env vars
  if (!result.provider) {
    result.provider = detectProvider();
  }

  return result;
}

function printHelp() {
  console.log(`
Unix AI Agent — Codebase Health Checker (v2 — multi-provider)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USAGE:
  node src/main.js [target-path] [options]

ARGUMENTS:
  target-path           Directory to analyze (default: ".")

OPTIONS:
  --provider, -p        LLM provider to use: anthropic | gemini
                        Auto-detected from available env vars if not specified
                        (ANTHROPIC_API_KEY → anthropic, GEMINI_API_KEY → gemini)
  --model               Override the default model for the chosen provider
                        Anthropic default: claude-sonnet-4-20250514
                        Gemini default:    gemini-1.5-pro
  --goal, -g            Natural language goal for the analysis
  --max-iterations      Maximum number of API calls the agent can make (default: 5)
  --output, -o          Save the final health report to a file (e.g. --output report.txt)
  --dry-run             Simulate without executing Unix commands
  --help, -h            Show this help message

ENVIRONMENT VARIABLES:
  ANTHROPIC_API_KEY     Required when using --provider anthropic
  GEMINI_API_KEY        Required when using --provider gemini
  (or GOOGLE_API_KEY)

EXAMPLES:
  node src/main.js .
  node src/main.js . --provider gemini
  node src/main.js ./src --provider anthropic --goal "Find security issues"
  node src/main.js . --provider gemini --model gemini-1.5-flash
  node src/main.js . --dry-run
`);
}

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const ENV_REQUIREMENTS = {
  anthropic: {
    vars: ["ANTHROPIC_API_KEY"],
    hint: "Get your key at https://console.anthropic.com",
  },
  gemini: {
    vars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    anyOf: true, // Only one of the vars needs to be set
    hint: "Get your key at https://aistudio.google.com/apikey",
  },
};

function validateEnvironment(providerName) {
  if (!providerName) {
    console.error(
      "\nError: No API key found. Set one of the following environment variables:\n\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...   # https://console.anthropic.com\n" +
      "  export GEMINI_API_KEY=AIza...          # https://aistudio.google.com/apikey\n"
    );
    process.exit(1);
  }

  const req = ENV_REQUIREMENTS[providerName];
  if (!req) return; // Unknown provider — will fail later with a clear error

  if (req.anyOf) {
    const isSet = req.vars.some((v) => process.env[v]);
    if (!isSet) {
      console.error(
        `\nError: Set one of these environment variables for the "${providerName}" provider:\n` +
        req.vars.map((v) => `  export ${v}=...`).join("\n") +
        `\n\n${req.hint}\n`
      );
      process.exit(1);
    }
  } else {
    for (const v of req.vars) {
      if (!process.env[v]) {
        console.error(
          `\nError: ${v} environment variable is not set.\n${req.hint}\n`
        );
        process.exit(1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DEFAULT_GOAL =
  "Perform a comprehensive codebase health check. " +
  "Analyze the project structure, measure code volume, find TODO/FIXME/HACK comments, " +
  "look for console.log statements, identify large files, check for hardcoded secrets or API keys, " +
  "and assess overall code quality. Provide a detailed health report with actionable recommendations.";

async function main() {
  const { targetPath: rawPath, provider: providerName, model, goal, dryRun, help, maxIterations, output } =
    parseArgs(process.argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  validateEnvironment(providerName);

  const targetPath   = path.resolve(rawPath);
  const analysisGoal = goal || DEFAULT_GOAL;

  // Build provider options — only include model if explicitly provided
  const providerOpts = model ? { model } : {};
  let provider;
  try {
    provider = await createProvider(providerName, providerOpts);
  } catch (err) {
    console.error(`\nError: ${err.message}\n`);
    console.error(`Available providers: ${PROVIDER_NAMES.join(", ")}\n`);
    process.exit(1);
  }

  try {
    const { report, healthScore, usage, iterations } = await runAgent(
      analysisGoal,
      targetPath,
      provider,
      { dryRun, ...(maxIterations ? { maxIterations } : {}) }
    );

    logger.finalReport(report, healthScore, usage, iterations);

    if (output) {
      const outputPath = path.resolve(output);
      const content = [
        `Health Score: ${healthScore ?? "N/A"}/10`,
        `Date: ${new Date().toISOString()}`,
        `Provider: ${providerName} — Target: ${targetPath}`,
        `${"─".repeat(60)}`,
        report,
      ].join("\n");
      fs.writeFileSync(outputPath, content, "utf8");
      console.log(`\nReport saved to: ${outputPath}`);
    }
    process.exit(0);
  } catch (err) {
    // Surface provider-specific auth errors clearly
    if (err.message?.includes("API key") || err.status === 401) {
      console.error("\nError: Invalid or expired API key.\n");
    } else if (err.status === 429) {
      console.error("\nError: Rate limit hit. Try again in a moment.\n");
    } else if (err.status === 529) {
      console.error("\nError: Provider API is overloaded. Try again shortly.\n");
    } else {
      console.error("\nUnexpected error:", err.message);
      if (process.env.DEBUG) console.error(err);
    }
    process.exit(1);
  }
}

main();