"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table } from "@/components/ui/Table";
import { Toggle } from "@/components/ui/Toggle";
import { fetchAdminLogs } from "@/lib/admin-api";
import type {
  AdminLog,
  AdminLogFilters,
  AdminLogLevel,
  AdminPage,
} from "@/lib/admin-types";
import {
  AdminError,
  AdminLoading,
  AdminModal,
  AdminPager,
  formatAdminDate,
} from "./AdminPrimitives";
import styles from "./Admin.module.css";

const PER_PAGE = 50;

export function LogsClient() {
  const [result, setResult] = useState<AdminPage<AdminLog> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [level, setLevel] = useState<AdminLogLevel | "">("");
  const [source, setSource] = useState("");
  const [event, setEvent] = useState("");
  const [requestId, setRequestId] = useState("");
  const [userId, setUserId] = useState("");
  const [modelId, setModelId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminLog | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [debouncedQuery, event, from, level, modelId, providerId, requestId, source, to, userId]);

  const filters = useMemo<AdminLogFilters>(() => ({
    page,
    perPage: PER_PAGE,
    q: debouncedQuery || undefined,
    level,
    source: source.trim() || undefined,
    event: event.trim() || undefined,
    requestId: requestId.trim() || undefined,
    userId: userId.trim() || undefined,
    modelId: modelId.trim() || undefined,
    providerId: providerId.trim() || undefined,
    from: dateToIso(from),
    to: dateToIso(to),
  }), [debouncedQuery, event, from, level, modelId, page, providerId, requestId, source, to, userId]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      setResult(await fetchAdminLogs(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load logs.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [live, load]);

  const reset = () => {
    setQuery("");
    setLevel("");
    setSource("");
    setEvent("");
    setRequestId("");
    setUserId("");
    setModelId("");
    setProviderId("");
    setFrom("");
    setTo("");
  };

  return (
    <div className={`${styles.page} panel-reveal`}>
      <PageHeader
        title="Logs"
        subtitle="Search structured application, model, provider, authentication, and admin-audit events by correlation identifiers."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadLogs(result?.items ?? [])} disabled={!result?.items.length}>
              <Icon name="upload" size={13} />
              Export page
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <Icon name="refresh" size={13} />
              Refresh
            </Button>
          </>
        }
      />

      <div className={styles.toolbar}>
        <SearchInput className={styles.toolbarSearch} placeholder="Search message, event, user, model, or trace…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search logs" />
        <select className={styles.select} value={level} onChange={(event) => setLevel(event.target.value as AdminLogLevel | "")} aria-label="Filter logs by severity">
          <option value="">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <input className={styles.input} style={{ width: 150 }} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source" aria-label="Filter logs by source" />
        <input className={styles.input} style={{ width: 170 }} value={event} onChange={(event) => setEvent(event.target.value)} placeholder="Event name" aria-label="Filter logs by event" />
        <div className={styles.liveControl}>
          <Toggle size="sm" on={live} onChange={setLive} label="Live log refresh" />
          <span>Live · 5s</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.input} style={{ width: 185 }} value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="Request / trace ID" aria-label="Filter logs by request ID" />
        <input className={styles.input} style={{ width: 155 }} value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="User ID" aria-label="Filter logs by user ID" />
        <input className={styles.input} style={{ width: 155 }} value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="Model ID" aria-label="Filter logs by model ID" />
        <input className={styles.input} style={{ width: 155 }} value={providerId} onChange={(event) => setProviderId(event.target.value)} placeholder="Provider ID" aria-label="Filter logs by provider ID" />
        <input className={styles.input} style={{ width: 195 }} type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Logs from date" />
        <input className={styles.input} style={{ width: 195 }} type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Logs to date" />
        <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
      </div>

      {error && <AdminError message={error} />}
      {loading && !result ? (
        <AdminLoading label="Loading logs…" />
      ) : (
        <LogsTable
          logs={result?.items ?? []}
          page={result?.page ?? page}
          totalPages={result?.totalPages ?? 1}
          totalItems={result?.totalItems ?? 0}
          onPageChange={setPage}
          onSelect={setSelected}
        />
      )}

      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function LogsTable({
  logs,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onSelect,
}: {
  logs: AdminLog[];
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onSelect: (log: AdminLog) => void;
}) {
  return (
    <Table columns="126px 80px 110px minmax(280px,1fr) 105px 42px" minWidth={840} scroll aria-label="Platform logs">
      <Table.Header>
        <Table.HeaderCell>Timestamp</Table.HeaderCell>
        <Table.HeaderCell>Level</Table.HeaderCell>
        <Table.HeaderCell>Source</Table.HeaderCell>
        <Table.HeaderCell>Event</Table.HeaderCell>
        <Table.HeaderCell align="right">HTTP / latency</Table.HeaderCell>
        <Table.HeaderCell aria-hidden />
      </Table.Header>
      <Table.Body>
        {logs.length === 0 ? (
          <Table.Empty>No log events match these filters.</Table.Empty>
        ) : (
          logs.map((log) => (
            <Table.Row
              key={log.id}
              interactive
              className={styles.interactiveRow}
              tabIndex={0}
              aria-label={`Open ${log.event || "log event"}`}
              onClick={() => onSelect(log)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(log);
                }
              }}
            >
              <Table.Cell muted>{formatAdminDate(log.timestamp)}</Table.Cell>
              <Table.Cell><Pill tone={levelTone(log.level)} compact>{log.level.toUpperCase()}</Pill></Table.Cell>
              <Table.Cell muted>{log.source}</Table.Cell>
              <Table.Cell>
                <div className={styles.logMessage}>{log.event || log.message || "Untitled event"}</div>
                <div className={styles.logMeta}>
                  <span>{log.message}</span>
                  {log.requestId && <span>req {shortId(log.requestId)}</span>}
                </div>
              </Table.Cell>
              <Table.Cell align="right" mono>
                {log.statusCode ?? "—"}<br />
                <span className={styles.subtle}>{log.durationMs === null ? "—" : `${Math.round(log.durationMs)} ms`}</span>
              </Table.Cell>
              <Table.Cell align="right"><Table.RowAction onClick={() => onSelect(log)} ariaLabel="Open log details" iconName="chevron-right" /></Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
      <Table.Footer><AdminPager page={page} totalPages={totalPages} totalItems={totalItems} onChange={onPageChange} /></Table.Footer>
    </Table>
  );
}

function LogDetail({ log, onClose }: { log: AdminLog; onClose: () => void }) {
  const data: Array<[string, string]> = [
    ["Timestamp", formatAdminDate(log.timestamp)],
    ["Source", log.source || "—"],
    ["Event", log.event || "—"],
    ["Request ID", log.requestId || "—"],
    ["Trace ID", log.traceId || "—"],
    ["User ID", log.userId || "—"],
    ["Scan ID", log.scanId || "—"],
    ["Model ID", log.modelId || "—"],
    ["Provider ID", log.providerId || "—"],
    ["HTTP status", log.statusCode === null ? "—" : String(log.statusCode)],
    ["Duration", log.durationMs === null ? "—" : `${Math.round(log.durationMs)} ms`],
  ];
  return (
    <AdminModal
      title={log.event || "Log event"}
      subtitle={`${log.level.toUpperCase()} · ${log.source} · ${formatAdminDate(log.timestamp)}`}
      onClose={onClose}
      footer={<div className={styles.footerActions}><Button variant="secondary" onClick={() => void copyLog(log)}><Icon name="code" size={13} />Copy JSON</Button><Button variant="primary" onClick={onClose}>Done</Button></div>}
    >
      {log.message && <div className={styles.notice}>{log.message}</div>}
      <div className={styles.logDetail}>
        {data.map(([label, value]) => (
          <div key={label} className={styles.logDatum}>
            <div className={styles.logDatumLabel}>{label}</div>
            <div className={styles.logDatumValue}>{value}</div>
          </div>
        ))}
      </div>
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Structured metadata</h3>
        <pre className={styles.rawJson}>{JSON.stringify(log.metadata, null, 2)}</pre>
      </section>
    </AdminModal>
  );
}

function levelTone(level: AdminLogLevel): PillTone {
  if (level === "error") return "ai";
  if (level === "warn") return "warn";
  if (level === "debug") return "neutral";
  return "info";
}

function dateToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

async function copyLog(log: AdminLog): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
}

function downloadLogs(logs: AdminLog[]): void {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `heynotai-logs-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
}
