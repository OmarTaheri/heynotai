import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { ScoreRing, verdictFromScore } from "./ScoreRing";
import { StatusPill, type ScanState } from "./StatusPill";
import styles from "./EditorTopBar.module.css";

export interface Collaborator {
  initials: string;
  src?: string | null;
}

interface Props {
  /** Trail of crumbs after the logo, e.g. ["Library", "Text scans"]. */
  crumbs: string[];
  /** Final crumb — usually the document filename (rendered in mono). */
  docName: string;
  scanState: ScanState;
  scanDurationMs?: number;
  score: number | null;
  collaborators?: Collaborator[];
  /** Slot for editor-specific actions (e.g. extra buttons). */
  actions?: ReactNode;
  onShare?: () => void;
}

const SCAN_LABEL: Record<ScanState, string> = {
  idle: "Scan idle",
  scanning: "Scanning · word-level",
  done: "Scan complete",
};

export function EditorTopBar({
  crumbs,
  docName,
  scanState,
  scanDurationMs,
  score,
  collaborators,
  actions,
  onShare,
}: Props) {
  const safeScore = score ?? 0;
  const verdict = verdictFromScore(safeScore);
  const label =
    scanState === "done" && scanDurationMs
      ? `Scan complete · ${(scanDurationMs / 1000).toFixed(1)}s`
      : SCAN_LABEL[scanState];

  return (
    <header className={styles.bar}>
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <Link href="/" className={styles.crumbLogo} aria-label="heynotai home">
          <Logo size="sm" startClosed />
        </Link>
        {crumbs.map((c) => (
          <Fragment key={c}>
            <span className={styles.crumbSep}>/</span>
            <span>{c}</span>
          </Fragment>
        ))}
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbDoc}>{docName}</span>
      </nav>

      <StatusPill state={scanState} label={label} />

      <div className={styles.grow} />

      <div className={styles.scoreBadge}>
        <ScoreRing value={safeScore} size={32} stroke={3} verdict={verdict} />
        <div className={styles.scoreLabel}>
          <span>
            <b>{safeScore}</b>/100
          </span>
          <span className={styles.scoreSub}>authenticity</span>
        </div>
      </div>

      {collaborators && collaborators.length > 0 && (
        <div className={`${styles.avatars} ${styles.avatarStack}`} aria-label="Collaborators">
          {collaborators.map((c, i) => (
            <Avatar key={`${c.initials}-${i}`} initials={c.initials} src={c.src} size="sm" />
          ))}
        </div>
      )}

      <button type="button" className={styles.share} onClick={onShare}>
        <Icon name="share" size={14} />
        <span>Share</span>
      </button>

      <button type="button" className={styles.iconBtn} aria-label="More options">
        <Icon name="more" size={18} />
      </button>

      {actions}
    </header>
  );
}
