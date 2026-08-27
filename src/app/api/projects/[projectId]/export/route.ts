import { NextResponse } from "next/server";
import { listProjectFiles, getProject } from "@/server/db";

export const runtime = "nodejs";

interface RouteContext { 
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const versionParam = new URL(request.url).searchParams.get("version");
  const version = versionParam ? Number(versionParam) : undefined;

  const { data: project } = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await listProjectFiles(projectId, version);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Response type: { name, version, files: [{path, content}] }
  return NextResponse.json({
    name: project.name,
    version: version ?? undefined,
    files: data ?? [],
  });
}
