"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { StatusDot, type StatusTone } from "@/components/ui/StatusDot";
import type { AdminServiceStatus, AdminUserStatus } from "@/lib/admin-types";
import styles from "./Admin.module.css";

export function ServiceState({ status }: { status: AdminServiceStatus }) {
  const spec: Record<AdminServiceStatus, { label: string; pill: PillTone; dot: StatusTone }> = {
    healthy: { label: "Healthy", pill: "human", dot: "ok" },
    degraded: { label: "Degraded", pill: "warn", dot: "warn" },
    down: { label: "Down", pill: "ai", dot: "alert" },
    unknown: { label: "Unknown", pill: "neutral", dot: "muted" },
  };
  const state = spec[status];
  return (
    <Pill tone={state.pill} compact>
      <StatusDot tone={state.dot} size="sm" />
      {state.label}
    </Pill>
  );
}

export function UserState({ status }: { status: AdminUserStatus }) {
  const tone: Record<AdminUserStatus, PillTone> = {
    active: "human",
    suspended: "warn",
    invited: "info",
    deleted: "ai",
  };
  return (
    <Pill tone={tone[status]} compact dot>
      {labelCase(status)}
    </Pill>
  );
}

export function AdminError({ message }: { message: string }) {
  return <div className={styles.error} role="alert">{message}</div>;
}

export function AdminLoading({ label = "Loading admin data…" }: { label?: string }) {
  return <div className={styles.notice} role="status" aria-live="polite">{label}</div>;
}

export function AdminPager({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className={styles.pager}>
      <span>{totalItems.toLocaleString()} records · page {page} of {totalPages}</span>
      <span className={styles.pagerActions}>
        <button
          type="button"
          className={styles.pagerButton}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevron-left" size={12} />
        </button>
        <button
          type="button"
          className={styles.pagerButton}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevron-right" size={12} />
        </button>
      </span>
    </div>
  );
}

export function AdminModal({
  title,
  subtitle,
  wide,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.dialog}${wide ? ` ${styles.dialogWide}` : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 className={styles.dialogTitle}>{title}</h2>
            {subtitle && <p className={styles.dialogSubtitle}>{subtitle}</p>}
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        <footer className={styles.dialogFooter}>{footer}</footer>
      </section>
    </div>
  );
}

export function FormField({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? styles.fieldWide : styles.field}>
      <span className={styles.fieldLabel}>
        <span>{label}</span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function labelCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
