Create a Node.js project that demonstrates how Unix commands can be orchestrated as AI agents within an agentic pipeline. The project should simulate a real-world scenario where an AI reasons about a task and delegates work to Unix tools, capturing and interpreting their output to make further decisions.
Project Requirements:
Concept & Use Case The project should solve a practical, real-world problem — such as an AI-powered log analyzer, a file system auditor, a codebase health checker, or a system monitoring agent. The use case should feel natural for Unix tooling (e.g., grep, awk, find, curl, ps, df, wc, sort, uniq, etc.) rather than forcing Unix commands into an unrelated context.
Architecture The agent should follow a reason → act → observe loop (ReAct pattern):
* Reason: The AI receives a high-level goal and decides which Unix command to run next
* Act: The Node.js runtime executes the chosen command using child_process (exec, spawn, or execFile)
* Observe: The agent receives stdout/stderr and uses the output to decide its next action
* The loop should continue until the agent determines the goal is complete or hits a max iteration limit
Technical Requirements
* Written in Node.js (ESM or CommonJS, your choice, but be consistent)
* Use an LLM API (e.g., Anthropic, OpenAI) with tool/function calling to let the AI select and parameterize Unix commands
* Define a controlled set of allowed Unix commands as tools — include at least 5–8 distinct commands
* Sanitize and validate all command inputs before execution to prevent shell injection
* Stream or log each step of the agent loop to the console so the reasoning process is visible
* Handle errors gracefully (e.g., non-zero exit codes, timeouts, permission errors)
Scope & Complexity
* The project should be of medium complexity: more than a single-turn script, but not a full production application
* It should span at least 3–5 files with a clean separation of concerns (e.g., agent logic, tool definitions, command executor, main entry point)
* Include a README explaining the use case, setup steps, and an example run with sample output
Stretch Goals (optional but encouraged)
* Allow the user to provide a natural language goal via CLI argument
* Add a dry-run mode that shows what commands would be run without executing them
* Include a simple cost or token usage tracker per agent run
* It should support multiple AI models: gemini, anthropic, openai, grok etc.