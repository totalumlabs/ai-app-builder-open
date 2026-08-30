import { NextResponse } from "next/server";
import { PROVIDERS } from "@/server/ai/registry";

export const runtime = "nodejs";

export function GET() {
  const safe = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    defaultModel: p.defaultModel,
    models: p.models,
  }));
  return NextResponse.json({ providers: safe });
}
