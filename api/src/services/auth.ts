import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { sql } from "../db/client.js";
import { createRecordId } from "../db/id.js";

const ACCESS_TTL_MS = numberFromEnv("AUTH_ACCESS_TTL_SECONDS", 60 * 60) * 1_000;
const REFRESH_TTL_MS =
  numberFromEnv("AUTH_REFRESH_TTL_SECONDS", 30 * 24 * 60 * 60) * 1_000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1_000;
const OAUTH_EXCHANGE_TTL_MS = 60 * 1_000;

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type ClientKind = "web" | "extension" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  verified: boolean;
  name: string;
  handle: string;
  avatar: string;
  avatarUrl: string;
  timezone: string;
  language: string;
  plan: "check" | "verify" | "certify" | "team";
  planCycle: "monthly" | "yearly" | null;
  planBadge: string;
  planRenewsOn: string | null;
  stripeSubscriptionId: string;
  pendingPlan: AuthUser["plan"] | null;
  pendingPlanCycle: AuthUser["planCycle"];
  pendingPlanEffective: string | null;
  mfaEnabled: boolean;
  mfa: boolean;
  status: string;
  systemRole: "user" | "support" | "admin" | "owner";
  onboardingCompleted: boolean;
  customMonthlyLimit: number | null;
  created: string;
  updated: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
  refreshExpiresAt: string | null;
  lastSeenAt: string;
  device: string;
};

export type AuthContext = {
  user: AuthUser;
  session: AuthSession;
  isAdmin: boolean;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
  sessionId: string;
};

export type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  clientKind?: ClientKind;
};

export class AuthServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

type UserRow = {
  id: string;
  email: string;
  email_verified: boolean;
  password_hash: string | null;
  google_subject: string | null;
  name: string;
  handle: string;
  avatar_file_id: string | null;
  avatar_url: string;
  timezone: string;
  language: string;
  plan: AuthUser["plan"];
  plan_cycle: AuthUser["planCycle"];
  plan_badge: string;
  plan_renews_on: Date | string | null;
  stripe_subscription_id: string;
  pending_plan: AuthUser["plan"] | null;
  pending_plan_cycle: AuthUser["planCycle"];
  pending_plan_effective: Date | string | null;
  mfa_enabled: boolean;
  status: string;
  system_role: AuthUser["systemRole"];
  onboarding_completed: boolean;
  custom_monthly_limit: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SessionJoinRow = UserRow & {
  session_id: string;
  session_user_id: string;
  expires_at: Date | string;
  refresh_expires_at: Date | string | null;
  last_seen_at: Date | string;
  device: string;
};

type OAuthStateRow = {
  id: string;
  redirect_uri: string;
  client_kind: ClientKind;
  code_verifier: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(passwordWithPepper(password), salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, n, r, p, saltEncoded, hashEncoded, extra] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    extra !== undefined ||
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P ||
    !saltEncoded ||
    !hashEncoded
  ) {
    return false;
  }
  try {
    const salt = Buffer.from(saltEncoded, "base64url");
    const expected = Buffer.from(hashEncoded, "base64url");
    if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await scrypt(passwordWithPepper(password), salt);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const systemRole = isConfiguredAdminEmail(email) ? "admin" : "user";
  try {
    const rows = await sql<UserRow[]>`
      INSERT INTO users (
        id, email, email_verified, password_hash, name, language, plan,
        status, system_role
      ) VALUES (
        ${createRecordId()}, ${email}, false, ${passwordHash},
        ${input.name.trim()}, 'en', 'check', 'active', ${systemRole}
      )
      RETURNING ${sql.unsafe(USER_COLUMNS)}
    `;
    const row = rows[0];
    if (!row) throw new Error("insert returned no user");
    return mapUser(row);
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new AuthServiceError(409, "email_already_registered");
    }
    throw error;
  }
}

export async function authenticatePassword(
  emailInput: string,
  password: string,
): Promise<AuthUser> {
  const email = normalizeEmail(emailInput);
  const rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(USER_COLUMNS)}
    FROM users
    WHERE email = ${email} AND deleted_at IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  // Perform a real scrypt even for an unknown email to reduce account
  // enumeration through timing. The result is deliberately discarded.
  const valid = row
    ? await verifyPassword(password, row.password_hash)
    : await verifyPassword(password, DUMMY_PASSWORD_HASH);
  if (!row || !valid) {
    throw new AuthServiceError(401, "invalid_credentials");
  }
  assertUserCanSignIn(row);
  return mapUser(row);
}

export async function issueSession(
  userId: string,
  metadata: SessionMetadata = {},
): Promise<SessionTokens> {
  const accessToken = `hnta_${randomBytes(32).toString("base64url")}`;
  const refreshToken = `hntr_${randomBytes(40).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const sessionId = createRecordId();
  await sql`
    INSERT INTO sessions (
      id, user_id, token_hash, refresh_token_hash, expires_at,
      refresh_expires_at, ip_address, user_agent, device, metadata
    ) VALUES (
      ${sessionId}, ${userId}, ${hashOpaqueToken(accessToken)},
      ${hashOpaqueToken(refreshToken)}, ${expiresAt}, ${refreshExpiresAt},
      ${cleanIp(metadata.ipAddress)}, ${truncate(metadata.userAgent, 512)},
      ${truncate(metadata.device, 120) ?? ""},
      ${sql.json({ clientKind: metadata.clientKind ?? "web" })}
    )
  `;
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    sessionId,
  };
}

export async function authenticateAccessToken(
  token: string,
  metadata: Pick<SessionMetadata, "ipAddress" | "userAgent"> = {},
): Promise<AuthContext | null> {
  if (!isPlausibleToken(token, "hnta_")) return null;
  const rows = await sql<SessionJoinRow[]>`
    SELECT
      ${sql.unsafe(USER_COLUMNS_WITH_PREFIX)},
      s.id AS session_id,
      s.user_id AS session_user_id,
      s.expires_at,
      s.refresh_expires_at,
      s.last_seen_at,
      s.device
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashOpaqueToken(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.deleted_at IS NULL
      AND u.status = 'active'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  // Avoid a write on every polling request while still keeping session state
  // operationally useful.
  await sql`
    UPDATE sessions
    SET last_seen_at = now(),
        ip_address = COALESCE(${cleanIp(metadata.ipAddress)}, ip_address),
        user_agent = COALESCE(${truncate(metadata.userAgent, 512)}, user_agent),
        updated_at = now()
    WHERE id = ${row.session_id}
      AND last_seen_at < now() - interval '60 seconds'
  `;

  const user = mapUser(row);
  return {
    user,
    session: {
      id: row.session_id,
      userId: row.session_user_id,
      expiresAt: iso(row.expires_at),
      refreshExpiresAt: row.refresh_expires_at ? iso(row.refresh_expires_at) : null,
      lastSeenAt: iso(row.last_seen_at),
      device: row.device,
    },
    isAdmin: isAdminUser(user),
  };
}

export async function rotateSession(
  refreshToken: string,
  metadata: SessionMetadata = {},
): Promise<{ tokens: SessionTokens; user: AuthUser }> {
  if (!isPlausibleToken(refreshToken, "hntr_")) {
    throw new AuthServiceError(401, "invalid_refresh_token");
  }
  const newAccess = `hnta_${randomBytes(32).toString("base64url")}`;
  const newRefresh = `hntr_${randomBytes(40).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const rows = await sql<SessionJoinRow[]>`
    UPDATE sessions s
    SET token_hash = ${hashOpaqueToken(newAccess)},
        refresh_token_hash = ${hashOpaqueToken(newRefresh)},
        expires_at = ${expiresAt},
        refresh_expires_at = ${refreshExpiresAt},
        last_seen_at = now(),
        ip_address = COALESCE(${cleanIp(metadata.ipAddress)}, s.ip_address),
        user_agent = COALESCE(${truncate(metadata.userAgent, 512)}, s.user_agent),
        device = COALESCE(${truncate(metadata.device, 120)}, NULLIF(s.device, ''), ''),
        updated_at = now()
    FROM users u
    WHERE s.refresh_token_hash = ${hashOpaqueToken(refreshToken)}
      AND s.user_id = u.id
      AND s.revoked_at IS NULL
      AND s.refresh_expires_at > now()
      AND u.deleted_at IS NULL
      AND u.status = 'active'
    RETURNING
      ${sql.unsafe(USER_COLUMNS_WITH_PREFIX)},
      s.id AS session_id,
      s.user_id AS session_user_id,
      s.expires_at,
      s.refresh_expires_at,
      s.last_seen_at,
      s.device
  `;
  const row = rows[0];
  if (!row) throw new AuthServiceError(401, "invalid_refresh_token");
  return {
    tokens: {
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresAt: expiresAt.toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      sessionId: row.session_id,
    },
    user: mapUser(row),
  };
}

export async function revokeAccessToken(token: string): Promise<void> {
  if (!isPlausibleToken(token, "hnta_")) return;
  await sql`
    UPDATE sessions
    SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
    WHERE token_hash = ${hashOpaqueToken(token)}
  `;
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    UPDATE sessions
    SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
    WHERE user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(USER_COLUMNS)}
    FROM users
    WHERE id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function changeEmail(userId: string, emailInput: string): Promise<AuthUser> {
  const email = normalizeEmail(emailInput);
  try {
    const rows = await sql<UserRow[]>`
      UPDATE users
      SET email = ${email}, email_verified = false, updated_at = now()
      WHERE id = ${userId} AND deleted_at IS NULL AND status = 'active'
      RETURNING ${sql.unsafe(USER_COLUMNS)}
    `;
    if (!rows[0]) throw new AuthServiceError(404, "user_not_found");
    return mapUser(rows[0]);
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new AuthServiceError(409, "email_already_registered");
    }
    throw error;
  }
}

export async function findUserIdByEmail(emailInput: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM users
    WHERE email = ${normalizeEmail(emailInput)} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export function extractBearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  if (!match?.[1] || match[1].length > 512) return null;
  return match[1];
}

export function isAdminUser(user: Pick<AuthUser, "email" | "systemRole">): boolean {
  return (
    user.systemRole === "admin" ||
    user.systemRole === "owner" ||
    isConfiguredAdminEmail(user.email)
  );
}

export async function beginGoogleOAuth(input: {
  flow: "web" | "extension";
  finalRedirectUri?: string;
}): Promise<string> {
  const config = googleConfig();
  const finalRedirect =
    input.flow === "extension"
      ? validateExtensionRedirect(input.finalRedirectUri)
      : config.frontendUrl;
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  await sql`
    INSERT INTO oauth_states (
      id, provider, state_hash, code_verifier, redirect_uri, client_kind,
      expires_at, metadata
    ) VALUES (
      ${createRecordId()}, 'google', ${hashOpaqueToken(state)}, ${verifier},
      ${finalRedirect}, ${input.flow}, ${new Date(Date.now() + OAUTH_STATE_TTL_MS)},
      ${sql.json({ nonce })}
    )
  `;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function completeGoogleOAuth(input: {
  state: string;
  code: string;
}): Promise<{ exchangeCode: string; clientKind: ClientKind; redirectUri: string }> {
  const stateRows = await sql<OAuthStateRow[]>`
    UPDATE oauth_states
    SET consumed_at = now()
    WHERE provider = 'google'
      AND state_hash = ${hashOpaqueToken(input.state)}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING id, redirect_uri, client_kind, code_verifier, user_id, metadata
  `;
  const oauthState = stateRows[0];
  if (!oauthState) throw new AuthServiceError(400, "invalid_oauth_state");
  const nonce = stringProperty(oauthState.metadata, "nonce");
  if (!nonce) throw new AuthServiceError(400, "invalid_oauth_state");

  const config = googleConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
      code_verifier: oauthState.code_verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const tokenBody = (await tokenResponse.json().catch(() => null)) as
    | { id_token?: unknown; error?: unknown }
    | null;
  if (!tokenResponse.ok || typeof tokenBody?.id_token !== "string") {
    throw new AuthServiceError(401, "google_token_exchange_failed");
  }

  const identity = await verifyGoogleIdToken(tokenBody.id_token, nonce);
  const user = await findOrCreateGoogleUser(identity);
  const exchangeCode = randomBytes(32).toString("base64url");
  await sql`
    INSERT INTO oauth_states (
      id, provider, state_hash, exchange_code_hash, code_verifier,
      redirect_uri, client_kind, user_id, expires_at, metadata
    ) VALUES (
      ${createRecordId()}, 'google_exchange',
      ${hashOpaqueToken(randomBytes(32).toString("base64url"))},
      ${hashOpaqueToken(exchangeCode)}, '', ${oauthState.redirect_uri},
      ${oauthState.client_kind}, ${user.id},
      ${new Date(Date.now() + OAUTH_EXCHANGE_TTL_MS)}, ${sql.json({})}
    )
  `;
  return {
    exchangeCode,
    clientKind: oauthState.client_kind,
    redirectUri: oauthState.redirect_uri,
  };
}

export async function consumeFailedGoogleOAuth(state: string): Promise<{
  clientKind: ClientKind;
  redirectUri: string;
} | null> {
  if (!state) return null;
  const rows = await sql<Pick<OAuthStateRow, "client_kind" | "redirect_uri">[]>`
    UPDATE oauth_states
    SET consumed_at = now()
    WHERE provider = 'google'
      AND state_hash = ${hashOpaqueToken(state)}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING client_kind, redirect_uri
  `;
  return rows[0]
    ? { clientKind: rows[0].client_kind, redirectUri: rows[0].redirect_uri }
    : null;
}

export async function exchangeGoogleLogin(
  code: string,
  metadata: SessionMetadata = {},
): Promise<{ tokens: SessionTokens; user: AuthUser }> {
  const rows = await sql<{ user_id: string; client_kind: ClientKind }[]>`
    UPDATE oauth_states
    SET consumed_at = now()
    WHERE provider = 'google_exchange'
      AND exchange_code_hash = ${hashOpaqueToken(code)}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING user_id, client_kind
  `;
  const row = rows[0];
  if (!row?.user_id) throw new AuthServiceError(401, "invalid_exchange_code");
  const user = await getUserById(row.user_id);
  if (!user || user.status !== "active") {
    throw new AuthServiceError(403, "account_unavailable");
  }
  const tokens = await issueSession(user.id, {
    ...metadata,
    clientKind: row.client_kind,
  });
  return { tokens, user };
}

/** Mint a short-lived, single-use code that lets an already authenticated
 * website session create a separate extension session. The web bearer token
 * never crosses into extension storage. */
export async function issueExtensionHandoff(
  userId: string,
  finalRedirectUri: string | undefined,
): Promise<string> {
  const redirectUri = validateExtensionRedirect(finalRedirectUri);
  const exchangeCode = randomBytes(32).toString("base64url");
  await sql`
    INSERT INTO oauth_states (
      id, provider, state_hash, exchange_code_hash, code_verifier,
      redirect_uri, client_kind, user_id, expires_at, metadata
    ) VALUES (
      ${createRecordId()}, 'extension_handoff',
      ${hashOpaqueToken(randomBytes(32).toString("base64url"))},
      ${hashOpaqueToken(exchangeCode)}, '', ${redirectUri}, 'extension',
      ${userId}, ${new Date(Date.now() + OAUTH_EXCHANGE_TTL_MS)}, ${sql.json({})}
    )
  `;
  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", exchangeCode);
  return redirect.toString();
}

export async function exchangeExtensionHandoff(
  code: string,
  metadata: SessionMetadata = {},
): Promise<{ tokens: SessionTokens; user: AuthUser }> {
  const rows = await sql<{ user_id: string }[]>`
    UPDATE oauth_states
    SET consumed_at = now()
    WHERE provider = 'extension_handoff'
      AND exchange_code_hash = ${hashOpaqueToken(code)}
      AND client_kind = 'extension'
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING user_id
  `;
  const userId = rows[0]?.user_id;
  if (!userId) throw new AuthServiceError(401, "invalid_exchange_code");
  const user = await getUserById(userId);
  if (!user || user.status !== "active") {
    throw new AuthServiceError(403, "account_unavailable");
  }
  const tokens = await issueSession(user.id, {
    ...metadata,
    clientKind: "extension",
  });
  return { tokens, user };
}

export async function signInWithGoogleIdToken(
  idToken: string,
  metadata: SessionMetadata = {},
): Promise<{ tokens: SessionTokens; user: AuthUser }> {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await findOrCreateGoogleUser(identity);
  const tokens = await issueSession(user.id, {
    ...metadata,
    clientKind: metadata.clientKind ?? "extension",
  });
  return { tokens, user };
}

type GoogleIdentity = {
  subject: string;
  email: string;
  emailVerified: true;
  name: string;
  avatarUrl: string;
};

async function verifyGoogleIdToken(
  token: string,
  nonce?: string,
): Promise<GoogleIdentity> {
  const config = googleConfig();
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: config.clientId,
      clockTolerance: 5,
    });
    payload = result.payload;
  } catch {
    throw new AuthServiceError(401, "invalid_google_id_token");
  }
  if (nonce && payload.nonce !== nonce) {
    throw new AuthServiceError(401, "invalid_google_nonce");
  }
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new AuthServiceError(401, "google_email_not_verified");
  }
  return {
    subject: payload.sub,
    email: normalizeEmail(payload.email),
    emailVerified: true,
    name: typeof payload.name === "string" ? payload.name.slice(0, 200) : "",
    avatarUrl:
      typeof payload.picture === "string" ? payload.picture.slice(0, 2_000) : "",
  };
}

async function findOrCreateGoogleUser(identity: GoogleIdentity): Promise<AuthUser> {
  let rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(USER_COLUMNS)}
    FROM users
    WHERE google_subject = ${identity.subject} AND deleted_at IS NULL
    LIMIT 1
  `;
  if (rows[0]) {
    assertUserCanSignIn(rows[0]);
    return mapUser(rows[0]);
  }

  rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(USER_COLUMNS)}
    FROM users
    WHERE email = ${identity.email} AND deleted_at IS NULL
    LIMIT 1
  `;
  const existing = rows[0];
  if (existing) {
    if (existing.google_subject && existing.google_subject !== identity.subject) {
      throw new AuthServiceError(409, "google_account_conflict");
    }
    const linked = await sql<UserRow[]>`
      UPDATE users
      SET google_subject = ${identity.subject},
          email_verified = true,
          avatar_url = CASE WHEN avatar_url = '' THEN ${identity.avatarUrl} ELSE avatar_url END,
          updated_at = now()
      WHERE id = ${existing.id} AND google_subject IS NULL
      RETURNING ${sql.unsafe(USER_COLUMNS)}
    `;
    const user = linked[0] ?? existing;
    assertUserCanSignIn(user);
    return mapUser(user);
  }

  const role = isConfiguredAdminEmail(identity.email) ? "admin" : "user";
  try {
    const inserted = await sql<UserRow[]>`
      INSERT INTO users (
        id, email, email_verified, google_subject, name, avatar_url,
        language, plan, status, system_role
      ) VALUES (
        ${createRecordId()}, ${identity.email}, true, ${identity.subject},
        ${identity.name}, ${identity.avatarUrl}, 'en', 'check', 'active', ${role}
      )
      RETURNING ${sql.unsafe(USER_COLUMNS)}
    `;
    if (!inserted[0]) throw new Error("insert returned no user");
    return mapUser(inserted[0]);
  } catch (error) {
    if (postgresCode(error) === "23505") {
      // A concurrent first login may have created the identity. Re-read by the
      // immutable Google subject; never trust a client-supplied email here.
      const concurrent = await sql<UserRow[]>`
        SELECT ${sql.unsafe(USER_COLUMNS)}
        FROM users
        WHERE google_subject = ${identity.subject} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (concurrent[0]) return mapUser(concurrent[0]);
      throw new AuthServiceError(409, "google_account_conflict");
    }
    throw error;
  }
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    verified: Boolean(row.email_verified),
    name: row.name ?? "",
    handle: row.handle ?? "",
    avatar: row.avatar_file_id ?? "",
    avatarUrl: row.avatar_url ?? "",
    timezone: row.timezone ?? "",
    language: row.language ?? "en",
    plan: row.plan ?? "check",
    planCycle: row.plan_cycle ?? null,
    planBadge: row.plan_badge ?? "",
    planRenewsOn: row.plan_renews_on ? iso(row.plan_renews_on) : null,
    stripeSubscriptionId: row.stripe_subscription_id ?? "",
    pendingPlan: row.pending_plan ?? null,
    pendingPlanCycle: row.pending_plan_cycle ?? null,
    pendingPlanEffective: row.pending_plan_effective
      ? iso(row.pending_plan_effective)
      : null,
    mfaEnabled: Boolean(row.mfa_enabled),
    mfa: Boolean(row.mfa_enabled),
    status: row.status,
    systemRole: row.system_role ?? "user",
    onboardingCompleted: Boolean(row.onboarding_completed),
    customMonthlyLimit:
      row.custom_monthly_limit === null
        ? null
        : Number(row.custom_monthly_limit),
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

function assertUserCanSignIn(row: Pick<UserRow, "status">): void {
  if (row.status !== "active") {
    throw new AuthServiceError(403, "account_unavailable");
  }
}

function isConfiguredAdminEmail(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return admins.includes(normalizeEmail(email));
}

function googleConfig(): {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendUrl: string;
} {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const frontendUrl = normalizeOrigin(
    process.env.FRONTEND_URL ?? "http://localhost:3000",
  );
  const callbackUrl =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${normalizeOrigin(process.env.API_PUBLIC_URL ?? "http://localhost:8787")}/auth/google/callback`;
  return { clientId, clientSecret, callbackUrl, frontendUrl };
}

function validateExtensionRedirect(value: string | undefined): string {
  if (!value) throw new AuthServiceError(400, "missing_extension_redirect");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthServiceError(400, "invalid_extension_redirect");
  }
  const match = /^([a-p]{32})\.chromiumapp\.org$/i.exec(url.hostname);
  const extensionId = match?.[1]?.toLowerCase();
  const allowed = (process.env.EXTENSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    !extensionId ||
    !allowed.includes(extensionId) ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  ) {
    throw new AuthServiceError(400, "invalid_extension_redirect");
  }
  return url.toString();
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AuthServiceError(503, "google_oauth_not_configured");
  return value;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  return url.origin;
}

function passwordWithPepper(password: string): string {
  return `${password}\u0000${process.env.AUTH_PASSWORD_PEPPER ?? ""}`;
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAX_MEMORY },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });
}

function isPlausibleToken(token: string, prefix: string): boolean {
  return token.startsWith(prefix) && token.length >= 40 && token.length <= 512;
}

function cleanIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  return first.length > 64 ? first.slice(0, 64) : first || null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function stringProperty(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const nested = value?.[key];
  return typeof nested === "string" ? nested : null;
}

function postgresCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function numberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const USER_COLUMNS = `
  id, email, email_verified, password_hash, google_subject, name, handle,
  avatar_file_id, avatar_url, timezone, language, plan, plan_cycle, plan_badge,
  plan_renews_on, stripe_subscription_id, pending_plan, pending_plan_cycle,
  pending_plan_effective, mfa_enabled, status, system_role,
  onboarding_completed, custom_monthly_limit, created_at, updated_at
`;

const USER_COLUMNS_WITH_PREFIX = `
  u.id, u.email, u.email_verified, u.password_hash, u.google_subject,
  u.name, u.handle, u.avatar_file_id, u.avatar_url, u.timezone, u.language,
  u.plan, u.plan_cycle, u.plan_badge, u.plan_renews_on,
  u.stripe_subscription_id, u.pending_plan, u.pending_plan_cycle,
  u.pending_plan_effective, u.mfa_enabled, u.status, u.system_role,
  u.onboarding_completed, u.custom_monthly_limit, u.created_at, u.updated_at
`;

// Validly formatted scrypt for a fixed non-secret value. This prevents an
// unknown-email login from returning before the password KDF runs.
const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$W3za7xnSJyqJ1G7cQO2B4NjntOHviTL_HEmzjA8S9zc";
