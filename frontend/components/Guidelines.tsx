import Link from "next/link";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

const ITEMS = [
  {
    title: "Preventative Measures",
    body: "It's best to use AI detection tools as a preventative measure to avoid potential issues with plagiarism or content manipulation. You can always test your work before publishing or submission rather than relying on the tool as a remedy after the fact.",
    open: true,
  },
  {
    title: "Analysis Backup",
    body: "Always run critical documents through more than one checker and compare the results. Different engines weight stylistic signals differently.",
  },
  {
    title: "Checking for Consistency",
    body: "Consistency across tone, vocabulary, and cadence is often a stronger authenticity signal than any single sentence-level probability score.",
  },
  {
    title: "Avoid Overdependence",
    body: "A detector is a second opinion — not a verdict. Pair automated signals with human review for anything high-stakes.",
  },
];

export function Guidelines() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-8 pt-4">
      <div className="card p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <Pill>
              <Icon name="shield" size={12} /> Recommended Usage for AI Checker
            </Pill>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Effective Usage{" "}
              <span className="grad-highlight">Guidelines for AI</span> Checker
              Tools
            </h2>
            <p className="mt-4 text-sm text-[var(--color-fg-mid)]">
              Are you wondering why you should use AI writing scanners? Well,
              there are a few reasons, most importantly, for preventative
              measures. Whether you are in academia as a student or
              professor or working in a professional environment, AI
              detector tools and heynotai are a must. Here are more use-case
              scenarios and tips for effective AI checker tool usage.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="#detector" className="pill pill-primary text-xs">
                <Icon name="sparkle" size={13} /> heynotai Detector
              </Link>
              <Link href="#signup" className="pill pill-ghost text-xs">
                Get Started for free <Icon name="arrow-right" size={13} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {ITEMS.map((item) => (
              <details key={item.title} className="acc-item" open={item.open}>
                <summary>{item.title}</summary>
                <div className="acc-body">{item.body}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
