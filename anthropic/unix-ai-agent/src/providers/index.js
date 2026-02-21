/**
 * providers/index.js
 *
 * Factory that instantiates the correct provider by name.
 * Adding a new provider only requires:
 *   1. Creating src/providers/<name>.js implementing the common interface
 *   2. Adding it to the PROVIDERS map below
 */

const PROVIDERS = {
  anthropic: async (opts) => { const { AnthropicProvider } = await import("./anthropic.js"); return new AnthropicProvider(opts); },
  gemini:    async (opts) => { const { GeminiProvider }    = await import("./gemini.js");    return new GeminiProvider(opts); },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/**
 * Creates and returns a provider instance.
 *
 * @param {string} name  - "anthropic" or "gemini"
 * @param {object} opts  - Optional provider-specific options (e.g. { model: "..." })
 * @returns {AnthropicProvider | GeminiProvider}
 */
export async function createProvider(name, opts = {}) {
  const factory = PROVIDERS[name?.toLowerCase()];
  if (!factory) {
    throw new Error(
      `Unknown provider "${name}". Available providers: ${PROVIDER_NAMES.join(", ")}`
    );
  }
  return factory(opts);
}
