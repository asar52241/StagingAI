import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3310",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium",
    headless: true,
  },
  webServer: {
    command: "node --import ./tests/setup.mjs node_modules/next/dist/bin/next dev --turbo --hostname 127.0.0.1 --port 3310",
    url: "http://127.0.0.1:3310",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
