import { Icon } from "./Icon";
import { Pill } from "./Pill";

export function PowerDetector() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-8 pt-16 text-center">
      <Pill>
        <Icon name="activity" size={12} /> What heynotai Can Do
      </Pill>
      <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Feel the Power of heynotai&apos;s{" "}
        <span className="grad-highlight">AI Content Detector</span>
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--color-fg-mid)]">
        heynotai&apos;s AI content originality tool serves several purposes,
        and you can use it for various reasons. Here are just three things
        our AI tool analysis can do.
      </p>

      <div className="card-inset mx-auto mt-10 max-w-2xl p-5 text-left">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]">
            <Icon name="sparkle" size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold">
              Determine the Level of Human Involvement in Text Creation
            </div>
            <p className="mt-2 text-xs text-[var(--color-fg-mid)]">
              Know the limitations of AI programs. While AI content originality
              and ChatGPT checker tools are improving, they still have
              limitations. Many detectors may not have the ability to
              differentiate between sophisticated AI-generated text and complex
              text written by humans.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
