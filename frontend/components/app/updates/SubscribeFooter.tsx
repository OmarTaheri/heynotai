import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import styles from "./SubscribeFooter.module.css";

export function SubscribeFooter() {
  return (
    <section className={styles.foot}>
      <h3 className={styles.title}>
        Want to know <em>when we ship?</em>
      </h3>
      <p className={styles.body}>
        We publish updates every Tuesday — new model support, accuracy
        improvements, product changes. Pick how you want to hear about
        them.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" size="sm">
          <Icon name="send" size={13} />
          Email me weekly
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="share" size={13} />
          Subscribe to RSS
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="link" size={13} />
          Follow on X
        </Button>
      </div>
    </section>
  );
}
