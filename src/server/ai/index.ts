import "server-only";
import { completeOpenAI } from "./providers/openai";
import { completeGemini } from "./providers/gemini";
import { aiError } from "./fetch";
import {
  FALLBACK_CHAIN,
  PROVIDERS,
  resolveModel,
  type ChatMessage,
  type ProviderId,
  type ToolSpec,
} from "./registry";

export type GenerationMode = "chat" | "plan" | "agent";

export interface EngineRequest {
  mode: GenerationMode;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  provider?: ProviderId;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** System prompt is prepended when using OpenAI-compatible providers. */
  system?: string;
}

/**
 * Resolve a provider and execute a completion. Falls back across PROVIDERS in
 * FALLBACK_CHAIN when a provider errors. Returns the completion and the
 * provider actually used (for logging/metrics).
 */
export async function generate(req: EngineRequest) {
  const chain = req.provider ? [req.provider] : FALLBACK_CHAIN;
  let lastError: Error | null = null;

  for (const providerId of chain) {
    const spec = PROVIDERS[providerId];
    const key = process.env[spec.envKey];
    if (!key?.trim()) {
      lastError = new Error(`No API key for ${providerId}`);
      continue;
    }

    try {
      const resolved = resolveModel(providerId, req.model);
      const opts = {
        baseUrl: resolved.provider.baseUrl ?? "",
        apiKey: resolved.key,
        model: resolved.model,
        messages: req.system
          ? [{ role: "system" as const, content: req.system }, ...req.messages]
          : req.messages,
        tools: req.tools,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
      };

      const completion =
        spec.kind === "gemini"
          ? await completeGemini(opts)
          : await completeOpenAI(opts);

      return { ...completion, provider: providerId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw aiError(
    "provider",
    `All providers in ${chain.join(", ")} failed. Last error: ${lastError?.message}`
  );
}
