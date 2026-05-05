/* Probe every enabled detection model against a fixture input and
 * write a unified report. Validates that the api's normalization layer
 * (`normalizeHfClassification` + `verdictFromLabels`) handles every
 * label convention HF returns in production.
 *
 * Run:        npm run probe:models
 * Custom img: npm run probe:models -- --image=path/to/photo.jpg
 *
 * Reads the same PB superuser creds + service_secrets.huggingfaceToken
 * the api uses at runtime, so what's tested is exactly what ships.
 *
 * Image fixture:
 *   By default the script looks for `api/scripts/fixtures/sample.jpg`
 *   (a real ~64x64+ RGB JPEG you drop in). Without it, image models
 *   are SKIPPED — the previous inline 1x1 fixture tripped HF
 *   preprocessor configs ("mean must have 1 elements ...") and the
 *   resulting 400s polluted the report without telling us anything
 *   about the unification layer.
 *
 * Output:
 *   - stdout: one row per model (slug · hfModelId · verdict · aiPct · status)
 *   - api/scripts/probe-report.json: full raw + normalized + unified
 *     payload per model, gitignored. Inspect this when adding a new
 *     detector or debugging an unfamiliar label.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { pbAdmin } from "../src/lib/pb-admin.js";
import { detect as detectText } from "../src/detectors/hf-text.js";
import { detect as detectImage } from "../src/detectors/hf-image.js";
import {
  aiPctFromResult,
  normalizeHfClassification,
  verdictFromLabels,
  type DetectorResult,
} from "../src/detectors/types.js";
import { hfInference } from "../src/detectors/hf-client.js";

// LLM-y paragraph: hedged, template-y phrasing detectors should pick up.
const TEXT_FIXTURE = [
  "In today's rapidly evolving digital landscape, it is becoming increasingly important",
  "to leverage cutting-edge technologies in order to remain competitive. Furthermore,",
  "businesses must carefully consider the multifaceted implications of artificial",
  "intelligence and its transformative potential across various industries. As we",
  "delve deeper into this topic, it becomes evident that the adoption of these",
  "tools is not merely a passing trend but rather a fundamental shift. In conclusion,",
  "organizations that embrace this paradigm will undoubtedly reap significant rewards.",
].join(" ");

type DetectionModelRow = {
  id: string;
  slug: string;
  name: string;
  type: "txt" | "img" | "aud" | "vid";
  hfModelId?: string;
  enabled?: boolean;
};

type ModelReport = {
  slug: string;
  name: string;
  type: string;
  hfModelId: string;
  status: "ok" | "error" | "skipped";
  unified?: DetectorResult;
  aiPct?: number;
  rawProviderResponse?: unknown;
  rawShape?: string;
  normalized?: { label: string; score: number }[];
  error?: { status?: number; message: string };
  skipReason?: string;
  durationMs?: number;
};

function parseArgs(): { imagePath?: string } {
  const args: { imagePath?: string } = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--image=")) args.imagePath = a.slice(8);
  }
  return args;
}

async function loadImageFixture(
  fixturesDir: string,
  cliPath?: string,
): Promise<{ bytes: Buffer; mime: string; from: string } | null> {
  const candidates: string[] = [];
  if (cliPath) candidates.push(cliPath);
  candidates.push(join(fixturesDir, "sample.jpg"));
  candidates.push(join(fixturesDir, "sample.png"));
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      const mime = p.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      return { bytes, mime, from: p };
    } catch {}
  }
  return null;
}

async function main() {
  const args = parseArgs();
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(here, "fixtures");

  const admin = await pbAdmin();

  // 1. HF token from PocketBase service_secrets (same source the api uses).
  const secrets = await admin
    .collection("service_secrets")
    .getList(1, 1, { sort: "-created" });
  const hfToken = String(secrets.items[0]?.huggingfaceToken ?? "").trim();
  if (!hfToken) {
    console.error(
      "✗ no HF token in service_secrets — set one in the PB admin UI first",
    );
    process.exit(1);
  }
  console.log(
    `→ probing with HF token ${hfToken.slice(0, 4)}…${hfToken.slice(-4)}`,
  );

  // 2. Enabled non-meta detectors.
  const all = (await admin
    .collection("detection_models")
    .getFullList({
      filter: 'enabled = true',
      sort: "type,slug",
      requestKey: null,
    })) as unknown as DetectionModelRow[];
  const targets = all.filter(
    (m) => m.type === "txt" || m.type === "img" || m.type === "aud",
  );
  console.log(
    `→ ${targets.length} target model(s) (skipped meta-video, disabled, audio if any)`,
  );

  // 3. Image fixture — real on-disk file, or skip image models.
  const imageFixture = await loadImageFixture(fixturesDir, args.imagePath);
  if (imageFixture) {
    console.log(
      `→ image fixture: ${imageFixture.from} (${imageFixture.bytes.byteLength} bytes, ${imageFixture.mime})\n`,
    );
  } else {
    console.log(
      `→ no image fixture found — image models will be SKIPPED.\n` +
        `   Drop a real RGB JPEG at ${join(fixturesDir, "sample.jpg")}\n` +
        `   or pass --image=path/to/photo.jpg to override.\n`,
    );
  }

  // 4. Probe each.
  const reports: ModelReport[] = [];

  for (const m of targets) {
    const hfModelId = m.hfModelId ?? "";
    const base: ModelReport = {
      slug: m.slug,
      name: m.name,
      type: m.type,
      hfModelId,
      status: "ok",
    };

    if (!hfModelId) {
      reports.push({
        ...base,
        status: "error",
        error: { message: "row has no hfModelId" },
      });
      continue;
    }

    try {
      const startedAt = Date.now();
      let raw: unknown;
      let result: DetectorResult;

      if (m.type === "txt") {
        result = await detectText(
          { kind: "txt", text: TEXT_FIXTURE },
          { hfToken, hfModelId },
        );
        raw = result.rawProviderResponse;
      } else if (m.type === "img") {
        if (!imageFixture) {
          reports.push({
            ...base,
            status: "skipped",
            skipReason:
              "no image fixture — drop scripts/fixtures/sample.jpg or pass --image=",
          });
          console.log(
            ` ↷ ${pad(m.slug, 22)} ${pad(m.type, 4)} skipped (no fixture)`,
          );
          continue;
        }
        result = await detectImage(
          { kind: "img", bytes: imageFixture.bytes, mime: imageFixture.mime },
          { hfToken, hfModelId },
        );
        raw = result.rawProviderResponse;
      } else if (m.type === "aud") {
        // Audio detect() expects a wav/mp3 buffer; we don't bundle one.
        // Fire a raw HF call with an empty body so we still capture the
        // model's error envelope (HF free tier rejects audio anyway —
        // the report documents *that* clearly rather than skipping).
        raw = await hfInference({
          modelId: hfModelId,
          hfToken,
          contentType: "audio/wav",
          body: new Uint8Array(0),
        });
        const labels = normalizeHfClassification(raw);
        const v = verdictFromLabels(labels);
        result = {
          verdict: v.verdict,
          confidence: v.confidence,
          model: hfModelId,
          rawProviderResponse: raw,
          durationMs: Date.now() - startedAt,
        };
      } else {
        throw new Error(`unsupported type: ${m.type}`);
      }

      const normalized = normalizeHfClassification(raw);
      const aiPct = aiPctFromResult(result);
      reports.push({
        ...base,
        unified: result,
        aiPct,
        rawProviderResponse: raw,
        rawShape: describeShape(raw),
        normalized,
        durationMs: result.durationMs || Date.now() - startedAt,
      });
      console.log(
        ` ✓ ${pad(m.slug, 22)} ${pad(m.type, 4)} ${pad(result.verdict, 6)} aiPct=${pad(String(aiPct), 3)} conf=${pad(String(result.confidence), 3)} (${result.durationMs || Date.now() - startedAt}ms)`,
      );
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: unknown }).status)
          : undefined;
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      reports.push({
        ...base,
        status: "error",
        error: { status, message },
      });
      console.log(
        ` ✗ ${pad(m.slug, 22)} ${pad(m.type, 4)} ERROR ${status ?? ""} ${truncate(message, 80)}`,
      );
    }
  }

  // 5. Write JSON report.
  const reportPath = join(here, "probe-report.json");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        textFixture: TEXT_FIXTURE,
        imageFixture: imageFixture
          ? { from: imageFixture.from, bytes: imageFixture.bytes.byteLength, mime: imageFixture.mime }
          : null,
        reports,
      },
      null,
      2,
    ),
  );
  console.log(`\n→ report written to ${reportPath}`);

  // 5. Surface anything suspicious.
  const suspicious = reports.filter(
    (r) =>
      r.status === "ok" &&
      r.unified &&
      r.unified.verdict === "human" &&
      r.unified.confidence === 0,
  );
  if (suspicious.length > 0) {
    console.warn(
      `\n⚠ ${suspicious.length} model(s) returned verdict=human + confidence=0 — likely an unrecognized label:`,
    );
    for (const s of suspicious) {
      console.warn(
        `   - ${s.slug} (${s.hfModelId}): labels=${JSON.stringify(s.normalized)}`,
      );
    }
    console.warn(
      "   Update isAiLabel/isHumanLabel in api/src/detectors/types.ts.",
    );
  }
}

function describeShape(raw: unknown): string {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "array(empty)";
    if (Array.isArray(raw[0])) return `nested[${raw.length}][${(raw[0] as unknown[]).length}]`;
    return `flat[${raw.length}]`;
  }
  if (raw === null) return "null";
  return typeof raw;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
