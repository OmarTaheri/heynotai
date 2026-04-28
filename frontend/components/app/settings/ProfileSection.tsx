"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { FormRow } from "@/components/ui/FormRow";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  changeEmail,
} from "@/lib/settings-api";
import { avatarUrl, type PBUserRecord } from "@/lib/pocketbase";
import {
  profileMetaFromUser,
  type ProfileMetaTone,
} from "@/lib/settings-data";
import type { Language } from "@heynotai/shared";
import { SettingsSection } from "./SettingsSection";
import { useRegisterSection } from "./SettingsContext";
import styles from "./ProfileSection.module.css";

const META_TONE: Record<ProfileMetaTone, PillTone> = {
  human: "human",
  gold: "gold",
  info: "info",
};

const LANGS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
  { value: "ja", label: "日本語" },
];

type ProfileForm = {
  name: string;
  handle: string;
  email: string;
  timezone: string;
  language: Language;
};

function fromRecord(r: PBUserRecord | null): ProfileForm {
  return {
    name: r?.name ?? "",
    handle: r?.handle ?? "",
    email: r?.email ?? "",
    timezone: r?.timezone ?? "",
    language: ((r?.language as Language) ?? "en") as Language,
  };
}

export function ProfileSection() {
  const { user, refresh } = useAuth();
  const [record, setRecord] = useState<PBUserRecord | null>(null);
  const [original, setOriginal] = useState<ProfileForm>(fromRecord(null));
  const [form, setForm] = useState<ProfileForm>(fromRecord(null));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await getProfile();
        if (cancelled) return;
        setRecord(r);
        const f = fromRecord(r);
        setOriginal(f);
        setForm(f);
      } catch {
        // not signed in, or PB unreachable — leave blank
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dirty = useMemo(
    () =>
      form.name !== original.name ||
      form.handle !== original.handle ||
      form.timezone !== original.timezone ||
      form.language !== original.language,
    [form, original],
  );

  useRegisterSection("profile", {
    dirty,
    save: async () => {
      const patch: Partial<PBUserRecord> = {};
      if (form.name !== original.name) patch.name = form.name;
      if (form.handle !== original.handle) patch.handle = form.handle;
      if (form.timezone !== original.timezone) patch.timezone = form.timezone;
      if (form.language !== original.language) patch.language = form.language;
      if (Object.keys(patch).length === 0) return;
      const r = await updateProfile(patch);
      setRecord(r);
      const f = fromRecord(r);
      setOriginal(f);
      setForm(f);
      await refresh();
    },
    discard: () => setForm(original),
  });

  const onChooseAvatar = () => fileRef.current?.click();

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await uploadAvatar(file);
      setRecord(r);
      await refresh();
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onChangeEmail = async () => {
    if (!form.email || form.email === original.email) return;
    await changeEmail(form.email);
    alert("Confirmation email sent. Check your inbox to confirm the change.");
  };

  const meta = profileMetaFromUser({
    verified: record?.verified,
    plan: record?.plan,
    team: record?.team,
  });

  const initials = user?.initials ?? "··";
  const avatarSrc = avatarUrl(record);

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      description="Other team members see your name, avatar, and email. Update anything you want."
    >
      <Card>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden>
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className={styles.avatarImg} />
            ) : (
              <span>{initials}</span>
            )}
            <button
              type="button"
              className={styles.avatarEdit}
              aria-label="Change profile photo"
              onClick={onChooseAvatar}
            >
              <Icon name="image" size={13} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarChange}
            />
          </div>
          <div className={styles.info}>
            <div className={styles.name}>{form.name || user?.name || "—"}</div>
            <div className={styles.email}>{form.email}</div>
            <div className={styles.metaRow}>
              {meta.map((m) => (
                <Pill key={m.label} tone={META_TONE[m.tone]} compact>
                  {m.icon && <Icon name={m.icon as IconName} size={10} />}
                  {m.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <FormRow
          label="Full name"
          hint="Used in reports and team mentions"
          control={
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="settings-input"
            />
          }
        />
        <FormRow
          label="Display handle"
          hint="Shown next to your activity"
          control={
            <input
              type="text"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              className="settings-input mono"
            />
          }
        />
        <FormRow
          label="Email address"
          hint="Used for sign-in and notifications"
          control={
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="settings-input"
            />
          }
          aux={
            <Button variant="secondary" size="sm" onClick={onChangeEmail}>
              <Icon name="send" size={12} />
              Change
            </Button>
          }
        />
        <FormRow
          label="Time zone"
          hint="For dates and scheduled monitors"
          control={
            <input
              type="text"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="Europe/London"
              className="settings-input"
            />
          }
        />
        <FormRow
          label="Language"
          hint="Interface language"
          control={
            <select
              className="settings-input"
              value={form.language}
              onChange={(e) =>
                setForm({ ...form, language: e.target.value as Language })
              }
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          }
        />
      </Card>
    </SettingsSection>
  );
}
