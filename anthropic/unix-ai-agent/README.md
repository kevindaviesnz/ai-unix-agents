# Unix AI Agent — Codebase Health Checker

An AI-powered agent that analyzes your codebase by orchestrating Unix commands as tools inside a **ReAct (Reason → Act → Observe)** loop. Supports both **Anthropic Claude** and **Google Gemini** as LLM backends — swap between them with a single flag.

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│                     ReAct Agent Loop                     │
│                                                          │
│   User Goal                                              │
│       │                                                  │
│       ▼                                                  │
│   ┌──────────────────┐  tool_call  ┌──────────────────┐ │
│   │   LLM Provider   │ ──────────► │   Unix Executor  │ │
│   │ Anthropic/Gemini │             │ find/grep/wc/... │ │
│   │    (Reason)      │ ◄────────── │    (Act)         │ │
│   └──────────────────┘  tool_result└──────────────────┘ │
│             │                                            │
│             └── loops until summarize_report is called   │
└──────────────────────────────────────────────────────────┘
```

### Provider Architecture

API differences between Anthropic and Gemini are fully encapsulated in provider classes. The agent loop in `agent.js` has zero knowledge of which LLM it's talking to.

```
src/
├── agent.js              ← Provider-agnostic ReAct loop
├── executor.js           ← Unix command execution + sanitization
├── tools.js              ← Tool definitions (Anthropic format; Gemini provider converts)
├── logger.js             ← Pretty console output
├── main.js               ← CLI entry point
└── providers/
    ├── index.js          ← Factory: createProvider("anthropic" | "gemini")
    ├── anthropic.js      ← Anthropic SDK wrapper
    └── gemini.js         ← Google Generative AI SDK wrapper
```

### Available Tools

| Tool              | Unix Command  | Purpose                              |
|-------------------|---------------|--------------------------------------|
| `find_files`      | `find`        | Locate files by name or extension    |
| `count_lines`     | `wc`          | Measure code volume                  |
| `search_pattern`  | `grep`        | Find patterns (TODOs, secrets, logs) |
| `disk_usage`      | `du`          | Spot large or bloated directories    |
| `list_directory`  | `ls`          | Inspect directory contents           |
| `read_file_head`  | `head`        | Preview file contents                |
| `sort_and_unique` | *(in-memory)* | Aggregate and summarize output       |
| `summarize_report`| *(terminal)*  | End the loop with final findings     |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set API keys

**Anthropic:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
Get a key at [console.anthropic.com](https://console.anthropic.com).

**Gemini:**
```bash
export GEMINI_API_KEY=AIza...
```
Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

You only need to set the key for the provider you intend to use.

---

## Usage

```bash
# Anthropic (default)
node src/main.js .
node src/main.js . --provider anthropic

# Gemini
node src/main.js . --provider gemini
node src/main.js . --provider gemini --model gemini-1.5-flash   # faster/cheaper

# Custom goal
node src/main.js ./src --provider anthropic --goal "Find all TODO comments and console.log calls"
node src/main.js ./src --provider gemini    --goal "Check for hardcoded API keys and large files"

# Analyze a log directory
node src/main.js /var/log --provider gemini --goal "Find ERROR entries and check disk usage"

# Dry run — see what commands would be called without executing them
node src/main.js . --dry-run
node src/main.js . --provider gemini --dry-run

# Limit API calls (useful on free tier plans)
node src/main.js . --max-iterations 3
node src/main.js . --provider gemini --model gemini-2.5-flash --max-iterations 2

# Save the report to a file
node src/main.js . --output report.txt
node src/main.js ./sample-project --provider gemini --model gemini-2.5-flash --max-iterations 3 --output report.txt

# Help
node src/main.js --help
```

---

## Default Models

| Provider  | Default Model              | Notes                              |
|-----------|----------------------------|------------------------------------|
| Anthropic | `claude-sonnet-4-20250514` | Override with `--model <name>`     |
| Gemini    | `gemini-1.5-pro`           | Use `gemini-1.5-flash` for speed   |

---

## API Call Limit

The agent defaults to a maximum of **5 iterations** (API calls) per run. The model is prompted to batch multiple tool calls per turn, so 5 iterations is usually enough for a thorough analysis.

Use `--max-iterations` to adjust:

```bash
node src/main.js . --max-iterations 3   # fewer calls, faster and cheaper
node src/main.js . --max-iterations 10  # more thorough analysis
```

Use `--output` to save the report to a file:

```bash
node src/main.js . --output report.txt
```

---

## Sample Output

```
════════════════════════════════════════════════════════════════
║ AGENT START — Gemini (gemini-1.5-pro)                      ║
════════════════════════════════════════════════════════════════

[10:23:01] ℹ Goal: Perform a comprehensive codebase health check...
[10:23:01] ℹ Target: /Users/dev/my-project
────────────────────────────────────────────────────────────────

[10:23:02] ▶ Iteration 1/5

[10:23:03] 🧠 AI Reasoning:
   I'll start by mapping the overall project structure.

[10:23:03] 🔧 Tool Call: find_files
   Input: { "path": ".", "type": "f", "max_depth": 3 }

[10:23:03] 📤 Result from find_files:
   ./src/index.js
   ./src/utils/helpers.js
   ./package.json
   ...

... [agent continues iterating] ...

════════════════════════════════════════════════════════════════
║ FINAL HEALTH REPORT                                        ║
════════════════════════════════════════════════════════════════

## Codebase Health Report

**Issues Found**
🔴 High — Possible hardcoded secret in config/dev.js:14
🟡 Medium — 12 TODO/FIXME comments across 6 files
🟡 Medium — 23 console.log statements in production code

**Recommendations**
1. Audit config/dev.js immediately for hardcoded credentials
2. Add console.log to your ESLint rules
3. Address memory leak TODO in src/index.js

Health Score: 6/10
──────────────────────────────────────────────────────────────
Completed in 7 iteration(s)
Token usage: 18,240 in / 980 out (~$0.0418)
──────────────────────────────────────────────────────────────
```

---

## Security

All command inputs are validated before execution regardless of which provider is used:

- **No shell interpolation** — commands run via `execFile`, never through a shell
- **Path allowlist** — only safe characters permitted in paths
- **Pattern limits** — grep patterns are length-capped and null-byte checked
- **Glob validation** — `--include` patterns are restricted to safe characters
- **Timeouts** — each command capped at 15 seconds
- **Output limits** — output truncated at 50KB per command

---

## Adding a New Provider

1. Create `src/providers/myprovider.js` implementing the four interface methods:
   - `async complete(systemPrompt, messages)` → `{ text, toolCalls, usage, rawAssistantContent }`
   - `buildUserMessage(text)` → native message object
   - `buildAssistantMessage(normalizedResponse)` → native message object
   - `buildToolResultMessage(results)` → native message object
2. Register it in `src/providers/index.js`
3. Add environment variable validation in `src/main.js`

---

## License

MIT