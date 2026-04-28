"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  useId,
  useState,
} from "react";

export function Field({
  label,
  hint,
  ...rest
}: {
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12px] font-medium text-[var(--color-fg-mid)]"
      >
        {label}
      </label>
      <input id={id} {...rest} className="auth-input" />
      {hint && (
        <p className="mt-1 text-[11.5px] text-[var(--color-fg-dim)]">{hint}</p>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  hint,
  children,
  ...rest
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[12px] font-medium text-[var(--color-fg-mid)]"
        >
          {label}
        </label>
        {children}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          {...rest}
          className="auth-input pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-mid)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && (
        <p className="mt-1 text-[11.5px] text-[var(--color-fg-dim)]">{hint}</p>
      )}
    </div>
  );
}

export function OAuthGroup({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-2.5 sm:grid-cols-2 ${className}`}>
      <OAuthButton provider="Google" icon={<GoogleIcon />} />
      <OAuthButton provider="GitHub" icon={<GitHubIcon />} />
    </div>
  );
}

function OAuthButton({
  provider,
  icon,
}: {
  provider: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-surface-alt)] text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-alt)]"
    >
      {icon}
      {provider}
    </button>
  );
}

export function Divider({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="h-px flex-1 bg-[var(--color-line)]" />
      <span className="text-[11px] uppercase tracking-wider text-[var(--color-fg-dim)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--color-line)]" />
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[color-mix(in_oklch,var(--color-ai)_28%,transparent)] bg-[color-mix(in_oklch,var(--color-ai-soft)_75%,transparent)] px-3 py-2 text-center text-[12.5px] text-[var(--color-ai-ink)]">
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.7" />
      <path d="M6.6 6.6A16 16 0 0 0 2 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1.1" />
      <path d="M14 14a2.8 2.8 0 0 1-4-4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22 12.3c0-.7-.1-1.5-.2-2.2H12v4.1h5.6c-.2 1.3-1 2.4-2 3.1v2.5h3.3c1.9-1.8 3.1-4.4 3.1-7.5z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H2.9V16C4.6 19.6 8 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H2.9C2.3 8.8 2 10.4 2 12s.3 3.2.9 4.5L6.4 14z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2 8 2 4.6 4.4 2.9 7.5L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .3A12 12 0 0 0 8.2 23.7c.6.1.8-.3.8-.6v-2c-3.4.7-4-1.5-4-1.5-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}
