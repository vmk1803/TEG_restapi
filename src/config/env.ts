import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  REFRESH_ROTATION_THRESHOLD_SECONDS: z.coerce.number().int().nonnegative().default(60 * 60 * 24),
  DATABASE_URL: z.string().min(1),
  // Smart Add AI parsing (Groq chat completions). Without a key the app still
  // runs and Smart Add returns an empty result.
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_API_URL: z.url().default("https://api.groq.com/openai/v1/chat/completions"),
  GROQ_API_MODEL: z.string().min(1).default("llama-3.3-70b-versatile")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message);
  throw new Error("Invalid environment configuration:\n" + issues.join("\n"));
}

export const env = parsed.data;
