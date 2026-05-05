"use client";

import { useAuth } from "@/lib/auth";

/**
 * Hero-style greeting at the top of the home page.
 *
 * Borrowed from the marketing hero's "Hey. That's not human." pattern:
 * the surrounding phrase renders dimmed, the addressee renders at full
 * opacity so it pops as the line's anchor. Inter only — weight + size
 * + letter-spacing carry the editorial feel.
 *
 * `accentName` is optional — when omitted, the user's onboarding handle
 * (with a fallback chain handled in mapUser → user.displayName) is used.
 */
export function Greeting({
  greeting,
  accentName,
  subtitle,
}: {
  greeting: string;
  accentName?: string;
  subtitle: string;
}) {
  const { user } = useAuth();
  const name = accentName ?? user?.displayName ?? "there";
  return (
    <header className="home-greet">
      <div>
        <h1 className="home-greet-h1">
          {greeting}, <em>{name}</em>
        </h1>
        <p className="home-greet-sub">{subtitle}</p>
      </div>
    </header>
  );
}
