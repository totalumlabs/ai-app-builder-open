"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-14">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:py-32">
        <p className="animate-in-rise mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-success" />
          Agent + IDE + Live Preview + Terminal + Database + Deploy
        </p>
        <h1 className="animate-in-rise mx-auto max-w-4xl text-4xl font-display font-semibold tracking-tight sm:text-6xl">
          Describe it.
          <span className="text-primary"> An agent builds it.</span>
        </h1>
        <p className="animate-in-rise mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          FORGE turns a plain-English prompt into a real full-stack application —
          planning architecture, writing code, installing dependencies, running builds,
          fixing its own errors, and showing you a live preview.
        </p>
        <div className="animate-in-rise mt-10 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/signup">
              Start building <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/login">
              <Play className="size-4" /> Watch it work
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
