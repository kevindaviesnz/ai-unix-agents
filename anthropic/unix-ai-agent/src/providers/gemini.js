/**
 * providers/gemini.js
 *
 * Google Gemini provider.
 * Implements the same common provider interface as the Anthropic provider,
 * translating Gemini's native API format to/from the normalized format
 * the agent loop expects.
 *
 * Key differences handled here:
 *  - Gemini uses "model" role (not "assistant")
 *  - Gemini function declarations use "parameters" (not "input_schema")
 *  - Gemini tool results are "functionResponse" parts inside a "user" message
 *  - Gemini wraps function declarations inside a "tools" array of objects
 *  - Gemini does not use per-call IDs; we generate synthetic ones
 *  - Gemini system instructions are passed separately, not in the history
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { TOOL_DEFINITIONS } from "../tools.js";

// ---------------------------------------------------------------------------
// Convert Anthropic-style tool definitions → Gemini function declarations
// ---------------------------------------------------------------------------

function toGeminiFunctionDeclarations() {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertSchema(tool.input_schema),
  }));
}

/**
 * Recursively converts an Anthropic JSON Schema object to a Gemini-compatible
 * schema. The main difference is that Gemini doesn't support "null" type unions
 * and requires "type" to be uppercase strings in some SDK versions — we keep
 * lowercase since the newer SDK accepts it.
 */
function convertSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;

  const converted = {};

  for (const [key, value] of Object.entries(schema)) {
    // Gemini uses "properties" and "items" the same way as JSON Schema
    if (key === "properties" && typeof value === "object") {
      converted.properties = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, convertSchema(v)])
      );
    } else if (key === "items") {
      converted.items = convertSchema(value);
    } else if (key === "enum") {
      // Gemini supports enum inside string type
      converted.enum = value;
    } else if (key === "required") {
      converted.required = value;
    } else if (key === "type") {
      // Gemini wants lowercase type strings (already our format)
      converted.type = value;
    } else if (key === "description") {
      converted.description = value;
    }
    // Skip "additionalProperties" and other non-Gemini keys
  }

  return converted;
}

// ---------------------------------------------------------------------------
// Convert Gemini native history → provider-neutral history and back
// ---------------------------------------------------------------------------

/**
 * Gemini uses its own internal history managed by the Chat session.
 * We manage history ourselves (parallel to Gemini's) so we can rebuild
 * the chat with full context on each call if needed, and also to match
 * the interface pattern used by the Anthropic provider.
 */

let callIdCounter = 0;
function generateId() {
  return `gemini_call_${++callIdCounter}`;
}

// ---------------------------------------------------------------------------
// Provider class
// ---------------------------------------------------------------------------

export class GeminiProvider {
  #client;
  #model;
  #chat;       // Gemini ChatSession — stateful, holds history internally
  #started;    // Whether we've sent the first message

  constructor({ model = "gemini-1.5-pro" } = {}) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable is not set."
      );
    }
    this.#client = new GoogleGenerativeAI(apiKey);
    this.#model = model;
    this.#started = false;
    this.name = "Gemini";
    this.displayModel = model;
  }

  /**
   * Initializes (or re-uses) the Gemini chat session with the system prompt.
   * Gemini's chat session is stateful — it maintains history internally.
   */
  #initChat(systemPrompt) {
    if (this.#chat) return; // Already initialized

    const genModel = this.#client.getGenerativeModel({
      model: this.#model,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toGeminiFunctionDeclarations() }],
      generationConfig: {
        maxOutputTokens: 4096,
      },
    });

    this.#chat = genModel.startChat({ history: [] });
  }

  /**
   * Sends a message (or tool results) to Gemini and returns a normalized response.
   *
   * On the first call, `messages` should contain just the user message as a string.
   * On subsequent calls (tool results), `messages` is an array of tool result parts.
   *
   * @param {string} systemPrompt
   * @param {Array}  messages  - Provider-native messages array (we use only the last entry)
   * @returns {Promise<NormalizedResponse>}
   */
  async complete(systemPrompt, messages) {
    this.#initChat(systemPrompt);

    // The last message in the array is the new input to send
    const lastMessage = messages[messages.length - 1];

    let result;

    if (!this.#started) {
      // First call — send as a plain text string
      this.#started = true;
      result = await this.#chat.sendMessage(lastMessage.content);
    } else {
      // Subsequent calls — send tool function responses
      result = await this.#chat.sendMessage(lastMessage.content);
    }

    const response = result.response;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    // Extract text and function calls from parts
    let text = "";
    const toolCalls = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: generateId(),
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
        });
      }
    }

    // Gemini doesn't always expose token counts — use metadata if available
    const usageMeta = response.usageMetadata ?? {};
    const usage = {
      input_tokens: usageMeta.promptTokenCount ?? 0,
      output_tokens: usageMeta.candidatesTokenCount ?? 0,
    };

    return {
      text: text.trim(),
      toolCalls,
      usage,
      rawAssistantContent: parts, // Native Gemini parts
    };
  }

  /**
   * Builds an assistant history entry (not used directly by Gemini's stateful
   * chat, but kept for interface compatibility).
   */
  buildAssistantMessage(normalizedResponse) {
    return {
      role: "model",
      content: normalizedResponse.rawAssistantContent,
    };
  }

  /**
   * Builds a tool-results message in Gemini's native format.
   * Gemini expects functionResponse parts inside a user role message.
   *
   * @param {Array<{ id: string, name: string, result: string }>} results
   */
  buildToolResultMessage(results) {
    return {
      role: "user",
      content: results.map(({ name, result }) => ({
        functionResponse: {
          name,
          response: { result: String(result) },
        },
      })),
    };
  }

  /**
   * Builds the initial user message in Gemini-compatible format.
   */
  buildUserMessage(text) {
    return { role: "user", content: text };
  }
}
