import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Studio",
    price: "Free",
    desc: "For experimentation and small projects.",
    features: ["3 projects", "Community models", "Version history", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    desc: "For builders shipping real apps.",
    features: [
      "Unlimited projects",
      "All providers & models",
      "Priority builds",
      "Deployment history",
      "Env manager",
    ],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "Team",
    price: "Custom",
    desc: "For products embedding FORGE.",
    features: ["Multi-tenant projects", "SSO", "Audit logs", "Dedicated support"],
    cta: "Contact us",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
        Pricing-ready
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
        Structure for plans is in place. Toggle billing on when you are ready.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-xl border p-6 ${
              t.featured
                ? "border-primary bg-primary/5 shadow-lg"
                : "border-border bg-card"
            }`}
          >
            <h3 className="font-display font-semibold">{t.name}</h3>
            <div className="mt-2 font-display text-3xl font-semibold">
              {t.price}
              {t.price !== "Free" && t.price !== "Custom" && (
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            <ul className="mt-4 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-success" /> {f}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-6 w-full"
              variant={t.featured ? "default" : "outline"}
            >
              <Link href="/signup">{t.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
