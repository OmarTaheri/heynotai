import { sql } from "../db/client.js";
import { hashPassword, normalizeEmail } from "./auth.js";

const VALID_PLANS = ["check", "verify", "certify", "team"];

/** Boot-time seed for the Chrome Web Store reviewer account.
 *
 * Google's reviewers cannot complete a sign-up flow on our terms, and every
 * feature of the extension sits behind sign-in, so the account has to exist
 * before review starts. Running it at startup rather than as a one-off script
 * means a Coolify redeploy is the whole procedure: set REVIEWER_EMAIL and
 * REVIEWER_PASSWORD, deploy, done.
 *
 * Idempotent by design — it syncs the account to the current environment on
 * every boot, so rotating the password after a review round is just an
 * environment edit plus a restart. Leaving the variables set is safe.
 *
 * Deliberately narrow: one account, `user` system role, never admin.
 *
 * A bad value here warns and returns instead of throwing. A typo in an
 * optional seed must not take the API down. */
export async function seedReviewerAccount(): Promise<void> {
  const email = normalizeEmail(process.env.REVIEWER_EMAIL ?? "");
  const password = process.env.REVIEWER_PASSWORD ?? "";
  if (!email && !password) return;

  if (!email || !password) {
    console.warn(
      "[seed-reviewer] REVIEWER_EMAIL and REVIEWER_PASSWORD must both be set; skipping",
    );
    return;
  }
  if (password.length < 12) {
    console.warn("[seed-reviewer] REVIEWER_PASSWORD is under 12 characters; skipping");
    return;
  }

  // `check` caps at 100 tokens/month and ranks below the higher-tier
  // detection models, so a reviewer on it can hit a paywall mid-review and
  // file a rejection. Default to the top self-serve tier.
  const plan = process.env.REVIEWER_PLAN?.trim() || "certify";
  if (!VALID_PLANS.includes(plan)) {
    console.warn(`[seed-reviewer] REVIEWER_PLAN "${plan}" is not a valid plan; skipping`);
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    // The email uniqueness index is partial (`ON users (lower(email)) WHERE
    // deleted_at IS NULL`), which ON CONFLICT cannot target, so update-then-
    // insert inside a transaction — the same shape as seed-dev-auth.ts.
    const created = await sql.begin(async (tx) => {
      const updated = await tx<{ id: string }[]>`
        UPDATE users
        SET password_hash = ${passwordHash},
            email_verified = true,
            name = 'Chrome Web Store Reviewer',
            plan = ${plan},
            status = 'active',
            system_role = 'user',
            onboarding_completed = true,
            deleted_at = NULL,
            updated_at = now()
        WHERE lower(email) = ${email} AND deleted_at IS NULL
        RETURNING id
      `;
      if (updated.length > 0) return false;

      await tx`
        INSERT INTO users (
          email, email_verified, password_hash, name, language, plan,
          status, system_role, onboarding_completed
        ) VALUES (
          ${email}, true, ${passwordHash}, 'Chrome Web Store Reviewer', 'en', ${plan},
          'active', 'user', true
        )
      `;
      return true;
    });

    console.info(
      `[seed-reviewer] reviewer account ${created ? "created" : "synced"} -> ${email} (plan: ${plan})`,
    );
  } catch (error) {
    console.warn(
      `[seed-reviewer] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
