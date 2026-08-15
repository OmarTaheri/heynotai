import {
  ModelRuntimeError,
  parseRequestSpec,
  type BuiltRequest,
  type ProviderConfig,
  type RequestSpec,
  type RuntimeInput,
  type RuntimeModel,
} from "./types.js";

const TEMPLATE = /\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g;
const EXACT_TEMPLATE = /^\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}$/;

export function buildModelRequest(
  provider: ProviderConfig,
  model: RuntimeModel,
  input: RuntimeInput,
): BuiltRequest {
  if (provider.enabled === false) {
    throw new ModelRuntimeError("provider_disabled", "Provider is disabled", 503);
  }
  if (input.kind !== model.type) {
    throw new ModelRuntimeError(
      "input_kind_mismatch",
      `Model ${model.slug} expects ${model.type}, received ${input.kind}`,
      400,
    );
  }
  enforceInputLimits(model, input);

  const spec = parseRequestSpec(model.requestSpec);
  const context = templateContext(provider, model, input);
  const url = buildUrl(provider, model, spec, context);
  assertUrlAllowed(url, provider);
  const method = spec.method ?? "POST";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  for (const [key, value] of Object.entries(spec.headers ?? {})) {
    assertHeaderName(key);
    headers[key] = renderString(value, context);
  }
  applyCredential(headers, provider);

  const bodyMode = spec.bodyMode ?? inferBodyMode(input);
  let body: BuiltRequest["body"];
  if (bodyMode === "json") {
    headers["Content-Type"] = renderString(
      spec.contentType ?? "application/json",
      context,
    );
    const rendered = renderTemplate(spec.body ?? defaultJsonBody(model, input), context);
    body = JSON.stringify(rendered);
  } else if (bodyMode === "binary") {
    const bytes = requireBytes(input);
    headers["Content-Type"] = renderString(
      spec.contentType ?? input.mime ?? "application/octet-stream",
      context,
    );
    body = new Uint8Array(bytes);
  } else if (bodyMode === "multipart") {
    const bytes = requireBytes(input);
    const form = new FormData();
    const fields = renderTemplate(spec.fields ?? {}, context) as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      form.append(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    const fileField = spec.fileField?.trim() || "file";
    const fileName = renderString(
      spec.fileName ?? input.fileName ?? defaultFileName(input.mime),
      context,
    );
    form.append(
      fileField,
      new Blob([new Uint8Array(bytes)], {
        type: input.mime || "application/octet-stream",
      }),
      fileName,
    );
    body = form;
    // fetch adds the boundary; a manually supplied multipart content type is
    // invalid unless it includes that generated boundary.
    delete headers["Content-Type"];
  }

  const withQuery = appendQuery(url, spec.query, context);
  return { url: withQuery, method, headers, body };
}

export function renderTemplate(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = EXACT_TEMPLATE.exec(value);
    if (exact) return lookupContext(context, exact[1]!);
    return renderString(value, context);
  }
  if (Array.isArray(value)) return value.map((entry) => renderTemplate(entry, context));
  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderTemplate(entry, context)]),
    );
  }
  return value;
}

function renderString(value: string, context: Record<string, unknown>): string {
  return value.replace(TEMPLATE, (_match, path: string) => {
    const resolved = lookupContext(context, path);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
}

function lookupContext(context: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (segment === "__proto__" || segment === "prototype" || segment === "constructor") {
      throw new ModelRuntimeError("unsafe_template", `Blocked template path: ${path}`, 400);
    }
    if (!isPlainRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      throw new ModelRuntimeError("unknown_template", `Unknown template value: ${path}`, 400);
    }
    current = current[segment];
  }
  return current;
}

function templateContext(
  provider: ProviderConfig,
  model: RuntimeModel,
  input: RuntimeInput,
): Record<string, unknown> {
  return {
    input: {
      kind: input.kind,
      text: input.text ?? "",
      mime: input.mime ?? "application/octet-stream",
      fileName: input.fileName ?? defaultFileName(input.mime),
      durationSec: input.durationSec ?? 0,
      metadata: input.metadata ?? {},
    },
    model: {
      id: model.id ?? "",
      slug: model.slug,
      externalId: model.externalModelId ?? "",
      configVersion: model.configVersion ?? 1,
    },
    provider: {
      id: provider.id ?? "",
      key: provider.key,
      baseUrl: provider.baseUrl,
    },
  };
}

function buildUrl(
  provider: ProviderConfig,
  model: RuntimeModel,
  spec: RequestSpec,
  context: Record<string, unknown>,
): string {
  if (spec.url) return renderString(spec.url, context);
  let path = spec.path ? renderString(spec.path, context) : "";
  if (!path && provider.driver === "huggingface") {
    if (!model.externalModelId) {
      throw new ModelRuntimeError(
        "model_identifier_missing",
        `Hugging Face model ${model.slug} has no externalModelId`,
        400,
      );
    }
    path = encodePath(model.externalModelId);
  }
  if (!path && provider.driver === "openai-compatible") {
    path = "/v1/chat/completions";
  }
  const base = provider.baseUrl.replace(/\/+$/, "");
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${base}${suffix}`;
}

function appendQuery(
  url: string,
  query: Record<string, unknown> | undefined,
  context: Record<string, unknown>,
): string {
  if (!query || Object.keys(query).length === 0) return url;
  const parsed = new URL(url);
  const rendered = renderTemplate(query, context) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rendered)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) parsed.searchParams.append(key, String(item));
    } else {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}

function applyCredential(headers: Record<string, string>, provider: ProviderConfig): void {
  const credential = provider.credential?.trim();
  if (!credential || provider.authScheme === "none") return;
  switch (provider.authScheme) {
    case "bearer":
      headers.Authorization = `Bearer ${credential}`;
      break;
    case "basic":
      headers.Authorization = `Basic ${Buffer.from(credential).toString("base64")}`;
      break;
    case "x-api-key":
      headers[String(provider.config?.apiKeyHeader || "X-API-Key")] = credential;
      break;
    case "api-key":
      headers[String(provider.config?.apiKeyHeader || "Authorization")] = credential;
      break;
  }
}

function enforceInputLimits(model: RuntimeModel, input: RuntimeInput): void {
  const limits = model.inputLimits ?? {};
  const byteLength = input.bytes?.byteLength ??
    (input.text === undefined ? 0 : Buffer.byteLength(input.text, "utf8"));
  if (limits.maxBytes !== undefined && byteLength > limits.maxBytes) {
    throw new ModelRuntimeError(
      "input_too_large",
      `Input exceeds ${limits.maxBytes} bytes`,
      413,
      { limit: limits.maxBytes, actual: byteLength },
    );
  }
  if (limits.maxChars !== undefined && (input.text?.length ?? 0) > limits.maxChars) {
    throw new ModelRuntimeError("input_too_long", `Input exceeds ${limits.maxChars} characters`, 413);
  }
  if (
    limits.maxDurationSec !== undefined &&
    (input.durationSec ?? 0) > limits.maxDurationSec
  ) {
    throw new ModelRuntimeError(
      "input_duration_exceeded",
      `Input exceeds ${limits.maxDurationSec} seconds`,
      413,
    );
  }
  if (input.mime) {
    const exact = limits.allowedMimeTypes ?? [];
    const prefixes = limits.allowedMimePrefixes ?? [];
    if (
      (exact.length > 0 || prefixes.length > 0) &&
      !exact.includes(input.mime) &&
      !prefixes.some((prefix) => input.mime!.startsWith(prefix))
    ) {
      throw new ModelRuntimeError(
        "unsupported_media_type",
        `Model ${model.slug} does not accept ${input.mime}`,
        415,
      );
    }
  }
}

function assertUrlAllowed(rawUrl: string, provider: ProviderConfig): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ModelRuntimeError("invalid_provider_url", "Provider URL is invalid", 400);
  }
  if (url.username || url.password) {
    throw new ModelRuntimeError("provider_url_credentials", "Credentials are not allowed in provider URLs", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ModelRuntimeError("invalid_provider_protocol", "Provider URL must use HTTP(S)", 400);
  }
  const local = provider.isLocal === true || provider.driver === "local-http";
  if (!local && url.protocol !== "https:") {
    throw new ModelRuntimeError("insecure_provider_url", "Remote providers must use HTTPS", 400);
  }
  if (!local && isPrivateHostname(url.hostname)) {
    throw new ModelRuntimeError(
      "private_provider_url",
      "Remote providers cannot target localhost or private IP literals",
      400,
    );
  }
  const configuredHosts = Array.isArray(provider.config?.allowedHosts)
    ? provider.config!.allowedHosts
        .filter((v): v is string => typeof v === "string")
        .map((host) => host.trim().toLowerCase().replace(/^\[|\]$/g, ""))
        .filter(Boolean)
    : [];
  const environmentHosts = local
    ? (process.env.ALLOWED_LOCAL_MODEL_HOSTS ?? "localhost,127.0.0.1,::1")
        .split(",")
        .map((host) => host.trim().toLowerCase().replace(/^\[|\]$/g, ""))
        .filter(Boolean)
    : [];
  const allowedHosts = [...new Set([...configuredHosts, ...environmentHosts])];
  const normalizedHost = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (local && !allowedHosts.includes(normalizedHost)) {
    throw new ModelRuntimeError(
      "local_provider_host_not_allowed",
      `Local model host ${url.hostname} is not in ALLOWED_LOCAL_MODEL_HOSTS`,
      400,
    );
  }
  if (allowedHosts.length > 0 && !allowedHosts.includes(normalizedHost)) {
    throw new ModelRuntimeError("provider_host_not_allowed", `Host ${url.hostname} is not allowlisted`, 400);
  }
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  const match = /^172\.(\d{1,3})\./.exec(h);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (/^169\.254\./.test(h) || /^0\./.test(h)) return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  return false;
}

function assertHeaderName(name: string): void {
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
    throw new ModelRuntimeError("invalid_header_name", `Invalid request header: ${name}`, 400);
  }
  const lower = name.toLowerCase();
  if (["host", "content-length", "connection", "transfer-encoding"].includes(lower)) {
    throw new ModelRuntimeError("blocked_header", `Header ${name} is managed by the HTTP client`, 400);
  }
}

function defaultJsonBody(model: RuntimeModel, input: RuntimeInput): unknown {
  if (model.type === "txt") return { inputs: "{{input.text}}" };
  if (input.metadata) return input.metadata;
  return {};
}

function inferBodyMode(input: RuntimeInput): "json" | "binary" {
  return input.kind === "txt" ? "json" : "binary";
}

function requireBytes(input: RuntimeInput): Uint8Array {
  if (!input.bytes) {
    throw new ModelRuntimeError("binary_input_missing", `${input.kind} model requires file bytes`, 400);
  }
  return input.bytes;
}

function defaultFileName(mime = "application/octet-stream"): string {
  const extension = mime.split("/")[1]?.replace(/[^A-Za-z0-9]/g, "") || "bin";
  return `input.${extension}`;
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
