import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Install heynotai · Chrome extension",
  description:
    "Side-load the heynotai Chrome extension while we wait for Web Store approval. Takes about 30 seconds.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Download and unzip the file",
    body: "Right-click the downloaded file and choose Extract All (Windows), or double-click on macOS. You'll get a folder named heynotai-extension.",
  },
  {
    title: "Open chrome://extensions",
    body: "Paste chrome://extensions into your address bar. Works in Chrome, Brave, Edge, and Opera (any Chromium browser).",
  },
  {
    title: "Turn on Developer mode",
    body: "Use the toggle in the top-right of the extensions page. This unlocks Load unpacked.",
  },
  {
    title: "Click Load unpacked, select the unzipped folder",
    body: "Pick the folder you extracted in step 1. The heynotai icon appears in your toolbar — click it and sign in to start detecting.",
  },
];

export default function InstallPage() {
  return (
    <main>
      <div className="relative">
        <Nav />

        <section className="relative overflow-hidden pb-24 pt-32 md:pt-40">
          <div className="hero-aurora" aria-hidden>
            <span />
            <span />
          </div>

          <div className="relative mx-auto max-w-3xl px-6">
            <div className="text-center">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] font-semibold">
                Install · Early access
              </div>
              <h1 className="mt-3 text-[clamp(32px,4.5vw,48px)] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
                Install heynotai for Chrome
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-fg-mid)]">
                We're not on the Chrome Web Store yet — installation takes
                about 30 seconds. Works in Chrome, Brave, Edge, and any
                Chromium browser.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3">
                <a
                  href="/downloads/heynotai-extension.zip"
                  download
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--color-cta)] px-6 text-[14px] font-semibold text-white shadow-[0_6px_18px_var(--color-cta-ring)] transition-[filter] hover:brightness-105"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 4v12" />
                    <path d="m6 12 6 6 6-6" />
                    <path d="M5 20h14" />
                  </svg>
                  <span>Download .zip</span>
                </a>
                <span className="text-[12px] text-[var(--color-fg-dim)]">
                  ~2 MB · Manifest V3 · macOS, Windows, Linux
                </span>
              </div>
            </div>

            <ol className="mt-16 grid gap-4">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface-alt)] p-5"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-cta-soft)] text-[13px] font-semibold text-[var(--color-cta-ink)]"
                    aria-hidden
                  >
                    {i + 1}
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--color-fg)]">
                      {step.title}
                    </h2>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-fg-mid)]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-10 text-center text-[12.5px] text-[var(--color-fg-dim)]">
              Stuck?{" "}
              <a
                className="underline underline-offset-2 hover:text-[var(--color-fg-mid)]"
                href="mailto:support@heynot.ai"
              >
                support@heynot.ai
              </a>
              {" "}— we'll walk you through it.
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
