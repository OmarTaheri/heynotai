"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FormRow } from "@/components/ui/FormRow";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/Icon";
import { EXPORT_OPTIONS } from "@/lib/settings-data";
import { getPrivacy, savePrivacy, requestExport } from "@/lib/settings-api";
import { SettingsSection } from "./SettingsSection";
import { useRegisterSection } from "./SettingsContext";
import styles from "./PrivacySection.module.css";

type Form = {
  scanRetention: string;
  modelTraining: boolean;
  anonymousAnalytics: boolean;
  publicProfile: boolean;
};

const DEFAULT: Form = {
  scanRetention: "forever",
  modelTraining: false,
  anonymousAnalytics: true,
  publicProfile: true,
};

export function PrivacySection() {
  const [original, setOriginal] = useState<Form>(DEFAULT);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await getPrivacy();
        if (cancelled) return;
        const next: Form = {
          scanRetention: r.scanRetention ?? "forever",
          modelTraining: r.modelTraining ?? false,
          anonymousAnalytics: r.anonymousAnalytics ?? true,
          publicProfile: r.publicProfile ?? true,
        };
        setOriginal(next);
        setForm(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () =>
      form.scanRetention !== original.scanRetention ||
      form.modelTraining !== original.modelTraining ||
      form.anonymousAnalytics !== original.anonymousAnalytics ||
      form.publicProfile !== original.publicProfile,
    [form, original],
  );

  useRegisterSection("privacy", {
    dirty,
    save: async () => {
      if (!dirty) return;
      await savePrivacy(form);
      setOriginal(form);
    },
    discard: () => setForm(original),
  });

  const onExport = async (kind: "everything" | "library" | "reports") => {
    setExporting(kind);
    try {
      await requestExport(kind);
      alert("Export queued. We'll email a download link when it's ready.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <SettingsSection
      id="privacy"
      title="Data & privacy"
      description="What we keep, for how long, and how to take it with you."
    >
      <aside className={styles.callout}>
        <span className={styles.calloutIcon} aria-hidden>
          <Icon name="shield" size={16} />
        </span>
        <p className={styles.calloutText}>
          <strong>What we store.</strong> When you scan something, we keep the
          verdict, confidence, and a hash of the content. The actual content is
          held only long enough to compute a result — unless you save it to
          your Library or a Collection. We <strong>never</strong> use your
          scans to train detection models without explicit opt-in.
        </p>
      </aside>

      <Card>
        <FormRow
          label="Scan retention"
          hint="How long results stay in your Library before auto-delete"
          control={
            <select
              className="settings-input"
              value={form.scanRetention}
              onChange={(e) =>
                setForm({ ...form, scanRetention: e.target.value })
              }
            >
              <option value="forever">Forever (until I delete)</option>
              <option value="365d">1 year</option>
              <option value="90d">90 days</option>
              <option value="30d">30 days</option>
            </select>
          }
        />
        <FormRow
          label="Help improve detection models"
          hint="Allow anonymized scans to be used in training"
          control={<span />}
          aux={
            <Toggle
              on={form.modelTraining}
              onChange={(v) => setForm({ ...form, modelTraining: v })}
              label="Help improve detection models"
            />
          }
        />
        <FormRow
          label="Anonymous usage analytics"
          hint="Performance and error data — never page content"
          control={<span />}
          aux={
            <Toggle
              on={form.anonymousAnalytics}
              onChange={(v) => setForm({ ...form, anonymousAnalytics: v })}
              label="Anonymous usage analytics"
            />
          }
        />
        <FormRow
          label="Public profile in shared reports"
          hint="Show your name and avatar on public report pages"
          control={<span />}
          aux={
            <Toggle
              on={form.publicProfile}
              onChange={(v) => setForm({ ...form, publicProfile: v })}
              label="Public profile in shared reports"
            />
          }
        />
      </Card>

      <Card>
        <div className={styles.exportHead}>
          <div className={styles.exportTitle}>Export your data</div>
          <p className={styles.exportSub}>
            Download everything we have on you — scans, collections, monitor
            configs, reports. We&apos;ll email a download link when it&apos;s
            ready (usually under 5 minutes).
          </p>
        </div>
        <div className={styles.exportRow}>
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={styles.exportCard}
              onClick={() => void onExport(opt.id)}
              disabled={exporting !== null}
            >
              <span className={styles.exportIcon} aria-hidden>
                <Icon name={opt.icon} size={14} />
              </span>
              <div className={styles.exportName}>
                {opt.name}{" "}
                <span className={styles.exportFmt}>({opt.format})</span>
              </div>
              <div className={styles.exportDesc}>{opt.description}</div>
            </button>
          ))}
        </div>
      </Card>
    </SettingsSection>
  );
}
