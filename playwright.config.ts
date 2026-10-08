import { defineConfig } from "@playwright/test";

// Smoke test for the whole app on the local demo database.
//   npx playwright install chromium   (first time only)
//   npm run test:smoke
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 960 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    // Fresh demo database every run, on its own port
    // DATABASE_URL= keeps tests off the real database even if one is set in .env.local
    command: "rm -rf .data-test && export DATABASE_URL= PGLITE_DIR=.data-test && npx tsx scripts/ensure-db.ts && npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
