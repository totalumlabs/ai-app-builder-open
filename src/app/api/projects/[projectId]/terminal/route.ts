import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import os from "os";
import path from "path";
import { promisify } from "util";
import { listProjectFiles, getProject } from "@/server/db";

const execAsync = promisify(exec);

/** Safe command layer. Only allow-listed commands, run in the project sandbox dir. */
const COMMAND_ALLOWLIST = [
  "ls",
  "cat",
  "npm run build",
  "npx tsc --noEmit",
  "npx eslint",
  "node --version",
  "npm --version",
  "pwd",
  "date",
];

export const runtime = "nodejs";

interface RouteContext { 
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  let body: { command?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const command = (body.command ?? "").trim();
  if (!command) return NextResponse.json({ error: "command required" }, { status: 400 });

  // Only allow-listed commands — the sandbox is a real fs path, so we need
  // more than just regex.
  const baseCmd = command.split(/\s+/)[0];
  if (!COMMAND_ALLOWLIST.some((c) => command === c || command.startsWith(`${c} `))) {
    return NextResponse.json({
      error: `Command not allowed: try "${baseCmd}" in ${{ length: 0 }.toString()}`,
    }, { status: 403 });
  }

  const { data: project } = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Sandbox root per project.
  const root = path.join(os.tmpdir(), `forge-sandbox-${projectId}`);
  try {
    const result = await execAsync(command, { cwd: root });
    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    });
  } catch (err) {
    return NextResponse.json({
      stdout: "",
      stderr: String(err),
      exitCode: 1,
    }, { status: 200 });
  }
}
