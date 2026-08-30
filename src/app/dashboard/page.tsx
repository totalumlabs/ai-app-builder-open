"use client";

import * as React from "react";
import Link from "next/link";
import { ForgeLogo } from "@/components/forge/logo";
import { ThemeToggle } from "@/components/forge/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/primitives/EmptyState";
import { SkeletonBox } from "@/components/primitives/Skeletons";
import { Plus, Search, FolderGit2 } from "lucide-react";

interface ProjectCardData {
  id: string;
  name: string;
  description?: string;
  updatedAt?: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = React.useState<ProjectCardData[] | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []))
      .catch(() => setProjects([]));
  }, []);

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-display font-semibold">
            <ForgeLogo size={22} />
            <span>FORGE</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/dashboard/new">
              <Plus className="size-4" /> New project
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects === null ? "Loading…" : `${filtered.length} of ${projects.length}`}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {projects === null ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBox key={i} className="h-36" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<FolderGit2 className="size-8 text-muted-foreground" />}
              title={query ? "No matching projects" : "No projects yet"}
              description={query ? "Try a different search." : "Create your first project and let the agent build it."}
              actions={
                <Button asChild>
                  <Link href="/dashboard/new">
                    <Plus className="size-4" /> New project
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="font-display font-semibold">{p.name}</h3>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
