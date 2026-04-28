import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/Pill";

type ToneKey = "neutral" | "green" | "gold";

type Tier = {
  id: "check" | "verify" | "certify";
  name: string;
  tagline: string;
  price: string;
  tone: ToneKey;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "check",
    name: "Check",
    tagline: "A quick read on any text.",
    price: "$0",
    tone: "neutral",
  },
  {
    id: "verify",
    name: "Verify",
    tagline: "For writers and editors who ship daily.",
    price: "$10",
    tone: "green",
    popular: true,
  },
  {
    id: "certify",
    name: "Certify",
    tagline: "For teams that need a paper trail.",
    price: "$30",
    tone: "gold",
  },
];

type Tone = {
  card: string;
  text: string;
  textMuted: string;
  button: string;
  check: string;
  checkText: string;
};

const TONE: Record<ToneKey, Tone> = {
  neutral: {
    card: "bg-[var(--color-bg)] border border-[var(--color-line-strong)]",
    text: "text-[var(--color-fg)]",
    textMuted: "text-[var(--color-fg-mid)]",
    button:
      "bg-[var(--color-fg)] text-[#15171b] hover:bg-white",
    check:
      "bg-[color-mix(in_oklch,white_8%,transparent)] border border-[var(--color-line-strong)]",
    checkText: "text-[var(--color-fg)]",
  },
  green: {
    card: "bg-[#a5c5a8]",
    text: "text-[#15171b]",
    textMuted: "text-[#15171b]/70",
    button: "bg-[#15171b] text-white hover:bg-[#1f2228]",
    check: "bg-[#a5c5a8]",
    checkText: "text-[#1d2a1f]",
  },
  gold: {
    card: "bg-[#e3c773]",
    text: "text-[#15171b]",
    textMuted: "text-[#15171b]/70",
    button: "bg-[#15171b] text-white hover:bg-[#1f2228]",
    check: "bg-[#e3c773]",
    checkText: "text-[#2a2516]",
  },
};

const FEATURES: { label: string; values: [boolean, boolean, boolean] }[] = [
  { label: "AI text detection", values: [true, true, true] },
  { label: "Confidence score", values: [true, true, true] },
  { label: "Sentence-level highlighting", values: [true, true, true] },
  { label: "Browser extension", values: [false, true, true] },
  { label: "Paraphrase + tone analysis", values: [false, true, true] },
  { label: "Priority support", values: [false, true, true] },
  { label: "Shareable verification report", values: [false, false, true] },
  { label: "Audit history", values: [false, false, true] },
  { label: "Team workspace", values: [false, false, true] },
  { label: "API access", values: [false, false, true] },
];

export default function PricingPage() {
  return (
    <main>
      <div className="relative">
        <Nav />

        <section className="relative overflow-hidden pb-24 pt-32 md:pt-40">
          {/* Aurora backdrop — same drifting, color-shifting bloom used on the
              home Hero so the pricing page shares its living backdrop. */}
          <div className="hero-aurora" aria-hidden>
            <span />
            <span />
          </div>

          <div className="relative mx-auto max-w-6xl px-6">
            {/* Hero — brand-aligned: centered heading + paragraph */}
            <div className="text-center">
              <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                <span className="text-white">Simple</span>{" "}
                <span className="grad-highlight">pricing</span>
                <span className="text-white">.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[13.5px] leading-relaxed text-white/65">
                Three tiers, one job — keep human writing honest. Start free,
                level up when your workflow asks for more.
              </p>
            </div>

            {/* Cards row */}
            <div className="mt-16 grid gap-5 md:grid-cols-3">
              {TIERS.map((tier) => (
                <PlanCard key={tier.id} tier={tier} />
              ))}
            </div>

            <FeatureTable />

            <EnterpriseCard />
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}

function PlanCard({ tier }: { tier: Tier }) {
  const tone = TONE[tier.tone];
  return (
    <div
      className={`relative flex flex-col p-7 ${tone.card}`}
      style={{ borderRadius: 32 }}
    >
      {tier.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-fg)] px-3 py-1 text-[11px] font-medium text-[#15171b] shadow-sm">
          Most Popular!
        </span>
      )}

      <h3 className={`text-[24px] font-semibold tracking-tight ${tone.text}`}>
        {tier.name}
      </h3>
      <p
        className={`mt-1.5 max-w-[14rem] text-[13.5px] leading-snug ${tone.textMuted}`}
      >
        {tier.tagline}
      </p>

      <div
        className={`mt-10 text-[42px] font-semibold leading-none tracking-tight ${tone.text}`}
      >
        {tier.price}
        <span className={`ml-1 text-[13.5px] font-normal ${tone.textMuted}`}>
          /mo
        </span>
      </div>

      <Link
        href="#signup"
        className={`mt-6 inline-flex h-12 items-center justify-center rounded-full text-[14px] font-medium transition-colors ${tone.button}`}
      >
        Get started
      </Link>
    </div>
  );
}

function FeatureTable() {
  return (
    <div className="mt-24">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Key Features
      </h2>

      <div className="mt-6 border-t border-[var(--color-line)]">
        {FEATURES.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1.4fr_repeat(3,1fr)] items-center border-b border-[var(--color-line)] px-1 py-4 text-[13.5px]"
          >
            <span className="font-medium text-[var(--color-fg)]">
              {row.label}
            </span>
            {row.values.map((on, idx) => {
              const tone = TONE[TIERS[idx].tone];
              return (
                <div key={idx} className="flex justify-center">
                  {on ? (
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${tone.check} ${tone.checkText}`}
                    >
                      <Icon name="check" size={13} />
                    </span>
                  ) : (
                    <span className="text-[var(--color-fg-dim)]">—</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function EnterpriseCard() {
  return (
    <div
      className="mt-20 flex flex-col gap-8 bg-[var(--color-surface-sunken)] p-10 text-[var(--color-fg)] sm:p-12 lg:flex-row lg:items-center lg:justify-between"
      style={{ borderRadius: 32 }}
    >
      <div className="max-w-xl">
        <Pill>
          <Icon name="shield" size={12} /> Enterprise
        </Pill>
        <h3 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          Need a custom rollout?
        </h3>
        <p className="mt-4 max-w-lg text-[13.5px] leading-relaxed text-[var(--color-fg-mid)]">
          For publishers, universities, and platforms running detection at
          scale. SSO, dedicated infrastructure, custom detection models, and a
          contract built around your compliance needs.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 lg:items-end">
        <Link
          href="#contact"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-fg)] px-7 text-[14px] font-medium text-[#15171b] transition-colors hover:bg-white"
        >
          Contact us
        </Link>
        <Link
          href="mailto:sales@heynotai.io"
          className="inline-flex items-center gap-2 text-[13px] text-[var(--color-fg-mid)] transition-colors hover:text-[var(--color-fg)]"
        >
          sales@heynotai.io
          <Icon name="arrow-right" size={12} />
        </Link>
      </div>
    </div>
  );
}
