import { NextResponse } from "next/server";
import { listProjectVersions, createProjectVersion, getProject } from "@/server/db";

export const runtime = "nodejs";

interface RouteContext { 
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const { data, error } = await listProjectVersions(projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  let body: { label?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: project } = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Compute next version server-side to make Creates transactional-ish.
  const { data: existing } = await listProjectVersions(projectId);
  const max = (existing ?? []).reduce((acc, v) => Math.max(acc, v.version), 0);
  const version = max + 1;

  const { data, error } = await createProjectVersion({
    project_id: projectId,
    version,
    label: body.label,
    message: body.message,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
