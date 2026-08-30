import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

/**
 * FORGE's in-project database builder — schema editor tool for a client-side
 * chat of table definitions. Writes a JSON schema artifact into the project
 * sandbox for subsequent `sql.generate` calls.
 */
export async function POST(request: NextRequest) {
  let body: { projectId?: string; name?: string; schema?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.projectId || !body.name || !body.schema) {
    return NextResponse.json({ error: "projectId, name, schema required" }, { status: 400 });
  }

  const root = path.join(os.tmpdir(), `forge-sandbox-${body.projectId}`);
  const out = path.join(root, `.forge/database/${body.name}.json`);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(body.schema, null, 2), "utf8");
    return NextResponse.json({ success: true, path: out });
  } catch {
    return NextResponse.json({ error: "Failed to save schema" }, { status: 500 });
  }
}
