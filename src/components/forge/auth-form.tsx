"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ForgeLogo } from "@/components/forge/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export type AuthMode = "login" | "signup" | "forgot";

const titles: Record<AuthMode, { title: string; sub: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your studio" },
  signup: { title: "Create your studio", sub: "One prompt away from a full-stack app" },
  forgot: { title: "Reset password", sub: "We will email you a reset link" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Something went wrong");
      if (mode === "forgot") {
        toast.success("Check your inbox for a reset link.");
      } else {
        toast.success(mode === "signup" ? "Account created." : "Welcome back.");
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  const t = titles[mode];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <div className="mb-8 flex items-center gap-2 font-display text-lg font-semibold">
        <ForgeLogo size={28} />
        <span>FORGE</span>
      </div>
      <h1 className="font-display text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.sub}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.dev"
          />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" && "Sign in"}
          {mode === "signup" && "Create account"}
          {mode === "forgot" && "Send reset link"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" && (
          <>
            <a href="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </a>
            <span className="mx-2">·</span>
            <a href="/signup" className="text-primary hover:underline">
              Create an account
            </a>
          </>
        )}
        {mode === "signup" && (
          <a href="/login" className="text-primary hover:underline">
            Already have an account? Sign in
          </a>
        )}
        {mode === "forgot" && (
          <a href="/login" className="text-primary hover:underline">
            Back to sign in
          </a>
        )}
      </div>
    </div>
  );
}
