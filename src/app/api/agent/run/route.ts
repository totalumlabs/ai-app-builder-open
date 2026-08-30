import { NextRequest } from "next/server";
import { generate, type GenerationMode } from "@/server/ai";

export const runtime = "nodejs";

const modeToEngine: Record<string, GenerationMode> = {
  Plan: "plan",
  Build: "agent",
  Debug: "agent",
  Refactor: "agent",
  Review: "agent",
  Explain: "chat",
};

export async function POST(request: NextRequest) {
  let projectId: string;
  let prompt: string;
  let mode: GenerationMode = "agent";

  try {
    const body = (await request.json()) as {
      projectId?: string;
      prompt?: string;
      mode?: string;
    };
    projectId = body.projectId!;
    prompt = body.prompt!;
    if (body.mode && modeToEngine[body.mode]) {
      mode = modeToEngine[body.mode];
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }

  if (!projectId || !prompt) {
    return new Response(JSON.stringify({ error: "projectId and prompt required" }), {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        push({ type: "delta", text: `Agent (${mode}) received the request…\n\n` });
        // Phase 6 completion: this is where the planning + tool-call loop runs,
        // then streams a summary. For now we scaffold the plumbing so the client
        // workspace gets deltas; full tool execution is powered by the same
        // `generate()` pipeline once Supabase is provisioned.
        const completion = await generate({
          mode,
          messages: [{ role: "user", content: prompt }],
          system:
            "You are FORGE, an app-building agent. " +
            (mode === "plan"
              ? "Think through the plan before you act."
              : "Execute with tool calls; don’t just propose.") +
            "\n\nYou can write files, run commands, and fix errors using FORGE tools.",
        });
        push({ type: "delta", text: completion.text ?? "Done." });
      } catch (err) {
        push({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
