import { createHash } from "node:crypto";
import { Hono, type Context } from "hono";
import { z } from "zod";

import {
  AuthServiceError,
  authenticatePassword,
  beginGoogleOAuth,
  completeGoogleOAuth,
  changeEmail,
  consumeFailedGoogleOAuth,
  exchangeGoogleLogin,
  exchangeExtensionHandoff,
  extractBearerToken,
  findUserIdByEmail,
  issueSession,
  issueExtensionHandoff,
  normalizeEmail,
  registerWithPassword,
  revokeAccessToken,
  revokeAllSessions,
  rotateSession,
  signInWithGoogleIdToken,
} from "../services/auth.js";
import { requireSession, requestIp, requestMetadata } from "../middleware/session-auth.js";
import { writeAuditEvent, writeStructuredLog } from "../services/structured-log.js";

export const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
  name: z.string().trim().min(1).max(200),
  device: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  device: z.string().trim().max(120).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(40).max(512),
  device: z.string().trim().max(120).optional(),
});

const googleIdTokenSchema = z.object({
  idToken: z.string().min(100).max(16_384),
  device: z.string().trim().max(120).optional(),
});

const googleExchangeSchema = z.object({
  code: z.string().min(32).max(512),
  device: z.string().trim().max(120).optional(),
});

const extensionHandoffSchema = z.object({
  redirectUri: z.string().url().max(2_000),
}).strict();

auth.get("/me", requireSession, (c) => {
  return c.json({
    user: c.get("sessionUser"),
    session: c.get("appSession"),
  });
});

auth.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  try {
    const user = await registerWithPassword(parsed.data);
    const tokens = await issueSession(user.id, {
      ...requestMetadata(c),
      device: parsed.data.device,
      clientKind: "web",
    });
    await writeAuditEvent({
      actorUserId: user.id,
      action: "auth.registered",
      entityType: "user",
      entityId: user.id,
      requestId: c.get("requestId"),
      ipAddress: requestIp(c),
      userAgent: c.req.header("user-agent"),
      metadata: { method: "password", sessionId: tokens.sessionId },
    });
    return c.json({ user, ...tokens }, 201);
  } catch (error) {
    return authError(c, error);
  }
});

auth.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  try {
    const user = await authenticatePassword(parsed.data.email, parsed.data.password);
    const tokens = await issueSession(user.id, {
      ...requestMetadata(c),
      device: parsed.data.device,
      clientKind: "web",
    });
    await writeAuditEvent({
      actorUserId: user.id,
      action: "auth.login_succeeded",
      entityType: "session",
      entityId: tokens.sessionId,
      requestId: c.get("requestId"),
      ipAddress: requestIp(c),
      userAgent: c.req.header("user-agent"),
      metadata: { method: "password" },
    });
    return c.json({ user, ...tokens });
  } catch (error) {
    await writeStructuredLog({
      level: "warn",
      event: "auth.login_failed",
      message: "Password login failed",
      requestId: c.get("requestId"),
      errorCode: error instanceof AuthServiceError ? error.code : "login_failed",
      context: {
        // Correlatable for abuse response without persisting the address.
        emailHash: createHash("sha256")
          .update(normalizeEmail(parsed.data.email))
          .digest("hex"),
      },
    });
    return authError(c, error);
  }
});

auth.post("/refresh", async (c) => {
  const parsed = refreshSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_refresh_token" }, 401);
  try {
    const result = await rotateSession(parsed.data.refreshToken, {
      ...requestMetadata(c),
      device: parsed.data.device,
    });
    return c.json({ user: result.user, ...result.tokens });
  } catch (error) {
    return authError(c, error);
  }
});

auth.post("/logout", requireSession, async (c) => {
  const token = extractBearerToken(c.req.header("authorization"));
  if (token) await revokeAccessToken(token);
  const user = c.get("sessionUser");
  const session = c.get("appSession");
  await writeAuditEvent({
    actorUserId: user.id,
    action: "auth.logout",
    entityType: "session",
    entityId: session.id,
    requestId: c.get("requestId"),
    ipAddress: requestIp(c),
    userAgent: c.req.header("user-agent"),
  });
  return c.body(null, 204);
});

auth.post("/logout-all", requireSession, async (c) => {
  const user = c.get("sessionUser");
  const revoked = await revokeAllSessions(user.id);
  await writeAuditEvent({
    actorUserId: user.id,
    action: "auth.logout_all",
    entityType: "user",
    entityId: user.id,
    requestId: c.get("requestId"),
    ipAddress: requestIp(c),
    userAgent: c.req.header("user-agent"),
    metadata: { revokedSessions: revoked },
  });
  return c.json({ revoked });
});

auth.post("/email/change", requireSession, async (c) => {
  const parsed = z.object({ email: z.string().email().max(320) })
    .strict()
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  const current = c.get("sessionUser");
  try {
    const user = await changeEmail(current.id, parsed.data.email);
    await writeAuditEvent({
      actorUserId: current.id,
      action: "auth.email_changed",
      entityType: "user",
      entityId: current.id,
      requestId: c.get("requestId"),
      ipAddress: requestIp(c),
      userAgent: c.req.header("user-agent"),
      before: { email: current.email, emailVerified: current.emailVerified },
      after: { email: user.email, emailVerified: user.emailVerified },
    });
    return c.json({ user });
  } catch (error) {
    return authError(c, error);
  }
});

/** Uniform response prevents email enumeration. Until a mail transport is
 * configured this records the request for operators but never claims account
 * existence on the wire. */
auth.post("/password/reset", async (c) => {
  const parsed = z.object({ email: z.string().email().max(320) })
    .strict()
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 204);
  const email = normalizeEmail(parsed.data.email);
  const userId = await findUserIdByEmail(email);
  const emailHash = createHash("sha256").update(email).digest("hex");
  await writeStructuredLog({
    level: "info",
    event: "auth.password_reset_requested",
    message: "Password reset requested; email delivery is not configured",
    requestId: c.get("requestId"),
    userId,
    context: { emailHash, deliveryConfigured: false },
  });
  if (userId) {
    await writeAuditEvent({
      actorUserId: userId,
      action: "auth.password_reset_requested",
      entityType: "user",
      entityId: userId,
      requestId: c.get("requestId"),
      ipAddress: requestIp(c),
      userAgent: c.req.header("user-agent"),
      metadata: { deliveryConfigured: false },
    });
  }
  return c.body(null, 204);
});

auth.get("/google/start", async (c) => {
  const flow = c.req.query("flow") === "extension" ? "extension" : "web";
  try {
    const url = await beginGoogleOAuth({
      flow,
      finalRedirectUri: c.req.query("redirect_uri"),
    });
    return c.redirect(url, 302);
  } catch (error) {
    return authError(c, error);
  }
});

auth.get("/google/callback", async (c) => {
  const state = c.req.query("state") ?? "";
  const code = c.req.query("code") ?? "";
  const providerError = c.req.query("error");
  if (providerError || !state || !code) {
    const errorCode = providerError || "oauth_cancelled";
    const failedState = state ? await consumeFailedGoogleOAuth(state) : null;
    if (failedState?.clientKind === "extension") {
      const redirect = new URL(failedState.redirectUri);
      redirect.searchParams.set("error", errorCode);
      return c.redirect(redirect.toString(), 302);
    }
    return popupError(c, errorCode);
  }
  try {
    const result = await completeGoogleOAuth({ state, code });
    if (result.clientKind === "extension") {
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("code", result.exchangeCode);
      return c.redirect(redirect.toString(), 302);
    }
    return c.html(popupHtml({ ok: true, code: result.exchangeCode }));
  } catch (error) {
    const codeValue =
      error instanceof AuthServiceError ? error.code : "oauth_callback_failed";
    await writeStructuredLog({
      level: "warn",
      event: "auth.google_callback_failed",
      message: "Google OAuth callback failed",
      requestId: c.get("requestId"),
      errorCode: codeValue,
    });
    return popupError(c, codeValue);
  }
});

auth.post("/google/exchange", async (c) => {
  const parsed = googleExchangeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_exchange_code" }, 401);
  try {
    const result = await exchangeGoogleLogin(parsed.data.code, {
      ...requestMetadata(c),
      device: parsed.data.device,
    });
    await googleLoginAudit(c, result.user.id, result.tokens.sessionId, "oauth_code");
    return c.json({ user: result.user, ...result.tokens });
  } catch (error) {
    return authError(c, error);
  }
});

auth.post("/extension/handoff", requireSession, async (c) => {
  const parsed = extensionHandoffSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_extension_redirect" }, 400);
  try {
    const redirectUrl = await issueExtensionHandoff(
      c.get("sessionUser").id,
      parsed.data.redirectUri,
    );
    return c.json({ redirectUrl });
  } catch (error) {
    return authError(c, error);
  }
});

auth.post("/extension/exchange", async (c) => {
  const parsed = googleExchangeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_exchange_code" }, 401);
  try {
    const result = await exchangeExtensionHandoff(parsed.data.code, {
      ...requestMetadata(c),
      device: parsed.data.device,
      clientKind: "extension",
    });
    await googleLoginAudit(
      c,
      result.user.id,
      result.tokens.sessionId,
      "website_handoff",
      "website",
    );
    return c.json({ user: result.user, ...result.tokens });
  } catch (error) {
    return authError(c, error);
  }
});

/** Extension-safe alternative for chrome.identity.getAuthToken callers. The
 * server validates the signed ID token against Google's JWKS and this app's
 * audience; access-token userinfo is intentionally not accepted. */
auth.post("/google/id-token", async (c) => {
  const parsed = googleIdTokenSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_google_id_token" }, 401);
  }
  try {
    const result = await signInWithGoogleIdToken(parsed.data.idToken, {
      ...requestMetadata(c),
      device: parsed.data.device,
      clientKind: "extension",
    });
    await googleLoginAudit(c, result.user.id, result.tokens.sessionId, "id_token");
    return c.json({ user: result.user, ...result.tokens });
  } catch (error) {
    return authError(c, error);
  }
});

async function googleLoginAudit(
  c: Context,
  userId: string,
  sessionId: string,
  method: string,
  provider = "google",
): Promise<void> {
  await writeAuditEvent({
    actorUserId: userId,
    action: "auth.login_succeeded",
    entityType: "session",
    entityId: sessionId,
    requestId: c.get("requestId"),
    ipAddress: requestIp(c),
    userAgent: c.req.header("user-agent"),
    metadata: { provider, method },
  });
}

async function authError(c: Context, error: unknown): Promise<Response> {
  if (error instanceof AuthServiceError) {
    return c.json({ error: error.code }, error.status as 400 | 401 | 403 | 404 | 409 | 429 | 503);
  }
  await writeStructuredLog({
    level: "error",
    event: "auth.internal_error",
    message: "Authentication route failed",
    requestId: c.get("requestId"),
    errorCode: "internal_error",
    context: { error },
  });
  return c.json({ error: "internal_error" }, 500);
}

function popupError(c: Context, error: string): Response {
  return c.html(popupHtml({ ok: false, error }), 400);
}

function popupHtml(payload: { ok: true; code: string } | { ok: false; error: string }): string {
  const targetOrigin = new URL(
    process.env.FRONTEND_URL ?? "http://localhost:3000",
  ).origin;
  const safePayload = JSON.stringify({
    type: "heynotai:google-oauth",
    ...payload,
  }).replace(/</g, "\\u003c");
  const safeOrigin = JSON.stringify(targetOrigin).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<title>Google sign-in</title></head>
<body><p>Finishing sign-in…</p><script>
if (window.opener) window.opener.postMessage(${safePayload}, ${safeOrigin});
window.close();
</script></body></html>`;
}
