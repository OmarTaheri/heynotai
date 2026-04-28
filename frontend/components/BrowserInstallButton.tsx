"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/* ── Browser-aware install CTA ───────────────────────────────────────
   Detects the current browser at mount and renders the matching label
   plus a monochrome silhouette of its logo. Detection priority:
     Brave  (async navigator.brave.isBrave())
     Edge   (UA contains Edg/)
     Opera  (UA contains OPR/ or Opera/)
     Firefox (UA contains Firefox/)
     Safari (UA contains Safari/ but not Chrome/)
     Chrome (default fallback)
   SSR renders Chrome so initial paint is stable; the swap happens after
   hydration without layout shift (label width is roughly constant). */

type BrowserKey =
  | "chrome"
  | "brave"
  | "firefox"
  | "safari"
  | "edge"
  | "opera";

type NavigatorWithBrave = Navigator & {
  brave?: { isBrave?: () => Promise<boolean> };
};

function detectFromUA(ua: string): BrowserKey {
  // Order matters — Edge / Opera UA strings also contain "Chrome", and
  // Safari's UA contains "Safari" while Chrome's does too, so check
  // more specific markers first.
  if (/Edg\//.test(ua)) return "edge";
  if (/OPR\/|Opera\//.test(ua)) return "opera";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "chrome";
}

function useBrowser(): BrowserKey {
  const [browser, setBrowser] = useState<BrowserKey>("chrome");

  useEffect(() => {
    let cancelled = false;
    const ua = navigator.userAgent;
    const finish = (key: BrowserKey) => {
      if (!cancelled) setBrowser(key);
    };

    // Brave is the only browser where the UA looks like Chrome — its
    // isBrave() method is the only reliable way to tell them apart.
    const nav = navigator as NavigatorWithBrave;
    if (nav.brave?.isBrave) {
      nav.brave
        .isBrave()
        .then((isBrave) =>
          isBrave ? finish("brave") : finish(detectFromUA(ua)),
        )
        .catch(() => finish(detectFromUA(ua)));
    } else {
      finish(detectFromUA(ua));
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return browser;
}

const BROWSERS: Record<
  BrowserKey,
  { name: string; Icon: () => React.JSX.Element }
> = {
  chrome:  { name: "Chrome",  Icon: ChromeMark  },
  brave:   { name: "Brave",   Icon: BraveMark   },
  firefox: { name: "Firefox", Icon: FirefoxMark },
  safari:  { name: "Safari",  Icon: SafariMark  },
  edge:    { name: "Edge",    Icon: EdgeMark    },
  opera:   { name: "Opera",   Icon: OperaMark   },
};

export function BrowserInstallButton({
  href = "#extension",
  size = "sm",
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const key = useBrowser();
  const { name, Icon: Mark } = BROWSERS[key];
  return (
    <Button
      href={href}
      variant="green"
      size={size}
      leftIcon={<Mark />}
      rightIcon={<Icon name="arrow-right" size={13} />}
    >
      Install for {name}
    </Button>
  );
}

/* ── Browser silhouettes ──
   Monochrome simplifications of each brand mark, sized for 14px button
   slots. They use currentColor so they pick up the surrounding button's
   text color (white on the green CTA, etc.). */

function ChromeMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  );
}

function BraveMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.4 5 5.2v6.5c0 4.6 3.1 7.5 7 9.9 3.9-2.4 7-5.3 7-9.9V5.2L12 2.4Zm0 4 4 1.5v3.8c0 2.8-1.7 4.6-4 6.1-2.3-1.5-4-3.3-4-6.1V7.9l4-1.5Z" />
    </svg>
  );
}

function FirefoxMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.5 11.5a8.5 8.5 0 1 1-3.4-6.8" />
      <path d="M16 3.5c0 2 1 3.5 3 4 .2-1-.3-2.5-1-3.3" />
      <path d="M8 13c0-2.2 1.5-4 4-4s4 1.5 4 3.8" />
    </svg>
  );
}

function SafariMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EdgeMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3.5 13a8.5 8.5 0 0 1 16-4" />
      <path d="M19.5 9c-2.5 4-7.5 4.8-12 3" />
      <path d="M5 16.5a7 7 0 0 0 13 1" />
    </svg>
  );
}

function OperaMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="9.5" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="3.2" ry="6" strokeWidth="1.8" fill="currentColor" />
    </svg>
  );
}
