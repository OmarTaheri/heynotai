"use client";

/**
 * Full-screen farewell shown while signOut() is running. Reads the
 * chosen word from auth context (rotates each logout: "bye", "see ya",
 * "later"…). Just renders the word big and centered with a soft fade-in;
 * no pen stroke, so it reads as a parting note rather than the login
 * cold-open.
 */
export function GoodbyeSplash({ word }: { word: string }) {
  return (
    <div className="goodbye-splash" role="status" aria-live="polite" aria-label={`Signing out: ${word}`}>
      <span className="goodbye-word">{word}</span>
    </div>
  );
}
