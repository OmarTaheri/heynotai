"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { AuthModal, type AuthMode } from "./auth/AuthModal";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "#tools", label: "Tools" },
  { href: "#contact", label: "Contact" },
  { href: "#help", label: "Help" },
];

export function Nav() {
  const { user } = useAuth();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  /** `?next=` value captured at modal-open time. The query param gets
   *  stripped on close, so we cache it so post-login routing still works. */
  const [nextPath, setNextPath] = useState<string>("/app");

  /** Open the modal from a URL query param (?login=1 or ?signup=1) and
   *  remember any ?next=… so we can route there after a successful sign-in.
   *  We use raw window.location instead of useSearchParams so this stays
   *  outside the Suspense boundary the static prerender would otherwise
   *  require. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "1") setAuthMode("signup");
    else if (params.get("login") === "1") setAuthMode("login");
    const next = params.get("next");
    if (next && next.startsWith("/")) setNextPath(next);
  }, []);

  /** Close the modal and clean up the auth-related query params so a
   *  reload doesn't reopen the dialog. We keep any *other* params intact
   *  in case the page relies on them. */
  const handleClose = useCallback(() => {
    setAuthMode(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const cleaned = ["login", "signup", "next"].some((k) => url.searchParams.has(k));
    if (!cleaned) return;
    url.searchParams.delete("login");
    url.searchParams.delete("signup");
    url.searchParams.delete("next");
    const qs = url.searchParams.toString();
    window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : "") + url.hash);
  }, []);

  const handleAuthenticated = useCallback(() => {
    setAuthMode(null);
    router.push(nextPath || "/app");
  }, [router, nextPath]);

  return (
    <>
      <nav className="absolute left-0 right-0 top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="lg" />
            <span className="rounded border border-[var(--color-line-strong)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-dim)]">
              v3.2
            </span>
          </Link>

          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-[var(--color-fg)] transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="green" size="md" href="/app">
                Open app
              </Button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="hidden cursor-pointer items-center gap-1 text-sm text-[var(--color-fg)] transition-colors hover:text-white sm:inline-flex"
                >
                  Login
                </button>
                <Button
                  variant="green"
                  size="md"
                  onClick={() => setAuthMode("signup")}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={handleClose}
          onSwitchMode={(m) => setAuthMode(m)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  );
}
