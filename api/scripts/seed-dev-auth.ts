import { closeDatabase, initializeDatabase, sql } from "../src/db/client.js";
import { hashPassword, normalizeEmail } from "../src/services/auth.js";

const DEFAULT_PASSWORD = "HeyNotAI2026!";

const accounts = [
  {
    email: process.env.DEV_ADMIN_EMAIL ?? "admin@heynotai.local",
    name: "Development Admin",
    systemRole: "admin",
    plan: "check",
  },
  {
    email: process.env.DEV_USER_EMAIL ?? "user@heynotai.local",
    name: "Development User",
    systemRole: "user",
    plan: "check",
  },
  {
    // Mirrors the account the Chrome Web Store reviewer signs in with, so
    // the reviewer's exact path can be walked locally. Production creates
    // its own from REVIEWER_EMAIL/REVIEWER_PASSWORD at boot — see
    // src/services/seed-reviewer.ts — and never shares this password.
    // `certify` because a reviewer on `check` (100 tokens/month, below the
    // higher-tier models) can hit a paywall mid-review.
    email: process.env.REVIEWER_EMAIL ?? "chrome-review@heynotai.com",
    name: "Chrome Web Store Reviewer",
    systemRole: "user",
    plan: "certify",
  },
] as const;

const password = process.env.DEV_LOGIN_PASSWORD ?? DEFAULT_PASSWORD;

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed development accounts in production");
}

if (password.length < 8) {
  throw new Error("DEV_LOGIN_PASSWORD must contain at least 8 characters");
}

try {
  await initializeDatabase();

  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    const passwordHash = await hashPassword(password);
    await sql.begin(async (tx) => {
      const updated = await tx<{ id: string }[]>`
        UPDATE users
        SET password_hash = ${passwordHash},
            name = ${account.name},
            system_role = ${account.systemRole},
            plan = ${account.plan},
            status = 'active',
            deleted_at = NULL,
            updated_at = now()
        WHERE email = ${email}
        RETURNING id
      `;

      if (updated.length === 0) {
        await tx`
          INSERT INTO users (
            email, email_verified, password_hash, name, language, plan,
            status, system_role, onboarding_completed
          ) VALUES (
            ${email}, true, ${passwordHash}, ${account.name}, 'en', ${account.plan},
            'active', ${account.systemRole}, true
          )
        `;
      }
    });
  }

  console.log(
    `development auth -> ${accounts.map((a) => a.email).join(", ")} ready`,
  );
} finally {
  await closeDatabase();
}
