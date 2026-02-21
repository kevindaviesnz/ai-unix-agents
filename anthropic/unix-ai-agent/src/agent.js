/**
 * agent.js
 *
 * Provider-agnostic ReAct (Reason → Act → Observe) agent loop.
 *
 * The agent receives a provider instance that conforms to the common interface:
 *   provider.complete(systemPrompt, messages) → NormalizedResponse
 *   provider.buildUserMessage(text)           → native message object
 *   provider.buildAssistantMessage(response)  → native message object
 *   provider.buildToolResultMessage(results)  → native message object
 *
 * This file has zero knowledge of Anthropic or Gemini — all API differences
 * are encapsulated inside the provider classes.
 */

import { executeTool } from "./executor.js";
import { logger }      from "./logger.js";

const MAX_ITERATIONS_DEFAULT = 5;

const SYSTEM_PROMPT = `You are an expert Unix systems engineer and code quality analyst.
Your job is to analyze a codebase or directory by running Unix commands as tools.
You will be given a high-level goal, and you should methodically investigate by:
  - Using find_files to understand the project structure and scope
  - Using count_lines to measure code volume
  - Using search_pattern to find issues like TODOs, deprecated calls, console.logs, hardcoded secrets, etc.
  - Using disk_usage to find bloated directories or unexpectedly large files
  - Using list_directory and read_file_head to inspect specific areas of interest
  - Using sort_and_unique to summarize and aggregate repetitive results

IMPORTANT: To be efficient, call MULTIPLE tools at once whenever possible. For example, in a
single turn you can call find_files, count_lines, and search_pattern simultaneously — don't
wait for one result before deciding to call another if you can reasonably predict you'll need it.

Be thorough but efficient. Don't repeat the same command twice.
When you have a clear picture of the codebase health, call summarize_report with your findings.
Always provide a health_score from 1 (critical issues) to 10 (excellent).

Think step by step. After each round of tool results, reason about what to investigate next.`;

/**
 * Runs the full agent loop for a given goal using the supplied provider.
 *
 * @param {string} goal         - Natural language goal
 * @param {string} targetPath   - Root directory to analyze
 * @param {object} provider     - Provider instance (Anthropic or Gemini)
 * @param {object} options
 * @param {boolean} options.dryRun
 * @returns {Promise<{ report, healthScore, usage, iterations }>}
 */
export async function runAgent(goal, targetPath, provider, options = {}) {
  const { dryRun = false, maxIterations = MAX_ITERATIONS_DEFAULT } = options;

  const totalUsage = { input_tokens: 0, output_tokens: 0 };

  // Build initial message — provider normalizes its own format
  const initialText =
    `Goal: ${goal}\n\nTarget directory: ${targetPath}\n\nBegin your analysis now.`;

  const messages = [provider.buildUserMessage(initialText)];

  logger.header(`AGENT START — ${provider.name} (${provider.displayModel})`);
  logger.info(`Goal: ${goal}`);
  logger.info(`Target: ${targetPath}`);
  if (dryRun) logger.warn("DRY RUN MODE — commands will not be executed.");
  logger.separator();

  let iteration    = 0;
  let finalReport  = null;
  let healthScore  = null;

  while (iteration < maxIterations) {
    iteration++;
    logger.step(`Iteration ${iteration}/${maxIterations}`);

    // ── REASON: Ask the provider what to do next ───────────────────────────
    let normalized;
    try {
      normalized = await provider.complete(SYSTEM_PROMPT, messages);
    } catch (err) {
      throw new Error(`Provider API error: ${err.message}`);
    }

    // Accumulate token usage
    totalUsage.input_tokens  += normalized.usage.input_tokens;
    totalUsage.output_tokens += normalized.usage.output_tokens;

    // Log the model's reasoning text
    if (normalized.text) {
      logger.thinking(normalized.text);
    }

    // No tool calls → model decided it's done (or got confused)
    if (normalized.toolCalls.length === 0) {
      logger.warn("No tool calls returned — ending loop.");
      break;
    }

    // Append assistant turn in provider-native format
    messages.push(provider.buildAssistantMessage(normalized));

    // ── ACT + OBSERVE: Execute each tool call ──────────────────────────────
    const toolResults = [];
    let reportFound  = false;

    for (const toolCall of normalized.toolCalls) {
      const { id, name, input } = toolCall;
      logger.toolCall(name, input);

      // Terminal tool — agent signals it's done
      if (name === "summarize_report") {
        finalReport = input.summary;
        healthScore = input.health_score;
        logger.toolResult(name, `[Report generated — health score: ${healthScore}/10]`);
        toolResults.push({ id, name, result: "Report accepted. Analysis complete." });
        reportFound = true;
        break;
      }

      // Execute the Unix command
      let result;
      try {
        result = await executeTool(name, input, dryRun);
      } catch (err) {
        result = `Tool execution error: ${err.message}`;
      }

      logger.toolResult(name, result);
      toolResults.push({ id, name, result });
    }

    // Append tool results in provider-native format
    messages.push(provider.buildToolResultMessage(toolResults));

    if (reportFound) break;
  }

  if (iteration >= maxIterations && !finalReport) {
    logger.warn(`Max iterations (${maxIterations}) reached — requesting summary of findings so far.`);

    messages.push(provider.buildUserMessage(
      "You have reached the maximum number of iterations. " +
      "Based on everything you have found so far, please call summarize_report now with your best assessment. " +
      "It is okay if the analysis is not fully complete — summarize what you know."
    ));

    try {
      const final = await provider.complete(SYSTEM_PROMPT, messages);
      totalUsage.input_tokens  += final.usage.input_tokens;
      totalUsage.output_tokens += final.usage.output_tokens;

      const reportCall = final.toolCalls.find((t) => t.name === "summarize_report");
      if (reportCall) {
        finalReport = reportCall.input.summary;
        healthScore = reportCall.input.health_score;
      } else if (final.text) {
        finalReport = final.text;
      }
    } catch (err) {
      logger.warn(`Failed to get final summary: ${err.message}`);
    }
  }

  if (!finalReport) {
    finalReport = "Analysis incomplete — no summary could be generated.";
  }

  return {
    report:     finalReport,
    healthScore,
    usage:      totalUsage,
    iterations: iteration,
  };
}