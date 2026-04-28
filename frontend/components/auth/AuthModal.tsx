"use client";

import { useEffect, useRef } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

export type AuthMode = "login" | "signup";

export function AuthModal({
  mode,
  onClose,
  onSwitchMode,
  onAuthenticated,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  /** Fired after a successful sign-in. The caller is expected to navigate
   *  the user somewhere — typically `?next` or `/app`. */
  onAuthenticated?: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={onClose}
      className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card relative w-full max-w-[440px] rounded-[24px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)] sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-fg-mid)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
        >
          <CloseIcon />
        </button>

        {mode === "login" ? (
          <LoginForm
            onSwitchMode={() => onSwitchMode("signup")}
            onAuthenticated={onAuthenticated}
          />
        ) : (
          <SignupForm
            onSwitchMode={() => onSwitchMode("login")}
            onAuthenticated={onAuthenticated}
          />
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
