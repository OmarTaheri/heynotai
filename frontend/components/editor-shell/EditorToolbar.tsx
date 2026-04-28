"use client";

import type { ReactNode, MouseEventHandler } from "react";
import styles from "./EditorToolbar.module.css";

/**
 * Generic floating Figma-style toolbar. Renders the dark capsule and
 * positions itself above the canvas. Editor-specific buttons are passed
 * as children using the `Toolbar.Button`, `Toolbar.Sep`, etc. exports
 * below — so audio/image/video editors can compose their own button
 * arrangements without duplicating the toolbar chrome.
 */
export function Toolbar({ children, ariaLabel = "Editor toolbar" }: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <nav className={styles.toolbar} aria-label={ariaLabel}>
      {children}
    </nav>
  );
}

interface ButtonProps {
  tip?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  active?: boolean;
  variant?: "info";
  ariaLabel?: string;
  children: ReactNode;
}

function ToolbarButton({
  tip,
  onClick,
  disabled,
  active,
  variant,
  ariaLabel,
  children,
}: ButtonProps) {
  const cls = [
    styles.btn,
    active && variant === "info" ? styles.btnInfoActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      data-tip={tip}
      aria-label={ariaLabel ?? tip}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span className={styles.sep} aria-hidden />;
}

interface ScanProps {
  onClick: () => void;
  scanning: boolean;
  tip?: string;
  children: ReactNode;
}

function ToolbarScanButton({ onClick, scanning, tip = "Re-scan", children }: ScanProps) {
  return (
    <button
      type="button"
      className={`${styles.scanBtn}${scanning ? ` ${styles.scanBtnScanning}` : ""}`}
      onClick={onClick}
      disabled={scanning}
      data-tip={tip}
      aria-label={tip}
    >
      <span className={styles.scanPulse} />
      {children}
    </button>
  );
}

interface CounterProps {
  current: number;
  total: number;
  totalLabel?: string;
}

function ToolbarFlagCounter({ current, total, totalLabel = "flagged" }: CounterProps) {
  return (
    <div className={styles.flagct}>
      <span className={styles.flagctN}>{total === 0 ? 0 : current}</span>
      <span className={styles.flagctL}>
        / {total} {totalLabel}
      </span>
    </div>
  );
}

Toolbar.Button = ToolbarButton;
Toolbar.Sep = ToolbarSep;
Toolbar.ScanButton = ToolbarScanButton;
Toolbar.FlagCounter = ToolbarFlagCounter;
