README.md
Project: AI-Orchestrated Unix Command Agent
Overview
This Node.js project implements an AI agent that uses the ReAct (Reason-Act-Observe) pattern to orchestrate Unix commands for solving real-world tasks. The chosen use case is a Codebase Health Checker, where the AI analyzes a codebase for issues like large files, TODO comments, line counts, disk usage, and more. It delegates tasks to Unix tools, interprets outputs, and iterates until the goal is met.
The agent interacts with an LLM (e.g., OpenAI’s GPT-4o-mini) to reason about steps and select tools. Commands are executed safely via Node.js’s child_process, with validation to prevent security risks.
Use Case
•  Problem: Developers often need to audit codebases for health metrics (e.g., file sizes, code smells like TODOs, duplicate lines, etc.) without manual scripting.
•  How it Works: Provide a natural language goal (e.g., “Check for large files and count TODOs”). The AI breaks it down, runs commands like find, grep, du, etc., observes results, and builds a final report.
•  Why Unix Tools?: These are ideal for file system and text processing tasks, making the pipeline efficient and natural.
Architecture
•  ReAct Loop:
	•  Reason: LLM decides the next action based on the goal and prior observations.
	•  Act: Execute a selected Unix command as a tool.
	•  Observe: Capture output/error and feed back to LLM.
•  Tools: Limited to safe, predefined Unix commands (find, grep, wc, du, sort, uniq, awk, ls) exposed via LLM function calling.
•  Safety: Arguments are sanitized; no shell injection; relative paths only.
•  Loop Control: Max 10 iterations; stops on goal completion or limit.
Setup
1.  Prerequisites:
	•  Node.js v18+.
	•  OpenAI API key: Set OPENAI_API_KEY environment variable.
	•  Unix-like environment (Linux/macOS; some commands may differ on Windows).
2.  Installation:
