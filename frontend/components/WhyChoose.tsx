import { Icon } from "./Icon";
import { Pill } from "./Pill";

export function WhyChoose() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <Pill>
        <Icon name="sparkle" size={12} /> Why Use heynotai AI Content Detector
      </Pill>
      <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Why Choose <span className="grad-highlight">heynotai&apos;s AI Detector</span>
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--color-fg-mid)]">
        AI content detection tools ensure the authenticity and originality of
        written works. Anyone can easily falsify text using machine learning
        and algorithms, leading to plagiarism and harmed reputations in
        education and professional life. A writing detector software like
        heynotai can detect originality by analyzing text and determining its
        original creation method. It assists helpful to authors and other
        content creators by suggesting how to improve their text.
      </p>

      <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-alt)] p-5 text-left">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]">
          <Icon name="sparkle" size={16} />
        </div>
        <p className="text-xs text-[var(--color-fg-mid)]">
          Know the limitations of AI programs. While AI content originality
          and ChatGPT checker tools are improving, they still have limitations.
          Many detectors may not have the ability to differentiate between
          sophisticated AI-generated text and complex text written by humans.
        </p>
      </div>
    </section>
  );
}
