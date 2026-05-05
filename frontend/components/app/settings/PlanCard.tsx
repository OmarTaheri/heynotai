"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { PBUserRecord } from "@/lib/pocketbase";
import type { Plan } from "@heynotai/shared";
import { getPlan, formatTokens, TOP_PLANS } from "@/lib/plans-data";
import { cancelSubscription, undoCancelSubscription } from "@/lib/billing-api";
import { useAuth } from "@/lib/auth";
import styles from "./PlanCard.module.css";

/** Per-plan accent: drives the gradient + badge tint on the card.
 *  Mirrors the tone field on PlanInfo; falls back to the green CTA
 *  tokens so existing styles stay valid. */
function planAccentStyle(plan: Plan): CSSProperties {
  const tone = getPlan(plan).tone;
  const palette: Record<
    "neutral" | "cta" | "gold" | "accent",
    { accent: string; deep: string; ring: string; ink: string }
  > = {
    neutral: {
      accent: "var(--color-fg-mid)",
      deep: "var(--color-fg-dim)",
      ring: "color-mix(in oklch, var(--color-fg-mid) 30%, transparent)",
      ink: "var(--color-fg)",
    },
    cta: {
      accent: "var(--color-cta)",
      deep: "var(--color-cta-deep)",
      ring: "var(--color-cta-ring)",
      ink: "var(--color-cta-ink)",
    },
    gold: {
      accent: "var(--color-gold)",
      deep: "color-mix(in oklch, var(--color-gold) 65%, black)",
      ring: "color-mix(in oklch, var(--color-gold) 40%, transparent)",
      ink: "var(--color-gold-ink)",
    },
    accent: {
      accent: "var(--color-accent)",
      deep: "color-mix(in oklch, var(--color-accent) 65%, black)",
      ring: "color-mix(in oklch, var(--color-accent) 40%, transparent)",
      ink: "var(--color-accent-ink)",
    },
  };
  const c = palette[tone];
  return {
    ["--plan-accent" as never]: c.accent,
    ["--plan-accent-deep" as never]: c.deep,
    ["--plan-accent-ring" as never]: c.ring,
    ["--plan-accent-ink" as never]: c.ink,
  } as CSSProperties;
}

const NEXT_PLAN: Record<Plan, Plan | null> = {
  check: "verify",
  verify: "certify",
  certify: null,
  team: null,
};

/** Settings → Plan & billing card. Reads plan info from the shared
 *  `plans-data` source so features, scan budgets, and prices stay in
 *  lockstep with the picker on /app/upgrade and /pricing. */
export function PlanCard({
  record,
  onCancelled,
}: {
  record: PBUserRecord | null;
  /** Called after the cancel/undo round-trip succeeds so the parent
   *  can re-fetch the user record + refresh auth context. */
  onCancelled?: () => void;
}) {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const pendingPlan = record?.pendingPlan;
  const pendingPlanEffective = record?.pendingPlanEffective;
  // True when a cancellation is already scheduled for this user.
  const cancelScheduled =
    pendingPlan === "check" && Boolean(pendingPlanEffective);

  const renewLabel = record?.planRenewsOn
    ? new Date(record.planRenewsOn).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "the end of this period";

  const onConfirmCancel = async () => {
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelSubscription();
      await refreshAuth();
      onCancelled?.();
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "Couldn't schedule cancellation. Try again in a moment.",
      );
    } finally {
      setCancelBusy(false);
    }
  };

  const onUndoCancel = async () => {
    setCancelBusy(true);
    setCancelError(null);
    try {
      await undoCancelSubscription();
      await refreshAuth();
      onCancelled?.();
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "Couldn't restore your subscription. Try again in a moment.",
      );
    } finally {
      setCancelBusy(false);
    }
  };

  const planId: Plan =
    record?.plan === "verify" ||
    record?.plan === "certify" ||
    record?.plan === "team"
      ? (record.plan as Plan)
      : "check";

  if (planId === "team") {
    // Team accounts are admin-provisioned with a custom token allotment
    // and aren't represented in the self-serve plan catalogue, so we
    // render a stripped-down summary instead of the standard card.
    return (
      <article className={styles.card} style={planAccentStyle("team")}>
        <header className={styles.head}>
          <div>
            <div className={styles.name}>
              Team
              <span className={styles.badge}>CUSTOM</span>
            </div>
            <p className={styles.renews}>
              Custom plan — managed by your admin
            </p>
          </div>
        </header>
        <ul className={styles.features}>
          <li className={styles.feat}>
            <Icon name="check" size={11} />
            <span>Custom token allotment</span>
          </li>
          <li className={styles.feat}>
            <Icon name="check" size={11} />
            <span>Shared collections + monitors</span>
          </li>
          <li className={styles.feat}>
            <Icon name="check" size={11} />
            <span>SSO + role-based access</span>
          </li>
        </ul>
      </article>
    );
  }

  const detail = getPlan(planId);
  const nextId = NEXT_PLAN[planId];
  const cycle = record?.planCycle || (planId === "check" ? null : "monthly");
  // When a cancellation is scheduled the badge swaps to a clearer
  // "ENDING" tag and the "Renews <date>" copy becomes "Ends <date>"
  // so the card itself communicates the wind-down state.
  const badge = cancelScheduled
    ? "ENDING"
    : (record?.planBadge && record.planBadge.trim()) ||
      (planId === "check"
        ? "FOREVER"
        : cycle === "yearly"
          ? "YEARLY"
          : "MONTHLY");
  const formatDate = (s: string | undefined) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
  const renewsOn = formatDate(record?.planRenewsOn);
  const endsOn = formatDate(pendingPlanEffective ?? undefined);
  const showUpgrade =
    !TOP_PLANS.has(planId) && nextId !== null && !cancelScheduled;
  const priceForCycle = cycle === "yearly" ? detail.yearly : detail.monthly;

  return (
    <article
      className={`${styles.card}${cancelScheduled ? ` ${styles.cardEnding}` : ""}`}
      style={planAccentStyle(planId)}
    >
      <header className={styles.head}>
        <div>
          <div className={styles.name}>
            {detail.name}
            <span
              className={`${styles.badge}${cancelScheduled ? ` ${styles.badgeEnding}` : ""}`}
            >
              {badge}
            </span>
          </div>
          <p className={styles.renews}>
            {planId === "check" ? (
              "Free forever"
            ) : cancelScheduled ? (
              <>
                Ends <strong>{endsOn}</strong> · no further charges
              </>
            ) : (
              <>
                Renews <strong>{renewsOn}</strong>
              </>
            )}
          </p>
        </div>
        <div className={styles.priceBlock}>
          <div className={styles.price}>
            <span className={styles.priceNum}>${priceForCycle}</span>
            <span className={styles.pricePeriod}>
              / {cycle === "yearly" ? "year" : "month"}
            </span>
          </div>
          {priceForCycle > 0 && (
            <p className={styles.billed}>
              billed {cycle === "yearly" ? "annually" : "monthly"}
            </p>
          )}
          <p className={styles.scans}>
            <strong>{formatTokens(detail.tokensPerMonth)}</strong> tokens / month
          </p>
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
        {/* When the user is on monthly, the highest-leverage action is
         *  switching to yearly (saves 17%). Otherwise fall back to the
         *  next-tier upgrade. Hidden entirely when neither makes sense
         *  (already certify-yearly / team) or when a cancellation is
         *  already scheduled — pushing an upsell on a winding-down plan
         *  is the wrong moment to ask. */}
        {planId !== "check" && cycle === "monthly" && !cancelScheduled ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            onClick={() =>
              router.push(`/app/upgrade?plan=${planId}&cycle=yearly`)
            }
          >
            <Icon name="sparkle" size={11} />
            Switch to yearly · save 17%
          </button>
        ) : showUpgrade ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            onClick={() =>
              router.push(`/app/upgrade?plan=${nextId}&cycle=${cycle ?? "yearly"}`)
            }
          >
            <Icon name="sparkle" size={11} />
            Upgrade to {getPlan(nextId!).name}
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.secondary}`}
          onClick={() => router.push("/pricing")}
        >
          Compare plans
        </button>
        {planId !== "check" &&
          (cancelScheduled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.secondary}`}
              onClick={onUndoCancel}
              disabled={cancelBusy}
            >
              {cancelBusy ? "Working…" : "Undo cancellation"}
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.secondary}`}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel
            </button>
          ))}
      </footer>

      {confirmingCancel && (
        <CancelConfirm
          planName={detail.name}
          renewLabel={renewLabel}
          busy={cancelBusy}
          error={cancelError}
          onCancel={() => {
            setConfirmingCancel(false);
            setCancelError(null);
          }}
          onConfirm={onConfirmCancel}
        />
      )}
    </article>
  );
}

/** Inline confirm dialog that explains the deferred-cancel UX before
 *  the user commits. Renders via portal to document.body so it
 *  escapes the card's `overflow: hidden` and any ancestor transforms
 *  that would re-anchor a `position: fixed` backdrop. Click outside
 *  to dismiss; Escape too. */
function CancelConfirm({
  planName,
  renewLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  planName: string;
  renewLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [busy, onCancel]);

  if (!mounted) return null;

  const dialog = (
    <div
      className={styles.confirmBackdrop}
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="presentation"
    >
      <div
        className={styles.confirmDialog}
        role="alertdialog"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-title" className={styles.confirmTitle}>
          Cancel {planName}?
        </h3>
        <p id="cancel-body" className={styles.confirmBody}>
          Your plan stays active until <strong>{renewLabel}</strong>.
          You&apos;ll keep every {planName} feature through that date,
          then drop to the free Check tier — no charge after that. You
          can undo the cancellation any time before then.
        </p>
        {error && <p className={styles.confirmError}>{error}</p>}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondary}`}
            onClick={onCancel}
            disabled={busy}
          >
            Keep {planName}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.danger}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Cancelling…" : `Yes, cancel on ${renewLabel}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
