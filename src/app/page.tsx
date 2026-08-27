import { LandingNav } from "@/components/forge/nav";
import { Hero } from "@/components/forge/hero";
import { Features } from "@/components/forge/features";
import { HowItWorks } from "@/components/forge/how-it-works";
import { Pricing } from "@/components/forge/pricing";

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted-foreground">
          <span>FORGE — AI Full-Stack App Builder</span>
          <span>Built with the FORGE design system</span>
        </div>
      </footer>
    </>
  );
}
