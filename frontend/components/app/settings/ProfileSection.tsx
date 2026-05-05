"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { FormRow } from "@/components/ui/FormRow";
import { Icon, type IconName } from "@/components/Icon";
import {
  AvatarCropModal,
  type AvatarPickerHandle,
} from "@/components/ui/AvatarCropModal";
import { useAuth } from "@/lib/auth";
import {
  getProfile,
  updateProfile,
  changeEmail,
} from "@/lib/settings-api";
import { avatarUrl, pb, type PBUserRecord } from "@/lib/pocketbase";
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
  language: Language;
};

function fromRecord(r: PBUserRecord | null): ProfileForm {
  return {
    name: r?.name ?? "",
    handle: r?.handle ?? "",
    email: r?.email ?? "",
    language: ((r?.language as Language) ?? "en") as Language,
  };
}

/** Seed the form from the auth user record immediately so the page
 *  isn't blank during the network roundtrip to /settings. The auth
 *  context already has the latest record cached on every navigation. */
function fromAuthUser(u: ReturnType<typeof useAuth>["user"]): ProfileForm {
  return {
    name: u?.name ?? "",
    handle: u?.handle ?? "",
    email: u?.email ?? "",
    language: "en",
  };
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function ProfileSection() {
  const { user, refresh } = useAuth();
  const [record, setRecord] = useState<PBUserRecord | null>(null);
  const [original, setOriginal] = useState<ProfileForm>(() => fromAuthUser(user));
  const [form, setForm] = useState<ProfileForm>(() => fromAuthUser(user));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const pickerRef = useRef<AvatarPickerHandle>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let r = await getProfile();
        if (cancelled) return;
        // Auto-sync the browser's timezone in the background so the field
        // stays accurate without exposing it in the UI.
        const browserTz = detectTimezone();
        if (browserTz && r.timezone !== browserTz) {
          try {
            r = await updateProfile({ timezone: browserTz });
          } catch {
            // non-fatal; keep whatever the server has
          }
        }
        if (cancelled) return;
        setRecord(r);
        const f = fromRecord(r);
        setOriginal(f);
        setForm(f);
      } catch {
        // not signed in, or PB unreachable — leave the auth-seeded values.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Free the in-memory blob URL when we replace it or unmount.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const dirty = useMemo(
    () =>
      form.name !== original.name ||
      form.handle !== original.handle ||
      form.language !== original.language ||
      avatarFile !== null,
    [form, original, avatarFile],
  );

  useRegisterSection("profile", {
    dirty,
    save: async () => {
      // Field-level patch — only send what changed. When the user staged
      // a new avatar, switch to FormData so PB writes the file too.
      const fieldPatch: Partial<PBUserRecord> = {};
      if (form.name !== original.name) fieldPatch.name = form.name;
      if (form.handle !== original.handle) fieldPatch.handle = form.handle;
      if (form.language !== original.language) fieldPatch.language = form.language;

      if (!avatarFile && Object.keys(fieldPatch).length === 0) return;

      const userId = pb.authStore.record?.id;
      if (!userId) return;

      let r: PBUserRecord;
      if (avatarFile) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fieldPatch)) {
          if (v !== undefined) fd.append(k, String(v));
        }
        fd.append("avatar", avatarFile);
        r = (await pb.collection("users").update(userId, fd)) as PBUserRecord;
      } else {
        r = await updateProfile(fieldPatch);
      }
      setRecord(r);
      const f = fromRecord(r);
      setOriginal(f);
      setForm(f);
      setAvatarFile(null);
      setAvatarPreview((p) => {
        if (p) URL.revokeObjectURL(p);
        return null;
      });
      await refresh();
    },
    discard: () => {
      setForm(original);
      setAvatarFile(null);
      setAvatarPreview((p) => {
        if (p) URL.revokeObjectURL(p);
        return null;
      });
    },
  });

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
  // Prefer the staged preview (in-memory blob URL while the user has a
  // pending change), then the saved avatar from PB, then the URL field.
  const avatarSrc = avatarPreview ?? avatarUrl(record) ?? user?.avatarSrc ?? null;

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
              onClick={() => pickerRef.current?.open()}
            >
              <Icon name="image" size={13} />
            </button>
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

      <AvatarCropModal
        ref={pickerRef}
        onConfirm={(file, previewUrl) => {
          setAvatarPreview((p) => {
            if (p) URL.revokeObjectURL(p);
            return previewUrl;
          });
          setAvatarFile(file);
        }}
      />
    </SettingsSection>
  );
}
