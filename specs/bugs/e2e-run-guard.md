# Bug: overlapping or overloaded e2e runs fail in confusing ways

**Status:** in progress · **Branch:** fix/e2e-run-guard

## Symptom

During the theme-switcher work, e2e runs sometimes overlapped (agents left background runs, or old agents were resumed), or ran on a heavily loaded machine. The suite then failed with timeouts that looked like bugs. One full run took 1.8 h instead of about 6 min, and a review round took about 3 h.

## Reproduction

1. Start `npm run test:e2e`.
2. While it runs, start a second `npm run test:e2e` (or run it while the machine's load average is far above its core count).

Expected: the second run refuses to start with a clear message, and a run on an overloaded machine warns up front. Actual: there is no guard. Global setup clones and teardown drops the shared `<name>-e2e` database, so a second run can interfere with the first, and slowness shows up only as timeouts.

## Root cause

`tests/e2e/global-setup.ts` and `global-teardown.ts` assume they have port 3200, `test-results/` and the e2e database to themselves. Nothing checks for another run, and nothing reports machine load. Playwright clears `test-results/` right after loading the config, before the web server and global setup, so a check in global setup is too late: a second run would already have deleted the first run's traces.

## Fix

- `playwright.config.ts` calls `acquireRunLock()` (`tests/e2e/run-lock.ts`) at load time. This runs before Playwright clears `test-results/` and before the web server, global setup or the port are touched, so a refused run changes nothing.
- The lock file `tests/e2e/.e2e-run.lock` (gitignored with its temp files, `.e2e-run.lock*`; path resolved from `run-lock.ts`, overridable with `E2E_RUN_LOCK_PATH` for unit tests) holds `<pid> <start time>`. It is created atomically already filled in (temp file, then `linkSync`). If a live PID holds it, the run aborts with a message naming the PID, start time and lock path, and says to delete the file if no Playwright run is active. A lock whose PID is dead, unreadable (empty, garbage, non-integer PID) or our own PID is stale and is taken over.
- Takeover is race-safe: deleting a stale lock is serialized through a second link-created file (`.e2e-run.lock.reaper`), and the lock is deleted only after re-reading it under that mutual exclusion and finding the same dead holder. Without it, a slow starter could delete a live lock that a faster one had just created over the stale one (two owners). A reaper file older than 10 s (crashed reaper) is discarded.
- The lock is taken only for `playwright test` without `--list`; `--list` and other commands load the config but never run teardown.
- Workers re-load the config. The main process exports `E2E_RUN_LOCK_OWNER` when it takes the lock; workers inherit it and skip the check, so the lock is taken exactly once per run, by the main process.
- Global teardown (main process) drops the database and releases the lock only if it owns the lock. A refused run never reaches setup or teardown, so it cannot delete the live run's lock or database. If setup throws, Playwright still runs teardown, which cleans up.
- Global setup warns (never fails) when the load average exceeds the core count.

## Regression test

Unit: `tests/unit/run-lock.test.ts` (child processes against a temporary lock path; helper `tests/unit/run-lock-child.ts`) covers a live holder refused (message has path and delete hint), dead PID, empty file, garbage and non-integer PID taken over, own PID treated stale, 6 simultaneous starts on a fresh lock and on a stale lock giving exactly one owner, and release only by the owner. Also a deterministic reaper test: a stale lock plus a fresh `.reaper` file must be refused (`Could not acquire...`) and the lock left untouched, and once the reaper is removed a new run becomes owner. Fail-first proof: with `reapStale` replaced by a naive `unlinkSync(lockPath())` + retry, that test fails (the run takes over despite the reaper) while the rest pass. Against the previous takeover logic the suite also failed on garbage content (gave up instead of taking over) and on the message wording. The first stale-lock race (two owners) was reproduced by the reviewer with a stale lock and 4 simultaneous starts on the old code; the 6-start stale-lock test is probabilistic and kept as a smoke check.

Manual, earlier on the branch: a second `npx playwright test` started while a first one was running aborted immediately with the message above and the first run kept its lock and database. (The "167 passed" noted earlier was a `-g theme` subset, not the full suite of about 400 tests.) A lock with dead PID 999999 was reported and removed automatically.

## Known limits

- PID reuse: if the crashed run's PID now belongs to an unrelated live process, the stale lock looks live and the run is refused; the message says to delete the lock file.
- SIGINT (Ctrl+C) releases the lock through Playwright's teardown. SIGTERM, SIGKILL and a web server that fails to start can leave a stale lock; the next run clears it automatically.
- Long-lived modes (UI mode `--ui`, the IDE extension's test server) hold the lock while open, so a second run is refused until they close. `playwright test --list` does not take it.
- The lock is taken when the config loads, before `defineConfig` evaluates `e2eDatabaseUrl()`, so a missing `DATABASE_URL` or a "No tests found" exit leaves a stale lock; the next run clears it with a warning.
- A reaper file older than 10 s is discarded without checking whether the PID inside is alive (none is stored).
