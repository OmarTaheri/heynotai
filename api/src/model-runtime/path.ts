import { ModelRuntimeError } from "./types.js";

const MAX_PATH_LENGTH = 512;
const MAX_SEGMENTS = 64;
const MAX_RESULTS = 10_000;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type PathSegment = string | number | "*";

/** Extract a bounded dot/bracket path without eval or JSONPath filters.
 *
 * Supported examples: `$`, `frames[0].confidence`, `data.items[*].score`,
 * `$[0]`, and `["odd-key"]`. Recursive descent, scripts, unions, slices,
 * and predicates are deliberately unsupported. */
export function extractPath(root: unknown, path = "$", required = false): unknown {
  const segments = parsePath(path);
  let values: unknown[] = [root];
  let usedWildcard = false;

  for (const segment of segments) {
    const next: unknown[] = [];
    if (segment === "*") usedWildcard = true;
    for (const value of values) {
      if (segment === "*") {
        if (Array.isArray(value)) next.push(...value);
        else if (isPlainRecord(value)) next.push(...Object.values(value));
      } else if (typeof segment === "number") {
        if (Array.isArray(value) && segment >= 0 && segment < value.length) {
          next.push(value[segment]);
        }
      } else if (isPlainRecord(value) && Object.prototype.hasOwnProperty.call(value, segment)) {
        next.push(value[segment]);
      }
      if (next.length > MAX_RESULTS) {
        throw new ModelRuntimeError(
          "mapping_result_limit",
          `Path ${path} expanded beyond ${MAX_RESULTS} values`,
          400,
        );
      }
    }
    values = next;
    if (values.length === 0) break;
  }

  if (values.length === 0) {
    if (required) {
      throw new ModelRuntimeError(
        "mapping_path_missing",
        `Required response path not found: ${path}`,
        422,
      );
    }
    return undefined;
  }
  return usedWildcard ? values : values[0];
}

export function parsePath(path: string): PathSegment[] {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    throw new ModelRuntimeError("invalid_mapping_path", "Invalid mapping path", 400);
  }

  let cursor = path.startsWith("$") ? 1 : 0;
  const segments: PathSegment[] = [];
  while (cursor < path.length) {
    if (segments.length >= MAX_SEGMENTS) {
      throw new ModelRuntimeError(
        "mapping_path_limit",
        `Mapping path exceeds ${MAX_SEGMENTS} segments`,
        400,
      );
    }
    const char = path[cursor];
    if (char === ".") {
      cursor += 1;
      const match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(path.slice(cursor));
      if (!match) invalid(path, cursor);
      pushSafe(segments, match![0]);
      cursor += match![0].length;
      continue;
    }
    if (char === "[") {
      const end = findBracketEnd(path, cursor);
      const inner = path.slice(cursor + 1, end).trim();
      if (inner === "*") {
        segments.push("*");
      } else if (/^\d+$/.test(inner)) {
        segments.push(Number(inner));
      } else if (
        (inner.startsWith('"') && inner.endsWith('"')) ||
        (inner.startsWith("'") && inner.endsWith("'"))
      ) {
        let key: string;
        try {
          key = inner.startsWith('"')
            ? (JSON.parse(inner) as string)
            : inner.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        } catch {
          invalid(path, cursor);
        }
        pushSafe(segments, key!);
      } else {
        invalid(path, cursor);
      }
      cursor = end + 1;
      continue;
    }

    // A leading bare identifier (`frames[0]`) is accepted for concise admin
    // configuration. Bare identifiers after the first require a dot.
    if (segments.length === 0) {
      const match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(path.slice(cursor));
      if (!match) invalid(path, cursor);
      pushSafe(segments, match![0]);
      cursor += match![0].length;
      continue;
    }
    invalid(path, cursor);
  }
  return segments;
}

function findBracketEnd(path: string, start: number): number {
  let quote = "";
  let escaped = false;
  for (let i = start + 1; i < path.length; i += 1) {
    const c = path[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "]") return i;
  }
  invalid(path, start);
}

function pushSafe(segments: PathSegment[], key: string): void {
  if (BLOCKED_KEYS.has(key)) {
    throw new ModelRuntimeError(
      "unsafe_mapping_path",
      `Blocked mapping path segment: ${key}`,
      400,
    );
  }
  segments.push(key);
}

function invalid(path: string, cursor: number): never {
  throw new ModelRuntimeError(
    "invalid_mapping_path",
    `Invalid mapping path near character ${cursor}: ${path}`,
    400,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

