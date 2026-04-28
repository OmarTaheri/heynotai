import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { REPORTS_QUOTA } from "@/lib/reports-data";
import styles from "./ReportsQuota.module.css";

/** Footer card under the reports list. Distinct from the sidebar's
 *  UsageCard — this one is reports-specific and explains the public
 *  link branding constraint. */
export function ReportsQuota() {
  return (
    <aside className={styles.quota}>
      <div className={styles.left}>
        <span className={styles.icon} aria-hidden>
          <Icon name="share" size={18} />
        </span>
        <p className={styles.text}>
          <strong>
            {REPORTS_QUOTA.used} of {REPORTS_QUOTA.total}
          </strong>{" "}
          reports created this month · <strong>{REPORTS_QUOTA.shared}</strong>{" "}
          publicly shared. Public reports show a "Powered by heynotai" footer
          — disable on Team plan.
        </p>
      </div>
      <Button variant="secondary">
        <Icon name="sparkle" size={13} />
        Upgrade to remove
      </Button>
    </aside>
  );
}
