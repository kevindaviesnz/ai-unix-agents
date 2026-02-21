/**
 * providers/anthropic.js
 *
 * Anthropic Claude provider.
 * Implements the common provider interface used by the agent loop:
 *
 *   provider.complete(messages) → NormalizedResponse
 *
 * NormalizedResponse: {
 *   text: string,               // Model's reasoning text (may be empty)
 *   toolCalls: ToolCall[],      // Parsed tool invocations
 *   usage: { input_tokens, output_tokens },
 *   rawAssistantContent: any,   // Native format — stored in history verbatim
 * }
 *
 * ToolCall: { id: string, name: string, input: object }
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "../tools.js";

export class AnthropicProvider {
  #client;
  #model;

  constructor({ model = "claude-sonnet-4-20250514" } = {}) {
    this.#client = new Anthropic();
    this.#model = model;
    this.name = "Anthropic";
    this.displayModel = model;
  }

  /**
   * Sends a conversation to the Anthropic API and returns a normalized response.
   *
   * @param {string} systemPrompt
   * @param {Array}  messages  - Anthropic-format messages (role/content pairs)
   * @returns {Promise<NormalizedResponse>}
   */
  async complete(systemPrompt, messages) {
    const response = await this.#client.messages.create({
      model: this.#model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,  // Already in Anthropic format
      messages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    return {
      text: textBlocks.map((b) => b.text).join("\n").trim(),
      toolCalls: toolUseBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        input: b.input,
      })),
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
      rawAssistantContent: response.content, // Stored as-is in history
    };
  }

  /**
   * Builds an assistant history entry from a normalized response.
   */
  buildAssistantMessage(normalizedResponse) {
    return { role: "assistant", content: normalizedResponse.rawAssistantContent };
  }

  /**
   * Builds a tool-results history entry from an array of tool results.
   *
   * @param {Array<{ id: string, name: string, result: string }>} results
   */
  buildToolResultMessage(results) {
    return {
      role: "user",
      content: results.map(({ id, result }) => ({
        type: "tool_result",
        tool_use_id: id,
        content: String(result),
      })),
    };
  }

  /**
   * Builds the initial user message.
   */
  buildUserMessage(text) {
    return { role: "user", content: text };
  }
}
