/**
 * AI provider abstraction — provider/model/mode registry, normalized errors,
 * and the fallback chain. Server-only: never imported by client code.
 */

export type ProviderId = "deepseek" | "nvidia" | "gemini";
export type GenerationMode = "chat" | "agent" | "plan";

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
  supportsTools?: boolean;
}

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  envKey: string;
  baseUrl?: string;
  kind: "openai-chat" | "openai-responses" | "gemini";
  models: ModelInfo[];
  defaultModel: string;
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    kind: "openai-chat",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", label: "deepseek-chat (V3)" },
      { id: "deepseek-reasoner", label: "deepseek-reasoner (R1)" },
    ],
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA",
    envKey: "NVIDIA_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    kind: "openai-chat",
    defaultModel: "deepseek/deepseek-chat-v3-0324",
    models: [
      { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3" },
      { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B" },
      { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
  },
};

export const FALLBACK_CHAIN: ProviderId[] = ["deepseek", "nvidia", "gemini"];

export type AIErrorKind =
  | "auth"
  | "rate-limit"
  | "timeout"
  | "network"
  | "invalid"
  | "provider"
  | "unknown";

export class AIError extends Error {
  kind: AIErrorKind;
  status?: number;
  provider?: ProviderId;
  constructor(kind: AIErrorKind, message: string, opts?: { status?: number; provider?: ProviderId }) {
    super(message);
    this.kind = kind;
    this.status = opts?.status;
    this.provider = opts?.provider;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

export interface ChatRequest {
  provider: ProviderId;
  model?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; call: ToolCall }
  | { type: "end"; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: "error"; error: AIError };

export interface ResolvedModel {
  provider: ProviderSpec;
  model: string;
  key: string;
}

export function resolveModel(provider: ProviderId, model?: string): ResolvedModel {
  const spec = PROVIDERS[provider];
  const chosen = model ?? spec.defaultModel;
  const key = (process.env[spec.envKey] ?? "").trim();
  if (!key) {
    throw new AIError("auth", `Provider ${provider} has no API key configured.`, { provider });
  }
  return { provider: spec, model: chosen, key };
}
