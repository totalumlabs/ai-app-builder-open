import { NextResponse } from "next/server";
import { listProjectFiles, getProject } from "@/server/db";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";

export const runtime = "nodejs";

interface RouteContext { 
  params: Promise<{ projectId: string }>;
}

/** rSanders extracted part that actually materialises a project directory. */
export async function GET(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const versionParam = new URL(request.url).searchParams.get("version");
  const version = versionParam ? Number(versionParam) : undefined;

  const { data: project } = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: files } = await listProjectFiles(projectId, version);
  if (!files) return NextResponse.json({ error: "No files" }, { status: 404 });

  const root = path.join(os.tmpdir(), `forge-sandbox-${projectId}`);
  try {
    fs.mkdirSync(root, { recursive: true });
    for (const f of files) {
      const dest = path.join(root, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content, "utf8");
    }
    return NextResponse.json({
      url: pathToFileURL(root).toString(),
      filesWritten: files.length,
    });
  } catch {
    return NextResponse.json({ error: "Preview materialization failed" }, { status: 500 });
  }
}
