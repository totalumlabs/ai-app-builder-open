"use client";

import * as React from "react";
import Link from "next/link";
import { ForgeLogo } from "@/components/forge/logo";
import { ThemeToggle } from "@/components/forge/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function NewProjectPage() {
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success("Project created");
      window.location.href = `/project/${json.data.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-display font-semibold">
            <ForgeLogo size={22} />
            <span>FORGE</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-14">
        <h1 className="font-display text-2xl font-semibold">New project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A workspace starts with a name. You can add files and let the agent build as you go.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. shop-admin"
              className="mt-2"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this project do?"
              className="mt-2 min-h-28"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !name.trim()}>
              <Plus className="size-4" /> Create
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
