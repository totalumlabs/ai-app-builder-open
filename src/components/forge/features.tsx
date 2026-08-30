import {
  Bot,
  Code2,
  Database,
  FolderTree,
  Globe,
  KeyRound,
  Terminal,
  Eye,
} from "lucide-react";

const items = [
  {
    icon: Bot,
    title: "An agent with modes",
    desc: "Plan, Build, Debug, Refactor, Review and Explain — with approve/reject control over every change it makes.",
  },
  {
    icon: Code2,
    title: "A real code editor",
    desc: "Monaco with tabs, command palette, code search and syntax highlighting across the whole repository.",
  },
  {
    icon: Terminal,
    title: "A real terminal",
    desc: "npm install, dev, build, test and lint with captured stdout, stderr, exit codes and build times.",
  },
  {
    icon: Eye,
    title: "Live preview",
    desc: "Responsive viewports, runtime-error overlays, console streaming and an always-on preview URL.",
  },
  {
    icon: Database,
    title: "Visual database",
    desc: "Tables, columns, relationships, indexes and policies — generated from plain language.",
  },
  {
    icon: KeyRound,
    title: "Auth builder",
    desc: "Email/password, sessions, protected routes and roles scaffolded into your app — separate from platform auth.",
  },
  {
    icon: FolderTree,
    title: "Full project control",
    desc: "Create, rename, duplicate, version, export and restore — every action is recoverable.",
  },
  {
    icon: Globe,
    title: "Deploy when ready",
    desc: "Build → validate → deploy → URL, with status, logs and a full deployment history.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
        Everything a builder needs
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
        Not a mock-up. A working environment — from prompt to production.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((f) => (
          <div
            key={f.title}
            className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="mb-3 inline-flex rounded-lg bg-panel-accent p-2 text-panel-accent-foreground">
              <f.icon className="size-5" />
            </div>
            <h3 className="font-display text-base font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
