"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Sparkles,
  Eye,
  Database,
  Rocket,
  Key,
  GitBranch,
  Globe,
  Terminal,
  ArrowRight,
  Loader2,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Agent",
    description: "Describe your app and watch AI build it in real-time with live progress messages",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description: "See changes instantly with an embedded live development preview",
  },
  {
    icon: Database,
    title: "Database & CMS",
    description: "Visual schema viewer and full content management for your data",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description: "Deploy to production with a single click and get a public URL",
  },
  {
    icon: Key,
    title: "Secret Management",
    description: "Securely manage API keys and environment variables for your app",
  },
  {
    icon: GitBranch,
    title: "Version History",
    description: "Browse every version and restore any previous state instantly",
  },
  {
    icon: Globe,
    title: "Custom Domains",
    description: "Connect your own domain with automatic SSL certificates",
  },
  {
    icon: Terminal,
    title: "Server Logs",
    description: "Monitor your app with real-time backend server logs",
  },
];

export default function LandingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && !isPending) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">VibeBuild</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-medium mb-8 border border-violet-100">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered App Builder
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
            Build apps with
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              AI magic
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Describe what you want to build. Watch the AI agent create it in real-time.
            Preview, iterate, and deploy — all from one beautiful workspace.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                Start Building
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50/80 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Everything you need to ship</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              A complete AI development environment. Database, hosting, domains, and secrets — all managed for you.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg hover:border-violet-100 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                  <f.icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="font-semibold mb-1.5 text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to build something amazing?</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            Sign up in seconds and start building your first app with AI. No credit card required.
          </p>
          <Link href="/register">
            <Button size="lg" className="h-12 px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            VibeBuild
          </div>
          <span className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} VibeBuild. Powered by Totalum.
          </span>
        </div>
      </footer>
    </div>
  );
}
