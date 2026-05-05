"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Plan, PlanCycle } from "@heynotai/shared";
import { useAuth } from "@/lib/auth";
import { stripePromise, isStripeReady } from "@/lib/stripe";
import {
  startCheckout,
  confirmCheckout,
  syncSubscription,
  changeSubscription,
  previewChange,
  BillingError,
  type PreviewItem,
} from "@/lib/billing-api";
import {
  getPlan,
  PLAN_LABEL,
  PLAN_RANK,
  resolveCta,
} from "@/lib/plans-data";
import { UpgradeHeader } from "@/components/app/upgrade/UpgradeHeader";
import {
  PlanGrid,
  type PlanCardTarget,
} from "@/components/app/upgrade/PlanGrid";
import s from "./upgrade.module.css";

/* /app/upgrade — full-bleed multi-step flow.
 *   pick → confirm → billing → payment → done
 * Lives outside the (shell) route group so the dashboard sidebar isn't
 * rendered. Internal step state, no nested routes. */

type StepKey = "pick" | "confirm" | "billing" | "payment" | "done";
/** A plan that can be checked out via Stripe. `check` and `team` are
 *  free / contact-sales respectively. */
type ChargeablePlan = "verify" | "certify";
type Cycle = PlanCycle;

function isChargeable(p: Plan): p is ChargeablePlan {
  return p === "verify" || p === "certify";
}

/** Inline CSS vars driving the per-plan accent on confirm/billing/payment/done.
 *  Verify keeps the default green; Certify tints everything gold. Falls back
 *  to the green CTA tokens so existing rules stay valid before the wrapper
 *  mounts. */
function planAccentStyle(plan: ChargeablePlan): CSSProperties {
  const tone = getPlan(plan).tone;
  if (tone === "gold") {
    return {
      ["--plan-accent" as never]: "var(--color-gold)",
      ["--plan-accent-deep" as never]:
        "color-mix(in oklch, var(--color-gold) 65%, black)",
      ["--plan-accent-ring" as never]:
        "color-mix(in oklch, var(--color-gold) 40%, transparent)",
      ["--plan-accent-ink" as never]: "var(--color-gold-ink)",
    } as CSSProperties;
  }
  return {
    ["--plan-accent" as never]: "var(--color-cta)",
    ["--plan-accent-deep" as never]: "var(--color-cta-deep)",
    ["--plan-accent-ring" as never]: "var(--color-cta-ring)",
    ["--plan-accent-ink" as never]: "var(--color-cta-ink)",
  } as CSSProperties;
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradeShell />
    </Suspense>
  );
}

function UpgradeShell() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh } = useAuth();

  const requested = params.get("plan") as Plan | null;
  const requestedCycleParam = params.get("cycle");
  const requestedCycle: Cycle | null =
    requestedCycleParam === "monthly" || requestedCycleParam === "yearly"
      ? requestedCycleParam
      : null;
  const currentPlan: Plan = (user?.plan ?? "check") as Plan;
  const currentCycle: Cycle | null = user?.planCycle ?? null;
  const hasActiveSub = Boolean(user?.stripeSubscriptionId);

  const [step, setStep] = useState<StepKey>(
    requested && isChargeable(requested) ? "confirm" : "pick",
  );
  const [plan, setPlan] = useState<ChargeablePlan | null>(
    requested && isChargeable(requested) ? requested : null,
  );
  const [cycle, setCycle] = useState<Cycle>(
    requestedCycle ?? currentCycle ?? "yearly",
  );
  const [previews, setPreviews] = useState<Map<string, PreviewItem>>(new Map());
  const [billingAddress, setBillingAddress] = useState({
    line1: "",
    city: "",
    postalCode: "",
    country: "US",
    taxId: "",
    billingEmail: user?.email ?? "",
  });
  const [agreed, setAgreed] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auth gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/?login=1&next=/app/upgrade");
    }
  }, [loading, user, router]);

  // Fetch proration previews for existing subscribers — both the
  // PickStep cards and the ConfirmStep summary read this map.
  useEffect(() => {
    if (!hasActiveSub) {
      setPreviews(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await previewChange();
        if (cancelled) return;
        const map = new Map<string, PreviewItem>();
        for (const item of r.items) map.set(`${item.plan}-${item.cycle}`, item);
        setPreviews(map);
      } catch {
        // best effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasActiveSub, user?.plan, user?.planCycle]);

  // Resolve the kind of change for the current (plan, cycle) pair —
  // drives the ConfirmStep button copy and the immediate-vs-deferred
  // branch on submit.
  const intendedKind = useMemo(
    () =>
      plan
        ? resolveCta(
            plan,
            cycle,
            user ? { plan: user.plan, cycle: user.planCycle ?? null } : null,
          )
        : null,
    [plan, cycle, user],
  );

  const isDeferredChange = useMemo(() => {
    if (!plan || !user || !hasActiveSub) return false;
    if (PLAN_RANK[plan] < PLAN_RANK[user.plan]) return true;
    if (
      plan === user.plan &&
      user.planCycle === "yearly" &&
      cycle === "monthly"
    ) {
      return true;
    }
    return false;
  }, [plan, cycle, user, hasActiveSub]);

  if (loading || !user) return null;

  const goBack = () => {
    setError(null);
    if (step === "pick") {
      router.push("/app/settings");
      return;
    }
    if (step === "confirm") {
      setStep("pick");
      return;
    }
    if (step === "billing") {
      setStep("confirm");
      return;
    }
    if (step === "payment") {
      setStep("billing");
      return;
    }
    if (step === "done") {
      router.push("/app");
    }
  };

  const startPayment = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const r = await startCheckout({
        plan,
        cycle,
        billingAddress: billingAddress.line1
          ? `${billingAddress.line1}, ${billingAddress.city} ${billingAddress.postalCode}`.trim()
          : undefined,
        billingCountry: billingAddress.country,
        taxId: billingAddress.taxId || undefined,
        billingEmail: billingAddress.billingEmail || undefined,
      });
      setClientSecret(r.clientSecret);
      setSubscriptionId(r.subscriptionId);
      setStep("payment");
    } catch (err) {
      const code =
        err instanceof BillingError ? err.code : "checkout_failed";
      const msg =
        err instanceof BillingError &&
        typeof (err.detail as { message?: string }).message === "string"
          ? (err.detail as { message: string }).message
          : code;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  /** Existing-subscriber path: hit /billing/change directly. The
   *  customer already has a card on file, so we skip the billing-
   *  address and Stripe Elements steps entirely. Falls back to the
   *  full /checkout flow if Stripe says there's no active sub. */
  const submitChange = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      await changeSubscription({ plan, cycle });
      await refresh();
      setStep("done");
    } catch (err) {
      if (err instanceof BillingError && err.code === "no_active_sub") {
        // Sub got cancelled between page load and click — fall back
        // to the new-checkout path.
        setStep("billing");
        return;
      }
      const msg =
        err instanceof BillingError &&
        typeof (err.detail as { message?: string }).message === "string"
          ? (err.detail as { message: string }).message
          : err instanceof Error
            ? err.message
            : "Couldn't change your plan. Try again in a moment.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.body}>
      <div className={s.shell}>
        <header className={s.top}>
          <button
            type="button"
            className={s.back}
            onClick={goBack}
            aria-label="Back"
          >
            <BackArrow />
          </button>
        </header>

        <main className={s.stage}>
          <div className={s.stageInner}>
            {step === "pick" && (
              <PickStep
                currentPlan={currentPlan}
                currentCycle={currentCycle}
                pendingPlanEffective={user.pendingPlanEffective ?? null}
                cycle={cycle}
                setCycle={setCycle}
                previews={previews}
                onPick={(target) => {
                  if (target.kind === "cancel_to_free") {
                    router.push("/app/settings");
                    return;
                  }
                  if (target.kind === "contact") {
                    return;
                  }
                  if (isChargeable(target.plan)) {
                    setPlan(target.plan);
                    setCycle(target.cycle);
                    setStep("confirm");
                  }
                }}
              />
            )}

            {step === "confirm" && plan && (
              <ConfirmStep
                plan={plan}
                cycle={cycle}
                setCycle={setCycle}
                currentPlan={currentPlan}
                agreed={agreed}
                setAgreed={setAgreed}
                error={error}
                busy={busy}
                preview={previews.get(`${plan}-${cycle}`) ?? null}
                hasActiveSub={hasActiveSub}
                isDeferred={isDeferredChange}
                intendedKind={intendedKind}
                onContinue={
                  hasActiveSub ? submitChange : () => setStep("billing")
                }
              />
            )}

            {step === "billing" && plan && (
              <BillingStep
                plan={plan}
                cycle={cycle}
                value={billingAddress}
                setValue={setBillingAddress}
                error={error}
                busy={busy}
                onContinue={startPayment}
              />
            )}

            {step === "payment" && plan && clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "night", labels: "floating" },
                }}
              >
                <PaymentStep
                  plan={plan}
                  cycle={cycle}
                  subscriptionId={subscriptionId!}
                  onDone={async () => {
                    await refresh();
                    setStep("done");
                  }}
                />
              </Elements>
            )}

            {step === "payment" && !isStripeReady() && (
              <div className={s.notConfigured}>
                <p>
                  <strong>Stripe isn&apos;t configured.</strong>{" "}
                  Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in{" "}
                  <code>frontend/.env.local</code> and restart the dev server.
                </p>
              </div>
            )}

            {step === "done" && plan && (
              <DoneStep
                plan={plan}
                cycle={cycle}
                onFinish={() => router.replace("/app")}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Step components ──────────────────────────────────────────────── */

function PickStep({
  currentPlan,
  currentCycle,
  pendingPlanEffective,
  cycle,
  setCycle,
  previews,
  onPick,
}: {
  currentPlan: Plan;
  currentCycle: Cycle | null;
  pendingPlanEffective: string | null;
  cycle: Cycle;
  setCycle: (c: Cycle) => void;
  previews: Map<string, PreviewItem>;
  onPick: (target: PlanCardTarget) => void;
}) {
  return (
    <>
      <UpgradeHeader
        eyebrow="Pricing · Three plans"
        title="Detection that <em>scales with you</em>"
        subtitle="From a quick read on a single paragraph to a full audit trail your reviewers can cite — pick the tier that matches how often you ship."
      />

      <div className={s.cycleToggleWrap}>
        <div className={s.cycleToggle} role="tablist">
          <button
            role="tab"
            aria-selected={cycle === "monthly"}
            className={`${s.cycleBtn}${cycle === "monthly" ? ` ${s.cycleBtnActive}` : ""}`}
            onClick={() => setCycle("monthly")}
          >
            Monthly
          </button>
          <button
            role="tab"
            aria-selected={cycle === "yearly"}
            className={`${s.cycleBtn}${cycle === "yearly" ? ` ${s.cycleBtnActive}` : ""}`}
            onClick={() => setCycle("yearly")}
          >
            Yearly{" "}
            <span className={s.savePill}>· Save 17%</span>
          </button>
        </div>
      </div>

      <PlanGrid
        cycle={cycle}
        currentPlan={currentPlan}
        currentCycle={currentCycle}
        pendingPlanEffective={pendingPlanEffective}
        previews={previews}
        onPick={onPick}
        hideTeam
      />

      <p className={s.pickFootnote}>
        *Prices shown don&apos;t include applicable tax. Cancel any time
        from Settings.
      </p>
    </>
  );
}

function ConfirmStep({
  plan,
  cycle,
  setCycle,
  currentPlan,
  agreed,
  setAgreed,
  error,
  busy,
  preview,
  hasActiveSub,
  isDeferred,
  intendedKind,
  onContinue,
}: {
  plan: ChargeablePlan;
  cycle: Cycle;
  setCycle: (c: Cycle) => void;
  currentPlan: Plan;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  error: string | null;
  busy: boolean;
  preview: PreviewItem | null;
  hasActiveSub: boolean;
  isDeferred: boolean;
  intendedKind: ReturnType<typeof resolveCta> | null;
  onContinue: () => void;
}) {
  const d = getPlan(plan);
  const currentLabel =
    currentPlan === "check" ? "Free plan" : `${PLAN_LABEL[currentPlan]} plan`;
  const verb = currentPlan === "check" ? "Upgrade" : "Switch";
  const stickerForCycle = cycle === "yearly" ? d.yearly : d.monthly;
  // Compute what to render in the order summary "Total due today" line:
  // existing subscribers see the prorated amount; new buyers see sticker.
  const totalDueToday =
    hasActiveSub && preview && !preview.error
      ? (preview.totalDueToday ?? stickerForCycle)
      : stickerForCycle;
  const credit =
    hasActiveSub && preview && !preview.error ? (preview.credit ?? 0) : 0;
  const symbol = preview?.currency === "USD" ? "$" : "$";
  // Confirm-button copy varies:
  // - new buyer: "Confirm Verify plan" → leads into payment step
  // - existing subscriber, immediate: "Confirm switch — $X today"
  // - existing subscriber, deferred (downgrade): "Schedule switch on <date>"
  const confirmLabel = (() => {
    if (busy) return "Working…";
    if (!hasActiveSub) return `Confirm ${d.name} plan`;
    if (isDeferred) return `Schedule switch to ${d.name}`;
    return `Confirm switch — ${symbol}${totalDueToday.toFixed(2)} today`;
  })();
  // For deferred changes the user doesn't owe money today, so the
  // "agree to charge" checkbox is misleading; auto-accept it.
  const requireAgree = !hasActiveSub || !isDeferred;
  return (
    <div style={planAccentStyle(plan)}>
      <UpgradeHeader
        eyebrow={`${verb.toUpperCase()} · ${d.name} plan`}
        title={`${verb} to <em>${d.name}</em>`}
        subtitle={`${(d.tokensPerMonth ?? 0).toLocaleString()} tokens / month, billed ${cycle === "yearly" ? "annually" : "monthly"}. You can change either at any time.`}
      />

      <div className={s.confirmCycleGrid}>
        <CycleCard
          name="Monthly"
          price={`$${d.monthly} / month + tax`}
          selected={cycle === "monthly"}
          onClick={() => setCycle("monthly")}
        />
        <CycleCard
          name="Yearly"
          price={`$${d.yearly} / year + tax`}
          selected={cycle === "yearly"}
          onClick={() => setCycle("yearly")}
          save="Save 17%"
        />
      </div>

      <div className={s.orderCard}>
        <div className={s.orderTitle}>Order summary</div>

        <div className={s.orderLines}>
          <div className={s.orderLine}>
            <span className={s.orderLineKey}>From</span>
            <span className={s.orderLineVal}>{currentLabel}</span>
          </div>
          <div className={s.orderLine}>
            <span className={s.orderLineKey}>To</span>
            <span className={s.orderLineVal}>
              {d.name} plan
              <span className={s.orderLineMeta}>
                {" · "}{cycle === "yearly" ? "Annual" : "Monthly"}
                {" · "}{(d.tokensPerMonth ?? 0).toLocaleString()} tokens / month
              </span>
            </span>
          </div>
        </div>

        <div className={s.orderTotal}>
          <span className={s.orderTotalLabel}>
            {isDeferred ? "Charges today" : "Total due today"}
          </span>
          <span className={s.orderTotalAmount}>
            {isDeferred ? (
              <>
                $0.00
                <span className={s.orderTotalUnit}>
                  {" "}— switches at period end
                </span>
              </>
            ) : (
              <>
                {symbol}
                {totalDueToday.toFixed(2)}
                <span className={s.orderTotalUnit}>
                  {hasActiveSub
                    ? credit > 0
                      ? ` (sticker $${stickerForCycle}, $${credit.toFixed(2)} credit)`
                      : " + tax"
                    : ` / ${cycle === "yearly" ? "year" : "month"} + tax`}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {error && <div className={s.errorBox}>{error}</div>}

      <div className={s.confirmFooter}>
        {requireAgree && (
          <label className={s.confirmAgree}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              {hasActiveSub
                ? `You agree to be charged the prorated amount above on your card on file, and to be billed ${cycle === "yearly" ? "annually" : "monthly"} from this period's renewal until you cancel.`
                : `You agree that we will charge your card in the amount above now and on a recurring ${cycle === "yearly" ? "annual" : "monthly"} basis until you cancel. Cancel any time in account settings.`}
            </span>
          </label>
        )}
        {!requireAgree && (
          <p className={s.confirmAgree}>
            <span>
              No charge today. Your {PLAN_LABEL[currentPlan]} plan stays
              active until the end of the current period; we&apos;ll switch
              you to {d.name} automatically at that point. You can undo
              before then from Settings.
            </span>
          </p>
        )}
        <button
          type="button"
          className={s.primaryBtn}
          disabled={(requireAgree && !agreed) || busy}
          onClick={onContinue}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function CycleCard({
  name, price, selected, onClick, save,
}: {
  name: string;
  price: string;
  selected: boolean;
  onClick: () => void;
  save?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${s.confirmCycleCard}${selected ? ` ${s.confirmCycleCardSel}` : ""}`}
    >
      <div className={s.confirmCycleRadio} />
      {save && <span className={s.confirmSavePill}>{save}</span>}
      <div className={s.confirmCycleName}>{name}</div>
      <div className={s.confirmCyclePrice}>{price}</div>
    </button>
  );
}

type BillingForm = {
  line1: string;
  city: string;
  postalCode: string;
  country: string;
  taxId: string;
  billingEmail: string;
};

function BillingStep({
  plan, cycle, value, setValue, error, busy, onContinue,
}: {
  plan: ChargeablePlan;
  cycle: Cycle;
  value: BillingForm;
  setValue: (next: BillingForm) => void;
  error: string | null;
  busy: boolean;
  onContinue: () => void;
}) {
  const d = getPlan(plan);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.billingEmail);
  const valid = Boolean(
    value.line1 && value.city && value.postalCode && value.country && emailValid,
  );
  return (
    <div style={planAccentStyle(plan)}>
      <UpgradeHeader
        eyebrow="Step 2 · Billing details"
        title={`Billing for <em>${d.name}</em>`}
        subtitle={`${cycle === "yearly" ? "Annual" : "Monthly"} cycle. We use this address on your invoices and tax receipts.`}
      />

      <div className={s.formCard}>
        <div className={s.formField}>
          <label>Billing email</label>
          <input
            className={s.formInput}
            type="email"
            value={value.billingEmail}
            onChange={(e) => setValue({ ...value, billingEmail: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div className={s.formField}>
          <label>Address line 1</label>
          <input
            className={s.formInput}
            value={value.line1}
            onChange={(e) => setValue({ ...value, line1: e.target.value })}
            placeholder="221B Baker St"
          />
        </div>
        <div className={s.formRow2}>
          <div className={s.formField}>
            <label>City</label>
            <input
              className={s.formInput}
              value={value.city}
              onChange={(e) => setValue({ ...value, city: e.target.value })}
              placeholder="London"
            />
          </div>
          <div className={s.formField}>
            <label>Postal code</label>
            <input
              className={s.formInput}
              value={value.postalCode}
              onChange={(e) => setValue({ ...value, postalCode: e.target.value })}
              placeholder="NW1 6XE"
            />
          </div>
        </div>
        <div className={s.formRow2}>
          <div className={s.formField}>
            <label>Country (ISO)</label>
            <input
              className={s.formInput}
              value={value.country}
              onChange={(e) => setValue({ ...value, country: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="GB"
              maxLength={2}
            />
          </div>
          <div className={s.formField}>
            <label>Tax ID (optional)</label>
            <input
              className={s.formInput}
              value={value.taxId}
              onChange={(e) => setValue({ ...value, taxId: e.target.value })}
              placeholder="VAT or local equivalent"
            />
          </div>
        </div>

        {error && <div className={s.errorBox}>{error}</div>}

        <button
          type="button"
          className={s.primaryBtn}
          disabled={!valid || busy}
          onClick={onContinue}
        >
          {busy ? "Preparing payment…" : "Continue to payment"}
        </button>
      </div>
    </div>
  );
}

function PaymentStep({
  plan, cycle, subscriptionId, onDone,
}: {
  plan: ChargeablePlan;
  cycle: Cycle;
  subscriptionId: string;
  onDone: () => void | Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        setError(error.message ?? "Payment failed.");
        return;
      }
      // Stripe took the money. From here, the only thing that can
      // fail is *us* failing to write the new plan into PB. If
      // /confirm errors, fall back to /sync (which reads live state
      // from Stripe) before surfacing an error — the most common
      // /confirm failure is transient (network blip, subscription
      // metadata not yet readable) and /sync recovers from it.
      try {
        await confirmCheckout(subscriptionId);
      } catch (confirmErr) {
        try {
          await syncSubscription();
        } catch {
          const detail =
            confirmErr instanceof BillingError &&
            typeof (confirmErr.detail as { message?: string })?.message === "string"
              ? (confirmErr.detail as { message: string }).message
              : confirmErr instanceof Error
                ? confirmErr.message
                : "We couldn't sync your subscription.";
          setError(
            `Payment succeeded, but ${detail} Open Settings → Billing and click "Refresh from Stripe", or reload in a minute.`,
          );
          return;
        }
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  const d = getPlan(plan);

  return (
    <div style={planAccentStyle(plan)}>
      <UpgradeHeader
        eyebrow="Step 3 · Payment"
        title={`Pay for <em>${d.name}</em>`}
        subtitle={`${cycle === "yearly" ? "Annual" : "Monthly"} subscription, charged via Stripe.`}
      />
      <div className={s.payCard}>
        <p className={s.payHint}>
          Card details are handled by Stripe — they never touch our server.
        </p>
        <PaymentElement />
        {error && <div className={s.errorBox}>{error}</div>}
        <button
          type="button"
          className={s.primaryBtn}
          style={{ marginTop: 16 }}
          disabled={!stripe || busy}
          onClick={submit}
        >
          {busy ? "Processing…" : `Pay $${cycle === "yearly" ? d.yearly : d.monthly} ${cycle === "yearly" ? "/ year" : "/ month"}`}
        </button>
        <p className={s.payNote}>Use Stripe&apos;s test card 4242 4242 4242 4242 in test mode.</p>
      </div>
    </div>
  );
}

function DoneStep({
  plan, cycle, onFinish,
}: { plan: ChargeablePlan; cycle: Cycle; onFinish: () => void }) {
  const d = getPlan(plan);
  return (
    <div className={s.doneStage} style={planAccentStyle(plan)}>
      <div className={s.doneOrb}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M5 12l5 5 9-9" />
        </svg>
      </div>
      <UpgradeHeader
        eyebrow="Welcome aboard"
        title={`You're on <em>${d.name}</em>`}
        subtitle={`Your ${cycle === "yearly" ? "yearly" : "monthly"} subscription is active. Receipts will land in your inbox.`}
      />
      <button
        type="button"
        className={s.primaryBtn}
        style={{ marginTop: 24, maxWidth: 300 }}
        onClick={onFinish}
      >
        Open dashboard →
      </button>
    </div>
  );
}

/* ── Tiny SVGs ───────────────────────────────────────────────────── */

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}
