"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SettingsSectionId } from "@heynotai/shared";

/* Each section registers a small handle so the page-level SaveBar can
 * aggregate dirty state and run all saves in parallel. Sections own
 * their own data + dirty tracking — the registry is just the wiring. */

export type SectionHandle = {
  dirty: boolean;
  save: () => Promise<void>;
  discard: () => void;
};

type Registry = {
  register: (id: SettingsSectionId, handle: SectionHandle) => void;
  unregister: (id: SettingsSectionId) => void;
  unsavedCount: number;
  saveAll: () => Promise<void>;
  discardAll: () => void;
  saving: boolean;
  error: string | null;
};

const SettingsCtx = createContext<Registry | null>(null);

export function SettingsRegistryProvider({ children }: { children: ReactNode }) {
  const handlesRef = useRef(new Map<SettingsSectionId, SectionHandle>());
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recompute = useCallback(() => {
    let n = 0;
    for (const h of handlesRef.current.values()) if (h.dirty) n++;
    setUnsavedCount(n);
  }, []);

  const register = useCallback(
    (id: SettingsSectionId, handle: SectionHandle) => {
      handlesRef.current.set(id, handle);
      recompute();
    },
    [recompute],
  );

  const unregister = useCallback(
    (id: SettingsSectionId) => {
      handlesRef.current.delete(id);
      recompute();
    },
    [recompute],
  );

  const saveAll = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const tasks: Array<Promise<unknown>> = [];
      for (const h of handlesRef.current.values()) if (h.dirty) tasks.push(h.save());
      await Promise.all(tasks);
      recompute();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [recompute]);

  const discardAll = useCallback(() => {
    for (const h of handlesRef.current.values()) if (h.dirty) h.discard();
    recompute();
  }, [recompute]);

  const value = useMemo<Registry>(
    () => ({
      register,
      unregister,
      unsavedCount,
      saveAll,
      discardAll,
      saving,
      error,
    }),
    [register, unregister, unsavedCount, saveAll, discardAll, saving, error],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettingsRegistry(): Registry {
  const ctx = useContext(SettingsCtx);
  if (!ctx)
    throw new Error("useSettingsRegistry must be used inside SettingsRegistryProvider");
  return ctx;
}

/** Section-side hook. Pass current dirty + save/discard refs and the
 *  registry stays up to date as you type. */
export function useRegisterSection(
  id: SettingsSectionId,
  handle: SectionHandle,
): void {
  const { register, unregister } = useSettingsRegistry();
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    register(id, {
      get dirty() {
        return handleRef.current.dirty;
      },
      save: () => handleRef.current.save(),
      discard: () => handleRef.current.discard(),
    });
    return () => unregister(id);
  }, [id, register, unregister]);

  // Re-register on dirty changes so the unsavedCount stays accurate.
  useEffect(() => {
    register(id, {
      get dirty() {
        return handleRef.current.dirty;
      },
      save: () => handleRef.current.save(),
      discard: () => handleRef.current.discard(),
    });
  }, [id, register, handle.dirty]);
}
