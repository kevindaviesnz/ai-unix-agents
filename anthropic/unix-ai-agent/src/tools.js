/**
 * tools.js
 *
 * Defines the set of Unix commands exposed to the AI as callable tools.
 * Each tool maps directly to a Unix command and includes an Anthropic-compatible
 * tool definition for function calling.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description:
      "Search for files in a directory tree. Use this to locate files by name pattern, extension, or type. Returns a list of matching file paths.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The root directory to search in (e.g. '.' or './src')",
        },
        name_pattern: {
          type: "string",
          description:
            "Shell glob pattern to match filenames (e.g. '*.js', '*.log'). Optional.",
        },
        type: {
          type: "string",
          enum: ["f", "d"],
          description:
            "Restrict to files (f) or directories (d). Optional, defaults to files.",
        },
        max_depth: {
          type: "number",
          description: "Maximum directory depth to search. Optional.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "count_lines",
    description:
      "Count the number of lines, words, or bytes in one or more files. Useful for measuring file size or code volume.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File or glob pattern to count (e.g. 'src/*.js'). Use a specific file path.",
        },
        mode: {
          type: "string",
          enum: ["lines", "words", "bytes"],
          description: "What to count. Defaults to lines.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_pattern",
    description:
      "Search for a text pattern inside files using grep. Returns matching lines with file and line number. Great for finding TODOs, deprecated calls, console.logs, etc.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text or regex pattern to search for.",
        },
        path: {
          type: "string",
          description:
            "File or directory to search in. Use '.' to search recursively from the current directory.",
        },
        file_pattern: {
          type: "string",
          description:
            "Limit search to files matching this glob (e.g. '*.js'). Optional.",
        },
        case_insensitive: {
          type: "boolean",
          description: "Whether to ignore case when matching. Default false.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of matching lines to return. Optional.",
        },
      },
      required: ["pattern", "path"],
    },
  },
  {
    name: "disk_usage",
    description:
      "Show disk usage of files or directories. Useful for finding large files or directories consuming unexpected space.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory or file path to measure.",
        },
        depth: {
          type: "number",
          description:
            "How many levels of subdirectories to summarize. Default 1.",
        },
        sort: {
          type: "boolean",
          description:
            "If true, sort results by size (largest first). Default false.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description:
      "List the contents of a directory with details (size, permissions, dates). Good for getting a quick overview of what's in a folder.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list.",
        },
        show_hidden: {
          type: "boolean",
          description: "Include hidden files (starting with '.'). Default false.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file_head",
    description:
      "Read the first N lines of a file. Use this to inspect file headers, config files, or get a preview of a file's contents without reading the whole thing.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read.",
        },
        lines: {
          type: "number",
          description: "Number of lines to read from the top. Default 20.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "sort_and_unique",
    description:
      "Sort lines of text and optionally count duplicate occurrences. Useful for summarizing repetitive output like log levels, file extensions, or error types.",
    input_schema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description:
            "Multi-line text to sort and deduplicate (e.g. output from a previous command).",
        },
        count_duplicates: {
          type: "boolean",
          description:
            "If true, prefix each line with the number of times it appears. Default false.",
        },
        numeric_sort: {
          type: "boolean",
          description:
            "Sort numerically instead of alphabetically. Default false.",
        },
        reverse: {
          type: "boolean",
          description: "Reverse the sort order. Default false.",
        },
      },
      required: ["input"],
    },
  },
  {
    name: "summarize_report",
    description:
      "Signal that the analysis is complete and provide a final health report. Call this when you have gathered enough information to summarize findings. This ends the agent loop.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "A clear, structured summary of findings. Include: overall health assessment, key metrics, issues found (with severity), and concrete recommendations.",
        },
        health_score: {
          type: "number",
          description:
            "An overall health score from 1 (critical) to 10 (excellent).",
        },
      },
      required: ["summary", "health_score"],
    },
  },
];

/** Map of tool name -> tool definition for quick lookup */
export const TOOL_MAP = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t])
);
