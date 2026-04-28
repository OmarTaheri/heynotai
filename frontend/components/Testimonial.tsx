import { Icon } from "./Icon";

interface Props {
  quote: string;
  name: string;
  role: string;
  avatar?: string;
  showNav?: boolean;
}

export function Testimonial({ quote, name, role, avatar, showNav = false }: Props) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 text-center">
      <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-[var(--color-fg)] sm:text-xl">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <div
          className="h-10 w-10 rounded-full bg-[var(--color-card)]"
          style={
            avatar
              ? {
                  backgroundImage: `url(${avatar})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="text-left">
          <div className="text-sm font-medium text-[var(--color-fg)]">{name}</div>
          <div className="text-xs text-[var(--color-fg-dim)]">{role}</div>
        </div>
      </div>
      {showNav && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            aria-label="Previous testimonial"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-fg-mid)] transition-colors hover:text-[var(--color-fg)]"
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <button
            aria-label="Next testimonial"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-alt)] text-[var(--color-fg)]"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
