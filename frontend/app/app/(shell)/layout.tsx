import type { Metadata } from "next";
import { DashboardShell } from "@/components/app/DashboardShell";
import "../styles/index.css";

export const metadata: Metadata = {
  /* Title template lets each page set just its own segment ("Library")
     and Next.js stitches it with the workspace name ("Library — Detect").
     `default` is what shows on /app itself when no override is set. */
  title: {
    default: "Detect — heynotai",
    template: "%s — Detect",
  },
  description: "Scan text, images, audio, video, and URLs for AI-generated content.",
};

/**
 * Layout for the authenticated dashboard segment.
 *
 * Lives inside the `(shell)` route group so the sidebar + auth gate
 * only wrap pages that actually need them. `/app/login` sits one level
 * up — outside this group — so its server-side redirect runs cleanly
 * without DashboardShell's AuthGuard intercepting first.
 *
 * The shell itself persists across navigations between dashboard pages:
 * sidebar logo doesn't re-animate and BrandLoader doesn't replay.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
