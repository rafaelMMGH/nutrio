import { mkdirSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { authStatePath, BASE_PORT, serverLogDir, serverLogPath, workerCount, workerDatabaseUrl, workerPort } from "./tests/e2e/database";
import { acquireRunLock } from "./tests/e2e/run-lock";

// End-to-end tests run against their own `next dev` per worker (port BASE_PORT + parallelIndex), each backed by its own
// throwaway copy of the database (created in global setup, dropped in global teardown), so spec files run in parallel
// without sharing data. The dev server on :3000 and its data are never touched.
const WORKERS = workerCount();
mkdirSync(serverLogDir(), { recursive: true });

// Refuse a second concurrent run here: Playwright clears test-results/ right after loading the config, before the
// web server and global setup, so any later check would already have broken the first run's traces.
// Only a real `playwright test` run takes the lock: `--list` and other commands load this config too but never reach
// global teardown, which is what releases it.
if (process.argv[2] === "test" && !process.argv.includes("--list")) acquireRunLock();
const viewport = { width: 1440, height: 900 };

export default defineConfig({
  testDir: "./tests/e2e",
  // Files spread across the workers; the tests inside a file keep running in order (describe.serial included).
  fullyParallel: false,
  workers: WORKERS,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    // Placeholder: tests/e2e/fixtures.ts points every test at its own worker's server.
    baseURL: `http://localhost:${BASE_PORT}`,
    locale: "es-MX",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "dashboard",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport, storageState: authStatePath(0) }
    }
  ],
  // One server per worker, each on its own database. None serves the template, so cloning it never meets open connections.
  webServer: Array.from({ length: WORKERS }, (_, index) => ({
    command: `sh -c "npx next dev -p ${workerPort(index)} 2>&1 | tee '${serverLogPath(index)}'"`,
    url: `http://localhost:${workerPort(index)}/login`,
    reuseExistingServer: false,
    // Three cold compiles run at once, so the first /login takes longer than with a single server.
    timeout: 240_000,
    env: { DATABASE_URL: workerDatabaseUrl(index), NEXT_DIST_DIR: `.next-e2e-${index}`, E2E_HOOKS: "1" }
  }))
});
