"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormRow } from "@/components/ui/FormRow";
import { Icon } from "@/components/Icon";
import {
  getInvoices,
  getProfile,
  invoicePdfUrl,
  updateProfile,
} from "@/lib/settings-api";
import { syncSubscription } from "@/lib/billing-api";
import { pb, type PBUserRecord } from "@/lib/pocketbase";
import { useAuth } from "@/lib/auth";
import type { Invoice, Plan } from "@heynotai/shared";
import { SettingsSection } from "./SettingsSection";
import { PlanCard } from "./PlanCard";
import { useRegisterSection } from "./SettingsContext";
import styles from "./BillingSection.module.css";

export function BillingSection() {
  console.log("[billing] BillingSection render");
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [record, setRecord] = useState<PBUserRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingEmail, setBillingEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [syncing, setSyncing] = useState(false);
  const autoSyncedRef = useRef(false);

  // Auto-sync runs independently of the profile/invoice load so a
  // failure on either of those (404 invoices, etc.) doesn't gate the
  // self-heal call. /billing/sync is a no-op for users without a
  // Stripe customer linked.
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    console.log("[billing] auto-sync useEffect entered, firing /billing/sync");
    void (async () => {
      try {
        await syncSubscription();
        const fresh = await getProfile();
        setRecord(fresh);
        const email = (fresh.billingEmail as string) ?? "";
        setBillingEmail(email);
        setOriginalEmail(email);
        try {
          const inv = await getInvoices();
          setInvoices(inv);
        } catch {
          // invoice list is best-effort
        }
        console.log("[billing] auto-sync result", {
          plan: fresh.plan,
          stripeCustomerId: fresh.stripeCustomerId,
          stripeSubscriptionId: fresh.stripeSubscriptionId,
          planRenewsOn: fresh.planRenewsOn,
          billingEmail: fresh.billingEmail,
        });
        await refreshAuth();
      } catch (err) {
        console.warn("[billing] auto-sync failed", err);
      }
    })();
  }, [refreshAuth]);

  useEffect(() => {
    console.log("[billing] BillingSection useEffect entered");
    let cancelled = false;
    let unsub: (() => void) | null = null;

    async function loadInvoices() {
      try {
        const inv = await getInvoices();
        if (!cancelled) setInvoices(inv);
      } catch {
        // unauthenticated
      }
    }

    void (async () => {
      let r: PBUserRecord | null = null;
      try {
        r = await getProfile();
        if (cancelled) return;
        setRecord(r);
        const e = (r.billingEmail as string) ?? "";
        setBillingEmail(e);
        setOriginalEmail(e);

        console.log("[billing] BillingSection loaded record", {
          id: r.id,
          plan: r.plan,
          planCycle: r.planCycle,
          planRenewsOn: r.planRenewsOn,
          stripeCustomerId: r.stripeCustomerId,
          stripeSubscriptionId: r.stripeSubscriptionId,
        });
      } catch (err) {
        console.warn("[billing] getProfile failed", err);
        return;
      }

      try {
        const inv = await getInvoices();
        if (!cancelled) setInvoices(inv);
      } catch (err) {
        console.warn("[billing] getInvoices failed", err);
      }

      // Subscribe to live updates on this user record so webhook-
      // driven changes (plan upgrades/cancellations) land in this
      // tab immediately instead of waiting for a reload.
      try {
        await pb.collection("users").subscribe(r.id, (e) => {
          if (cancelled) return;
          if (e.action === "update") {
            console.log("[billing] realtime user update", {
              plan: (e.record as PBUserRecord).plan,
            });
            setRecord(e.record as PBUserRecord);
            void loadInvoices();
          }
        });
        const id = r.id;
        unsub = () => {
          void pb.collection("users").unsubscribe(id);
        };
      } catch (err) {
        console.warn("[billing] realtime subscribe failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const dirty = useMemo(
    () => billingEmail !== originalEmail,
    [billingEmail, originalEmail],
  );

  useRegisterSection("billing", {
    dirty,
    save: async () => {
      if (!dirty) return;
      const r = await updateProfile({ billingEmail });
      setRecord(r);
      setOriginalEmail(billingEmail);
    },
    discard: () => setBillingEmail(originalEmail),
  });

  const planId: Plan = (record?.plan as Plan) ?? "check";
  const isFree = planId === "check";
  const paymentMethod = record?.paymentLast4
    ? `${record.paymentBrand ? `${capitalize(record.paymentBrand)} ` : ""}•••• ${record.paymentLast4}`
    : "Not set";
  const paymentExpires = record?.paymentExpires ?? "—";
  const billingAddress = record?.billingAddress ?? "—";
  const renewsOn = formatRenewal(record?.planRenewsOn);
  const pendingPlan = record?.pendingPlan as Plan | undefined;
  const pendingPlanCycle = record?.pendingPlanCycle as
    | "monthly"
    | "yearly"
    | undefined;
  const pendingPlanEffective = record?.pendingPlanEffective as
    | string
    | undefined;

  const onRefresh = async () => {
    setSyncing(true);
    try {
      await syncSubscription();
      const fresh = await getProfile();
      setRecord(fresh);
      const inv = await getInvoices();
      setInvoices(inv);
      await refreshAuth();
    } catch {
      // Surfacing this isn't worth a toast for now — the live
      // subscription will keep the UI honest, and re-clicking is cheap.
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SettingsSection
      id="billing"
      title="Plan & billing"
      description={
        isFree
          ? "You're on the free plan — upgrade to unlock invoices, payment methods, and audit trails."
          : "Manage your subscription, payment method, and view invoices."
      }
    >
      <PlanCard
        record={record}
        onCancelled={async () => {
          try {
            const fresh = await getProfile();
            setRecord(fresh);
          } catch {
            // best effort
          }
        }}
      />

      {pendingPlan && pendingPlanEffective ? (
        <Card>
          <div className={styles.pendingBanner}>
            <div className={styles.pendingIcon} aria-hidden>
              <Icon name="sparkle" size={16} />
            </div>
            <div className={styles.pendingBody}>
              {pendingPlan === "check" ? (
                <>
                  <div className={styles.pendingTitle}>
                    Cancels on{" "}
                    <strong>{formatRenewal(pendingPlanEffective)}</strong>
                  </div>
                  <p className={styles.pendingText}>
                    Your plan stays active with all features until then —
                    no further charges. You can undo the cancellation any
                    time before that date.
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.pendingTitle}>
                    Switches to{" "}
                    {pendingPlan === "verify"
                      ? "Verify"
                      : pendingPlan === "certify"
                        ? "Certify"
                        : pendingPlan}
                    {pendingPlanCycle ? ` ${pendingPlanCycle}` : ""} on{" "}
                    <strong>{formatRenewal(pendingPlanEffective)}</strong>
                  </div>
                  <p className={styles.pendingText}>
                    You scheduled a downgrade. Your current plan stays
                    active with all features until that date.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {isFree ? (
        <Card>
          <div className={styles.empty}>
            <div className={styles.emptyIcon} aria-hidden>
              <Icon name="sparkle" size={18} />
            </div>
            <div className={styles.emptyBody}>
              <div className={styles.emptyTitle}>
                No billing details to show
              </div>
              <p className={styles.emptyText}>
                The Check plan is free forever — there&apos;s no card on
                file, no invoices, and no renewal date. Upgrade to Verify
                or Certify to unlock payment methods, invoice history, and
                VAT-compliant billing.
              </p>
            </div>
            <div className={styles.emptyActions}>
              <Button
                variant="primary"
                onClick={() => router.push("/app/upgrade")}
              >
                <Icon name="sparkle" size={13} />
                See paid plans
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefresh}
                disabled={syncing}
              >
                {syncing ? "Syncing…" : "Refresh from Stripe"}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className={styles.grid}>
              <div className={styles.block}>
                <div className={styles.lbl}>Payment method</div>
                <div className={styles.val}>{paymentMethod}</div>
                <div className={styles.sub}>
                  Expires <strong>{paymentExpires}</strong> · default
                </div>
              </div>
              <div className={`${styles.block} ${styles.blockBorder}`}>
                {pendingPlan === "check" && pendingPlanEffective ? (
                  <>
                    <div className={styles.lbl}>Plan ends</div>
                    <div className={styles.val}>
                      {formatRenewal(pendingPlanEffective)}
                    </div>
                    <div className={styles.sub}>
                      <strong>No further charges</strong> · cancellation
                      scheduled
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.lbl}>Next invoice</div>
                    <div className={styles.val}>—</div>
                    <div className={styles.sub}>
                      on <strong>{renewsOn}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
            <FormRow
              label="Billing email"
              hint="Where invoices are sent"
              control={
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className="settings-input"
                />
              }
            />
            <FormRow
              label="Billing address & tax ID"
              hint="For VAT-compliant invoicing"
              control={<span className="settings-readout">{billingAddress}</span>}
              aux={
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
              }
            />
          </Card>

          <Card>
            <div className={styles.invoiceHeader}>
              <div>
                <div className={styles.invoiceTitle}>Invoice history</div>
                <p className={styles.invoiceSub}>
                  {invoices.length === 0
                    ? "No invoices yet — your first will land here after the next billing cycle."
                    : `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} on file`}
                </p>
              </div>
              <div className={styles.invoiceActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefresh}
                  disabled={syncing}
                >
                  {syncing ? "Syncing…" : "Refresh from Stripe"}
                </Button>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className={styles.invoiceEmpty}>
                When Stripe charges your card, the receipt will appear here.
              </div>
            ) : (
              <div className={styles.invoiceList}>
                {invoices.map((inv) => {
                  const url = invoicePdfUrl(inv);
                  const date = new Date(inv.paidOn);
                  const dateLabel = isNaN(date.getTime())
                    ? inv.paidOn
                    : date.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                  return (
                    <InvoiceRow
                      key={inv.id}
                      dateLabel={dateLabel}
                      amount={inv.amount}
                      currency={inv.currency}
                      url={url}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </SettingsSection>
  );
}

function InvoiceRow({
  dateLabel,
  amount,
  currency,
  url,
}: {
  dateLabel: string;
  amount: number;
  currency: string;
  url: string | null;
}) {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? "";
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return (
    <div className={styles.invoiceItem}>
      <div className={styles.invoiceLead}>
        <span className={styles.invoiceDate}>{dateLabel}</span>
        <span className={styles.invoiceLeadDivider} aria-hidden>
          ·
        </span>
        <span className={styles.invoiceAmount}>
          {symbol}
          {formatted}
          <span className={styles.invoiceCurrency}>
            {currency.toUpperCase()}
          </span>
        </span>
      </div>
      <div className={styles.invoiceTrail}>
        <span className={styles.invoiceStatusPill}>
          <span className={styles.invoiceStatusDot} aria-hidden />
          Paid
        </span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={styles.invoiceDownload}
            aria-label="Download receipt PDF"
          >
            <span className={styles.invoiceDownloadIcon} aria-hidden>
              <Icon name="upload" size={12} />
            </span>
            Receipt
          </a>
        ) : (
          <span className={styles.invoiceDownloadEmpty}>not on file</span>
        )}
      </div>
    </div>
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
};

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatRenewal(d: string | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}
