import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import styles from "./SuggestEngine.module.css";

const ENGINE_REQUEST_MAILTO =
  "mailto:support@heynotai.io?subject=Engine%20request";

/**
 * Footer card inviting users to request a missing engine. Quiet
 * surface — a soft gradient sits beneath a single CTA so the page
 * doesn't end on an empty edge.
 */
export function SuggestEngine() {
  return (
    <section className={styles.card}>
      <div className={styles.copy}>
        <h3 className={styles.title}>Don&apos;t see an engine?</h3>
        <p className={styles.body}>
          If a generator is missing from this list, request it. Most requests
          ship within 2 weeks of release. We update the catalog every Tuesday.
        </p>
      </div>
      {/* Opens the user's mail client. The button previously had no
          handler at all, so the request went nowhere. */}
      <div className={styles.action}>
        <Button variant="primary" href={ENGINE_REQUEST_MAILTO}>
          <Icon name="plus" size={13} />
          Request an engine
        </Button>
      </div>
    </section>
  );
}
