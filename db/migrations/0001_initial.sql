/**
 * FORGE initial schema — enables pgcrypto for gen_id(), database functions,
 * and all core tables + RLS.
 *
 * Run with: psql $APP_DATABASE_URL -f db/migrations/0001_initial.sql
 */

create extension if not exists pgcrypto;

-- ── Enums ─────────────────────────────────────────────────────────────────
create type project_visibility as enum ('private', 'public');
create type project_status as enum ('active', 'archived');
create type agent_role as enum ('user', 'assistant', 'tool');
create type agent_mode as enum ('plan', 'build', 'debug', 'refactor', 'review', 'explain');

-- ── Users (synced from Supabase auth.users via trigger) ────────────────────
create table if not exists public.users (
  id uuid primary key default public.gen_id(),
  email text not null,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default public.gen_id(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  visibility project_visibility not null default 'private',
  status project_status not null default 'active',
  preview_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_id_idx on public.projects (owner_id);

-- ── Project files (snapshot per version) ───────────────────────────────────
create table if not exists public.project_files (
  id uuid primary key default public.gen_id(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version bigint not null,
  path text not null,
  content text not null,
  size int not null default length(content),
  created_at timestamptz not null default now()
);
create unique index if not exists project_files_project_version_path_idx
  on public.project_files (project_id, version, path);

-- ── Project versions ────────────────────────────────────────────────────────
create table if not exists public.project_versions (
  id uuid primary key default public.gen_id(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version bigint not null,
  label text,
  created_by uuid references public.users(id),
  message text, — the prompt that produced it
  created_at timestamptz not null default now()
);

-- ── Agent messages (chat / runs) ────────────────────────────────────────────
create table if not exists public.agent_messages (
  id uuid primary key default public.gen_id(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role agent_role not null,
  mode agent_mode,
  content text not null,
  tool jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_project_id_idx on public.agent_messages (project_id);

-- ── Database table builder (per-project, deferred) ─────────────────────────
create table if not exists public.project_databases (
  id uuid primary key default public.gen_id(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Enable RLS + policies ───────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.project_versions enable row level security;
alter table public.agent_messages enable row level security;
alter table public.project_databases enable row level security;

-- Users can read/update their own profile
create policy if not exists "users_self" on public.users
  for all using (auth.uid() = id);

-- Projects: owner can CRUD; public accessible to anyone
create policy if not exists "projects_owner_all" on public.projects
  for all using (owner_id = auth.uid());
create policy if not exists "projects_public_read" on public.projects
  for select using (visibility = 'public');

-- Files/versions/messages/databases: follow parent project
create policy if not exists "files_project_access" on public.project_files
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and (p.owner_id = auth.uid() or p.visibility = 'public')
    )
  );
create policy if not exists "versions_project_access" on public.project_versions
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_versions.project_id
        and (p.owner_id = auth.uid() or p.visibility = 'public')
    )
  );
create policy if not exists "agent_project_access" on public.agent_messages
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = agent_messages.project_id
        and (p.owner_id = auth.uid() or p.visibility = 'public')
    )
  );
create policy if not exists "databases_project_access" on public.project_databases
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_databases.project_id
        and (p.owner_id = auth.uid() or p.visibility = 'public')
    )
  );

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.gen_id() returns uuid
  language plpgsql as $$
begin
  return gen_random_uuid();
end;
$$;

create or replace function public.next_version(p_project_id uuid)
returns bigint
language plpgsql as $$
declare v bigint;
begin
  select coalesce(max(version), 0) + 1 into v
  from public.project_versions
  where project_id = p_project_id;
  return v;
end;
$$;
