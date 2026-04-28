import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { TypeChip, type ScanType } from "@/components/ui/TypeChip";
import { Icon } from "@/components/Icon";
import {
  KIND_TAG_LABEL,
  type UpdateItem,
  type UpdateKind,
} from "@/lib/updates-data";
import { ModelPreviewRow } from "./ModelPreviewRow";
import { AccuracyCompare } from "./AccuracyCompare";
import { StatBand } from "./StatBand";
import styles from "./UpdateCard.module.css";

const KIND_TONE: Record<UpdateKind, PillTone> = {
  "new-model": "gold",
  accuracy: "info",
  product: "mixed",
  fix: "neutral",
};

export function UpdateCard({
  item,
  isUnread,
}: {
  item: UpdateItem;
  isUnread: boolean;
}) {
  return (
    <article className={styles.entry} data-kind={item.kind}>
      <span className={styles.marker} aria-hidden>
        <span className={styles.markerInner} />
      </span>

      <Card className={styles.card}>
        <div className={styles.head}>
          <div className={styles.tags}>
            {isUnread && (
              <Pill tone="ai" dot compact>
                NEW
              </Pill>
            )}
            <Pill tone={KIND_TONE[item.kind]} compact>
              {KIND_TAG_LABEL[item.kind]}
            </Pill>
            {item.contentType && (
              <TypeChip type={item.contentType as ScanType} />
            )}
          </div>
          <span className={styles.time}>{item.timestamp}</span>
        </div>

        <h3
          className={styles.title}
          dangerouslySetInnerHTML={{ __html: item.title }}
        />
        <p
          className={styles.desc}
          dangerouslySetInnerHTML={{ __html: item.description }}
        />

        {item.modelPreview && <ModelPreviewRow preview={item.modelPreview} />}
        {item.accuracyCompare && <AccuracyCompare data={item.accuracyCompare} />}
        {item.statBand && <StatBand stats={item.statBand} />}

        {(item.meta || item.cta) && (
          <div className={styles.foot}>
            {item.meta ? (
              <span
                className={styles.footMeta}
                dangerouslySetInnerHTML={{ __html: item.meta }}
              />
            ) : (
              <span />
            )}
            {item.cta &&
              (item.cta.href ? (
                <Link href={item.cta.href} className={styles.cta}>
                  {item.cta.label}
                  <Icon name="chevron-right" size={12} />
                </Link>
              ) : (
                <button type="button" className={styles.cta}>
                  {item.cta.label}
                  <Icon name="chevron-right" size={12} />
                </button>
              ))}
          </div>
        )}
      </Card>
    </article>
  );
}
