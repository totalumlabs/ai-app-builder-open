"use client";

import * as React from "react";

export function TerminalPane({ lines }: { lines: string[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);

  return (
    <div ref={ref} className="scrollbar-thin h-full overflow-auto p-3 font-mono text-xs leading-relaxed">
      {lines.length === 0 ? (
        <span className="text-muted-foreground">Shell activity appears here.</span>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-primary">$</span> {l}
          </div>
        ))
      )}
    </div>
  );
}
