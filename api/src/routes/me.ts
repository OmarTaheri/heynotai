import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { pbAdmin } from "../lib/pb-admin.js";
import { getMonthlyUsage } from "../lib/usage.js";

export const me = new Hono();

me.use("*", requireAuth);

me.get("/", (c) => {
  const user = c.get("user");
  return c.json({ user });
});

/** Real per-user monthly token usage. Powers the sidebar UsageCard
 *  and the /app/models TokenUsageBand. Single endpoint, both surfaces
 *  pick the slice they need. Aggregates `scans.creditsUsed` for the
 *  current calendar month UTC and looks up the plan cap via PLAN_TOKEN_LIMITS. */
me.get("/usage", async (c) => {
  const pb = c.get("pb");
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const usage = await getMonthlyUsage(pb, {
    id: user.id,
    plan: user.plan as string | undefined,
  });
  return c.json(usage);
});

/** Look up a single user by **exact email** for the invite flow.
 *
 *  PB's listRule on `users` is closed (protects billing + Stripe data),
 *  and product policy is "don't surface users unless the inviter
 *  already knows their email" — so this endpoint refuses partial
 *  matches and only returns the user whose email is exactly equal to
 *  the query. Returns `users: []` for self, missing users, or anything
 *  that doesn't look like an email.
 *
 *  Caller must be authenticated. Returns only public-safe profile
 *  fields (`id`, `name`, `handle`, `email`, `avatarUrl`). */
me.get("/users/search", async (c) => {
  const caller = c.get("user");
  if (!caller) return c.json({ error: "unauthorized" }, 401);

  const raw = (c.req.query("q") ?? "").trim().toLowerCase();
  // Reject non-email queries up front so the endpoint can't be used to
  // browse the user table — invite UX requires the inviter to type the
  // recipient's full email anyway.
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  if (!isEmail) return c.json({ users: [] });
  if (raw === (caller.email as string | undefined)?.toLowerCase()) {
    return c.json({ users: [] });
  }

  const admin = await pbAdmin();
  const filter = admin.filter("email = {:q}", { q: raw });
  const list = await admin
    .collection("users")
    .getList(1, 1, { filter });

  const users = list.items.map((record) => {
    const avatarFile = record.avatar as string | undefined;
    const avatarUrl = avatarFile
      ? admin.files.getURL(record, avatarFile)
      : null;
    return {
      id: record.id,
      name: (record.name as string | undefined) ?? "",
      handle: (record.handle as string | undefined) ?? "",
      email: (record.email as string | undefined) ?? "",
      avatarUrl,
    };
  });
  return c.json({ users });
});

/** Resolve a batch of user ids to the public profile fields used for
 *  displaying collaborators (avatar, name, handle, email).
 *
 *  Same rationale as `/users/search`: the `users` listRule is closed
 *  to protect billing fields. Collection members + invite rows store
 *  raw user ids; the collaborator-facing UI needs to render them. */
me.get("/users/by-ids", async (c) => {
  const caller = c.get("user");
  if (!caller) return c.json({ error: "unauthorized" }, 401);

  const raw = c.req.query("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9]{15}$/.test(s));
  if (ids.length === 0) return c.json({ users: [] });
  // Cap to keep the URL + DB cost bounded.
  const limited = ids.slice(0, 50);

  const admin = await pbAdmin();
  const filter = limited.map((id) => `id="${id}"`).join(" || ");
  const list = await admin
    .collection("users")
    .getList(1, limited.length, { filter });

  const users = list.items.map((record) => {
    const avatarFile = record.avatar as string | undefined;
    const avatarUrl = avatarFile
      ? admin.files.getURL(record, avatarFile)
      : null;
    return {
      id: record.id,
      name: (record.name as string | undefined) ?? "",
      handle: (record.handle as string | undefined) ?? "",
      email: (record.email as string | undefined) ?? "",
      avatarUrl,
    };
  });
  return c.json({ users });
});

const ROLE_VALUES = new Set(["editor", "viewer"]);

/** Issue a collaboration invite. Resolves the recipient's PB id via
 *  superuser (the `users` listRule is closed, so the inviter's own
 *  client can't see anyone else's record), then writes the row.
 *
 *  Without this server lane, every invite landed with `userId = ""` —
 *  the recipient's `listPendingRequests` filter (`userId = self`)
 *  would never match, and the invite was effectively lost. Setting
 *  `userId` at invite time fixes the registered-user case; users who
 *  haven't signed up yet still get an unlinked row that backfills
 *  later.
 *
 *  Authorization: caller must be the owner of the target collection. */
me.post("/collections/invite", async (c) => {
  const caller = c.get("user");
  if (!caller) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const collectionId = typeof body?.collectionId === "string"
    ? body.collectionId.trim()
    : "";
  const email = typeof body?.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const role = ROLE_VALUES.has(body?.role) ? (body.role as "editor" | "viewer") : "editor";
  const message = typeof body?.message === "string"
    ? body.message.trim().slice(0, 500)
    : "";

  if (!collectionId) {
    return c.json({ error: "missing_collection" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "invalid_email" }, 400);
  }
  if (email === (caller.email as string | undefined)?.toLowerCase()) {
    return c.json({ error: "self_invite" }, 400);
  }

  const admin = await pbAdmin();

  // Verify the caller owns the target collection. The collection's
  // own listRule already lets the owner read it, but we re-check via
  // superuser so the answer is authoritative regardless of cache state.
  let collection;
  try {
    collection = await admin.collection("collections").getOne(collectionId);
  } catch {
    return c.json({ error: "collection_not_found" }, 404);
  }
  if (collection.userId !== caller.id) {
    return c.json({ error: "forbidden" }, 403);
  }

  // Resolve recipient. 404 → unregistered, leave userId blank.
  let recipientId = "";
  try {
    const recipient = await admin
      .collection("users")
      .getFirstListItem(admin.filter("email = {:email}", { email }));
    recipientId = recipient.id;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status !== 404) throw err;
  }

  if (recipientId === caller.id) {
    return c.json({ error: "self_invite" }, 400);
  }

  try {
    const record = await admin.collection("collection_members").create({
      collection: collectionId,
      userId: recipientId,
      invitedBy: caller.id,
      invitedEmail: email,
      role,
      status: "pending",
      message,
    });
    return c.json({ membershipId: record.id, recipientId });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const data = (err as { response?: { data?: Record<string, { code?: string }> } })?.response?.data;
    const isDuplicate =
      status === 400 &&
      data &&
      Object.values(data).some((f) => f?.code === "validation_not_unique");
    if (isDuplicate) {
      return c.json({ error: "already_invited" }, 409);
    }
    throw err;
  }
});
