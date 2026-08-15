import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import styles from "./SubscribeFooter.module.css";

/** Footer CTA under the changelog.
 *
 *  Only the RSS feed is offered, because it's the only channel that
 *  exists: there is no mail transport configured (see the password-reset
 *  handler in the API, which logs `deliveryConfigured: false`) and no
 *  verified social account to point at. The previous "Email me weekly"
 *  and "Follow on X" buttons had no handlers and no destination. */
export function SubscribeFooter() {
  return (
    <section className={styles.foot}>
      <h3 className={styles.title}>
        Want to know <em>when we ship?</em>
      </h3>
      <p className={styles.body}>
        Every model addition, accuracy change, and product update lands in
        the feed below — point your reader at it and you&apos;ll get them as
        they publish.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" href="/updates/rss.xml">
          <Icon name="share" size={13} />
          Subscribe to RSS
        </Button>
      </div>
    </section>
  );
}
