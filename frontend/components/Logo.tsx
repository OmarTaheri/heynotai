"use client";

import { useEffect, useState } from "react";

/**
 * Brand logo: animated "hey[not]ai".
 * On mount, renders the full "heynotai", holds briefly, then collapses
 * the `[not]` and strikes through `ai` — reading as "hey ~~ai~~".
 * Hovering the closed logo reopens it back to "heynotai" for as long
 * as the pointer stays on it.
 */
interface Props {
  size?: "sm" | "md" | "lg";
  /** Skip the intro animation and render in the closed `hey~~ai~~` state
   *  from mount. Used by the sidebar so toggling collapse/expand never
   *  has to fight with the Logo's auto-close timer. */
  startClosed?: boolean;
}

const SIZE_PX: Record<NonNullable<Props["size"]>, string> = {
  sm: "18px",
  md: "22px",
  lg: "28px",
};

/** How long to hold the full "heynotai" before collapsing, in ms. */
const HOLD_MS = 1000;

export function Logo({ size = "md", startClosed = false }: Props) {
  const [closed, setClosed] = useState(startClosed);

  useEffect(() => {
    if (startClosed) return;
    const t = setTimeout(() => setClosed(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [startClosed]);

  return (
    <span
      className={`logo-word${closed ? " is-closed" : ""}`}
      aria-label="heynotai"
      style={{ fontSize: SIZE_PX[size] }}
    >
      <span className="logo-hey">hey</span>
      <span className="logo-not">
        <span className="logo-not-inner">not</span>
      </span>
      <span className="logo-ai">
        <span className="logo-strike" aria-hidden />
        ai
      </span>
    </span>
  );
}
