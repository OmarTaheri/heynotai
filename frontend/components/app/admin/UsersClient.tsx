"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Plan } from "@heynotai/shared";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table } from "@/components/ui/Table";
import {
  fetchAdminUsers,
  revokeAdminUserSessions,
  updateAdminUser,
} from "@/lib/admin-api";
import type {
  AdminPage,
  AdminSystemRole,
  AdminUser,
  AdminUserPatch,
  AdminUserStatus,
} from "@/lib/admin-types";
import {
  AdminError,
  AdminLoading,
  AdminModal,
  AdminPager,
  FormField,
  UserState,
  formatAdminDate,
} from "./AdminPrimitives";
import styles from "./Admin.module.css";

const PER_PAGE = 25;
const PLANS: Plan[] = ["check", "verify", "certify", "team"];
const STATUSES: AdminUserStatus[] = ["active", "suspended", "invited"];

type UserDraft = {
  status: AdminUserStatus;
  systemRole: AdminSystemRole;
  plan: Plan;
  monthlyTokenLimit: string;
};

export function UsersClient() {
  const [result, setResult] = useState<AdminPage<AdminUser> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [debouncedQuery, status, plan]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await fetchAdminUsers({
          page,
          perPage: PER_PAGE,
          q: debouncedQuery || undefined,
          status: status || undefined,
          plan: plan || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, plan, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${styles.page} panel-reveal`}>
      <PageHeader
        title="Users"
        subtitle="Inspect account state, authentication, plan access, and monthly usage limits."
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={13} />
            Refresh
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <SearchInput
          className={styles.toolbarSearch}
          placeholder="Search name, email, handle, or ID…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search users"
        />
        <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter users by state">
          <option value="">All states</option>
          {STATUSES.map((entry) => <option key={entry} value={entry}>{capitalize(entry)}</option>)}
        </select>
        <select className={styles.select} value={plan} onChange={(event) => setPlan(event.target.value)} aria-label="Filter users by plan">
          <option value="">All plans</option>
          {PLANS.map((entry) => <option key={entry} value={entry}>{capitalize(entry)}</option>)}
        </select>
      </div>

      {error && <AdminError message={error} />}
      {loading && !result ? (
        <AdminLoading label="Loading users…" />
      ) : (
        <UsersTable
          users={result?.items ?? []}
          page={result?.page ?? page}
          totalPages={result?.totalPages ?? 1}
          totalItems={result?.totalItems ?? 0}
          onPageChange={setPage}
          onEdit={setEditing}
        />
      )}

      {editing && (
        <UserEditor
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function UsersTable({
  users,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onEdit,
}: {
  users: AdminUser[];
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onEdit: (user: AdminUser) => void;
}) {
  return (
    <Table columns="minmax(230px,1.4fr) 105px 100px 150px 110px 42px" minWidth={800} scroll aria-label="Platform users">
      <Table.Header>
        <Table.HeaderCell>User</Table.HeaderCell>
        <Table.HeaderCell>State</Table.HeaderCell>
        <Table.HeaderCell>Plan</Table.HeaderCell>
        <Table.HeaderCell>Monthly usage</Table.HeaderCell>
        <Table.HeaderCell>Last active</Table.HeaderCell>
        <Table.HeaderCell aria-hidden />
      </Table.Header>
      <Table.Body>
        {users.length === 0 ? (
          <Table.Empty>No users match these filters.</Table.Empty>
        ) : (
          users.map((user) => {
            const percent = usagePercent(user);
            return (
              <Table.Row
                key={user.id}
                interactive
                className={styles.interactiveRow}
                tabIndex={0}
                aria-label={`Edit ${user.email}`}
                onClick={() => onEdit(user)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit(user);
                  }
                }}
              >
                <Table.Cell>
                  <div className={styles.entity}>
                    <Avatar initials={initials(user)} src={user.avatarUrl} size="sm" />
                    <div className={styles.entityCopy}>
                      <div className={styles.entityTitle}>{user.name || user.email}</div>
                      <div className={styles.entityMeta}>{user.email} · {user.verified ? "verified" : "unverified"}</div>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell><UserState status={user.status} /></Table.Cell>
                <Table.Cell>
                  <Pill tone={planTone(user.plan)} compact>{user.plan.toUpperCase()}</Pill>
                  {user.systemRole !== "user" && <div className={styles.subtle}>platform {user.systemRole}</div>}
                </Table.Cell>
                <Table.Cell>
                  <div className={styles.metricPair}>
                    <strong>{user.monthlyUsage.toLocaleString()}</strong>
                    <span>/ {user.monthlyTokenLimit === null ? "custom" : user.monthlyTokenLimit.toLocaleString()}</span>
                  </div>
                  {percent !== null && <div className={styles.bar}><span style={{ width: `${percent}%` }} /></div>}
                </Table.Cell>
                <Table.Cell muted>{formatAdminDate(user.lastActiveAt)}</Table.Cell>
                <Table.Cell align="right">
                  <Table.RowAction onClick={() => onEdit(user)} ariaLabel={`Edit ${user.email}`} />
                </Table.Cell>
              </Table.Row>
            );
          })
        )}
      </Table.Body>
      <Table.Footer>
        <AdminPager page={page} totalPages={totalPages} totalItems={totalItems} onChange={onPageChange} />
      </Table.Footer>
    </Table>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo<UserDraft>(() => ({
    status: user.status,
    systemRole: user.systemRole,
    plan: user.plan,
    monthlyTokenLimit: user.monthlyTokenLimit === null ? "" : String(user.monthlyTokenLimit),
  }), [user]);
  const [draft, setDraft] = useState<UserDraft>(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    setBusy("save");
    setError("");
    setMessage("");
    const patch: AdminUserPatch = {
      status: draft.status,
      systemRole: draft.systemRole,
      plan: draft.plan,
      monthlyTokenLimit:
        draft.monthlyTokenLimit.trim() === ""
          ? null
          : Math.max(0, Number(draft.monthlyTokenLimit) || 0),
    };
    try {
      await updateAdminUser(user.id, patch);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    } finally {
      setBusy("");
    }
  };

  const revoke = async () => {
    if (!window.confirm(`Revoke every active session for ${user.email}?`)) return;
    setBusy("revoke");
    setError("");
    setMessage("");
    try {
      await revokeAdminUserSessions(user.id);
      setMessage("All active sessions were revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke sessions.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AdminModal
      title={user.name || user.email}
      subtitle={`${user.email} · ${user.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={() => void revoke()} disabled={!!busy}>
            <Icon name="log-out" size={13} />
            {busy === "revoke" ? "Revoking…" : "Revoke sessions"}
          </Button>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()} disabled={!!busy}>
              {busy === "save" ? "Saving…" : "Save user"}
            </Button>
          </div>
        </>
      }
    >
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Access and state</h3>
        <div className={styles.fieldGrid}>
          <FormField label="Account state">
            <select className={styles.select} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdminUserStatus }))}>
              {STATUSES.map((entry) => <option key={entry} value={entry}>{capitalize(entry)}</option>)}
            </select>
          </FormField>
          <FormField label="Platform role" hint="server enforced">
            <select className={styles.select} value={draft.systemRole} onChange={(event) => setDraft((current) => ({ ...current, systemRole: event.target.value as AdminSystemRole }))}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </FormField>
        </div>
      </section>
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Plan and usage</h3>
        <p className={styles.formSectionHint}>A blank monthly limit keeps the plan-managed or custom allocation.</p>
        <div className={styles.fieldGrid}>
          <FormField label="Plan">
            <select className={styles.select} value={draft.plan} onChange={(event) => setDraft((current) => ({ ...current, plan: event.target.value as Plan }))}>
              {PLANS.map((entry) => <option key={entry} value={entry}>{capitalize(entry)}</option>)}
            </select>
          </FormField>
          <FormField label="Monthly token limit" hint="blank = managed">
            <input className={styles.input} type="number" min="0" step="1" value={draft.monthlyTokenLimit} onChange={(event) => setDraft((current) => ({ ...current, monthlyTokenLimit: event.target.value }))} placeholder="Plan default" />
          </FormField>
        </div>
        <div className={styles.metricPair}>
          <strong>{user.monthlyUsage.toLocaleString()}</strong>
          <span>tokens used this month</span>
        </div>
      </section>
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Authentication</h3>
        <div className={styles.logDetail}>
          <Readout label="Verified" value={user.verified ? "Yes" : "No"} />
          <Readout label="Providers" value={user.authProviders.join(", ") || "Password / unknown"} />
          <Readout label="Created" value={formatAdminDate(user.createdAt)} />
          <Readout label="Last active" value={formatAdminDate(user.lastActiveAt)} />
        </div>
      </section>
      {error && <div className={styles.inlineError}>{error}</div>}
      {message && <div className={styles.inlineSuccess}>{message}</div>}
    </AdminModal>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.logDatum}>
      <div className={styles.logDatumLabel}>{label}</div>
      <div className={styles.logDatumValue}>{value}</div>
    </div>
  );
}

function initials(user: AdminUser): string {
  const source = user.name.trim() || user.email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function usagePercent(user: AdminUser): number | null {
  if (!user.monthlyTokenLimit || user.monthlyTokenLimit <= 0) return null;
  return Math.min(100, Math.round((user.monthlyUsage / user.monthlyTokenLimit) * 100));
}

function planTone(plan: Plan): PillTone {
  if (plan === "team") return "gold";
  if (plan === "certify") return "certify";
  if (plan === "verify") return "human";
  return "neutral";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
