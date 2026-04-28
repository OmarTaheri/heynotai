import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = { title: "Not found — heynotai" };

/**
 * Top-level 404 for routes that don't match any segment. Replaces the
 * root layout entirely — must render its own <html> and <body> — so it
 * can serve an accessible 404 even when the root layout would otherwise
 * mount auth/context providers that aren't relevant here.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              filter: "blur(120px)",
              opacity: 0.45,
              background:
                "radial-gradient(ellipse 40% 40% at 30% 30%, oklch(0.55 0.2 250 / 0.5), transparent 70%), radial-gradient(ellipse 35% 35% at 75% 60%, oklch(0.6 0.18 235 / 0.45), transparent 70%)",
            }}
          />
          <div className="relative z-10 w-full max-w-[420px] rounded-[22px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
              404
            </p>
            <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
              Page not found.
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--color-fg-mid)]">
              That URL doesn&apos;t lead anywhere we recognize. Try the home
              page, or sign in to your workspace.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[var(--color-cta)] text-[14px] font-semibold text-white shadow-[0_6px_18px_var(--color-cta-ring)] transition hover:brightness-105"
              >
                Back to homepage
              </Link>
              <Link
                href="/app"
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[var(--color-line-strong)] text-[14px] font-medium text-[var(--color-fg)] transition hover:bg-[var(--color-surface-alt)]"
              >
                Open the app
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
