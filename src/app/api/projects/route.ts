import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const { data, error } = await listProjects({ search });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; description?: string; visibility?: "private" | "public" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await createProject({
    name: body.name,
    description: body.description,
    visibility: body.visibility,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
