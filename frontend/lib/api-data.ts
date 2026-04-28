/* ─────────────────────────────────────────────
   Mock data for /app/api — API keys, webhooks,
   request log, sample code snippets, and the
   webhook event reference list.

   Lives alongside library-data, monitors-data,
   team-data, etc. so the page reads as a server
   component and swaps to a real fetch later
   without component edits.
   ───────────────────────────────────────────── */

export type KeyScope = "full" | "write" | "read";

export type ApiKey = {
  id: string;
  name: string;
  /** italic suffix shown after the name */
  nameSuffix?: string;
  meta: string;
  /** masked value as shown by default */
  masked: string;
  scope: KeyScope;
  callsThisMonth: number;
  /** 0–100 — how full the per-key bar is */
  usagePercent: number;
  /** "warn" tints the bar amber; "danger" tints it strike-red */
  usageTone?: "warn" | "danger";
  lastUsedHeadline: string;
  lastUsedSub: string;
};

export type WebhookStatus = "healthy" | "error" | "paused";

export type WebhookStat = {
  label: string;
  value: string;
  /** small tone for the unit suffix — e.g. "% ok" or "% warn" */
  unitTone?: "ok" | "warn";
  unit?: string;
  sub: string;
};

export type Webhook = {
  id: string;
  name: string;
  nameSuffix?: string;
  url: string;
  status: WebhookStatus;
  /** label shown inside the status pill */
  statusLabel: string;
  events: string[];
  stats?: WebhookStat[];
};

export type RequestMethod = "GET" | "POST" | "DEL";
export type RequestStatusTone = "ok" | "err";

export type RequestRow = {
  id: string;
  method: RequestMethod;
  status: number;
  statusTone: RequestStatusTone;
  path: string;
  latency: string;
  tokens: string;
  key: string;
  when: string;
};

/** A single highlighted token in the code snippet. */
export type CodeSpan =
  | string
  | {
      /**
       * k = keyword, s = string, n = number, c = comment, t = tag/key,
       * m = muted/punctuation
       */
      kind: "k" | "s" | "n" | "c" | "t" | "m";
      text: string;
    };

export type CodeSample = {
  id: "curl" | "node" | "python" | "go";
  label: string;
  /** flat list of spans — newlines are inline `\n` characters */
  spans: CodeSpan[];
  /** plain-text version used by the copy button */
  plain: string;
};

export type WebhookEvent = {
  group: string;
  name: string;
  desc: string;
};

export type UsageBar = { height: number; peak?: boolean };

/* ── API keys ──────────────────────────────── */
export const API_KEYS: ApiKey[] = [
  {
    id: "k1",
    name: "Production server",
    meta: "created Aug 14, 2025 · main backend",
    masked: "sk_live_••••••••••••••••••8a2f",
    scope: "full",
    callsThisMonth: 9402,
    usagePercent: 73,
    lastUsedHeadline: "2m ago",
    lastUsedSub: "Apr 24 · 09:12",
  },
  {
    id: "k2",
    name: "Staging environment",
    meta: "created Jan 6, 2026 · pre-prod tests",
    masked: "sk_live_••••••••••••••••••3c91",
    scope: "write",
    callsThisMonth: 2108,
    usagePercent: 38,
    lastUsedHeadline: "1h ago",
    lastUsedSub: "Apr 24 · 08:24",
  },
  {
    id: "k3",
    name: "Daniel's local",
    nameSuffix: "dev",
    meta: "created Mar 11, 2026 · daniel@maple.news",
    masked: "sk_live_••••••••••••••••••f7d4",
    scope: "read",
    callsThisMonth: 1337,
    usagePercent: 24,
    usageTone: "warn",
    lastUsedHeadline: "Yesterday",
    lastUsedSub: "Apr 23 · 17:08",
  },
  {
    id: "k4",
    name: "Zapier integration",
    meta: "created Feb 2, 2026 · third-party",
    masked: "sk_live_••••••••••••••••••2b6e",
    scope: "write",
    callsThisMonth: 0,
    usagePercent: 1,
    usageTone: "danger",
    lastUsedHeadline: "3 weeks ago",
    lastUsedSub: "Apr 4 · 11:42",
  },
];

/* ── Webhooks ──────────────────────────────── */
export const WEBHOOKS: Webhook[] = [
  {
    id: "w1",
    name: "Slack alerts",
    nameSuffix: "#verification-alerts",
    url: "https://hooks.slack.com/services/T0••••/B0••••/x9j2k4...",
    status: "healthy",
    statusLabel: "HEALTHY",
    events: ["scan.completed", "scan.flagged", "monitor.alert"],
    stats: [
      { label: "Deliveries · 7d", value: "847", sub: "~121 / day" },
      {
        label: "Success rate",
        value: "99.8",
        unit: "%",
        unitTone: "ok",
        sub: "2 retries needed",
      },
      { label: "Avg latency", value: "214", unit: "ms", sub: "p50 · slack" },
      { label: "Last delivery", value: "12m ago", sub: "200 OK" },
    ],
  },
  {
    id: "w2",
    name: "Editorial dashboard",
    nameSuffix: "internal CMS",
    url: "https://cms.maple.news/api/detect-webhook",
    status: "error",
    statusLabel: "4 FAILURES",
    events: ["scan.flagged", "report.shared"],
    stats: [
      { label: "Deliveries · 7d", value: "412", sub: "~59 / day" },
      {
        label: "Success rate",
        value: "94.2",
        unit: "%",
        unitTone: "warn",
        sub: "24 retries",
      },
      { label: "Last error", value: "503", sub: "timeout · 28m ago" },
      { label: "Last delivery", value: "8m ago", sub: "200 OK · recovered" },
    ],
  },
  {
    id: "w3",
    name: "Discord — research lab",
    url: "https://discord.com/api/webhooks/14•••/Y3jK4...",
    status: "paused",
    statusLabel: "PAUSED",
    events: ["monitor.alert", "collection.updated"],
  },
];

/* ── Recent requests log ───────────────────── */
export const REQUESTS: RequestRow[] = [
  {
    id: "r1",
    method: "POST",
    status: 200,
    statusTone: "ok",
    path: "/v1/scan",
    latency: "142ms",
    tokens: "2 tk",
    key: "prod ··8a2f",
    when: "2m",
  },
  {
    id: "r2",
    method: "POST",
    status: 200,
    statusTone: "ok",
    path: "/v1/scan",
    latency: "128ms",
    tokens: "3 tk",
    key: "prod ··8a2f",
    when: "2m",
  },
  {
    id: "r3",
    method: "GET",
    status: 200,
    statusTone: "ok",
    path: "/v1/library?limit=20",
    latency: "38ms",
    tokens: "0 tk",
    key: "stage ··3c91",
    when: "5m",
  },
  {
    id: "r4",
    method: "POST",
    status: 429,
    statusTone: "err",
    path: "/v1/scan/batch",
    latency: "12ms",
    tokens: "0 tk",
    key: "prod ··8a2f",
    when: "8m",
  },
  {
    id: "r5",
    method: "POST",
    status: 200,
    statusTone: "ok",
    path: "/v1/scan/batch",
    latency: "624ms",
    tokens: "42 tk",
    key: "prod ··8a2f",
    when: "9m",
  },
  {
    id: "r6",
    method: "GET",
    status: 200,
    statusTone: "ok",
    path: "/v1/scan/scan_2k4j9...",
    latency: "28ms",
    tokens: "0 tk",
    key: "dev ··f7d4",
    when: "14m",
  },
  {
    id: "r7",
    method: "DEL",
    status: 204,
    statusTone: "ok",
    path: "/v1/library/scan_98aa1...",
    latency: "52ms",
    tokens: "0 tk",
    key: "dev ··f7d4",
    when: "22m",
  },
  {
    id: "r8",
    method: "POST",
    status: 401,
    statusTone: "err",
    path: "/v1/scan",
    latency: "8ms",
    tokens: "0 tk",
    key: "··revoked",
    when: "1h",
  },
  {
    id: "r9",
    method: "POST",
    status: 200,
    statusTone: "ok",
    path: "/v1/scan",
    latency: "156ms",
    tokens: "2 tk",
    key: "prod ··8a2f",
    when: "1h",
  },
];

/* ── Webhook event reference (right rail) ──── */
export const WEBHOOK_EVENTS: WebhookEvent[] = [
  { group: "scan", name: "completed", desc: "Any scan finishes" },
  { group: "scan", name: "flagged", desc: "Verdict is AI ≥ threshold" },
  { group: "scan", name: "failed", desc: "Engine returned error" },
  { group: "monitor", name: "alert", desc: "Monitor flagged content" },
  { group: "monitor", name: "created", desc: "New monitor configured" },
  { group: "collection", name: "updated", desc: "Items added or removed" },
  { group: "report", name: "shared", desc: "Report published" },
  { group: "report", name: "viewed", desc: "Public report opened" },
  { group: "tokens", name: "low", desc: "≤ 10% balance left" },
  { group: "tokens", name: "depleted", desc: "Balance hit 0" },
];

/* ── Usage sparkline (14 days) ─────────────── */
export const USAGE_BARS: UsageBar[] = [
  { height: 35 },
  { height: 42 },
  { height: 28 },
  { height: 55 },
  { height: 48 },
  { height: 62 },
  { height: 88, peak: true },
  { height: 68 },
  { height: 58 },
  { height: 72 },
  { height: 64 },
  { height: 80 },
  { height: 74 },
  { height: 90 },
];

/* ── Code snippets ─────────────────────────── */
const CURL_PLAIN = `# Scan a single piece of text
curl -X POST https://api.detect.app/v1/scan \\
  -H "Authorization: Bearer sk_live_•••••8a2f" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "text",
    "engine": "atlas-pro",
    "content": "The transformative power of coastal living..."
  }'

# Response — under 300ms
{
  "id": "scan_2k4j9...",
  "verdict": "ai_generated",
  "confidence": 0.89,
  "closest_model": "gpt-5",
  "tokens_used": 2
}`;

const NODE_PLAIN = `// npm i @heynotai/detect
import Detect from "@heynotai/detect";

const detect = new Detect({ apiKey: process.env.DETECT_KEY });

const result = await detect.scan({
  type: "text",
  engine: "atlas-pro",
  content: "The transformative power of coastal living...",
});

console.log(result.verdict, result.confidence);
// → "ai_generated" 0.89`;

const PYTHON_PLAIN = `# pip install heynotai-detect
from heynotai import Detect

detect = Detect(api_key=os.environ["DETECT_KEY"])

result = detect.scan(
    type="text",
    engine="atlas-pro",
    content="The transformative power of coastal living...",
)

print(result.verdict, result.confidence)
# → "ai_generated" 0.89`;

const GO_PLAIN = `// go get github.com/heynotai/detect-go
import "github.com/heynotai/detect-go"

client := detect.New(os.Getenv("DETECT_KEY"))

result, err := client.Scan(ctx, &detect.ScanRequest{
    Type:    "text",
    Engine:  "atlas-pro",
    Content: "The transformative power of coastal living...",
})

fmt.Println(result.Verdict, result.Confidence)
// → "ai_generated" 0.89`;

export const CODE_SAMPLES: CodeSample[] = [
  {
    id: "curl",
    label: "curl",
    plain: CURL_PLAIN,
    spans: [
      { kind: "c", text: "# Scan a single piece of text" },
      "\n",
      { kind: "k", text: "curl" },
      " ",
      { kind: "m", text: "-X" },
      " POST https://api.detect.app/v1",
      { kind: "t", text: "/scan" },
      " \\\n  ",
      { kind: "m", text: "-H" },
      " ",
      { kind: "s", text: '"Authorization: Bearer sk_live_•••••8a2f"' },
      " \\\n  ",
      { kind: "m", text: "-H" },
      " ",
      { kind: "s", text: '"Content-Type: application/json"' },
      " \\\n  ",
      { kind: "m", text: "-d" },
      " ",
      {
        kind: "s",
        text: `'{
    "type": "text",
    "engine": "atlas-pro",
    "content": "The transformative power of coastal living..."
  }'`,
      },
      "\n\n",
      { kind: "c", text: "# Response — under 300ms" },
      "\n{\n  ",
      { kind: "t", text: '"id"' },
      ": ",
      { kind: "s", text: '"scan_2k4j9..."' },
      ",\n  ",
      { kind: "t", text: '"verdict"' },
      ": ",
      { kind: "s", text: '"ai_generated"' },
      ",\n  ",
      { kind: "t", text: '"confidence"' },
      ": ",
      { kind: "n", text: "0.89" },
      ",\n  ",
      { kind: "t", text: '"closest_model"' },
      ": ",
      { kind: "s", text: '"gpt-5"' },
      ",\n  ",
      { kind: "t", text: '"tokens_used"' },
      ": ",
      { kind: "n", text: "2" },
      "\n}",
    ],
  },
  {
    id: "node",
    label: "node.js",
    plain: NODE_PLAIN,
    spans: [
      { kind: "c", text: "// npm i @heynotai/detect" },
      "\n",
      { kind: "k", text: "import" },
      " Detect ",
      { kind: "k", text: "from" },
      " ",
      { kind: "s", text: '"@heynotai/detect"' },
      ";\n\n",
      { kind: "k", text: "const" },
      " detect = ",
      { kind: "k", text: "new" },
      " Detect({ apiKey: process.env.DETECT_KEY });\n\n",
      { kind: "k", text: "const" },
      " result = ",
      { kind: "k", text: "await" },
      " detect.",
      { kind: "t", text: "scan" },
      "({\n  type: ",
      { kind: "s", text: '"text"' },
      ",\n  engine: ",
      { kind: "s", text: '"atlas-pro"' },
      ",\n  content: ",
      { kind: "s", text: '"The transformative power of coastal living..."' },
      ",\n});\n\nconsole.",
      { kind: "t", text: "log" },
      "(result.verdict, result.confidence);\n",
      { kind: "c", text: '// → "ai_generated" 0.89' },
    ],
  },
  {
    id: "python",
    label: "python",
    plain: PYTHON_PLAIN,
    spans: [
      { kind: "c", text: "# pip install heynotai-detect" },
      "\n",
      { kind: "k", text: "from" },
      " heynotai ",
      { kind: "k", text: "import" },
      " Detect\n\ndetect = Detect(api_key=os.environ[",
      { kind: "s", text: '"DETECT_KEY"' },
      "])\n\nresult = detect.",
      { kind: "t", text: "scan" },
      "(\n    type=",
      { kind: "s", text: '"text"' },
      ",\n    engine=",
      { kind: "s", text: '"atlas-pro"' },
      ",\n    content=",
      { kind: "s", text: '"The transformative power of coastal living..."' },
      ",\n)\n\n",
      { kind: "k", text: "print" },
      "(result.verdict, result.confidence)\n",
      { kind: "c", text: '# → "ai_generated" 0.89' },
    ],
  },
  {
    id: "go",
    label: "go",
    plain: GO_PLAIN,
    spans: [
      { kind: "c", text: "// go get github.com/heynotai/detect-go" },
      "\n",
      { kind: "k", text: "import" },
      " ",
      { kind: "s", text: '"github.com/heynotai/detect-go"' },
      "\n\nclient := detect.",
      { kind: "t", text: "New" },
      "(os.Getenv(",
      { kind: "s", text: '"DETECT_KEY"' },
      "))\n\nresult, err := client.",
      { kind: "t", text: "Scan" },
      "(ctx, &detect.ScanRequest{\n    Type:    ",
      { kind: "s", text: '"text"' },
      ",\n    Engine:  ",
      { kind: "s", text: '"atlas-pro"' },
      ",\n    Content: ",
      { kind: "s", text: '"The transformative power of coastal living..."' },
      ",\n})\n\nfmt.",
      { kind: "t", text: "Println" },
      "(result.Verdict, result.Confidence)\n",
      { kind: "c", text: '// → "ai_generated" 0.89' },
    ],
  },
];

/* ── Header counters ───────────────────────── */
export const USAGE_SUMMARY = {
  used: 12_847,
  quota: 50_000,
  avgPerDay: 428,
  peakValue: 1204,
  peakLabel: "Apr 17",
  rangeStart: "Apr 11",
  rangeEnd: "TODAY",
  p50: "142ms",
};
