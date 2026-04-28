import Link from "next/link";
import { Logo } from "./Logo";

const COLUMNS: { title: string; links: string[] }[] = [
  {
    title: "Tools",
    links: [
      "Paragraph Rewriter",
      "Plagiarism Checker",
      "heynotai (AI Writer)",
      "Citation Machine",
      "Text Summarizer",
      "heynotai Omni",
    ],
  },
  {
    title: "Blogs",
    links: ["How to Avoid Plagiarism", "What is Self-Plagiarism?", "Creative AI Writer", "Writing with AI Writer", "Text Summarizer"],
  },
  {
    title: "Company",
    links: ["About Us", "Contact Us", "Pricing", "Need help?", "Services", "Reviews", "APIs"],
  },
  {
    title: "Resources",
    links: ["About Us", "Contact Us", "Pricing", "Need help?", "Services", "Reviews", "APIs"],
  },
];

export function Footer() {
  return (
    <footer className="pt-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-10 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div>
          <Logo size="sm" />
          <p className="mt-4 max-w-xs text-xs text-[var(--color-fg-mid)]">
            Unlock the power of AI for writing, research, and plagiarism
            detection with heynotai.
          </p>
          <p className="mt-3 text-xs text-[var(--color-fg-dim)]">
            Email: support@heynotai.io
            <br />
            Phone: +1 (555) 766-5460
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link}>
                  <Link
                    href="#"
                    className="text-xs text-[var(--color-fg-mid)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-[11px] text-[var(--color-fg-dim)]">
          <span>© heynotai Inc. 2026. Designed and built by Claude.</span>
          <div className="flex gap-5">
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
            <Link href="#">Press kit</Link>
            <Link href="#">Legal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
