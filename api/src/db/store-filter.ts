import { StoreError, type PocketRecord } from "./store-types.js";

type Token =
  | { kind: "identifier"; value: string }
  | { kind: "literal"; value: unknown }
  | { kind: "operator"; value: string }
  | { kind: "paren"; value: "(" | ")" };

type Predicate = (record: PocketRecord) => boolean;

/** Compile the small application backend filter subset used by this repository.
 * Invalid syntax fails closed; filter text is never interpolated into SQL. */
export function compileFilter(source?: string): Predicate {
  if (!source?.trim()) return () => true;
  if (source.length > 10_000) {
    throw new StoreError(400, "invalid_filter", "Filter is too long");
  }
  const parser = new Parser(tokenize(source));
  const predicate = parser.parseExpression();
  parser.expectEnd();
  return predicate;
}

export function interpolateFilter(
  source: string,
  params: Record<string, unknown>,
): string {
  return source.replace(/\{:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new StoreError(400, "invalid_filter", `Missing filter parameter: ${key}`);
    }
    return literal(params[key]);
  });
}

export function sortRecords(records: PocketRecord[], sort?: string): PocketRecord[] {
  const terms = (sort ?? "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => ({
      descending: term.startsWith("-"),
      field: term.replace(/^[+-]/, ""),
    }));
  if (terms.length === 0) return records;
  return records.sort((a, b) => {
    for (const term of terms) {
      const av = fieldValue(a, term.field);
      const bv = fieldValue(b, term.field);
      const comparison = compare(av, bv);
      if (comparison !== 0) return term.descending ? -comparison : comparison;
    }
    return 0;
  });
}

export function projectFields(record: PocketRecord, fields?: string): PocketRecord {
  if (!fields?.trim()) return record;
  const selected = new Set(
    fields.split(",").map((field) => field.trim()).filter(Boolean),
  );
  for (const required of ["id", "collectionId", "collectionName", "created", "updated"]) {
    selected.add(required);
  }
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => selected.has(key)),
  ) as PocketRecord;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): Predicate {
    return this.parseOr();
  }

  expectEnd(): void {
    if (this.index !== this.tokens.length) this.invalid("Unexpected trailing filter input");
  }

  private parseOr(): Predicate {
    let left = this.parseAnd();
    while (this.operator("||")) {
      const right = this.parseAnd();
      const previous = left;
      left = (record) => previous(record) || right(record);
    }
    return left;
  }

  private parseAnd(): Predicate {
    let left = this.parsePrimary();
    while (this.operator("&&")) {
      const right = this.parsePrimary();
      const previous = left;
      left = (record) => previous(record) && right(record);
    }
    return left;
  }

  private parsePrimary(): Predicate {
    if (this.paren("(")) {
      const inner = this.parseExpression();
      if (!this.paren(")")) this.invalid("Missing closing parenthesis");
      return inner;
    }
    const left = this.operand();
    const operator = this.take("operator");
    if (!operator || !["=", "!=", ">", ">=", "<", "<=", "~", "?="].includes(operator.value)) {
      this.invalid("Expected a comparison operator");
    }
    const right = this.operand();
    return (record) => evaluate(resolve(left, record), operator!.value, resolve(right, record));
  }

  private operand(): Token {
    const token = this.tokens[this.index];
    if (!token || (token.kind !== "identifier" && token.kind !== "literal")) {
      this.invalid("Expected a field or literal");
    }
    this.index += 1;
    return token!;
  }

  private operator(value: string): boolean {
    const token = this.tokens[this.index];
    if (token?.kind === "operator" && token.value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private paren(value: "(" | ")"): boolean {
    const token = this.tokens[this.index];
    if (token?.kind === "paren" && token.value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private take<K extends Token["kind"]>(kind: K): Extract<Token, { kind: K }> | undefined {
    const token = this.tokens[this.index];
    if (token?.kind !== kind) return undefined;
    this.index += 1;
    return token as Extract<Token, { kind: K }>;
  }

  private invalid(message: string): never {
    throw new StoreError(400, "invalid_filter", message);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const rest = source.slice(cursor);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      cursor += whitespace[0].length;
      continue;
    }
    const two = source.slice(cursor, cursor + 2);
    if (["&&", "||", "!=", ">=", "<=", "?="].includes(two)) {
      tokens.push({ kind: "operator", value: two });
      cursor += 2;
      continue;
    }
    const char = source[cursor]!;
    if (["=", ">", "<", "~"].includes(char)) {
      tokens.push({ kind: "operator", value: char });
      cursor += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
      cursor += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const parsed = readString(source, cursor, char);
      tokens.push({ kind: "literal", value: parsed.value });
      cursor = parsed.cursor;
      continue;
    }
    const number = /^-?\d+(?:\.\d+)?/.exec(rest);
    if (number) {
      tokens.push({ kind: "literal", value: Number(number[0]) });
      cursor += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(rest);
    if (word) {
      const value = word[0];
      if (value === "true") tokens.push({ kind: "literal", value: true });
      else if (value === "false") tokens.push({ kind: "literal", value: false });
      else if (value === "null") tokens.push({ kind: "literal", value: null });
      else tokens.push({ kind: "identifier", value });
      cursor += value.length;
      continue;
    }
    throw new StoreError(400, "invalid_filter", `Invalid filter character at ${cursor}`);
  }
  return tokens;
}

function readString(
  source: string,
  start: number,
  quote: string,
): { value: string; cursor: number } {
  let value = "";
  let escaped = false;
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor]!;
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) return { value, cursor: cursor + 1 };
    value += char;
  }
  throw new StoreError(400, "invalid_filter", "Unterminated string literal");
}

function resolve(token: Token, record: PocketRecord): unknown {
  return token.kind === "identifier" ? fieldValue(record, token.value) : token.value;
}

function fieldValue(record: PocketRecord, path: string): unknown {
  const parts = path.split(".");
  let value: unknown = record;
  for (const part of parts) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function evaluate(left: unknown, operator: string, right: unknown): boolean {
  if (operator === "=") return scalar(left) === scalar(right);
  if (operator === "!=") return scalar(left) !== scalar(right);
  if (operator === "~") {
    return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
  }
  if (operator === "?=") {
    return Array.isArray(left)
      ? left.some((value) => scalar(value) === scalar(right))
      : scalar(left) === scalar(right);
  }
  const comparison = compare(left, right);
  if (operator === ">") return comparison > 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  return false;
}

function compare(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left).localeCompare(String(right));
}

function scalar(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  throw new StoreError(400, "invalid_filter", "Filter parameters must be scalar values");
}

