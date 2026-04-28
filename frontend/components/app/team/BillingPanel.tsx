import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { BILLING } from "@/lib/team-data";

export function BillingPanel() {
  return (
    <Card className="team-rail-card">
      <div className="team-rail-title">
        <span>Billing</span>
        <button type="button" className="team-rail-link">
          View invoices
        </button>
      </div>

      <div className="team-bill">
        <div className="team-bill-row">
          <span className="team-bill-l">Plan</span>
          <span className="team-bill-r">{BILLING.planLabel}</span>
        </div>
        <div className="team-bill-row">
          <span className="team-bill-l">Seats</span>
          <span className="team-bill-r">{BILLING.seatsLabel}</span>
        </div>
        <div className="team-bill-row">
          <span className="team-bill-l">Pooled tokens</span>
          <span className="team-bill-r">{BILLING.pooledTokens}</span>
        </div>
        <div className="team-bill-row">
          <span className="team-bill-l">Next invoice</span>
          <span className="team-bill-r team-bill-big">
            {BILLING.nextInvoice}
            <em>{BILLING.invoiceUnit}</em>
          </span>
        </div>
        <div className="team-bill-row">
          <span className="team-bill-l">Renews</span>
          <span className="team-bill-r">{BILLING.renews}</span>
        </div>
      </div>

      <div className="team-bill-actions">
        <Button variant="primary" size="sm">
          <Icon name="users" size={11} />
          <span>{BILLING.addSeatsCta}</span>
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="key" size={11} />
          <span>Update payment method</span>
        </Button>
      </div>
    </Card>
  );
}
