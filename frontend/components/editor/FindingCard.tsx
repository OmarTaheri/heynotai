import { Icon } from "@/components/Icon";
import type { AiFlag, FlagKind } from "@/lib/detection-types";
import styles from "./FindingCard.module.css";

interface Props {
  flag: AiFlag;
  active: boolean;
  onClick: () => void;
  excerpt?: string;
}

const KIND_LABEL: Record<FlagKind, string> = {
  gen: "AI-generated",
  match: "Paraphrase",
  plag: "Plagiarism",
};

const TAG_CLASS: Record<FlagKind, string> = {
  gen: styles.tagGen,
  match: styles.tagMatch,
  plag: styles.tagPlag,
};

const QUOTE_CLASS: Record<FlagKind, string> = {
  gen: "",
  match: styles.quoteMatch,
  plag: styles.quotePlag,
};

const VENDOR_BADGE: Record<string, { initials: string; cls: string }> = {
  openai: { initials: "G5", cls: styles.modelAvatarGpt },
  anthropic: { initials: "Cl", cls: styles.modelAvatarCl },
  google: { initials: "Ge", cls: styles.modelAvatarGem },
};

export function FindingCard({ flag, active, onClick, excerpt }: Props) {
  return (
    <article
      className={`${styles.card}${active ? ` ${styles.cardActive}` : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <header className={styles.head}>
        <span className={`${styles.tag} ${TAG_CLASS[flag.kind]}`}>
          <span className={styles.tagDot} />
          {KIND_LABEL[flag.kind]}
        </span>
        <span>{flag.confidence}% confidence</span>
        <span className={styles.pos}>{flag.label}</span>
      </header>

      {excerpt && (
        <blockquote className={`${styles.quote} ${QUOTE_CLASS[flag.kind]}`}>
          {excerpt}
        </blockquote>
      )}

      {flag.match && (
        <div className={styles.modelRow}>
          <span
            className={`${styles.modelAvatar} ${VENDOR_BADGE[flag.match.vendor]?.cls ?? ""}`}
          >
            {VENDOR_BADGE[flag.match.vendor]?.initials ?? "AI"}
          </span>
          <div className={styles.modelBody}>
            <div className={styles.modelName}>{flag.match.name}</div>
            <div className={styles.modelMeta}>
              {flag.match.vendor.toUpperCase()} · text · model match
            </div>
          </div>
          <div className={styles.modelPct}>{flag.confidence}%</div>
        </div>
      )}

      {flag.source && (
        <div className={styles.plag}>
          <div className={styles.plagUrl}>{flag.source.url}</div>
          <div className={styles.plagQuote}>{flag.source.quote}</div>
        </div>
      )}

      <footer className={styles.actions}>
        <button type="button" className={styles.btnDark} onClick={(e) => e.stopPropagation()}>
          <Icon name="check" size={11} />
          Mark reviewed
        </button>
        <button type="button" className={styles.btnGhost} onClick={(e) => e.stopPropagation()}>
          Dismiss
        </button>
        <span className={styles.grow} />
        <button
          type="button"
          className={`${styles.btnGhost} ${styles.btnIcon}`}
          onClick={(e) => e.stopPropagation()}
          aria-label="More"
        >
          <Icon name="more" size={14} />
        </button>
      </footer>
    </article>
  );
}
