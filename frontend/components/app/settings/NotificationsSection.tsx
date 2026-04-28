"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import {
  NOTIF_EVENTS,
  type NotifChannel,
  type NotifPrefs,
} from "@/lib/settings-data";
import { getNotifPrefs, saveNotifPrefs } from "@/lib/settings-api";
import { SettingsSection } from "./SettingsSection";
import { useRegisterSection } from "./SettingsContext";
import styles from "./NotificationsSection.module.css";

const CHANNELS: { id: NotifChannel; label: string }[] = [
  { id: "inApp", label: "In-app" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
];

function defaultsMap(): Record<string, NotifPrefs> {
  return NOTIF_EVENTS.reduce(
    (acc, e) => {
      acc[e.id] = { ...e.defaults };
      return acc;
    },
    {} as Record<string, NotifPrefs>,
  );
}

export function NotificationsSection() {
  const [original, setOriginal] = useState<Record<string, NotifPrefs>>(() =>
    defaultsMap(),
  );
  const [prefs, setPrefs] = useState<Record<string, NotifPrefs>>(() =>
    defaultsMap(),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await getNotifPrefs();
        if (cancelled) return;
        const merged = { ...defaultsMap(), ...(r.prefs ?? {}) };
        setOriginal(merged);
        setPrefs(merged);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(original),
    [prefs, original],
  );

  useRegisterSection("notifications", {
    dirty,
    save: async () => {
      if (!dirty) return;
      await saveNotifPrefs(prefs);
      setOriginal(prefs);
    },
    discard: () => setPrefs(original),
  });

  const flip = (eventId: string, channel: NotifChannel) =>
    setPrefs((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [channel]: !prev[eventId][channel],
      },
    }));

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Pick which events reach you, and how. Most users only want monitor alerts via email."
    >
      <Card>
        <div className={`${styles.head} ${styles.row}`}>
          <span>Event</span>
          {CHANNELS.map((c) => (
            <span key={c.id} className={styles.channelHead}>
              {c.label}
            </span>
          ))}
        </div>
        {NOTIF_EVENTS.map((event) => (
          <div key={event.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{event.name}</div>
              <div className={styles.desc}>{event.description}</div>
            </div>
            {CHANNELS.map((c) => (
              <div key={c.id} className={styles.toggleCell}>
                <Toggle
                  size="sm"
                  on={prefs[event.id]?.[c.id] ?? false}
                  onChange={() => flip(event.id, c.id)}
                  label={`${event.name} via ${c.label}`}
                />
              </div>
            ))}
          </div>
        ))}
      </Card>
    </SettingsSection>
  );
}
