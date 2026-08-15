"use client";

/** Minimal RFC 4180 CSV writer + browser download.
 *
 *  Used by the collection "Export" action, which previously rendered a
 *  button labelled "Export report" with no handler behind it. There is
 *  no report-generation service yet, so this exports the thing we
 *  actually have: the rows on screen, as a spreadsheet-ready file. */

/** Quote a single field. Values containing a delimiter, quote, or
 *  newline get wrapped; embedded quotes are doubled. */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeField).join(","),
  );
  // Trailing newline keeps POSIX tools happy; BOM makes Excel read UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Hand the user a file. Uses an object URL rather than a data: URI so
 *  large exports don't blow the URL length limit. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick — revoking synchronously can cancel the
  // download in some Chromium builds.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Turn an arbitrary title into a safe, readable filename stem. */
export function slugifyFilename(value: string, fallback = "export"): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return slug || fallback;
}
