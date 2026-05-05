"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import type { Plan, PlanCycle } from "@heynotai/shared";
import { useAuth } from "@/lib/auth";
import { UpgradeHeader } from "@/components/app/upgrade/UpgradeHeader";
import {
  PlanGrid,
  type PlanCardTarget,
} from "@/components/app/upgrade/PlanGrid";
import { getPlan, TEAM_SALES_MAILTO } from "@/lib/plans-data";
import { previewChange, type PreviewItem } from "@/lib/billing-api";
import s from "./pricing.module.css";

/* /pricing — public plan-comparison page. Shares the same UpgradeHeader
 * + PlanGrid as /app/upgrade so the two surfaces stay in lockstep.
 * Team is split out into its own horizontal block under the comparison
 * table because it's contact-sales rather than self-serve.
 * Authenticated users land on /app/upgrade?plan=<id> when they pick a
 * tier; unauthenticated users bounce to signup with a `next=` query so
 * they resume the upgrade flow after creating an account. */

const FEATURES: { label: string; values: [boolean, boolean, boolean] }[] = [
  { label: "AI text detection",                     values: [true,  true,  true ] },
  { label: "Confidence score",                      values: [true,  true,  true ] },
  { label: "Sentence-level highlighting",           values: [true,  true,  true ] },
  { label: "Image + video detection",               values: [true,  true,  true ] },
  { label: "Browser extension on every site",       values: [false, true,  true ] },
  { label: "Paraphrase + tone forensics",           values: [false, true,  true ] },
  { label: "Priority support",                      values: [false, true,  true ] },
  { label: "Shareable verification reports",        values: [false, false, true ] },
  { label: "12-month audit trail",                  values: [false, false, true ] },
  { label: "API access",                            values: [false, false, true ] },
  { label: "Re-scans free on every new model",      values: [true,  true,  true ] },
];

const COLUMN_NAMES = ["Check", "Verify", "Certify"] as const;

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [cycle, setCycle] = useState<PlanCycle>("yearly");
  const [previews, setPreviews] = useState<Map<string, PreviewItem>>(new Map());

  // Pre-select the toggle to the user's actual cycle on hydration.
  // We can't initialise via `useState(...)` because `user` may
  // populate after first render (the auth context hydrates async).
  useEffect(() => {
    if (user?.planCycle) setCycle(user.planCycle);
  }, [user?.planCycle]);

  // Fetch proration previews when the user has an active sub. The
  // backend ignores the call gracefully when there's no sub, so this
  // is also safe to fire for free users — but skipping the network
  // round-trip is cheaper.
  useEffect(() => {
    if (!user?.stripeSubscriptionId) {
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
        // best effort — without previews the cards still show sticker
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.stripeSubscriptionId, user?.plan, user?.planCycle]);

  const onPick = useMemo(
    () => (target: PlanCardTarget) => {
      const { plan: id, cycle: pickedCycle, kind } = target;
      if (kind === "contact") {
        window.location.href = TEAM_SALES_MAILTO;
        return;
      }
      if (kind === "anonymous_signup") {
        const next =
          id === "check"
            ? "/app"
            : `/app/upgrade?plan=${id}&cycle=${pickedCycle}`;
        router.push(`/?signup=1&next=${encodeURIComponent(next)}`);
        return;
      }
      if (kind === "cancel_to_free") {
        router.push("/app/settings");
        return;
      }
      router.push(`/app/upgrade?plan=${id}&cycle=${pickedCycle}`);
    },
    [router],
  );

  return (
    <main>
      <div className="relative">
        <Nav />

        <section className="relative overflow-hidden pb-24 pt-32 md:pt-40">
          {/* Aurora backdrop — same drifting bloom used on the home Hero
              so the marketing surfaces share one living backdrop. */}
          <div className="hero-aurora" aria-hidden>
            <span />
            <span />
          </div>

          <div className="relative mx-auto max-w-6xl px-6">
            <UpgradeHeader
              eyebrow="Pricing · Three plans"
              title="Catch <em>what slips by</em> — at every scale"
              subtitle="Three tiers built around how seriously you need to verify content. Start free; cancel any time."
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
              currentPlan={(user?.plan as Plan) ?? null}
              currentCycle={user?.planCycle ?? null}
              pendingPlanEffective={user?.pendingPlanEffective ?? null}
              previews={previews}
              onPick={onPick}
              hideTeam
            />

            <FeatureTable />

            <TeamBanner
              onPick={() => onPick({ plan: "team", cycle, kind: "contact" })}
            />
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}

function FeatureTable() {
  return (
    <div className={s.tableWrap}>
      <div className="mb-2">
        <div className={s.tableEyebrow}>What you get</div>
        <h2 className={s.tableTitle}>Detection coverage by plan</h2>
      </div>

      <div className={s.table}>
        <div className={`${s.row} ${s.rowHead}`}>
          <span>{/* feature label column */}</span>
          {COLUMN_NAMES.map((n) => (
            <span key={n} className={s.colName}>
              {n}
            </span>
          ))}
        </div>
        {FEATURES.map((row) => (
          <div key={row.label} className={s.row}>
            <span className={s.featureLabel}>{row.label}</span>
            {row.values.map((on, idx) => (
              <div key={idx} className={s.cell}>
                {on ? (
                  <span className={s.checkChip} aria-label="included">
                    <Icon name="check" size={12} />
                  </span>
                ) : (
                  <span className={s.dash} aria-label="not included">—</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamBanner({ onPick }: { onPick: () => void }) {
  const team = getPlan("team");
  return (
    <section className={s.teamBanner} aria-labelledby="team-plan-title">
      <div className={s.teamBannerInner}>
        <div className={s.teamLead}>
          <div className={s.teamEyebrow}>For organizations</div>
          <h3 id="team-plan-title" className={s.teamTitle}>
            {team.name}
          </h3>
          <p className={s.teamTagline}>{team.tagline}</p>

          <div className={s.teamMetrics}>
            <div className={s.teamMetric}>
              <span className={s.teamMetricNumber}>Custom</span>
              <span className={s.teamMetricLabel}>tailored to your team</span>
            </div>
            <div className={s.teamMetricDivider} aria-hidden />
            <div className={s.teamMetric}>
              <span className={s.teamMetricNumber}>Custom</span>
              <span className={s.teamMetricLabel}>tokens / month</span>
            </div>
          </div>

          <button
            type="button"
            className={s.teamCta}
            onClick={onPick}
          >
            Talk to us
          </button>
        </div>

        <ul className={s.teamFeatures}>
          {team.features.map((f) => (
            <li key={f}>
              <span className={s.teamCheckIcon} aria-hidden>
                <Icon name="check" size={12} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
