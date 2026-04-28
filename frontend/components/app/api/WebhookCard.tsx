import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import type { Webhook, WebhookStatus } from "@/lib/api-data";

const STATUS_TONE: Record<WebhookStatus, PillTone> = {
  healthy: "human",
  error: "ai",
  paused: "neutral",
};

const STATUS_ICON: Record<WebhookStatus, IconName> = {
  healthy: "activity",
  error: "alert-triangle",
  paused: "pause",
};

/**
 * One webhook endpoint card. Header strip + (optional) 4-stat strip
 * + event chips. Paused webhooks hide the stats strip since they
 * have no recent traffic.
 */
export function WebhookCard({ webhook }: { webhook: Webhook }) {
  return (
    <Card className="api-wh">
      <div className="api-wh-head">
        <div className="api-wh-icon" aria-hidden>
          <Icon name={STATUS_ICON[webhook.status]} size={16} />
        </div>
        <div className="api-wh-info">
          <div className="api-wh-name">
            <span>{webhook.name}</span>
            {webhook.nameSuffix && (
              <span className="api-wh-name-suffix">· {webhook.nameSuffix}</span>
            )}
          </div>
          <div className="api-wh-url">{webhook.url}</div>
        </div>
        <Pill tone={STATUS_TONE[webhook.status]} dot={webhook.status !== "paused"}>
          {webhook.statusLabel}
        </Pill>
        <div className="api-wh-actions">
          {webhook.status === "paused" ? (
            <button type="button" className="api-wh-action" aria-label="Resume">
              <Icon name="play" size={13} />
            </button>
          ) : (
            <>
              <button type="button" className="api-wh-action" aria-label="Test">
                <Icon name="bolt" size={13} />
              </button>
              <button type="button" className="api-wh-action" aria-label="Pause">
                <Icon name="pause" size={13} />
              </button>
            </>
          )}
          <button type="button" className="api-wh-action" aria-label="More">
            <Icon name="more" size={13} />
          </button>
        </div>
      </div>

      {webhook.stats && (
        <div className="api-wh-stats">
          {webhook.stats.map((stat) => (
            <div className="api-wh-stat" key={stat.label}>
              <div className="api-wh-stat-lbl">{stat.label}</div>
              <div className="api-wh-stat-val">
                {stat.value}
                {stat.unit && (
                  <em
                    className={
                      stat.unitTone ? `api-wh-stat-unit is-${stat.unitTone}` : "api-wh-stat-unit"
                    }
                  >
                    {stat.unit}
                  </em>
                )}
              </div>
              <div className="api-wh-stat-sub">{stat.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="api-wh-events">
        <span className="api-wh-events-lbl">EVENTS</span>
        {webhook.events.map((event) => (
          <span key={event} className="api-wh-evt">
            {event}
          </span>
        ))}
      </div>
    </Card>
  );
}
