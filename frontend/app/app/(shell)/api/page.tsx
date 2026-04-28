import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHead } from "@/components/ui/SectionHead";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { CodeBlock } from "@/components/app/api/CodeBlock";
import { UsageMeter } from "@/components/app/api/UsageMeter";
import { KeysTable } from "@/components/app/api/KeysTable";
import { WebhookList } from "@/components/app/api/WebhookList";
import { RequestsLog } from "@/components/app/api/RequestsLog";
import { EventsReferenceCard } from "@/components/app/api/EventsReferenceCard";
import {
  API_KEYS,
  CODE_SAMPLES,
  REQUESTS,
  USAGE_BARS,
  USAGE_SUMMARY,
  WEBHOOK_EVENTS,
  WEBHOOKS,
} from "@/lib/api-data";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "API & webhooks" };

export default function ApiPage() {
  return (
    <ComingSoon feature="API & webhooks" subtitle="Programmatic access is landing soon.">
    <div className="api panel-reveal">
      <PageHeader
        title="API & webhooks"
        subtitle="Programmatic access to detection. Manage keys, set up webhooks, and watch your usage."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="file-text" size={13} />
              <span>API reference</span>
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={13} />
              <span>New key</span>
            </Button>
          </>
        }
      />

      <div className="api-quickstart">
        <CodeBlock samples={CODE_SAMPLES} />
        <UsageMeter
          used={USAGE_SUMMARY.used}
          quota={USAGE_SUMMARY.quota}
          avgPerDay={USAGE_SUMMARY.avgPerDay}
          peakValue={USAGE_SUMMARY.peakValue}
          peakLabel={USAGE_SUMMARY.peakLabel}
          rangeStart={USAGE_SUMMARY.rangeStart}
          rangeEnd={USAGE_SUMMARY.rangeEnd}
          p50={USAGE_SUMMARY.p50}
          bars={USAGE_BARS}
        />
      </div>

      <section>
        <SectionHead
          title="API keys"
          subtitle="create, rotate, and revoke"
        />
        <KeysTable keys={API_KEYS} />
      </section>

      <div className="api-body">
        <div className="api-body-main">
          <section>
            <SectionHead
              title="Webhooks"
              subtitle="deliveries retry up to 5 times"
            />
            <WebhookList webhooks={WEBHOOKS} />
          </section>

          <section>
            <SectionHead
              title="Recent requests"
              subtitle="last 50 calls"
            />
            <RequestsLog rows={REQUESTS} />
          </section>
        </div>

        <EventsReferenceCard events={WEBHOOK_EVENTS} />
      </div>
    </div>
    </ComingSoon>
  );
}
