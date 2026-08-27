import "server-only";
import { aiFetch } from "../fetch";
import type { ChatMessage, ToolSpec } from "../registry";

export interface GeminiOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
}

/** Non-streaming completion against Gemini's generateContent endpoint. */
export async function completeGemini(opts: GeminiOptions) {
  const url = `${opts.baseUrl}/models/${opts.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

  const body = {
    contents: toGeminiContents(opts.messages),
    ...(opts.tools?.length ? { tools: toGeminiTools(opts.tools) } : {}),
    generationConfig: {
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
  };

  const res = await aiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status >= 400) {
    const msg = await readError(res);
    throw new Error(`Gemini request failed (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0] ?? {};
  const parts = (candidate.content?.parts ?? []) as GeminiPart[];

  const textParts = parts.filter((p) => "text" in p) as Array<{ text: string }>;
  const text = textParts.map((p) => p.text).join("");

  const toolCalls = parts
    .filter((p): p is { functionCall: { name: string; args: unknown } } => "functionCall" in p)
    .map((p, i) => ({
      id: `gemini-${i}`,
      name: p.functionCall.name,
      arguments: (p.functionCall.args ?? {}) as Record<string, unknown>,
    }));

  return {
    text,
    toolCalls,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    },
    finish: candidate.finishReason as string | undefined,
  };
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: unknown } }
  | { functionResponse: { name: string; response: unknown } };

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => {
    // Gemini wants one functionCall/functionResponse per part, and
    // user/model roles. We map tool-result/assistant-tool-call via parts.
    if (m.role === "tool") {
      return {
        role: "function",
        parts: [{ functionResponse: { name: m.toolCallId ?? "tool", response: { content: m.content } } }],
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "model",
        parts: m.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.arguments } })),
      };
    }
    return {
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }],
    };
  });
}

function toGeminiTools(tools: ToolSpec[]) {
  return [
    {
      function_declarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

async function readError(res: Response) {
  try {
    const data = await res.json();
    return data?.error?.message ?? JSON.stringify(data).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
