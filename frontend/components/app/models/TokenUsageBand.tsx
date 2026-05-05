import {
  TYPE_LABEL,
  type EngineType,
  type TokenUsage,
} from "@/lib/models-data";
import styles from "./TokenUsageBand.module.css";

const SEGMENT_TONE: Record<EngineType, string> = {
  txt: styles.segTxt,
  img: styles.segImg,
  aud: styles.segAud,
  vid: styles.segVid,
};

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/**
 * Header card sitting above the engine list. Shows monthly token usage
 * with a multi-segment fill bar (one per content type), a compact legend
 * row, and a right-aligned "Remaining" balance with days-of-runway.
 *
 * Usage data comes from `GET /me/usage` via `ModelsClient`. When the
 * fetch hasn't resolved yet (`null`) we render a slim placeholder; for
 * Team accounts the plan budget is admin-assigned (`total === null`)
 * and we render a "custom allotment" line instead of the bar.
 */
export function TokenUsageBand({ usage }: { usage: TokenUsage | null }) {
  if (!usage) {
    return (
      <section className={`${styles.band} ${styles.bandLoading}`} aria-hidden>
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <h2 className={styles.title}>Tokens used this month</h2>
            <p className={styles.meta}>Loading usage…</p>
          </div>
        </div>
        <div className={styles.bar} />
      </section>
    );
  }

  if (usage.total === null) {
    return (
      <section className={styles.band}>
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <h2 className={styles.title}>Tokens used this month</h2>
            <p className={styles.meta}>
              <strong>{fmt(usage.used)}</strong> tokens spent · resets {usage.resetsOn} ·
              avg <strong>{fmt(usage.avgPerDay)} / day</strong>
            </p>
          </div>
          <div className={styles.balance}>
            <div className={styles.balanceLabel}>Allotment</div>
            <div className={styles.balanceValue}>Custom</div>
            <div className={styles.balanceSub}>Team plan — talk to your account manager</div>
          </div>
        </div>
      </section>
    );
  }

  const remaining = Math.max(0, usage.total - usage.used);
  const daysOfRunway =
    usage.avgPerDay > 0 ? Math.round(remaining / usage.avgPerDay) : 0;

  return (
    <section className={styles.band}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>Tokens used this month</h2>
          <p className={styles.meta}>
            <strong>{fmt(usage.used)}</strong> of <strong>{fmt(usage.total)}</strong> ·
            resets {usage.resetsOn} · avg <strong>{fmt(usage.avgPerDay)} / day</strong>
          </p>
        </div>
        <div className={styles.balance}>
          <div className={styles.balanceLabel}>Remaining</div>
          <div className={styles.balanceValue}>
            {fmt(remaining)} <span className={styles.balanceUnit}>tk</span>
          </div>
          <div className={styles.balanceSub}>
            ~{daysOfRunway} days at current rate
          </div>
        </div>
      </div>

      <div
        className={styles.bar}
        role="img"
        aria-label={`${fmt(usage.used)} of ${fmt(usage.total)} tokens used this month`}
      >
        {usage.segments.map((seg) => {
          const pct = usage.total ? (seg.value / usage.total) * 100 : 0;
          return (
            <span
              key={seg.type}
              className={`${styles.segment} ${SEGMENT_TONE[seg.type]}`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      <ul className={styles.legend}>
        {usage.segments.map((seg) => (
          <li key={seg.type} className={styles.legendItem}>
            <span
              className={`${styles.legendDot} ${SEGMENT_TONE[seg.type]}`}
              aria-hidden
            />
            <span>
              {TYPE_LABEL[seg.type]} · <strong>{fmt(seg.value)} tk</strong>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
