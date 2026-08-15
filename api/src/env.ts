import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

// api/.env.local is the developer's machine-local override and wins over
// api/.env (the copy of .env.example). Container/process variables still win
// over both, because dotenv does not override an already-set variable.
config({
  path: fileURLToPath(new URL("../.env.local", import.meta.url)),
  override: true,
});
config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const optionalString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),

  DATABASE_URL: z.string().min(1).default(
    "postgres://postgres:postgres@127.0.0.1:5432/heynotai",
  ),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  API_PUBLIC_URL: z.string().url().default("http://localhost:8787"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  FILE_URL_SECRET: optionalString,

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,chrome-extension://*")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),

  // Structured logs are always persisted to `system_logs`. This mirrors them
  // to the process stdout/stderr so `pnpm dev` and `docker logs` show activity
  // without a database query. "auto" is human-readable lines in development
  // and one JSON object per line in production.
  LOG_STDOUT: z.enum(["auto", "pretty", "json", "off"]).default("auto"),
  LOG_STDOUT_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),

  AUTH_PASSWORD_PEPPER: optionalString,
  AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
  AUTH_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).max(31_536_000)
    .default(30 * 24 * 60 * 60),
  ADMIN_EMAILS: z.string().default("").transform((value) =>
    value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
  ),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().optional(),
  ),
  EXTENSION_IDS: z.string().default("").transform((value) =>
    value.split(",").map((id) => id.trim()).filter(Boolean)
  ),

  CREDENTIAL_ENCRYPTION_KEY: optionalString,
  ALLOWED_LOCAL_MODEL_HOSTS: z.string().default(""),
  HUGGINGFACE_TOKEN: optionalString,
  VELMA_API_KEY: optionalString,
  VELMA_BASE_URL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().optional(),
  ),
  VELMA_DETECT_PATH: optionalString,

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_VERIFY_MONTHLY: optionalString,
  STRIPE_PRICE_VERIFY_YEARLY: optionalString,
  STRIPE_PRICE_CERTIFY_MONTHLY: optionalString,
  STRIPE_PRICE_CERTIFY_YEARLY: optionalString,
  STRIPE_PRICE_TEAM_MONTHLY: optionalString,
  STRIPE_PRICE_TEAM_YEARLY: optionalString,
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;

  const requireLength = (key: "AUTH_PASSWORD_PEPPER" | "FILE_URL_SECRET") => {
    if (!value[key] || value[key]!.length < 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must contain at least 32 characters in production`,
      });
    }
  };
  requireLength("AUTH_PASSWORD_PEPPER");
  requireLength("FILE_URL_SECRET");
  if (!process.env.DATABASE_URL?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL must be explicitly configured in production",
    });
  }
  if (!value.CREDENTIAL_ENCRYPTION_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CREDENTIAL_ENCRYPTION_KEY"],
      message: "CREDENTIAL_ENCRYPTION_KEY is required in production",
    });
  }
});

export const env = envSchema.parse(process.env);
