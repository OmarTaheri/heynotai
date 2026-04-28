import Link from "next/link";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

export function Elevating() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-8 pt-12">
      <div className="card p-8 sm:p-12">
        <div className="text-center">
          <Pill>
            <Icon name="shield" size={12} /> AI Detection Redefined
          </Pill>
          <h2 className="mx-auto mt-5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Elevating AI Detection Standards with the{" "}
            <span className="grad-highlight">Leading Writing Assistant</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--color-fg-mid)]">
            heynotai&apos;s free AI detector is an advanced tool that
            distinguishes between human-written and text generated content. The
            heynotai engine can detect text generated content by ChatGPT, Gemini
            or other AI content-generating sites. Professional writers,
            students, and educators rely on heynotai to screen their work for
            digital manipulation and ensure its authenticity.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="card-inset p-6">
            <Pill>
              <Icon name="sparkle" size={12} /> Let&apos;s Break it down
            </Pill>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Discover the{" "}
              <span className="grad-highlight">Precision of heynotai&apos;s</span>{" "}
              Detection AI Tool
            </h3>
            <p className="mt-3 text-sm text-[var(--color-fg-mid)]">
              heynotai&apos;s AI Detector is designed to set a new benchmark in
              accuracy and reliability, making it a trusted tool for identifying
              AI-generated content. But just how precise is it? Our advanced
              detection technology ensures unparalleled precision, combining
              cutting-edge algorithms with a user-friendly interface.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="#detector" className="pill pill-primary text-xs">
                <Icon name="sparkle" size={13} /> heynotai AI Detector
              </Link>
              <Link href="#signup" className="pill pill-ghost text-xs">
                Get Started for free <Icon name="arrow-right" size={13} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <StatCard
              dotClass="bg-[var(--color-accent)]"
              value="91%"
              label="of AI documents are considered AI content"
            />
            <StatCard
              dotClass="bg-[var(--color-gold)]"
              value="99%"
              label="of Human documents are considered Human"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  dotClass,
  value,
  label,
}: {
  dotClass: string;
  value: string;
  label: string;
}) {
  return (
    <div className="card-inset flex items-center gap-4 p-5">
      <div
        className={`h-10 w-10 flex-shrink-0 rounded-full ${dotClass} opacity-80`}
      />
      <div>
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-xs text-[var(--color-fg-mid)]">{label}</div>
      </div>
    </div>
  );
}
