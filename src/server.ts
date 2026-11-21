import cron from "node-cron";
import { createApp } from "./app";
import { env } from "./config/env";

async function startServer() {
  const { app, initialize, runRecurringCatchUp } = createApp({
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
    refreshRotationThresholdSeconds: env.REFRESH_ROTATION_THRESHOLD_SECONDS,
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    groq: { apiKey: env.GROQ_API_KEY, apiUrl: env.GROQ_API_URL, model: env.GROQ_API_MODEL }
  });

  console.log(
    env.GROQ_API_KEY
      ? `[smart-add] AI parsing enabled (model ${env.GROQ_API_MODEL})`
      : "[smart-add] AI parsing disabled: GROQ_API_KEY not set"
  );

  await initialize();

  try {
    const result = await runRecurringCatchUp();
    console.log(
      `[recurring-job] startup catch-up: created=${result.created} skipped=${result.skipped}`
    );
  } catch (error) {
    console.error("[recurring-job] startup catch-up failed:", error);
  }

  cron.schedule("5 0 1 * *", async () => {
    try {
      const result = await runRecurringCatchUp();
      console.log(
        `[recurring-job] monthly run: created=${result.created} skipped=${result.skipped}`
      );
    } catch (error) {
      console.error("[recurring-job] monthly run failed:", error);
    }
  });

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

void startServer();
