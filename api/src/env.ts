import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  POCKETBASE_URL: z.string().url().default("http://127.0.0.1:8090"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
