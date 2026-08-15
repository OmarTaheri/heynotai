"use client";

import { useEffect, useState } from "react";

export type ExtensionPresence =
  | { state: "checking" }
  | { state: "installed"; version: string; extensionId: string }
  | { state: "missing" };

const VERSION_ATTR = "data-heynotai-extension";
const ID_ATTR = "data-heynotai-extension-id";

/** How long to wait for the content script before declaring the
 *  extension missing. The script runs at `document_idle`, so on a slow
 *  page it can land a beat after React hydrates. */
const GRACE_MS = 1500;

function read(): ExtensionPresence | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  const version = root.getAttribute(VERSION_ATTR);
  if (!version) return null;
  return {
    state: "installed",
    version,
    extensionId: root.getAttribute(ID_ATTR) ?? "",
  };
}

/** Detects whether the heynotai extension is installed in this browser.
 *
 *  The content script stamps `data-heynotai-extension="<version>"` on
 *  `<html>` on every page it runs on, including this one. That marker is
 *  the only honest signal the website has — the extension page used to
 *  render a fixed "Active · v2.4.1 · installed Aug 14, 2025" card
 *  regardless of whether anything was installed at all.
 *
 *  Watches for the attribute rather than reading once, so an extension
 *  that loads after hydration still flips the card to "installed". */
export function useExtensionPresence(): ExtensionPresence {
  const [presence, setPresence] = useState<ExtensionPresence>({
    state: "checking",
  });

  useEffect(() => {
    const initial = read();
    if (initial) {
      setPresence(initial);
      return;
    }

    let settled = false;
    const observer = new MutationObserver(() => {
      const found = read();
      if (!found) return;
      settled = true;
      observer.disconnect();
      setPresence(found);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [VERSION_ATTR],
    });

    const timer = window.setTimeout(() => {
      if (settled) return;
      observer.disconnect();
      setPresence(read() ?? { state: "missing" });
    }, GRACE_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return presence;
}
