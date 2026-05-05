import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Bottom-of-page "you're using N of M monitors" upsell card. Co-located
 * with the monitors page since it's the only consumer right now;
 * promote to ui/ when a second usage card needs it.
 */
export function MonitorPlanUpsell({
  used,
  cap,
  plan,
}: {
  used: number;
  cap: number;
  plan: string;
}) {
  return (
    <div className="mon-plan">
      <div className="mon-plan-l">
        <div className="mon-plan-icon" aria-hidden>
          ∞
        </div>
        <div className="mon-plan-text">
          You&apos;re using{" "}
          <strong>
            {used} of {cap} monitors
          </strong>{" "}
          on your <em>{plan}</em> plan. Need more watches running at once?{" "}
          <strong>Certify lifts the cap</strong> and adds shared alert
          routing.
        </div>
      </div>
      <Button variant="primary" href="/app/upgrade">
        Compare plans
        <Icon name="arrow-right" size={13} />
      </Button>
    </div>
  );
}
