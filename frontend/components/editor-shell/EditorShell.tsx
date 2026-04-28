import type { ReactNode } from "react";
import styles from "./EditorShell.module.css";

interface Props {
  /** Top bar — breadcrumb + status pill + score badge + actions. */
  topbar: ReactNode;
  /** Main canvas — the document/medium being edited. */
  canvas: ReactNode;
  /** Right-side inspector — analysis panel for the medium. */
  inspector?: ReactNode;
  /** Floating toolbar (rendered as a sibling, fixed-positioned). */
  toolbar?: ReactNode;
  /** Optional class on the main canvas (e.g. for a `is-scanning` modifier). */
  mainClassName?: string;
}

/**
 * Generic editor shell. Provides the 4-slot grid layout (topbar / main /
 * panel / floating toolbar) used by every editor surface — text, audio,
 * image, video. Each medium plugs its own canvas + inspector content
 * into the slots and the chrome stays consistent.
 */
export function EditorShell({
  topbar,
  canvas,
  inspector,
  toolbar,
  mainClassName,
}: Props) {
  return (
    <div className={styles.app}>
      <div className={styles.topbar}>{topbar}</div>
      <main className={`${styles.main}${mainClassName ? ` ${mainClassName}` : ""}`}>
        {canvas}
      </main>
      {inspector && <aside className={styles.panel}>{inspector}</aside>}
      {toolbar}
    </div>
  );
}
