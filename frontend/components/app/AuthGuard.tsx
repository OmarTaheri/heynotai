"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BrandLoader } from "./BrandLoader";
import { GoodbyeSplash } from "./GoodbyeSplash";

/**
 * Wraps every authenticated page in /app/*. Three states:
 *   loading  → render the brand loader
 *   logged-out → bounce to /app/login
 *   logged-in → render children
 *
 * The brand loader also stays visible for the full intro animation on
 * the very first authenticated page load, even after auth resolves —
 * this keeps the cold-open feel consistent with how the user expects
 * the app to enter from the marketing site.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, signingOut, farewell } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (!loading && !user && !signingOut) {
      // Bounce to the marketing home with the login modal open. The
      // `next` param tells Nav where to send the user after they sign in.
      // Skipping while `signingOut` keeps the goodbye splash on screen
      // until auth.tsx finishes its own timeout and clears the user.
      const next = encodeURIComponent(pathname || "/app");
      router.replace(`/?login=1&next=${next}`);
    }
  }, [loading, user, signingOut, pathname, router]);

  if (signingOut) {
    return <GoodbyeSplash word={farewell} />;
  }

  // Mount the page underneath the BrandLoader as soon as auth resolves,
  // so the loader's fade-out reveals a fully-rendered dashboard instead
  // of cutting to a blank frame. The .app-shell-main reveal-stagger runs
  // while the loader still covers everything; by the time the loader
  // fades, the cards are already in place.
  return (
    <>
      {!loading && user ? children : null}
      {!introDone && <BrandLoader onDone={() => setIntroDone(true)} />}
    </>
  );
}
