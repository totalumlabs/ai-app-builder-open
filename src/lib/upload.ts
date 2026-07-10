"use client";

import type { AgentInputFile } from "@/lib/vcaas-types";
import { vcaasApi } from "@/lib/vcaas";

/**
 * Upload a single file to a VCaaS project and return an agent-ready
 * { name, url, imageDescription } descriptor (or null if every attempt failed).
 *
 * Multipart uploads can't go through `api.*` (JSON only), so we use raw fetch —
 * this is the one documented exception. We retry a few times because a
 * just-created project's file storage can take a moment to become writable, and
 * a transient failure would otherwise silently drop the attachment (leaving the
 * agent with no image — the exact bug we're fixing).
 */
export async function uploadFileToProject(
  projectId: string,
  file: File,
  opts: { retries?: number; delayMs?: number } = {}
): Promise<AgentInputFile | null> {
  const retries = opts.retries ?? 3;
  const delayMs = opts.delayMs ?? 1500;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const json = await vcaasApi.upload(projectId, formData);
      if (json.ok && json.data?.url) {
        return { name: file.name, url: json.data.url, imageDescription: file.name };
      }
    } catch {
      /* ignore */
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** Upload several files, returning only the ones that succeeded (order preserved). */
export async function uploadFilesToProject(
  projectId: string,
  files: File[],
  opts?: { retries?: number; delayMs?: number }
): Promise<AgentInputFile[]> {
  const out: AgentInputFile[] = [];
  for (const file of files) {
    const uploaded = await uploadFileToProject(projectId, file, opts);
    if (uploaded) out.push(uploaded);
  }
  return out;
}
