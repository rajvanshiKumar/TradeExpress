import { defineConfig } from "@playwright/test";

// E2E runs the real frontend against the real backend + PostgreSQL. The AI provider is the
// explicitly-marked FAKE test provider (TX_ENVIRONMENT=test); live Gemini runs are covered by
// backend/tests/live. Prepare the DB first: python backend/scripts/e2e_prepare.py <admin-url>
const DB = process.env.E2E_DATABASE_URL ?? "postgresql+asyncpg://postgres:@127.0.0.1:53260/tx_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: [
    {
      command: "..\\backend\\.venv\\Scripts\\python -m uvicorn app.main:create_app --factory --port 8100",
      cwd: "../backend",
      url: "http://localhost:8100/health/live",
      reuseExistingServer: false,
      env: {
        TX_DATABASE_URL: DB,
        TX_JWT_SECRET: "e2e-secret-" + "k".repeat(40),
        TX_ENVIRONMENT: "test",
        TX_AI_PROVIDER: "fake",
        TX_CORS_ORIGINS: '["http://localhost:3100"]',
        TX_STORAGE_DIR: "./.e2e-storage",
      },
    },
    {
      command: "npm run build && npx next start -p 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 240_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:8100" },
    },
  ],
});
