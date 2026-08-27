const steps = [
  { n: "01", title: "Describe", desc: "Tell FORGE what to build. It plans the architecture and files first." },
  { n: "02", title: "Approve", desc: "Review the plan and each file change before anything is written." },
  { n: "03", title: "Watch it run", desc: "Dependencies install, builds execute, errors self-heal — live." },
  { n: "04", title: "Deploy", desc: "Validate, deploy and get a URL. Iterate with version history." },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 bg-panel/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
          How it works
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="font-display text-sm font-semibold text-primary">{s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
