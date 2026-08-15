import { closeDatabase, sql } from "../src/db/client.js";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const email = `integration-${Date.now()}@example.test`;
let userId = "";

type Json = Record<string, unknown>;

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${api}${path}`, init);
}

async function json(response: Response): Promise<Json> {
  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

try {
  const registered = await json(await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Integration-test-password-42", name: "Integration Test" }),
  }));
  const user = registered.user as Json;
  userId = String(user.id);
  const webToken = String(registered.accessToken);

  const redirectUri =
    "https://blffhfijmlabjphlccpmdhjkninakchg.chromiumapp.org/website-auth";
  const handoff = await json(await request("/auth/extension/handoff", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${webToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ redirectUri }),
  }));
  const redirect = new URL(String(handoff.redirectUrl));
  if (redirect.origin !== new URL(redirectUri).origin) throw new Error("redirect origin mismatch");
  const code = redirect.searchParams.get("code");
  if (!code) throw new Error("handoff omitted exchange code");

  const exchanged = await json(await request("/auth/extension/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }));
  const extensionToken = String(exchanged.accessToken);

  const replay = await request("/auth/extension/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (replay.status !== 401) throw new Error(`exchange replay returned ${replay.status}`);

  const created = await json(await request("/data/extension_prefs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${webToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, mode: "compact", scanMode: "manual", sites: [] }),
  }));
  const prefsId = String(created.id);
  await json(await request(`/data/extension_prefs/${encodeURIComponent(prefsId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${extensionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scanMode: "allowlist", sites: [{ host: "example.com", enabled: true }] }),
  }));
  const fromWebsite = await json(await request(`/data/extension_prefs/${encodeURIComponent(prefsId)}`, {
    headers: { Authorization: `Bearer ${webToken}` },
  }));
  if (fromWebsite.scanMode !== "allowlist") throw new Error("website did not observe extension update");

  console.log("auth handoff: ok");
  console.log("single-use exchange: ok");
  console.log("cross-client preference visibility: ok");
} finally {
  if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
  await closeDatabase();
}
