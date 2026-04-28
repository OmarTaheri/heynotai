import { WebhookCard } from "./WebhookCard";
import type { Webhook } from "@/lib/api-data";

export function WebhookList({ webhooks }: { webhooks: Webhook[] }) {
  return (
    <div className="api-wh-list">
      {webhooks.map((webhook) => (
        <WebhookCard key={webhook.id} webhook={webhook} />
      ))}
    </div>
  );
}
