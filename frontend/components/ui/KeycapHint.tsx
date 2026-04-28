import type { ReactNode } from "react";
import styles from "./KeycapHint.module.css";

/**
 * Keyboard-shortcut keycap. Visual hint that the surrounding text is a
 * keyboard input — used in toolbar copy ("press <KeycapHint>⌘V</KeycapHint>
 * to paste"). Renders as a `<kbd>` so screen readers announce it as one.
 */
export function KeycapHint({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
