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
  gen: styles.quoteGen,
  match: styles.quoteMatch,
  plag: styles.quotePlag,
};

const EXPLANATION: Record<FlagKind, string> = {
  gen: "This passage carries markers of machine generation: low lexical burstiness, uniform sentence cadence, and template-like transitions. The confidence reflects how strongly these signals cluster in the span.",
  match: "The phrasing here closely echoes the output style of the model identified above. Restructuring sentence boundaries or substituting domain-specific vocabulary usually reduces this signal.",
  plag: "This passage matches indexed source material. The source URL and the matched quote are shown below — review and cite, or rewrite to remove the overlap.",
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
        <span className={styles.confidence}>{flag.confidence}% confidence</span>
        <span className={styles.pos}>{flag.label}</span>
      </header>

      {excerpt && (
        <blockquote className={`${styles.quote} ${QUOTE_CLASS[flag.kind]}`}>
          {excerpt}
        </blockquote>
      )}

      <p className={styles.explain}>{EXPLANATION[flag.kind]}</p>

      {flag.source && (
        <div className={styles.plag}>
          <div className={styles.plagUrl}>{flag.source.url}</div>
          <div className={styles.plagQuote}>{flag.source.quote}</div>
        </div>
      )}
    </article>
  );
}
