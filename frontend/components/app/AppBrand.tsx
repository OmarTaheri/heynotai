import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Brand mark for the application sidebar. Renders the site Logo (the
 * animated heynotai → hey~~ai~~ wordmark from components/Logo.tsx) and
 * links it back to the home page so clicking the mark always escapes
 * to the dashboard root.
 *
 * The Logo's animation only fires on mount. Since the dashboard shell
 * lives in a persistent layout, the mark animates exactly once per
 * session — first arrival into /app/* — not on every navigation.
 */
export function AppBrand({
  href = "/app",
  startClosed = false,
  className,
}: {
  href?: string;
  /** Skip the heynotai → hey~~ai~~ intro and render the closed state
   *  from mount. Used by the sidebar so toggling collapse/expand keeps
   *  the strike steady instead of replaying from scratch. */
  startClosed?: boolean;
  /** Layout class applied to the anchor. Defaults to the global
   *  `app-brand` class so existing non-module callers still render. The
   *  sidebar injects its own module-scoped class instead. */
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={className ?? "app-brand"}
      aria-label="heynotai home"
    >
      <Logo size="md" startClosed={startClosed} />
    </Link>
  );
}
