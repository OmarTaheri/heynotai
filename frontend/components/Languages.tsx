import { Icon } from "./Icon";
import { Pill } from "./Pill";

export function Languages() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20 text-center">
      <Pill>
        <Icon name="globe" size={12} /> What heynotai Supports
      </Pill>
      <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Great supports for <span className="grad-highlight">multiple language</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--color-fg-mid)]">
        heynotai&apos;s AI content originality tool serves several purposes, and
        you can use it for various reasons. Here are just three things our
        AI tool analysis can do.
      </p>

      <div className="mt-8 inline-flex">
        <button type="button" className="pill pill-ghost">
          <Icon name="globe" size={14} /> Choose a preferred language
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
    </section>
  );
}
