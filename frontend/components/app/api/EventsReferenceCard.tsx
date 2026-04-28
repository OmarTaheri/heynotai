import { Card } from "@/components/ui/Card";
import type { WebhookEvent } from "@/lib/api-data";

/**
 * Right-rail reference list of webhook event names + short
 * one-liners. Lives in a Card so it picks up the same surface
 * tone as the webhook cards next to it.
 */
export function EventsReferenceCard({ events }: { events: WebhookEvent[] }) {
  return (
    <Card padded as="aside" className="api-events-ref">
      <div className="api-events-title">
        <span>Webhook events</span>
        <a className="api-events-link" href="#">
          Docs
        </a>
      </div>
      <div className="api-events-list">
        {events.map((event) => (
          <div className="api-events-row" key={`${event.group}.${event.name}`}>
            <span className="api-events-name">
              <strong>{event.group}</strong>
              <span className="api-events-dot">.</span>
              {event.name}
            </span>
            <span className="api-events-desc">{event.desc}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
