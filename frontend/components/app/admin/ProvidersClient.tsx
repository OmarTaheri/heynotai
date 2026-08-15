"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Table } from "@/components/ui/Table";
import { Toggle } from "@/components/ui/Toggle";
import {
  createAdminProvider,
  deleteAdminProvider,
  fetchAdminProviders,
  testAdminProvider,
  updateAdminProvider,
} from "@/lib/admin-api";
import type {
  AdminProvider,
  AdminProviderInput,
  AdminProviderKind,
  AdminTestResult,
} from "@/lib/admin-types";
import {
  AdminError,
  AdminLoading,
  AdminModal,
  FormField,
  ServiceState,
  formatAdminDate,
  labelCase,
} from "./AdminPrimitives";
import styles from "./Admin.module.css";

const EMPTY_PROVIDER: AdminProviderInput = {
  name: "",
  slug: "",
  kind: "http",
  baseUrl: "",
  authType: "bearer",
  credential: "",
  enabled: true,
  timeoutMs: 30_000,
  maxRetries: 1,
  requestsPerMinute: null,
  concurrencyLimit: null,
};

export function ProvidersClient() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminProvider | "new" | null>(null);
  const [testingId, setTestingId] = useState("");
  const [testResults, setTestResults] = useState<Record<string, AdminTestResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProviders(await fetchAdminProviders());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = async (provider: AdminProvider) => {
    setTestingId(provider.id);
    setError("");
    try {
      const result = await testAdminProvider(provider.id);
      setTestResults((current) => ({ ...current, [provider.id]: result }));
      await load();
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [provider.id]: {
          ok: false,
          status: "down",
          message: err instanceof Error ? err.message : "Connection test failed.",
          latencyMs: null,
        },
      }));
    } finally {
      setTestingId("");
    }
  };

  return (
    <div className={`${styles.page} panel-reveal`}>
      <PageHeader
        title="Providers"
        subtitle="Connect local runtimes and hosted APIs once, then reuse them across detection models. Secrets are write-only."
        actions={
          <>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <Icon name="refresh" size={13} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Icon name="plus" size={13} />
              Add provider
            </Button>
          </>
        }
      />

      {error && <AdminError message={error} />}
      {loading && providers.length === 0 ? (
        <AdminLoading label="Loading providers…" />
      ) : (
        <Table columns="minmax(220px,1.4fr) 125px 110px 110px 115px 88px 42px" minWidth={870} scroll aria-label="Model providers">
          <Table.Header>
            <Table.HeaderCell>Provider</Table.HeaderCell>
            <Table.HeaderCell>Runtime</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Limits</Table.HeaderCell>
            <Table.HeaderCell>Last tested</Table.HeaderCell>
            <Table.HeaderCell>Test</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Header>
          <Table.Body>
            {providers.length === 0 ? (
              <Table.Empty>No providers configured. Add a local runtime or API connection.</Table.Empty>
            ) : (
              providers.map((provider) => {
                const testResult = testResults[provider.id];
                return (
                  <Table.Row
                    key={provider.id}
                    interactive
                    className={styles.interactiveRow}
                    tabIndex={0}
                    aria-label={`Edit ${provider.name}`}
                    onClick={() => setEditing(provider)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditing(provider);
                      }
                    }}
                  >
                    <Table.Cell>
                      <div className={styles.entity}>
                        <span className={styles.entityIcon}><Icon name={provider.kind === "local" ? "code" : "globe"} size={15} /></span>
                        <div className={styles.entityCopy}>
                          <div className={styles.entityTitle}>{provider.name}</div>
                          <div className={styles.entityMeta}>{provider.baseUrl || "No endpoint"} · {provider.credentialConfigured ? "secret set" : "no secret"}</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell><Pill tone={provider.kind === "local" ? "local" : "info"} compact>{labelCase(provider.kind)}</Pill></Table.Cell>
                    <Table.Cell><ServiceState status={provider.enabled ? provider.status : "unknown"} /></Table.Cell>
                    <Table.Cell muted>
                      {provider.requestsPerMinute === null ? "unlimited" : `${provider.requestsPerMinute} rpm`}
                      <br />{provider.concurrencyLimit === null ? "auto concurrency" : `${provider.concurrencyLimit} concurrent`}
                    </Table.Cell>
                    <Table.Cell muted>{formatAdminDate(provider.lastTestedAt)}</Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!provider.enabled || testingId === provider.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void test(provider);
                        }}
                      >
                        {testingId === provider.id ? "Testing…" : "Test"}
                      </Button>
                      {testResult && <div className={testResult.ok ? styles.subtle : styles.inlineError}>{testResult.latencyMs === null ? testResult.message : `${Math.round(testResult.latencyMs)} ms`}</div>}
                    </Table.Cell>
                    <Table.Cell align="right"><Table.RowAction onClick={() => setEditing(provider)} ariaLabel={`Edit ${provider.name}`} /></Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      )}

      {editing && (
        <ProviderEditor
          provider={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onDeleted={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ProviderEditor({
  provider,
  onClose,
  onSaved,
  onDeleted,
}: {
  provider: AdminProvider | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const initial = useMemo<AdminProviderInput>(() => provider ? {
    name: provider.name,
    slug: provider.slug,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    authType: provider.authType,
    credential: "",
    enabled: provider.enabled,
    timeoutMs: provider.timeoutMs,
    maxRetries: provider.maxRetries,
    requestsPerMinute: provider.requestsPerMinute,
    concurrencyLimit: provider.concurrencyLimit,
  } : { ...EMPTY_PROVIDER }, [provider]);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<AdminTestResult | null>(null);

  const save = async () => {
    if (!draft.name.trim() || !draft.slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    if (draft.kind !== "local" && !draft.baseUrl.trim()) {
      setError("Hosted providers need a base URL.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        baseUrl: draft.baseUrl.trim(),
        credential: draft.credential?.trim() || undefined,
      };
      if (provider) await updateAdminProvider(provider.id, payload);
      else await createAdminProvider(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save provider.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!provider || !window.confirm(`Delete provider “${provider.name}”? Models using it must be reassigned first.`)) return;
    setBusy("delete");
    setError("");
    try {
      await deleteAdminProvider(provider.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete provider.");
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    if (!provider) return;
    setBusy("test");
    setError("");
    try {
      setTestResult(await testAdminProvider(provider.id));
    } catch (err) {
      setTestResult({
        ok: false,
        status: "down",
        message: err instanceof Error ? err.message : "Connection test failed.",
        latencyMs: null,
      });
    } finally {
      setBusy("");
    }
  };

  const setNumber = (key: "timeoutMs" | "maxRetries" | "requestsPerMinute" | "concurrencyLimit", value: string, nullable = false) => {
    const minimum = key === "timeoutMs" ? 100 : key === "maxRetries" ? 0 : 1;
    setDraft((current) => ({
      ...current,
      [key]: nullable && value === "" ? null : Math.max(minimum, Number(value) || 0),
    }));
  };

  return (
    <AdminModal
      title={provider ? `Edit ${provider.name}` : "Add provider"}
      subtitle={provider ? "Update connection details, credentials, and execution limits." : "Connect a local runtime or hosted inference API."}
      onClose={onClose}
      footer={
        <>
          {provider && (
            <Button variant="secondary" className={styles.dangerButton} onClick={() => void remove()} disabled={!!busy}>
              <Icon name="trash" size={13} />
              Delete
            </Button>
          )}
          <div className={styles.footerActions}>
            {provider && <Button variant="secondary" onClick={() => void test()} disabled={!!busy}>{busy === "test" ? "Testing…" : "Test connection"}</Button>}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save provider"}</Button>
          </div>
        </>
      }
    >
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Connection</h3>
        <div className={styles.fieldGrid}>
          <FormField label="Display name">
            <input className={styles.input} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, slug: provider || current.slug ? current.slug : slugify(event.target.value) }))} placeholder="Local Ollama" />
          </FormField>
          <FormField label="Slug" hint="stable identifier">
            <input className={styles.input} value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))} placeholder="local-ollama" />
          </FormField>
          <FormField label="Provider kind">
            <select className={styles.select} value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as AdminProviderKind }))}>
              <option value="local">Local runtime</option>
              <option value="huggingface">Hugging Face</option>
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="http">Custom HTTP</option>
            </select>
          </FormField>
          <FormField label="Authentication">
            <select className={styles.select} value={draft.authType} onChange={(event) => setDraft((current) => ({ ...current, authType: event.target.value as AdminProviderInput["authType"] }))}>
              <option value="none">None</option>
              <option value="bearer">Bearer token</option>
              <option value="api-key">API key header</option>
              <option value="basic">Basic auth</option>
            </select>
          </FormField>
          <FormField label="Base URL" wide>
            <input className={styles.input} type="url" value={draft.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={draft.kind === "local" ? "http://127.0.0.1:11434" : "https://api.provider.example/v1"} />
          </FormField>
          {draft.authType !== "none" && (
            <FormField label="Credential" hint={provider?.credentialConfigured ? "leave blank to keep current" : "encrypted at rest"} wide>
              <input className={styles.input} type="password" autoComplete="new-password" value={draft.credential ?? ""} onChange={(event) => setDraft((current) => ({ ...current, credential: event.target.value }))} placeholder={provider?.credentialConfigured ? "••••••••••••" : "Paste secret"} />
            </FormField>
          )}
        </div>
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleTitle}>Provider enabled</div>
            <div className={styles.toggleHint}>Disabled providers cannot receive model traffic.</div>
          </div>
          <Toggle on={draft.enabled} onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} label="Provider enabled" />
        </div>
      </section>
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Execution limits</h3>
        <p className={styles.formSectionHint}>Leave rate and concurrency blank to inherit the service defaults.</p>
        <div className={styles.fieldGrid}>
          <FormField label="Timeout" hint="milliseconds"><input className={styles.input} type="number" min="100" value={draft.timeoutMs} onChange={(event) => setNumber("timeoutMs", event.target.value)} /></FormField>
          <FormField label="Retries"><input className={styles.input} type="number" min="0" max="10" value={draft.maxRetries} onChange={(event) => setNumber("maxRetries", event.target.value)} /></FormField>
          <FormField label="Rate limit" hint="requests / minute"><input className={styles.input} type="number" min="1" value={draft.requestsPerMinute ?? ""} onChange={(event) => setNumber("requestsPerMinute", event.target.value, true)} placeholder="Unlimited" /></FormField>
          <FormField label="Concurrency"><input className={styles.input} type="number" min="1" value={draft.concurrencyLimit ?? ""} onChange={(event) => setNumber("concurrencyLimit", event.target.value, true)} placeholder="Automatic" /></FormField>
        </div>
      </section>
      {testResult && <div className={testResult.ok ? styles.inlineSuccess : styles.inlineError}>{testResult.message}{testResult.latencyMs === null ? "" : ` · ${Math.round(testResult.latencyMs)} ms`}</div>}
      {error && <div className={styles.inlineError}>{error}</div>}
    </AdminModal>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
