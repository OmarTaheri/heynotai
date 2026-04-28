"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { updateProfile } from "@/lib/settings-api";
import type { Plan } from "@heynotai/shared";
import styles from "./UpgradeModal.module.css";

type Tier = {
  id: Plan;
  name: string;
  tagline: string;
  price: string;
  tone: "neutral" | "green" | "gold" | "info";
  popular?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "check",
    name: "Check",
    tagline: "A quick read on any text.",
    price: "$0",
    tone: "neutral",
    features: [
      "AI text detection",
      "Confidence score",
      "Sentence-level highlighting",
    ],
  },
  {
    id: "verify",
    name: "Verify",
    tagline: "For writers and editors who ship daily.",
    price: "$10",
    tone: "green",
    popular: true,
    features: [
      "Everything in Check",
      "Browser extension",
      "Paraphrase + tone analysis",
      "Priority support",
    ],
  },
  {
    id: "certify",
    name: "Certify",
    tagline: "For teams that need a paper trail.",
    price: "$30",
    tone: "gold",
    features: [
      "Everything in Verify",
      "Shareable verification report",
      "Audit history",
      "Team workspace",
      "API access",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "Shared workspace, manager-controlled seats.",
    price: "$80",
    tone: "info",
    features: [
      "Everything in Certify",
      "Shared scans, collections, monitors",
      "Manager-controlled member seats",
      "Pooled API quota",
    ],
  },
];

const TONE_CLASS: Record<Tier["tone"], string> = {
  neutral: styles.tierNeutral,
  green: styles.tierGreen,
  gold: styles.tierGold,
  info: styles.tierGold,
};

export function UpgradeModal({
  currentPlan = "verify",
  onClose,
}: {
  currentPlan?: Plan;
  onClose: () => void;
}) {
  const { refresh } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Plan | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = async (id: Plan) => {
    if (id === currentPlan) return;
    setBusy(id);
    try {
      // Stripe wiring is out of scope; for now we patch the plan
      // directly so the rest of the app reflects the choice. Real
      // billing flow goes through a webhook.
      await updateProfile({ plan: id });
      await refresh();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={styles.dialog}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={styles.close}
        >
          <Icon name="x" size={14} />
        </button>

        <div className={styles.head}>
          <h2 id="upgrade-title" className={styles.title}>
            Choose your plan
          </h2>
          <p className={styles.subtitle}>
            Four tiers, one job — keep human writing honest.
          </p>
        </div>

        <div className={styles.grid}>
          {TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlan;
            const ctaLabel = isCurrent
              ? "Current plan"
              : busy === tier.id
                ? "Updating…"
                : tier.id === "check"
                  ? "Downgrade"
                  : `Upgrade to ${tier.name}`;
            return (
              <div
                key={tier.id}
                className={`${styles.tier} ${TONE_CLASS[tier.tone]}`}
              >
                {tier.popular && !isCurrent && (
                  <span className={styles.popular}>Most Popular!</span>
                )}
                {isCurrent && (
                  <span className={styles.currentTag}>CURRENT</span>
                )}
                <h3 className={styles.tierName}>{tier.name}</h3>
                <p className={styles.tierTagline}>{tier.tagline}</p>
                <div className={styles.tierPrice}>
                  {tier.price}
                  <span className={styles.tierPeriod}>/mo</span>
                </div>
                <ul className={styles.tierFeatures}>
                  {tier.features.map((f) => (
                    <li key={f}>
                      <Icon name="check" size={12} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={isCurrent || busy !== null}
                  onClick={() => void choose(tier.id)}
                  className={`${styles.tierBtn} ${isCurrent ? styles.tierBtnDisabled : ""}`}
                >
                  {ctaLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
