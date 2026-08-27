import { NextRequest, NextResponse } from "next/server";
import {
  createProjectVersion,
  getProject,
  listProjectFiles,
  saveProjectFile,
} from "@/server/db";

export const runtime = "nodejs";

interface RouteContext { 
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  const versionParam = request.nextUrl.searchParams.get("version");
  const version = versionParam ? Number(versionParam) : undefined;

  const { data: project, error: projError } = await getProject(projectId);
  if (projError || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await listProjectFiles(projectId, version);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  let body: { path?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.path || body.content === undefined) {
    return NextResponse.json({ error: "path and content required" }, { status: 400 });
  }

  const { data: project, error: projectError } = await getProject(projectId);
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { nextVersion } = await computeNextVersion(projectId);
  const { data, error } = await saveProjectFile({
    projectId,
    path: body.path,
    content: body.content,
    version: nextVersion,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, version: nextVersion });
}

/** Snapshot files into project_files at a new version number. */
async function computeNextVersion(projectId: string) {
  // Advance the version by reading project_versions then finding max.
  const { data: versions } = await import("@/server/db").then((m) =>
    m.listProjectVersions(projectId)
  );
  const max = (versions ?? []).reduce((acc, v) => Math.max(acc, v.version), 0);
  return { nextVersion: max + 1 };
}
