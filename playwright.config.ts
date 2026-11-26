// End-to-end tests: the real UI in a browser, with preview/mock.ts standing in for the Rust backend.
// Run: npm run test:e2e   (one engine: npx playwright test --project=webkit)
import { defineConfig } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  // WebKit is the engine the app ships with on macOS (Tauri), so it runs the same tests as Chromium.
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
