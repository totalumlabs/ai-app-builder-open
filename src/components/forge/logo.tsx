import { Sparkles } from "lucide-react";

export function ForgeLogo({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground"
      style={{ width: size, height: size }}
    >
      <Sparkles style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
