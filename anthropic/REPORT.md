# Unix AI Agent — Project Report

**Project:** Unix AI Agent — Codebase Health Checker  
**Version:** 2.0.0  
**Date:** February 2026  
**Technology:** Node.js (ESM), Anthropic Claude API, Google Gemini API

---

## Table of Contents

1. [Project Brief](#1-project-brief)
2. [Requirements Analysis](#2-requirements-analysis)
3. [Architecture & Design Decisions](#3-architecture--design-decisions)
4. [Implementation](#4-implementation)
5. [Debugging & Issue Resolution](#5-debugging--issue-resolution)
6. [Iterative Improvements](#6-iterative-improvements)
7. [Final Project Structure](#7-final-project-structure)
8. [CLI Reference](#8-cli-reference)
9. [Lessons Learned](#9-lessons-learned)

---

## 1. Project Brief

The original brief requested a Node.js project demonstrating how Unix commands can be used as AI agents. The initial specification was deliberately open-ended:

> *"Create a project that demonstrates how how Unix commands can be used as AI agents. The project should have real-world use and be of medium complexity. The project should be written using nodejs."*

Before development began, the brief was expanded and formalised into a comprehensive specification covering architecture, technical requirements, scope, and stretch goals. The key additions to the brief were:

- A defined **ReAct (Reason → Act → Observe)** loop pattern as the agent architecture
- Explicit use of **LLM function calling / tool use** to select and parameterise Unix commands
- A **security requirement** to sanitize and validate all command inputs before execution
- A minimum of **5–8 distinct Unix command tools**
- A **project structure** spanning at least 3–5 files with clean separation of concerns
- **Stretch goals**: natural language CLI goal input, dry-run mode, and token usage tracking

The chosen use case was a **Codebase Health Checker** — an agent that analyses a directory, identifies code quality issues (TODOs, hardcoded secrets, console.log statements, large files), and produces a structured health report with a score out of 10. This use case was selected because it maps naturally to Unix tooling and has genuine real-world value for any development team.

---

## 2. Requirements Analysis

### Functional Requirements

| Requirement | Description | Status |
|---|---|---|
| ReAct loop | Iterative Reason → Act → Observe agent pattern | Implemented |
| Tool calling | LLM selects and parameterises Unix commands via function calling | Implemented |
| Unix tools | At least 5–8 distinct commands exposed as tools | Implemented (8 tools) |
| Input sanitization | Shell injection prevention on all command inputs | Implemented |
| Visible reasoning | Each step of the agent loop logged to console | Implemented |
| Error handling | Graceful handling of non-zero exit codes, timeouts, permission errors | Implemented |
| Multi-provider support | Both Anthropic Claude and Google Gemini as LLM backends | Implemented |
| CLI goal input | Natural language goal via `--goal` flag | Implemented |
| Dry-run mode | Simulate commands without executing | Implemented |
| Token usage tracking | Cost and token count per run | Implemented |
| Output to file | Save health report to a file via `--output` flag | Implemented |
| API call limiting | `--max-iterations` flag to cap the number of API calls | Implemented |

### Non-Functional Requirements

- **Security:** No shell interpolation; all commands run via `execFile`, not `sh -c`
- **Portability:** Runs on any Unix-based system (macOS, Linux)
- **Extensibility:** Adding a new provider or tool requires minimal changes
- **Observability:** Full reasoning trace printed to the terminal in real time

---

## 3. Architecture & Design Decisions

### 3.1 The ReAct Loop

The core of the project is a ReAct (Reason, Act, Observe) loop, a well-established pattern for agentic AI systems. In each iteration:

1. **Reason** — The LLM receives the conversation history (including all previous tool results) and decides what to do next, expressed as one or more tool calls.
2. **Act** — The Node.js runtime intercepts the tool calls and executes the corresponding sanitized Unix commands via `child_process.execFile`.
3. **Observe** — The stdout/stderr output from the commands is fed back to the LLM as tool results, giving it the information it needs to decide the next step.

The loop terminates when either:
- The model calls the special `summarize_report` tool, signalling it has gathered enough information
- The maximum iteration limit is reached, at which point a final forced-summary API call is made

### 3.2 Provider Abstraction Layer

The most significant architectural decision was introducing a **provider abstraction layer** when Gemini support was added. Rather than branching the agent logic on provider type, all API differences are encapsulated inside provider classes that implement a common interface:

```
provider.complete(systemPrompt, messages)     → NormalizedResponse
provider.buildUserMessage(text)               → native message object
provider.buildAssistantMessage(response)      → native message object
provider.buildToolResultMessage(results)      → native message object
```

This means `agent.js` has zero knowledge of whether it is talking to Anthropic or Gemini — it simply calls methods on whatever provider object it receives. The key differences handled inside the provider classes are:

- **Message roles:** Anthropic uses `"assistant"`, Gemini uses `"model"`
- **Tool schemas:** Anthropic uses `input_schema`, Gemini uses `parameters` (the Gemini provider converts the shared tool definitions at runtime)
- **Tool results:** Anthropic uses `tool_result` content blocks; Gemini uses `functionResponse` parts
- **Session management:** Gemini uses a stateful `ChatSession`; Anthropic rebuilds from the full message array on each call

### 3.3 Security Model

All user-supplied values (paths, patterns, globs) pass through strict validation before being used in command arguments. The key security properties are:

- **No shell** — `execFile` is used instead of `exec` or `spawn` with `shell: true`. This means no shell metacharacters (`;`, `|`, `` ` ``, `$()`) are ever interpreted.
- **Path allowlist** — Paths are restricted to alphanumeric characters, spaces, dashes, underscores, dots, slashes, `@`, and `~`. Any other character causes the command to be rejected.
- **Pattern limits** — Grep patterns are capped at 200 characters and checked for null bytes.
- **Glob validation** — `--include` patterns are restricted to characters safe in filenames.
- **Output truncation** — Command output is capped at 50KB to prevent memory exhaustion.
- **Timeouts** — Each command is limited to 15 seconds.

### 3.4 Tool Design

Eight tools were defined, each mapping to a Unix command or in-memory operation:

| Tool | Command | Purpose |
|---|---|---|
| `find_files` | `find` | Locate files by name pattern, extension, or type |
| `count_lines` | `wc` | Measure lines, words, or bytes in files |
| `search_pattern` | `grep` | Search for text patterns recursively |
| `disk_usage` | `du` | Identify large files or directories |
| `list_directory` | `ls` | Inspect directory contents |
| `read_file_head` | `head` | Preview file contents |
| `sort_and_unique` | *(in-memory)* | Sort and deduplicate output for aggregation |
| `summarize_report` | *(terminal)* | Signal completion and deliver the final report |

`summarize_report` is a sentinel tool — it does not execute a Unix command but instead terminates the agent loop and captures the model's structured findings, including a numeric health score.

---

## 4. Implementation

### 4.1 File Structure

The project is structured across 7 source files with clear separation of concerns:

```
unix-ai-agent/
├── src/
│   ├── main.js               CLI entry point, argument parsing, env validation
│   ├── agent.js              ReAct loop, conversation management
│   ├── executor.js           Tool dispatch, command execution, input sanitization
│   ├── tools.js              Anthropic-format tool definitions (schemas)
│   ├── logger.js             Coloured, structured console output
│   └── providers/
│       ├── index.js          Factory: createProvider("anthropic" | "gemini")
│       ├── anthropic.js      Anthropic SDK wrapper
│       └── gemini.js         Google Generative AI SDK wrapper
├── sample-project/
│   ├── auth.js               Sample file with hardcoded secrets, MD5 hashing
│   ├── api.js                Sample file with console.logs and dead code
│   └── dataProcessor.js      Sample file with TODOs and performance issues
├── package.json
├── .env.example
└── README.md
```

### 4.2 Sample Project

Three sample files were created to serve as realistic test targets for the agent. Each file was deliberately seeded with the kinds of issues the agent is designed to find:

- **`auth.js`** — Hardcoded JWT secret, API key, and DB password; MD5 password hashing (weak); session tokens logged to console; missing rate limiting
- **`api.js`** — Excessive `console.log` statements leaking tokens; dead code (`debugDumpSessions`); unvalidated user input; hardcoded placeholder data
- **`dataProcessor.js`** — Hardcoded database connection string with credentials; `Math.max(...largeArray)` stack overflow risk; ignored function parameters; missing pagination

### 4.3 Dependencies

| Package | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Anthropic Claude API client |
| `@google/generative-ai` | Google Gemini API client |
| `dotenv` | Load environment variables from `.env` file |

All three are runtime dependencies. There are no build tools, bundlers, or transpilers — the project runs directly with Node.js using native ESM (`"type": "module"`).

---

## 5. Debugging & Issue Resolution

The following issues were encountered and resolved during development and testing.

### Issue 1 — Missing `ANTHROPIC_API_KEY` error when using Gemini

**Symptom:**
```
Error: ANTHROPIC_API_KEY environment variable is not set.
```
The error appeared even when running with `--provider gemini`, because the default provider was hardcoded to `"anthropic"` and the key check fired before the provider flag was read.

**Root cause:** `main.js` set `provider: "anthropic"` as the default in the parsed args object, meaning the Anthropic key check ran unconditionally.

**Fix:** Replaced the hardcoded default with an auto-detection function that inspects available environment variables:

```js
function detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return null;
}
```

The explicit `--provider` flag takes precedence; if omitted, the provider is inferred from whichever key is present in the environment.

---

### Issue 2 — `Cannot find package '@anthropic-ai/sdk'` when using Gemini

**Symptom:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@anthropic-ai/sdk'
imported from .../src/providers/anthropic.js
```
The error occurred even when `--provider gemini` was specified, because the Anthropic provider was eagerly imported at the top of `providers/index.js`.

**Root cause:** Static `import` statements at the module level are resolved before any runtime logic executes. Even though the Anthropic provider was never used, its import was attempted — and failed because `@anthropic-ai/sdk` was not installed.

**Fix:** Switched from static imports to dynamic `await import()` inside the provider factory, so each provider's SDK is only loaded when that provider is actually requested:

```js
const PROVIDERS = {
  anthropic: async (opts) => {
    const { AnthropicProvider } = await import("./anthropic.js");
    return new AnthropicProvider(opts);
  },
  gemini: async (opts) => {
    const { GeminiProvider } = await import("./gemini.js");
    return new GeminiProvider(opts);
  },
};
```

This also required marking `createProvider` as `async` and awaiting it at the call site in `main.js`.

---

### Issue 3 — `provider.buildUserMessage is not a function`

**Symptom:**
```
Unexpected error: provider.buildUserMessage is not a function
```

**Root cause:** A direct consequence of Issue 2's fix — `createProvider` was made `async` to support dynamic imports, but the call site in `main.js` was not updated to `await` it. As a result, `provider` held a pending `Promise` object rather than the resolved provider instance, so none of its methods existed.

**Fix:** Added `await` to the `createProvider` call in `main.js`:

```js
provider = await createProvider(providerName, providerOpts);
```

---

### Issue 4 — `.env` file not loaded; API key not recognised

**Symptom:**
```
Error: Set one of these environment variables for the "gemini" provider:
  export GEMINI_API_KEY=...
```
The error persisted even after setting the key in a `.env` file.

**Root cause:** Node.js does not automatically load `.env` files. Environment variables must either be exported in the shell or loaded programmatically using a library such as `dotenv`.

**Fix:** Added `dotenv` to the project dependencies and added a single import at the very top of `main.js` — before any other code runs — so the `.env` file is loaded before any API key checks are performed:

```js
import "dotenv/config";
```

---

### Issue 5 — Agent returned "Analysis incomplete" when iteration limit was reached

**Symptom:** When `--max-iterations` was set to a low value (e.g. `3`), the agent would hit the limit and return the message `"Analysis incomplete — max iterations reached."` instead of producing a health report.

**Root cause:** The original loop simply set a fallback string when `MAX_ITERATIONS` was reached, with no attempt to produce a summary from the data already gathered.

**Fix:** When the iteration limit is hit, the agent now makes one final API call with the full conversation history, explicitly instructing the model to call `summarize_report` with whatever it has found so far:

```js
messages.push(provider.buildUserMessage(
  "You have reached the maximum number of iterations. " +
  "Based on everything you have found so far, please call summarize_report now " +
  "with your best assessment. It is okay if the analysis is not fully complete."
));
const final = await provider.complete(SYSTEM_PROMPT, messages);
```

This guarantees a structured health report is always produced, regardless of how many iterations were permitted.

---

## 6. Iterative Improvements

Beyond bug fixes, several enhancements were made in response to real-world usage feedback.

### 6.1 Gemini Provider Support

The initial version only supported Anthropic. Gemini support was added by introducing a provider abstraction layer (described in Section 3.2). The tool definitions in `tools.js` are stored in Anthropic format and converted to Gemini's `functionDeclarations` format at runtime inside the Gemini provider.

### 6.2 API Call Reduction

Users on free-tier plans reported running out of API calls quickly. Two changes were made:

**Default iteration limit reduced from 15 to 5.** Each iteration is one API call. Lowering the default significantly reduces usage without meaningfully impacting report quality, because the second change ensures each iteration does more work.

**System prompt updated to encourage batching.** The model is now explicitly instructed to call multiple tools in a single turn rather than waiting for each result before deciding on the next one:

> *"IMPORTANT: To be efficient, call MULTIPLE tools at once whenever possible. For example, in a single turn you can call find_files, count_lines, and search_pattern simultaneously."*

This means a 5-iteration run can produce results equivalent to a 10–15 iteration run under the original prompt.

### 6.3 `--max-iterations` CLI Flag

A `--max-iterations` flag was added to give users explicit control over the API call budget per run:

```bash
node src/main.js . --max-iterations 3   # conservative — fewer calls
node src/main.js . --max-iterations 10  # thorough — more calls
```

### 6.4 `--output` Flag for Report Saving

Users who wanted to save the health report to a file previously had to redirect stdout, which also captured the full agent trace. A dedicated `--output` flag was added that writes only the final report (with a metadata header) to the specified file, while the full trace continues to print to the terminal:

```bash
node src/main.js . --output report.txt
```

The saved file includes a header with the health score, date, provider, and target directory.

### 6.5 Auto-detection of Provider from Environment

The provider selection was made smarter — if `--provider` is not specified, the application inspects the environment and selects the appropriate provider automatically based on which API key is present. If both keys are set, Anthropic takes precedence.

---

## 7. Final Project Structure

```
unix-ai-agent/
├── src/
│   ├── main.js
│   ├── agent.js
│   ├── executor.js
│   ├── tools.js
│   ├── logger.js
│   └── providers/
│       ├── index.js
│       ├── anthropic.js
│       └── gemini.js
├── sample-project/
│   ├── auth.js
│   ├── api.js
│   └── dataProcessor.js
├── package.json
├── .env.example
└── README.md
```

---

## 8. CLI Reference

```
USAGE:
  node src/main.js [target-path] [options]

ARGUMENTS:
  target-path           Directory to analyse (default: ".")

OPTIONS:
  --provider, -p        LLM provider: anthropic | gemini
                        Auto-detected from environment if not specified
  --model               Override the default model
                        Anthropic default: claude-sonnet-4-20250514
                        Gemini default:    gemini-1.5-pro
  --goal, -g            Natural language goal for the analysis
  --max-iterations      Maximum number of API calls (default: 5)
  --output, -o          Save the final report to a file
  --dry-run             Simulate without executing commands
  --help, -h            Show help

ENVIRONMENT VARIABLES:
  ANTHROPIC_API_KEY     Required when using --provider anthropic
  GEMINI_API_KEY        Required when using --provider gemini
  GOOGLE_API_KEY        Alternative name for Gemini key
  DEBUG                 Set to any value to enable verbose error output

EXAMPLES:
  node src/main.js .
  node src/main.js . --provider gemini --model gemini-2.5-flash
  node src/main.js ./sample-project --provider gemini --model gemini-2.5-flash --max-iterations 3
  node src/main.js . --goal "Find hardcoded secrets and TODO comments" --output report.txt
  node src/main.js . --dry-run
```

---

## 9. Lessons Learned

### Static imports are always resolved, regardless of runtime conditions

The most instructive debugging session in this project was Issue 2. Static `import` statements in ESM are hoisted and resolved at module load time — before any runtime code runs. This means that even an import inside a conditional branch (or, in this case, inside a factory that is only called for one provider) will cause a module resolution failure if the package is not installed. Dynamic `await import()` is the correct solution when a dependency should only be loaded on demand.

### Async changes must be propagated to all call sites

Issue 3 was a direct consequence of Issue 2 — making a function async without updating its call sites is a common and subtle mistake. The function returned a Promise which was used as if it were the resolved value, causing all method calls on it to fail silently as `undefined` rather than throwing immediately.

### Environment variable loading must happen before all other code

`dotenv` must be imported as the very first statement in the application entry point. Any code that runs before `dotenv/config` is imported — including module-level constants, default values, or validation checks — will see the environment without the `.env` values.

### Graceful degradation is better than hard failure

The original behaviour of returning `"Analysis incomplete"` when the iteration limit was reached was technically correct but unhelpful. The improvement — making one final summarisation call — demonstrates that a small amount of additional complexity at a boundary condition can substantially improve the user experience. The agent always produces a useful output regardless of how aggressively the iteration limit is set.

### Provider abstraction pays for itself immediately

The decision to build a clean provider interface from the start (rather than branching on provider name throughout the codebase) made the Gemini addition straightforward. All Gemini-specific logic — message format conversion, session management, schema translation — is contained entirely within `providers/gemini.js`. No other file needed to change to accommodate a new LLM provider.

---

*End of Report*