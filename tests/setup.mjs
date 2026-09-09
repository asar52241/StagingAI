// Always replace credentials before loading application modules. Tests never use .env.local.
Object.assign(process.env, {
  NODE_ENV: "test",
  ROBOKASSA_LOGIN: "test-merchant",
  ROBOKASSA_PASSWORD1: "test-live-password-1",
  ROBOKASSA_PASSWORD2: "test-live-password-2",
  ROBOKASSA_TEST_PASSWORD1: "test-password-1",
  ROBOKASSA_TEST_PASSWORD2: "test-password-2",
  ROBOKASSA_TEST: "true",
  PAYMENT_TOKEN_SECRET: "test-only-secret-with-at-least-32-characters",
  OPENAI_API_KEY: "test-only-not-a-real-key",
  NEXT_PUBLIC_SITE_URL: "https://staging-ai.test",
});
for (const key of ["DATABASE_URL", "POSTGRES_URL", "TRUSTED_IP_HEADER", "VERCEL"]) delete process.env[key];
