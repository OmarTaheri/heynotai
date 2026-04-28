"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormRow } from "@/components/ui/FormRow";
import { StatusDot } from "@/components/ui/StatusDot";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import {
  getProfile,
  listSessions,
  requestPasswordReset,
  revokeSession,
  signInWithGoogle,
} from "@/lib/settings-api";
import type { Session } from "@heynotai/shared";
import type { PBUserRecord } from "@/lib/pocketbase";
import { SettingsSection } from "./SettingsSection";
import styles from "./SecuritySection.module.css";

export function SecuritySection() {
  const { user, refresh } = useAuth();
  const [record, setRecord] = useState<PBUserRecord | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [r, s] = await Promise.all([getProfile(), listSessions()]);
        if (cancelled) return;
        setRecord(r);
        setSessions(s);
      } catch {
        // unauthenticated
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onChangePassword = async () => {
    if (!record?.email) return;
    setBusy("password");
    try {
      await requestPasswordReset(record.email);
      alert("Password reset email sent. Check your inbox.");
    } finally {
      setBusy(null);
    }
  };

  const onLinkGoogle = async () => {
    setBusy("google");
    try {
      await signInWithGoogle();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRevoke = async (id: string) => {
    setBusy(id);
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusy(null);
    }
  };

  const mfaEnabled = Boolean(record?.mfa);
  const googleLinked = Boolean(record?.email);

  return (
    <SettingsSection
      id="security"
      title="Security"
      description="Password, two-factor authentication, and active sessions across your devices."
    >
      <Card>
        <FormRow
          label="Password"
          hint="Change via email reset link"
          control={<span className="settings-readout">••••••••••••</span>}
          aux={
            <Button
              variant="secondary"
              size="sm"
              onClick={onChangePassword}
              disabled={busy === "password"}
            >
              <Icon name="settings" size={12} />
              {busy === "password" ? "Sending…" : "Change"}
            </Button>
          }
        />
        <FormRow
          label="Two-factor authentication"
          hint="Configured at the workspace level via PocketBase"
          control={
            <span className="settings-readout">
              <StatusDot tone={mfaEnabled ? "ok" : "warn"} size="sm" />
              {mfaEnabled ? (
                <strong>Enabled — email OTP required at sign-in</strong>
              ) : (
                <strong>Disabled</strong>
              )}
            </span>
          }
          aux={
            <Button variant="secondary" size="sm" disabled>
              Workspace setting
            </Button>
          }
        />
        <FormRow
          label="Sign in with Google"
          hint="Use Google for one-click sign-in"
          control={
            <span className="settings-readout">
              {googleLinked ? (
                <>
                  <strong>{record?.email}</strong> · linked
                </>
              ) : (
                <span className="settings-readout--muted">Not linked</span>
              )}
            </span>
          }
          aux={
            <Button
              variant="secondary"
              size="sm"
              onClick={onLinkGoogle}
              disabled={busy === "google"}
            >
              {googleLinked ? "Re-link" : "Connect"}
            </Button>
          }
        />
        <FormRow
          label="Single sign-on (SSO)"
          hint="SAML / OIDC for your team"
          control={
            <span className="settings-readout settings-readout--muted">
              Available on Team plan and above
            </span>
          }
          aux={
            <Button variant="secondary" size="sm" disabled>
              Configure
            </Button>
          }
        />
      </Card>

      <Card>
        <div className={styles.sessionsHead}>
          <div className={styles.sessionsTitle}>Active sessions</div>
          <p className={styles.sessionsSub}>
            {sessions.length} device{sessions.length === 1 ? "" : "s"} currently
            signed in. Sign out of any you don&apos;t recognize.
          </p>
        </div>
        {sessions.map((s) => (
          <div key={s.id} className={styles.row}>
            <span className={styles.icon} aria-hidden>
              <Icon name="sidebar" size={16} />
            </span>
            <div className={styles.info}>
              <div className={styles.device}>
                <span>{s.device}</span>
                {s.current && (
                  <span className={styles.currentTag}>CURRENT</span>
                )}
              </div>
              <div className={styles.meta}>{s.meta}</div>
            </div>
            <span className={styles.when}>{s.when}</span>
            {s.current ? (
              <span />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onRevoke(s.id)}
                disabled={busy === s.id}
              >
                Sign out
              </Button>
            )}
          </div>
        ))}
      </Card>
    </SettingsSection>
  );
}
