import "server-only";
import { aiFetch } from "../fetch";
import type { ChatMessage, ToolSpec } from "../registry";

export interface OpenAIOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
}

/** Non-streaming chat completion for DeepSeek / OpenRouter / any OpenAI-compatible API. */
export async function completeOpenAI(opts: OpenAIOptions) {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages.map(normalizeForOpenAI),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.tools?.length ? { tools: opts.tools.map(toOpenAITool) } : {}),
  };

  const res = await checkedOpenAI(opts, body);
  const data = await res.json();

  const choice = data.choices?.[0] ?? {};
  const message = choice.message ?? {};
  const toolCalls = (message.tool_calls ?? []) as Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;

  return {
    text: message.content ?? "",
    toolCalls: toolCalls.map((c) => ({
      id: c.id,
      name: c.function.name,
      arguments: safeParse(c.function.arguments),
    })),
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
    finish: choice.finish_reason as string | undefined,
  };
}

async function checkedOpenAI(opts: OpenAIOptions, body: Record<string, unknown>) {
  const res = await aiFetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status >= 400) {
    const msg = await readError(res);
    throw new Error(`OpenAI request failed (${res.status}): ${msg}`);
  }
  return res;
}

function normalizeForOpenAI(m: ChatMessage) {
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content } as const;
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.arguments) },
      })),
    } as const;
  }
  return { role: m.role, content: m.content } as const;
}

function toOpenAITool(t: ToolSpec) {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  };
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readError(res: Response) {
  try {
    const data = await res.json();
    return data?.error?.message ?? data?.message ?? JSON.stringify(data).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
