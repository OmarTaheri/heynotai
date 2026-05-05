"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FormRow } from "@/components/ui/FormRow";
import { Toggle } from "@/components/ui/Toggle";
import { THEMES } from "@/lib/settings-data";
import { getAppearance, saveAppearance } from "@/lib/settings-api";
import type { ThemeChoice } from "@heynotai/shared";
import { SettingsSection } from "./SettingsSection";
import { useRegisterSection } from "./SettingsContext";
import styles from "./AppearanceSection.module.css";

type Form = {
  theme: ThemeChoice;
  dateFormat: string;
  showAuthenticVerdicts: boolean;
};

const DEFAULT: Form = {
  theme: "system",
  dateFormat: "DD MMM YYYY",
  showAuthenticVerdicts: true,
};

export function AppearanceSection() {
  const [original, setOriginal] = useState<Form>(DEFAULT);
  const [form, setForm] = useState<Form>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await getAppearance();
        if (cancelled) return;
        const next: Form = {
          theme: (r.theme as ThemeChoice) ?? "system",
          dateFormat: r.dateFormat ?? "DD MMM YYYY",
          showAuthenticVerdicts: r.showAuthenticVerdicts ?? true,
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
      form.theme !== original.theme ||
      form.dateFormat !== original.dateFormat ||
      form.showAuthenticVerdicts !== original.showAuthenticVerdicts,
    [form, original],
  );

  useRegisterSection("appearance", {
    dirty,
    save: async () => {
      if (!dirty) return;
      await saveAppearance(form);
      setOriginal(form);
    },
    discard: () => setForm(original),
  });

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Theme and how data is presented across the app."
    >
      <Card>
        <FormRow
          label="Theme"
          hint="Light, dark, or follow your system"
          control={
            <div
              className={styles.themePicker}
              role="radiogroup"
              aria-label="Theme"
            >
              {THEMES.map((t) => {
                const active = t.id === form.theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={[styles.themeWrap, active && styles.themeActive]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setForm({ ...form, theme: t.id })}
                  >
                    <span
                      className={`${styles.theme} ${styles[`theme_${t.id}`]}`}
                      aria-hidden
                    />
                    <span className={styles.themeLabel}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          }
        />

        <FormRow
          label="Date format"
          hint="How dates appear throughout the app"
          control={
            <select
              className="settings-input"
              value={form.dateFormat}
              onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
            >
              <option value="DD MMM YYYY">24 Apr 2026 — Day Mon Year</option>
              <option value="YYYY-MM-DD">2026-04-24 — ISO</option>
              <option value="MM/DD/YYYY">04/24/2026 — US</option>
            </select>
          }
        />

        <FormRow
          label="Show authentic verdicts"
          hint="By default, only AI-flagged items get colored badges"
          control={<span />}
          aux={
            <Toggle
              on={form.showAuthenticVerdicts}
              onChange={(v) => setForm({ ...form, showAuthenticVerdicts: v })}
              label="Show authentic verdicts"
            />
          }
        />

      </Card>
    </SettingsSection>
  );
}
