"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { PBUserRecord } from "@/lib/pocketbase";
import type { Plan } from "@heynotai/shared";
import { UpgradeModal } from "./UpgradeModal";
import styles from "./PlanCard.module.css";

const PLAN_DETAILS: Record<
  Plan,
  { name: string; price: number; features: string[] }
> = {
  check: {
    name: "Check",
    price: 0,
    features: [
      "AI text detection",
      "Confidence score",
      "Sentence-level highlighting",
    ],
  },
  verify: {
    name: "Verify",
    price: 10,
    features: [
      "AI text detection",
      "Confidence score",
      "Sentence-level highlighting",
      "Browser extension",
      "Paraphrase + tone analysis",
      "Priority support",
    ],
  },
  certify: {
    name: "Certify",
    price: 30,
    features: [
      "Everything in Verify",
      "Shareable verification report",
      "Audit history",
      "Team workspace",
      "API access",
    ],
  },
  team: {
    name: "Team",
    price: 80,
    features: [
      "Everything in Certify",
      "Shared scans, collections, monitors",
      "Manager-controlled member seats",
      "Pooled API quota",
      "SSO ready (when configured)",
    ],
  },
};

const NEXT_PLAN: Record<Plan, Plan | null> = {
  check: "verify",
  verify: "certify",
  certify: "team",
  team: null,
};

export function PlanCard({ record }: { record: PBUserRecord | null }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const planId: Plan =
    record?.plan === "verify" ||
    record?.plan === "certify" ||
    record?.plan === "team"
      ? (record.plan as Plan)
      : "check";

  const detail = PLAN_DETAILS[planId];
  const nextId = NEXT_PLAN[planId];
  const next = nextId ? PLAN_DETAILS[nextId] : null;
  const badge = record?.planBadge ?? (planId === "check" ? "FREE" : "MONTHLY");
  const renewsOn = record?.planRenewsOn
    ? new Date(record.planRenewsOn).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div>
          <div className={styles.name}>
            {detail.name}
            <span className={styles.badge}>{badge}</span>
          </div>
          <p className={styles.renews}>
            {planId === "check" ? "Free forever" : (
              <>
                Renews <strong>{renewsOn}</strong>
              </>
            )}
          </p>
        </div>
        <div className={styles.priceBlock}>
          <div className={styles.price}>
            <span className={styles.priceNum}>${detail.price}</span>
            <span className={styles.pricePeriod}>/ month</span>
          </div>
          {detail.price > 0 && (
            <p className={styles.billed}>billed monthly</p>
          )}
        </div>
      </header>

      <ul className={styles.features}>
        {detail.features.map((feat) => (
          <li key={feat} className={styles.feat}>
            <Icon name="check" size={11} />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <footer className={styles.actions}>
        {next && (
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            onClick={() => setUpgradeOpen(true)}
          >
            <Icon name="sparkle" size={11} />
            Upgrade to {next.name}
          </button>
        )}
        <button
          type="button"
          className={`${styles.btn} ${styles.secondary}`}
          onClick={() => setUpgradeOpen(true)}
        >
          Compare plans
        </button>
        {planId !== "check" && (
          <button type="button" className={`${styles.btn} ${styles.secondary}`}>
            Cancel
          </button>
        )}
      </footer>

      {upgradeOpen && (
        <UpgradeModal
          currentPlan={planId}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
    </article>
  );
}
