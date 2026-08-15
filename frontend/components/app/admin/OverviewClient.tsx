"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHead } from "@/components/ui/SectionHead";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { Table } from "@/components/ui/Table";
import { TypeChip } from "@/components/ui/TypeChip";
import { fetchAdminOverview } from "@/lib/admin-api";
import type { AdminOverview } from "@/lib/admin-types";
import {
  AdminError,
  AdminLoading,
  ServiceState,
  formatAdminDate,
} from "./AdminPrimitives";
import styles from "./Admin.module.css";

export function OverviewClient() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await fetchAdminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load system state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${styles.page} panel-reveal`}>
      <PageHeader
        title="Platform overview"
        subtitle="Live service health, account activity, model reliability, and the failures that need attention."
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={13} />
            Refresh
          </Button>
        }
      />

      {error && <AdminError message={error} />}
      {loading && !overview ? <AdminLoading /> : overview && <OverviewBody overview={overview} />}
    </div>
  );
}

function OverviewBody({ overview }: { overview: AdminOverview }) {
  return (
    <>
      <StatGrid>
        <StatTile
          label="Total users"
          value={overview.totalUsers.toLocaleString()}
          delta={`${overview.activeUsers.toLocaleString()} active`}
          tone="up"
        />
        <StatTile
          label="Scans · 24h"
          value={overview.scans24h.toLocaleString()}
          delta={`${overview.enabledModels} models enabled`}
          tone="up"
        />
        <StatTile
          label="Error rate · 24h"
          value={formatPercent(overview.errorRate24h)}
          delta={overview.errorRate24h > 5 ? "Needs attention" : "Within target"}
          tone={overview.errorRate24h > 5 ? "warn" : "up"}
        />
        <StatTile
          label="P95 latency"
          value={Math.round(overview.p95LatencyMs).toLocaleString()}
          unit="ms"
          delta="end-to-end requests"
          tone={overview.p95LatencyMs > 5_000 ? "warn" : "down"}
        />
      </StatGrid>

      <section>
        <SectionHead title="System state" subtitle={`updated ${formatAdminDate(overview.generatedAt)}`} />
        {overview.services.length === 0 ? (
          <div className={styles.empty}>No service checks have reported yet.</div>
        ) : (
          <div className={styles.serviceGrid}>
            {overview.services.map((service) => (
              <article key={service.id} className={styles.serviceCard}>
                <div className={styles.serviceIdentity}>
                  <div className={styles.serviceTitle}>
                    <Icon name="activity" size={14} />
                    {service.name}
                  </div>
                  <p className={styles.serviceMessage}>
                    {service.message || "Last health check completed without details."}
                  </p>
                  <p className={styles.serviceMeta}>
                    {service.latencyMs === null ? "latency —" : `${Math.round(service.latencyMs)} ms`}
                    {service.checkedAt ? ` · ${formatAdminDate(service.checkedAt)}` : ""}
                  </p>
                </div>
                <ServiceState status={service.status} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead title="Model health" subtitle={`${overview.modelHealth.length} reporting`} />
        <Table columns="44px minmax(200px,1fr) 130px 105px 110px" minWidth={680} scroll>
          <Table.Header>
            <Table.HeaderCell aria-hidden />
            <Table.HeaderCell>Model</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Success</Table.HeaderCell>
            <Table.HeaderCell align="right">P95 latency</Table.HeaderCell>
          </Table.Header>
          <Table.Body>
            {overview.modelHealth.length === 0 ? (
              <Table.Empty>No model health checks yet.</Table.Empty>
            ) : (
              overview.modelHealth.map((model) => (
                <Table.Row key={model.id}>
                  <Table.Cell><TypeChip type={model.type} /></Table.Cell>
                  <Table.Cell>
                    <Table.CellTitle>{model.name}</Table.CellTitle>
                    <Table.CellMeta><span>{model.provider || "No provider"}</span></Table.CellMeta>
                  </Table.Cell>
                  <Table.Cell><ServiceState status={model.status} /></Table.Cell>
                  <Table.Cell mono>
                    {model.successRate === null ? "—" : formatPercent(model.successRate)}
                  </Table.Cell>
                  <Table.Cell align="right" mono>
                    {model.p95LatencyMs === null ? "—" : `${Math.round(model.p95LatencyMs)} ms`}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </section>

      <section>
        <SectionHead title="Recent events" subtitle={`${overview.recentLogs.length} events`} linkLabel="Open logs" linkHref="/app/admin/logs" />
        <Table columns="90px 120px minmax(260px,1fr) 110px" minWidth={650} scroll>
          <Table.Header>
            <Table.HeaderCell>Level</Table.HeaderCell>
            <Table.HeaderCell>Source</Table.HeaderCell>
            <Table.HeaderCell>Event</Table.HeaderCell>
            <Table.HeaderCell align="right">When</Table.HeaderCell>
          </Table.Header>
          <Table.Body>
            {overview.recentLogs.length === 0 ? (
              <Table.Empty>No recent failures.</Table.Empty>
            ) : (
              overview.recentLogs.map((log) => (
                <Table.Row key={log.id}>
                  <Table.Cell mono>{log.level.toUpperCase()}</Table.Cell>
                  <Table.Cell muted>{log.source}</Table.Cell>
                  <Table.Cell>
                    <Table.CellTitle>{log.event || log.message}</Table.CellTitle>
                    <Table.CellMeta><span>{log.message}</span></Table.CellMeta>
                  </Table.Cell>
                  <Table.Cell align="right" muted>{formatAdminDate(log.timestamp)}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </section>
    </>
  );
}

function formatPercent(value: number): string {
  const normalized = value > 0 && value < 1 ? value * 100 : value;
  return `${normalized.toFixed(normalized < 10 ? 1 : 0)}%`;
}
