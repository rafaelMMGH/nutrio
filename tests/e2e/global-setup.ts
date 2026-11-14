import os from "node:os";
import { cloneDatabase } from "./database";

// Guards against overloaded runs (specs/bugs/e2e-run-guard.md). Overlapping runs are refused earlier, when
// playwright.config.ts takes tests/e2e/.e2e-run.lock; teardown releases it. If this setup throws, Playwright still
// runs teardown, which drops the clone and releases the lock. A run refused by the lock never reaches setup or
// teardown, so it cannot touch the live run's database or lock.
// Warns (never fails) when the 1-minute load average exceeds the core count, since timeouts are then unreliable.

export default function globalSetup() {
  const load = os.loadavg()[0];
  const cores = os.cpus().length;
  if (load > cores) {
    console.warn(`High machine load (${load.toFixed(1)} on ${cores} cores): e2e timings may be unreliable; timeouts may not be real failures.`);
  }
  cloneDatabase();
}
