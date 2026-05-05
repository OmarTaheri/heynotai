import { z } from "zod";
import { config } from "dotenv";

// Load .env (api/.env) before reading process.env. Done here so any
// import of `env` triggers loading exactly once. The loader is a no-op
// if the file is missing or vars are already set by the shell/CI.
config({ path: new URL("../.env", import.meta.url).pathname });

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  POCKETBASE_URL: z.string().url().default("http://127.0.0.1:8090"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_VERIFY_MONTHLY: z.string().optional(),
  STRIPE_PRICE_VERIFY_YEARLY: z.string().optional(),
  STRIPE_PRICE_CERTIFY_MONTHLY: z.string().optional(),
  STRIPE_PRICE_CERTIFY_YEARLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),

  PB_ADMIN_EMAIL: z.string().optional(),
  PB_ADMIN_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
