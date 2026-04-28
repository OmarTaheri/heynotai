"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { PBUserRecord } from "@/lib/pocketbase";
import type { Invoice } from "@heynotai/shared";
import { SettingsSection } from "./SettingsSection";
import { PlanCard } from "./PlanCard";
import { useRegisterSection } from "./SettingsContext";
import styles from "./BillingSection.module.css";

export function BillingSection() {
  const [record, setRecord] = useState<PBUserRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingEmail, setBillingEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [r, inv] = await Promise.all([getProfile(), getInvoices()]);
        if (cancelled) return;
        setRecord(r);
        setInvoices(inv);
        const e = (r.billingEmail as string) ?? "";
        setBillingEmail(e);
        setOriginalEmail(e);
      } catch {
        // unauthenticated
      }
    })();
    return () => {
      cancelled = true;
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

  const paymentMethod = record?.paymentMethodLast4
    ? `•••• ${record.paymentMethodLast4}`
    : "Not set";
  const paymentExpires = record?.paymentExpires ?? "—";
  const billingAddress = record?.billingAddress ?? "—";
  const renewsOn = formatRenewal(record?.planRenewsOn);

  return (
    <SettingsSection
      id="billing"
      title="Plan & billing"
      description="Manage your subscription, payment method, and view invoices."
    >
      <PlanCard record={record} />

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
            <div className={styles.lbl}>Next invoice</div>
            <div className={styles.val}>—</div>
            <div className={styles.sub}>
              on <strong>{renewsOn}</strong>
            </div>
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
        <div className={styles.invoiceRow}>
          <div>
            <div className={styles.lbl}>Invoice history</div>
            <p className={styles.sub}>
              {invoices.length === 0
                ? "No invoices yet."
                : `Download past invoices for accounting`}
            </p>
          </div>
          {invoices.length > 0 && (
            <Button variant="secondary">
              <Icon name="upload" size={13} />
              View all {invoices.length} invoices
            </Button>
          )}
        </div>
        {invoices.slice(0, 5).map((inv) => {
          const url = invoicePdfUrl(inv);
          return (
            <div key={inv.id} className={styles.invoiceRow}>
              <div>
                <div className={styles.val}>
                  {inv.currency} {inv.amount.toFixed(2)}
                </div>
                <p className={styles.sub}>
                  Paid on {new Date(inv.paidOn).toLocaleDateString()}
                </p>
              </div>
              {url && (
                <Button variant="secondary" size="sm">
                  <a href={url} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </Card>
    </SettingsSection>
  );
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
