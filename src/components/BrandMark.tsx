import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-8 w-8";
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center border border-cyan-400/40 bg-[#0E1925]",
        dim,
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,223,255,0.35),transparent_70%)]" />
      <svg viewBox="0 0 24 24" className="relative h-[58%] w-[58%] text-[#00DFFF]" fill="none">
        <path
          d="M4 16.5 12 4.5l8 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="miter"
        />
        <path d="M7.2 16.5h9.6" stroke="#008CFF" strokeWidth="1.6" />
        <circle cx="12" cy="16.5" r="1.35" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandWordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={compact ? "sm" : "md"} />
      <span className="font-display text-[13px] font-semibold tracking-[0.18em] text-white uppercase">
        {compact ? "RF.ai" : "RyanFenn.ai"}
      </span>
    </span>
  );
}
