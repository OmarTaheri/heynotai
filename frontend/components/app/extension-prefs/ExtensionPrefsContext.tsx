"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ExtensionPrefs } from "@heynotai/shared";
import { useExtensionPrefs } from "@/lib/use-extension-prefs";

type Ctx = {
  prefs: ExtensionPrefs | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  patch: (p: Partial<ExtensionPrefs>) => void;
  patchAndSave: (p: Partial<ExtensionPrefs>) => Promise<void>;
  setFlag: (id: string, value: boolean) => void;
  save: () => Promise<void>;
  discard: () => void;
  reset: () => Promise<void>;
};

const ExtensionCtx = createContext<Ctx | null>(null);

export function ExtensionPrefsProvider({ children }: { children: ReactNode }) {
  const value = useExtensionPrefs();
  return (
    <ExtensionCtx.Provider value={value}>{children}</ExtensionCtx.Provider>
  );
}

export function useExtensionPrefsContext(): Ctx {
  const ctx = useContext(ExtensionCtx);
  if (!ctx)
    throw new Error(
      "useExtensionPrefsContext must be used inside <ExtensionPrefsProvider>",
    );
  return ctx;
}
