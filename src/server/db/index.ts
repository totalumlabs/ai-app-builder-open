import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

let _client: SupabaseClient | null = null;

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  status: "active" | "archived";
  preview_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectFileRow {
  id: string;
  project_id: string;
  version: number;
  path: string;
  content: string;
  size: number;
  created_at: string;
}

export interface ProjectVersionRow {
  id: string;
  project_id: string;
  version: number;
  label: string | null;
  created_by: string | null;
  message: string | null;
  created_at: string;
}

export interface AgentMessageRow {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "tool";
  mode: string | null;
  content: string;
  tool: Record<string, unknown> | null;
  created_at: string;
}

function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  _client = createServerClient(url, key, {
    cookies: {
      getAll: async () => await cookies().then((c) => c.getAll()),
      setAll: async (newCookies) => {
        const store = await cookies();
        newCookies.forEach(({ name, value, options }) => store.set(name, value, options));
      },
    },
  });
  return _client;
}

function supabase() {
  return getSupabase();
}

export interface ListProjectsOptions {
  limit?: number;
  search?: string;
}

export async function listProjects({ limit = 50, search = "" }: ListProjectsOptions = {}) {
  const q = supabase()
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (search) q.ilike("name", `%${search}%`);
  const { data, error } = await q;
  return { data: data as ProjectRow[] | null, error };
}

export async function getProject(id: string) {
  const { data, error } = await supabase()
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as ProjectRow | null, error };
}

export async function createProject(input: {
  name: string;
  description?: string;
  visibility?: "private" | "public";
}) {
  const { data: user } = await supabase().auth.getUser();
  if (!user.user?.id) return { data: null, error: new Error("Not authenticated") };
  const { data, error } = await supabase()
    .from("projects")
    .insert({
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility ?? "private",
      owner_id: user.user.id,
    })
    .select()
    .single();
  return { data: data as ProjectRow | null, error };
}

export async function listProjectFiles(projectId: string, version?: number) {
  const q = supabase()
    .from("project_files")
    .select("*")
    .eq("project_id", projectId);
  if (version !== undefined) q.eq("version", version);
  const { data, error } = await q;
  return { data: data as ProjectFileRow[] | null, error };
}

export async function getProjectFile(projectId: string, path: string, version?: number) {
  const q = supabase()
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("path", path);
  if (version !== undefined) q.eq("version", version);
  const { data, error } = await q.maybeSingle();
  return { data: data as ProjectFileRow | null, error };
}

export async function saveProjectFile(input: {
  projectId: string;
  path: string;
  content: string;
  version: number;
}) {
  const { data, error } = await supabase()
    .from("project_files")
    .upsert(
      {
        project_id: input.projectId,
        path: input.path,
        content: input.content,
        version: input.version,
      },
      { onConflict: "project_id,version,path" }
    )
    .select()
    .single();
  return { data: data as ProjectFileRow | null, error };
}

export async function createProjectVersion(input: {
  project_id: string;
  version: number;
  label?: string;
  created_by?: string;
  message?: string;
}) {
  const { data, error } = await supabase()
    .from("project_versions")
    .insert({
      project_id: input.project_id,
      version: input.version,
      label: input.label ?? null,
      created_by: input.created_by ?? null,
      message: input.message ?? null,
    })
    .select()
    .single();
  return { data: data as ProjectVersionRow | null, error };
}

export async function listProjectVersions(projectId: string) {
  const { data, error } = await supabase()
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  return { data: data as ProjectVersionRow[] | null, error };
}

export async function listAgentMessages(projectId: string, limit = 50) {
  const { data, error } = await supabase()
    .from("agent_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return { data: data as AgentMessageRow[] | null, error };
}

export async function addAgentMessage(input: {
  project_id: string;
  role: "user" | "assistant" | "tool";
  mode?: string;
  content: string;
  tool?: Record<string, unknown>;
}) {
  const { data, error } = await supabase()
    .from("agent_messages")
    .insert({
      project_id: input.project_id,
      role: input.role,
      mode: input.mode ?? null,
      content: input.content,
      tool: input.tool ?? null,
    })
    .select()
    .single();
  return { data: data as AgentMessageRow | null, error };
}
