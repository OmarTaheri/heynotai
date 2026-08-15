"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Plan } from "@heynotai/shared";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table } from "@/components/ui/Table";
import { Toggle } from "@/components/ui/Toggle";
import { TypeChip } from "@/components/ui/TypeChip";
import {
  createAdminModel,
  deleteAdminModel,
  fetchAdminModels,
  fetchAdminProviders,
  normalizeAdminModelResponse,
  testAdminModel,
  updateAdminModel,
} from "@/lib/admin-api";
import type {
  AdminModel,
  AdminModelInput,
  AdminModelType,
  AdminNormalizedResult,
  AdminProvider,
  AdminResponseMapping,
  AdminTestResult,
} from "@/lib/admin-types";
import {
  AdminError,
  AdminLoading,
  AdminModal,
  FormField,
  ServiceState,
  formatAdminDate,
} from "./AdminPrimitives";
import styles from "./Admin.module.css";

const PLANS: Plan[] = ["check", "verify", "certify", "team"];
const TYPES: { id: AdminModelType; label: string }[] = [
  { id: "txt", label: "Text" },
  { id: "img", label: "Image" },
  { id: "aud", label: "Audio" },
  { id: "vid", label: "Video" },
];

const DEFAULT_MAPPING: AdminResponseMapping = {
  preset: "hf-classification",
  resultPath: "",
  labelPath: "label",
  scorePath: "score",
  modelPath: "model",
  errorPath: "error",
  aiLabels: ["ai", "fake", "generated", "synthetic", "label_1"],
  humanLabels: ["human", "real", "authentic", "label_0"],
  scoreScale: "zero_to_one",
  invertScore: false,
  aggregation: "first",
  mixedThreshold: 40,
  aiThreshold: 70,
};

const EMPTY_MODEL: AdminModelInput = {
  slug: "",
  name: "",
  description: "",
  type: "txt",
  providerId: "",
  modelIdentifier: "",
  endpointPath: "",
  enabled: false,
  accuracy: 0,
  tier: "check",
  plansAllowed: [...PLANS],
  defaultForPlans: [],
  tokenCost: 1,
  costUnit: "per_scan",
  inputLimits: {
    maxCharacters: null,
    maxBytes: null,
    maxDurationSeconds: null,
  },
  executionLimits: {
    timeoutMs: 30_000,
    maxRetries: 1,
    requestsPerMinute: null,
    concurrencyLimit: null,
  },
  requestTemplate: {},
  responseMapping: DEFAULT_MAPPING,
};

type ModelDraft = Omit<AdminModelInput, "requestTemplate"> & {
  requestTemplateText: string;
};

export function ModelsClient() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [providerId, setProviderId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminModel | "new" | null>(null);
  const [testingId, setTestingId] = useState("");
  const [testResults, setTestResults] = useState<Record<string, AdminTestResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextModels, nextProviders] = await Promise.all([
        fetchAdminModels(),
        fetchAdminProviders(),
      ]);
      setModels(nextModels);
      setProviders(nextProviders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load model catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      if (type && model.type !== type) return false;
      if (providerId && model.providerId !== providerId) return false;
      if (status === "enabled" && !model.enabled) return false;
      if (status === "disabled" && model.enabled) return false;
      if (status === "unhealthy" && model.status !== "down" && model.status !== "degraded") return false;
      if (needle && !`${model.name} ${model.slug} ${model.modelIdentifier} ${model.providerName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [models, providerId, query, status, type]);

  const test = async (model: AdminModel) => {
    setTestingId(model.id);
    setError("");
    try {
      const result = await testAdminModel(model.id);
      setTestResults((current) => ({ ...current, [model.id]: result }));
      await load();
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [model.id]: {
          ok: false,
          status: "down",
          message: err instanceof Error ? err.message : "Model test failed.",
          latencyMs: null,
        },
      }));
    } finally {
      setTestingId("");
    }
  };

  const toggleEnabled = async (model: AdminModel, enabled: boolean) => {
    setModels((current) => current.map((entry) => entry.id === model.id ? { ...entry, enabled } : entry));
    try {
      await updateAdminModel(model.id, { enabled });
    } catch (err) {
      setModels((current) => current.map((entry) => entry.id === model.id ? { ...entry, enabled: model.enabled } : entry));
      setError(err instanceof Error ? err.message : "Could not update model state.");
    }
  };

  return (
    <div className={`${styles.page} panel-reveal`}>
      <PageHeader
        title="Models"
        subtitle="Manage local and hosted detectors, normalize provider-specific output, and control execution, input, billing, and plan limits."
        actions={
          <>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <Icon name="refresh" size={13} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setEditing("new")} disabled={providers.length === 0} title={providers.length === 0 ? "Add a provider first" : undefined}>
              <Icon name="plus" size={13} />
              Add model
            </Button>
          </>
        }
      />

      <div className={styles.toolbar}>
        <SearchInput className={styles.toolbarSearch} placeholder="Search model, provider, or identifier…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search models" />
        <select className={styles.select} value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter models by type">
          <option value="">All types</option>
          {TYPES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <select className={styles.select} value={providerId} onChange={(event) => setProviderId(event.target.value)} aria-label="Filter models by provider">
          <option value="">All providers</option>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </select>
        <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter models by state">
          <option value="">All states</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="unhealthy">Unhealthy</option>
        </select>
      </div>

      {error && <AdminError message={error} />}
      {loading && models.length === 0 ? (
        <AdminLoading label="Loading model catalog…" />
      ) : (
        <Table columns="44px minmax(230px,1.4fr) 145px 110px 105px 76px 82px 42px" minWidth={960} scroll aria-label="Detection models">
          <Table.Header>
            <Table.HeaderCell aria-hidden />
            <Table.HeaderCell>Model</Table.HeaderCell>
            <Table.HeaderCell>Provider</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Plan / cost</Table.HeaderCell>
            <Table.HeaderCell>Enabled</Table.HeaderCell>
            <Table.HeaderCell>Test</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Header>
          <Table.Body>
            {visible.length === 0 ? (
              <Table.Empty>No models match these filters.</Table.Empty>
            ) : (
              visible.map((model) => {
                const testResult = testResults[model.id];
                return (
                  <Table.Row
                    key={model.id}
                    interactive
                    className={styles.interactiveRow}
                    tabIndex={0}
                    aria-label={`Edit ${model.name}`}
                    onClick={() => setEditing(model)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditing(model);
                      }
                    }}
                  >
                    <Table.Cell><TypeChip type={model.type} /></Table.Cell>
                    <Table.Cell>
                      <Table.CellTitle>{model.name}</Table.CellTitle>
                      <Table.CellMeta><span>{model.slug} · {model.modelIdentifier || "no remote identifier"}</span></Table.CellMeta>
                    </Table.Cell>
                    <Table.Cell>
                      <div className={styles.entityTitle}>{model.providerName || providerName(providers, model.providerId)}</div>
                      <div className={styles.entityMeta}>{model.endpointPath || "provider default"}</div>
                    </Table.Cell>
                    <Table.Cell><ServiceState status={model.enabled ? model.status : "unknown"} /></Table.Cell>
                    <Table.Cell>
                      <Pill tone={planTone(model.tier)} compact>{model.tier.toUpperCase()}</Pill>
                      <div className={styles.subtle}>{model.tokenCost} tk / {model.costUnit === "per_minute" ? "minute" : "scan"}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div onClick={(event) => event.stopPropagation()}>
                        <Toggle size="sm" on={model.enabled} onChange={(enabled) => void toggleEnabled(model, enabled)} label={`${model.enabled ? "Disable" : "Enable"} ${model.name}`} />
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Button variant="ghost" size="sm" disabled={!model.enabled || testingId === model.id} onClick={(event) => { event.stopPropagation(); void test(model); }}>
                        {testingId === model.id ? "Testing…" : "Test"}
                      </Button>
                      {testResult && <div className={testResult.ok ? styles.subtle : styles.inlineError}>{testResult.latencyMs === null ? testResult.message : `${Math.round(testResult.latencyMs)} ms`}</div>}
                    </Table.Cell>
                    <Table.Cell align="right"><Table.RowAction onClick={() => setEditing(model)} ariaLabel={`Edit ${model.name}`} /></Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
          <Table.Footer>
            <span className={styles.countNote}>{visible.length} of {models.length} models · {models.filter((model) => model.enabled).length} enabled</span>
          </Table.Footer>
        </Table>
      )}

      {editing && (
        <ModelEditor
          model={editing === "new" ? null : editing}
          providers={providers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
          onDeleted={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function ModelEditor({
  model,
  providers,
  onClose,
  onSaved,
  onDeleted,
}: {
  model: AdminModel | null;
  providers: AdminProvider[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const initial = useMemo<ModelDraft>(() => {
    const source: AdminModelInput = model ? {
      slug: model.slug,
      name: model.name,
      description: model.description,
      type: model.type,
      providerId: model.providerId,
      modelIdentifier: model.modelIdentifier,
      endpointPath: model.endpointPath,
      enabled: model.enabled,
      accuracy: model.accuracy,
      tier: model.tier,
      plansAllowed: [...model.plansAllowed],
      defaultForPlans: [...model.defaultForPlans],
      tokenCost: model.tokenCost,
      costUnit: model.costUnit,
      inputLimits: { ...model.inputLimits },
      executionLimits: { ...model.executionLimits },
      requestTemplate: { ...model.requestTemplate },
      responseMapping: { ...model.responseMapping, aiLabels: [...model.responseMapping.aiLabels], humanLabels: [...model.responseMapping.humanLabels] },
    } : {
      ...EMPTY_MODEL,
      providerId: providers[0]?.id ?? "",
      inputLimits: { ...EMPTY_MODEL.inputLimits },
      executionLimits: { ...EMPTY_MODEL.executionLimits },
      plansAllowed: [...EMPTY_MODEL.plansAllowed],
      defaultForPlans: [],
      requestTemplate: {},
      responseMapping: { ...DEFAULT_MAPPING, aiLabels: [...DEFAULT_MAPPING.aiLabels], humanLabels: [...DEFAULT_MAPPING.humanLabels] },
    };
    const { requestTemplate, ...rest } = source;
    return { ...rest, requestTemplateText: JSON.stringify(requestTemplate, null, 2) };
  }, [model, providers]);
  const [draft, setDraft] = useState<ModelDraft>(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<AdminTestResult | null>(null);
  const [sampleResponse, setSampleResponse] = useState(sampleForPreset(initial.responseMapping.preset));
  const [normalized, setNormalized] = useState<AdminNormalizedResult | null>(null);

  const save = async () => {
    setError("");
    if (!draft.name.trim() || !draft.slug.trim() || !draft.providerId) {
      setError("Name, slug, and provider are required.");
      return;
    }
    if (draft.responseMapping.aiThreshold <= draft.responseMapping.mixedThreshold) {
      setError("AI threshold must be higher than the mixed threshold.");
      return;
    }
    let requestTemplate: Record<string, unknown>;
    try {
      requestTemplate = parseJsonObject(draft.requestTemplateText || "{}");
    } catch (err) {
      setError(err instanceof Error ? `Request template: ${err.message}` : "Request template is invalid JSON.");
      return;
    }
    const { requestTemplateText: _drop, ...rest } = draft;
    void _drop;
    const payload: AdminModelInput = {
      ...rest,
      name: rest.name.trim(),
      slug: rest.slug.trim(),
      description: rest.description.trim(),
      modelIdentifier: rest.modelIdentifier.trim(),
      endpointPath: rest.endpointPath.trim(),
      requestTemplate,
    };
    setBusy("save");
    try {
      if (model) await updateAdminModel(model.id, payload);
      else await createAdminModel(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save model.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!model || !window.confirm(`Delete model “${model.name}”? Existing scan results remain, but no new scan can use it.`)) return;
    setBusy("delete");
    setError("");
    try {
      await deleteAdminModel(model.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete model.");
    } finally {
      setBusy("");
    }
  };

  const liveTest = async () => {
    if (!model) return;
    setBusy("live-test");
    setError("");
    try {
      setTestResult(await testAdminModel(model.id));
    } catch (err) {
      setTestResult({ ok: false, status: "down", message: err instanceof Error ? err.message : "Model test failed.", latencyMs: null });
    } finally {
      setBusy("");
    }
  };

  const normalize = async () => {
    setBusy("normalize");
    setError("");
    setNormalized(null);
    try {
      const parsed = JSON.parse(sampleResponse) as unknown;
      setNormalized(await normalizeAdminModelResponse({ responseMapping: draft.responseMapping, sampleResponse: parsed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not normalize sample response.");
    } finally {
      setBusy("");
    }
  };

  const setMapping = <K extends keyof AdminResponseMapping>(key: K, value: AdminResponseMapping[K]) => {
    setDraft((current) => ({ ...current, responseMapping: { ...current.responseMapping, [key]: value } }));
  };

  const setPreset = (preset: AdminResponseMapping["preset"]) => {
    const mapping = mappingForPreset(preset);
    setDraft((current) => ({ ...current, responseMapping: mapping }));
    setSampleResponse(sampleForPreset(preset));
    setNormalized(null);
  };

  const setInputLimit = (key: keyof ModelDraft["inputLimits"], value: string) => {
    setDraft((current) => ({ ...current, inputLimits: { ...current.inputLimits, [key]: value === "" ? null : Math.max(1, Number(value) || 0) } }));
  };

  const setExecutionLimit = (key: keyof ModelDraft["executionLimits"], value: string, nullable = false) => {
    const minimum = key === "timeoutMs" ? 100 : key === "maxRetries" ? 0 : 1;
    setDraft((current) => ({ ...current, executionLimits: { ...current.executionLimits, [key]: nullable && value === "" ? null : Math.max(minimum, Number(value) || 0) } }));
  };

  return (
    <AdminModal
      title={model ? `Edit ${model.name}` : "Add model"}
      subtitle="Provider routing, declarative output mapping, and every operational limit live together."
      wide
      onClose={onClose}
      footer={
        <>
          {model && <Button variant="secondary" className={styles.dangerButton} onClick={() => void remove()} disabled={!!busy}><Icon name="trash" size={13} />Delete</Button>}
          <div className={styles.footerActions}>
            {model && <Button variant="secondary" onClick={() => void liveTest()} disabled={!!busy}>{busy === "live-test" ? "Testing…" : "Test live model"}</Button>}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save model"}</Button>
          </div>
        </>
      }
    >
      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Identity and routing</h3>
        <div className={styles.fieldGridThree}>
          <FormField label="Display name"><input className={styles.input} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, slug: model || current.slug ? current.slug : slugify(event.target.value) }))} placeholder="Audio deepfake detector" /></FormField>
          <FormField label="Slug" hint="stable identifier"><input className={styles.input} value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))} placeholder="audio-deepfake-v1" /></FormField>
          <FormField label="Content type"><select className={styles.select} value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as AdminModelType }))}>{TYPES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></FormField>
          <FormField label="Provider"><select className={styles.select} value={draft.providerId} onChange={(event) => setDraft((current) => ({ ...current, providerId: event.target.value }))}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.enabled ? "" : " (disabled)"}</option>)}</select></FormField>
          <FormField label="Model identifier" hint="repo, deployment, or model ID"><input className={styles.input} value={draft.modelIdentifier} onChange={(event) => setDraft((current) => ({ ...current, modelIdentifier: event.target.value }))} placeholder="org/model-name" /></FormField>
          <FormField label="Accuracy" hint="0–100"><input className={styles.input} type="number" min="0" max="100" step="0.1" value={draft.accuracy} onChange={(event) => setDraft((current) => ({ ...current, accuracy: clamp(Number(event.target.value) || 0, 0, 100) }))} /></FormField>
          <FormField label="Description" wide><textarea className={styles.textarea} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What this model detects and when operators should use it." /></FormField>
        </div>
        <div className={styles.toggleRow}>
          <div><div className={styles.toggleTitle}>Model enabled</div><div className={styles.toggleHint}>Keep new or untested models disabled until their adapter passes.</div></div>
          <Toggle on={draft.enabled} onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} label="Model enabled" />
        </div>
      </section>

      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Plan access and billing</h3>
        <div className={styles.fieldGridThree}>
          <FormField label="Minimum tier"><select className={styles.select} value={draft.tier} onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as Plan }))}>{PLANS.map((entry) => <option key={entry} value={entry}>{capitalize(entry)}</option>)}</select></FormField>
          <FormField label="Token charge"><input className={styles.input} type="number" min="0" step="1" value={draft.tokenCost} onChange={(event) => setDraft((current) => ({ ...current, tokenCost: Math.max(0, Number(event.target.value) || 0) }))} /></FormField>
          <FormField label="Charge unit"><select className={styles.select} value={draft.costUnit} onChange={(event) => setDraft((current) => ({ ...current, costUnit: event.target.value === "per_minute" ? "per_minute" : "per_scan" }))}><option value="per_scan">Per scan</option><option value="per_minute">Per minute</option></select></FormField>
        </div>
        <div>
          <div className={styles.fieldLabel}>Plans allowed</div>
          <PlanChecks values={draft.plansAllowed} onChange={(plansAllowed) => setDraft((current) => ({ ...current, plansAllowed }))} />
        </div>
        <div>
          <div className={styles.fieldLabel}>Default for plans</div>
          <PlanChecks values={draft.defaultForPlans} onChange={(defaultForPlans) => setDraft((current) => ({ ...current, defaultForPlans }))} />
        </div>
      </section>

      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Input and execution limits</h3>
        <p className={styles.formSectionHint}>Blank input/rate limits mean no model-specific cap; provider and platform safeguards still apply.</p>
        <div className={styles.fieldGridThree}>
          <FormField label="Max characters"><input className={styles.input} type="number" min="1" value={draft.inputLimits.maxCharacters ?? ""} onChange={(event) => setInputLimit("maxCharacters", event.target.value)} placeholder="Unlimited" /></FormField>
          <FormField label="Max file bytes"><input className={styles.input} type="number" min="1" value={draft.inputLimits.maxBytes ?? ""} onChange={(event) => setInputLimit("maxBytes", event.target.value)} placeholder="Unlimited" /></FormField>
          <FormField label="Max duration" hint="seconds"><input className={styles.input} type="number" min="1" value={draft.inputLimits.maxDurationSeconds ?? ""} onChange={(event) => setInputLimit("maxDurationSeconds", event.target.value)} placeholder="Unlimited" /></FormField>
          <FormField label="Timeout" hint="milliseconds"><input className={styles.input} type="number" min="100" value={draft.executionLimits.timeoutMs} onChange={(event) => setExecutionLimit("timeoutMs", event.target.value)} /></FormField>
          <FormField label="Retries"><input className={styles.input} type="number" min="0" max="10" value={draft.executionLimits.maxRetries} onChange={(event) => setExecutionLimit("maxRetries", event.target.value)} /></FormField>
          <FormField label="Rate limit" hint="requests / minute"><input className={styles.input} type="number" min="1" value={draft.executionLimits.requestsPerMinute ?? ""} onChange={(event) => setExecutionLimit("requestsPerMinute", event.target.value, true)} placeholder="Provider default" /></FormField>
          <FormField label="Concurrency"><input className={styles.input} type="number" min="1" value={draft.executionLimits.concurrencyLimit ?? ""} onChange={(event) => setExecutionLimit("concurrencyLimit", event.target.value, true)} placeholder="Provider default" /></FormField>
        </div>
      </section>

      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Request construction</h3>
        <p className={styles.formSectionHint}>Use a relative path under the provider base URL. The JSON template may contain backend-supported placeholders for the model and input.</p>
        <div className={styles.fieldGrid}>
          <FormField label="Endpoint path"><input className={styles.input} value={draft.endpointPath} onChange={(event) => setDraft((current) => ({ ...current, endpointPath: event.target.value }))} placeholder="/models/{model}/infer" /></FormField>
          <FormField label="Request template" hint="JSON object" wide><textarea className={styles.textarea} value={draft.requestTemplateText} onChange={(event) => setDraft((current) => ({ ...current, requestTemplateText: event.target.value }))} spellCheck={false} /></FormField>
        </div>
      </section>

      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Response adapter</h3>
        <p className={styles.formSectionHint}>Map unfamiliar provider JSON into one stable verdict. Paths are declarative; no executable code is stored.</p>
        <div className={styles.fieldGridThree}>
          <FormField label="Adapter preset"><select className={styles.select} value={draft.responseMapping.preset} onChange={(event) => setPreset(event.target.value as AdminResponseMapping["preset"])}><option value="hf-classification">HF classification</option><option value="velma-segments">Velma segments</option><option value="openai-compatible">OpenAI-compatible</option><option value="generic-json">Generic JSON mapping</option></select></FormField>
          <FormField label="Result path"><input className={styles.input} value={draft.responseMapping.resultPath} onChange={(event) => setMapping("resultPath", event.target.value)} placeholder="results or data.items" /></FormField>
          <FormField label="Aggregation"><select className={styles.select} value={draft.responseMapping.aggregation} onChange={(event) => setMapping("aggregation", event.target.value as AdminResponseMapping["aggregation"])}><option value="first">First result</option><option value="max">Maximum AI score</option><option value="mean">Mean score</option><option value="weighted_mean">Weighted mean</option></select></FormField>
          <FormField label="Label path"><input className={styles.input} value={draft.responseMapping.labelPath} onChange={(event) => setMapping("labelPath", event.target.value)} placeholder="label" /></FormField>
          <FormField label="Score path"><input className={styles.input} value={draft.responseMapping.scorePath} onChange={(event) => setMapping("scorePath", event.target.value)} placeholder="score" /></FormField>
          <FormField label="Score scale"><select className={styles.select} value={draft.responseMapping.scoreScale} onChange={(event) => setMapping("scoreScale", event.target.value as AdminResponseMapping["scoreScale"])}><option value="zero_to_one">0 to 1</option><option value="zero_to_hundred">0 to 100</option></select></FormField>
          <FormField label="Model path"><input className={styles.input} value={draft.responseMapping.modelPath} onChange={(event) => setMapping("modelPath", event.target.value)} placeholder="model" /></FormField>
          <FormField label="Error path"><input className={styles.input} value={draft.responseMapping.errorPath} onChange={(event) => setMapping("errorPath", event.target.value)} placeholder="error.message" /></FormField>
          <div className={styles.toggleRow}>
            <div><div className={styles.toggleTitle}>Invert score</div><div className={styles.toggleHint}>Use when score measures human probability.</div></div>
            <Toggle size="sm" on={draft.responseMapping.invertScore} onChange={(value) => setMapping("invertScore", value)} label="Invert score" />
          </div>
          <FormField label="AI labels" hint="comma separated"><input className={styles.input} value={draft.responseMapping.aiLabels.join(", ")} onChange={(event) => setMapping("aiLabels", csv(event.target.value))} /></FormField>
          <FormField label="Human labels" hint="comma separated"><input className={styles.input} value={draft.responseMapping.humanLabels.join(", ")} onChange={(event) => setMapping("humanLabels", csv(event.target.value))} /></FormField>
          <FormField label="Mixed threshold" hint="AI %"><input className={styles.input} type="number" min="0" max="100" value={draft.responseMapping.mixedThreshold} onChange={(event) => setMapping("mixedThreshold", clamp(Number(event.target.value) || 0, 0, 100))} /></FormField>
          <FormField label="AI threshold" hint="AI %"><input className={styles.input} type="number" min="0" max="100" value={draft.responseMapping.aiThreshold} onChange={(event) => setMapping("aiThreshold", clamp(Number(event.target.value) || 0, 0, 100))} /></FormField>
        </div>
      </section>

      <section className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Adapter test console</h3>
        <p className={styles.formSectionHint}>Paste a real or representative provider response. A passing preview verifies the mapping without calling the provider.</p>
        <div className={styles.testGrid}>
          <div className={styles.testPanel}>
            <div className={styles.fieldLabel}>Provider response</div>
            <textarea className={styles.textarea} style={{ minHeight: 180 }} value={sampleResponse} onChange={(event) => setSampleResponse(event.target.value)} spellCheck={false} />
          </div>
          <div className={styles.testPanel}>
            <div className={styles.fieldLabel}>Normalized result</div>
            <pre className={styles.testOutput}>{normalized ? JSON.stringify(normalized, null, 2) : "Run the adapter to preview { verdict, confidence, aiPct, model }."}</pre>
          </div>
        </div>
        <div><Button variant="secondary" onClick={() => void normalize()} disabled={!!busy}><Icon name="code" size={13} />{busy === "normalize" ? "Normalizing…" : "Run adapter test"}</Button></div>
      </section>
      {testResult && <div className={testResult.ok ? styles.inlineSuccess : styles.inlineError}>{testResult.message}{testResult.latencyMs === null ? "" : ` · ${Math.round(testResult.latencyMs)} ms`}</div>}
      {error && <div className={styles.inlineError}>{error}</div>}
      {model && <div className={styles.subtle}>Last tested {formatAdminDate(model.lastTestedAt)} · last updated {formatAdminDate(model.updatedAt)}</div>}
    </AdminModal>
  );
}

function PlanChecks({ values, onChange }: { values: Plan[]; onChange: (values: Plan[]) => void }) {
  return (
    <div className={styles.checkGrid}>
      {PLANS.map((plan) => (
        <label key={plan} className={styles.check}>
          <input type="checkbox" checked={values.includes(plan)} onChange={(event) => onChange(event.target.checked ? [...values, plan] : values.filter((entry) => entry !== plan))} />
          {capitalize(plan)}
        </label>
      ))}
    </div>
  );
}

function mappingForPreset(preset: AdminResponseMapping["preset"]): AdminResponseMapping {
  if (preset === "velma-segments") {
    return { ...DEFAULT_MAPPING, preset, resultPath: "segments", labelPath: "label", scorePath: "deepfake_probability", modelPath: "model", aggregation: "max", aiLabels: ["deepfake", "fake", "synthetic"], humanLabels: ["real", "human"] };
  }
  if (preset === "openai-compatible") {
    return { ...DEFAULT_MAPPING, preset, resultPath: "choices", labelPath: "message.content.label", scorePath: "message.content.score", modelPath: "model", aiLabels: ["ai", "generated"], humanLabels: ["human"] };
  }
  if (preset === "generic-json") {
    return { ...DEFAULT_MAPPING, preset, resultPath: "", labelPath: "verdict", scorePath: "confidence", modelPath: "model", scoreScale: "zero_to_hundred", aiLabels: ["ai"], humanLabels: ["human"] };
  }
  return { ...DEFAULT_MAPPING, preset, aiLabels: [...DEFAULT_MAPPING.aiLabels], humanLabels: [...DEFAULT_MAPPING.humanLabels] };
}

function sampleForPreset(preset: AdminResponseMapping["preset"]): string {
  if (preset === "velma-segments") return JSON.stringify({ model: "velma", segments: [{ label: "deepfake", deepfake_probability: 0.91 }] }, null, 2);
  if (preset === "openai-compatible") return JSON.stringify({ model: "detector-v2", choices: [{ message: { content: { label: "ai", score: 0.88 } } }] }, null, 2);
  if (preset === "generic-json") return JSON.stringify({ model: "custom-detector", verdict: "ai", confidence: 92 }, null, 2);
  return JSON.stringify([[{ label: "AI", score: 0.93 }, { label: "human", score: 0.07 }]], null, 2);
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function csv(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function providerName(providers: AdminProvider[], id: string): string {
  return providers.find((provider) => provider.id === id)?.name ?? "Unknown provider";
}

function planTone(plan: Plan): PillTone {
  if (plan === "team") return "gold";
  if (plan === "certify") return "certify";
  if (plan === "verify") return "human";
  return "neutral";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
