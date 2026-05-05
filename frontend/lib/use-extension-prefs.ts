"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_EXTENSION_PREFS,
  type ExtensionPrefs,
} from "@heynotai/shared";
import {
  getExtensionPrefs,
  resetExtensionPrefs,
  saveExtensionPrefs,
  subscribeExtensionPrefs,
} from "./settings-api";
import { useAuth } from "./auth";

/** Loads the user's `extension_prefs` row, subscribes to PB realtime
 *  updates so changes from the drawer (or another tab) appear live,
 *  and exposes a `patch` setter that updates local state immediately
 *  while queueing a save through the registry.
 *
 *  Echo-loop avoidance: PB sometimes fires multiple realtime events
 *  per save (our own write + the broadcast from another tab). We
 *  remember the `updated` timestamp from our own writes and drop any
 *  inbound event whose timestamp is `<=` that — instead of the older
 *  one-shot `ignoreNextRealtime` boolean which fired exactly once and
 *  let the second echo through. */
export function useExtensionPrefs() {
  const { user } = useAuth();
  const [original, setOriginal] = useState<ExtensionPrefs | null>(null);
  const [prefs, setPrefs] = useState<ExtensionPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastSavedUpdatedRef = useRef<string>("");

  const recordSelfWrite = (next: ExtensionPrefs) => {
    const updated = (next as unknown as { updated?: string }).updated;
    if (updated) lastSavedUpdatedRef.current = updated;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const r = await getExtensionPrefs();
        if (cancelled) return;
        setOriginal(r);
        setPrefs(r);
        const unsub = await subscribeExtensionPrefs((next) => {
          const updated = (next as unknown as { updated?: string }).updated;
          if (
            updated &&
            lastSavedUpdatedRef.current &&
            updated <= lastSavedUpdatedRef.current
          ) {
            return;
          }
          setOriginal(next);
          setPrefs(next);
        });
        unsubRef.current = unsub;
      } catch {
        // unauthenticated; surface an empty default so UI can still render
        const fallback = {
          ...DEFAULT_EXTENSION_PREFS,
          id: "",
          userId: "",
        } as unknown as ExtensionPrefs;
        setOriginal(fallback);
        setPrefs(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [user?.id]);

  const dirty = useMemo(() => {
    if (!prefs || !original) return false;
    return JSON.stringify(prefs) !== JSON.stringify(original);
  }, [prefs, original]);

  const patch = useCallback((p: Partial<ExtensionPrefs>) => {
    setPrefs((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  /** Patch + immediately persist to PB. Use this for live controls
   *  (e.g. the Platforms section) where the user expects instant
   *  propagation to the extension drawer rather than a Save click. */
  const patchAndSave = useCallback(
    async (p: Partial<ExtensionPrefs>) => {
      setPrefs((prev) => (prev ? { ...prev, ...p } : prev));
      setOriginal((prev) => (prev ? { ...prev, ...p } : prev));
      setSaving(true);
      try {
        const next = await saveExtensionPrefs(p);
        recordSelfWrite(next);
        setOriginal(next);
        setPrefs(next);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const setFlag = useCallback((id: string, value: boolean) => {
    setPrefs((prev) =>
      prev ? { ...prev, flags: { ...prev.flags, [id]: value } } : prev,
    );
  }, []);

  const save = useCallback(async () => {
    if (!prefs || !dirty) return;
    setSaving(true);
    try {
      const next = await saveExtensionPrefs({
        mode: prefs.mode,
        autoModelMode: prefs.autoModelMode,
        scanMode: prefs.scanMode,
        sites: prefs.sites,
        platforms: prefs.platforms,
        notifications: prefs.notifications,
        privacy: prefs.privacy,
        hotkeys: prefs.hotkeys,
        flags: prefs.flags,
      });
      recordSelfWrite(next);
      setOriginal(next);
      setPrefs(next);
    } finally {
      setSaving(false);
    }
  }, [prefs, dirty]);

  const discard = useCallback(() => {
    if (original) setPrefs(original);
  }, [original]);

  const reset = useCallback(async () => {
    setSaving(true);
    try {
      const next = await resetExtensionPrefs();
      recordSelfWrite(next);
      setOriginal(next);
      setPrefs(next);
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    prefs,
    loading,
    saving,
    dirty,
    patch,
    patchAndSave,
    setFlag,
    save,
    discard,
    reset,
  };
}
