"use client";

import * as React from "react";
import { LightbulbIcon } from "lucide-react";

/** Short and true for this builder on the new engine. No prices, no vendor names. */
const TIPS = [
  "Connect your own domain from More → Custom domain.",
  "Sync the code with GitHub from the GitHub button under the chat box.",
  "Browse and edit your app's data in More → Database.",
  "Keep API keys out of your code: add them in More → Secrets.",
  "Every change is saved as a version, so you can always go back.",
  "Open the Code tab to read or edit any file the AI wrote.",
  "Use the pencil in the chat box to edit text and styles right in the preview.",
  "Attach screenshots or a Figma link to show the AI exactly what you want.",
  "Your app comes with a database, file storage and sign-in built in.",
  "Publish puts your app online at its own address in a few minutes.",
];
const TIP_MS = 6_000;
const FADE_MS = 400;

/**
 * ═══ THE PREVIEW WHILE THE FIRST BUILD RUNS ═════════════════════════════════
 *
 * A wireframe of an app assembling itself (pure CSS, `globals.css` → `.bl-*`) over a
 * soft glow, the current stage, and a rotating "Did you know?" tip. Theme tokens only,
 * so it follows light/dark. With `prefers-reduced-motion` the drawing holds still and
 * the tips swap without the fade.
 */
export function BuildingLoader({ stage }: { stage?: string | null }) {
  const [tip, setTip] = React.useState(0);
  const [shown, setShown] = React.useState(true);

  React.useEffect(() => {
    setTip(Math.floor(Math.random() * TIPS.length));
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setShown(false);
      swap = setTimeout(() => { setTip((i) => (i + 1) % TIPS.length); setShown(true); }, FADE_MS);
    }, TIP_MS);
    return () => { clearInterval(id); clearTimeout(swap); };
  }, []);

  return (
    <div data-testid="building-loader" className="absolute inset-0 flex flex-col items-center justify-center gap-7 overflow-hidden bg-background px-6 text-center">
      <div className="bl-glow pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-[62%] rounded-full" aria-hidden />

      <div className="bl-window relative w-[220px] rounded-2xl border border-border bg-card p-3 shadow-sm" aria-hidden>
        <div className="mb-3 flex gap-1">
          <span className="size-1.5 rounded-full bg-muted-foreground/25" />
          <span className="size-1.5 rounded-full bg-muted-foreground/25" />
          <span className="size-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="space-y-2">
          <span className="bl-bar block h-2 w-2/3 rounded-full bg-primary/30" style={{ animationDelay: "0ms" }} />
          <span className="bl-bar block h-1.5 w-full rounded-full bg-muted-foreground/15" style={{ animationDelay: "250ms" }} />
          <span className="bl-bar block h-1.5 w-5/6 rounded-full bg-muted-foreground/15" style={{ animationDelay: "500ms" }} />
          <div className="flex gap-2 pt-1">
            <span className="bl-bar block h-10 flex-1 rounded-lg bg-muted-foreground/10" style={{ animationDelay: "750ms" }} />
            <span className="bl-bar block h-10 flex-1 rounded-lg bg-muted-foreground/10" style={{ animationDelay: "900ms" }} />
            <span className="bl-bar block h-10 flex-1 rounded-lg bg-muted-foreground/10" style={{ animationDelay: "1050ms" }} />
          </div>
          <span className="bl-bar block h-5 w-1/3 rounded-md bg-primary/40" style={{ animationDelay: "1300ms" }} />
        </div>
      </div>

      <div className="relative space-y-1">
        <p className="text-sm font-medium text-foreground">Building your app</p>
        <p className="text-xs text-muted-foreground" aria-live="polite">{stage || "The preview appears as soon as it is ready"}</p>
      </div>

      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card/70 px-4 py-3 text-left backdrop-blur-sm">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <LightbulbIcon className="size-3.5" aria-hidden /> Did you know?
        </p>
        <p
          data-testid="building-loader-tip"
          className="min-h-[2.5rem] text-[13px] leading-snug text-foreground transition-opacity duration-400 ease-out motion-reduce:transition-none"
          style={{ opacity: shown ? 1 : 0 }}
        >
          {TIPS[tip]}
        </p>
      </div>
    </div>
  );
}
