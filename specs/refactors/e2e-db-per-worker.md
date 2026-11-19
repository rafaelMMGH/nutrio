# Refactor: e2e database and server per worker

**Status:** done · **Branch:** refactor/e2e-db-per-worker

> No behavior change in the app. Test infrastructure only.

## Goal

The e2e suite (about 420 tests) runs on one worker against one cloned database and one `next dev`, so it is slow and one failing test early in a file can hide the rest. Give each Playwright worker its own database and its own server so files run in parallel (3 workers, the user's choice 2026-11-18), with the same pass/fail result as the serial run.

## Decisions (the user, 2026-11-18)

- One `next dev` per worker (port `3200 + i`, `NEXT_DIST_DIR=.next-e2e-<i>`), no app code change. The rejected option, one server choosing the database per request, would have touched `src/lib/storage/pg.ts`.
- 3 workers by default. Tests inside a file keep running in order (`fullyParallel: false`); files are spread across workers.
- Global setup clones the real database once into a template (`<name>-e2e`, as today), then creates `<name>-e2e-<i>` with `CREATE DATABASE … TEMPLATE`. Teardown drops all of them. The run lock stays as it is.
- Worker index = Playwright's `parallelIndex` (stable 0..workers-1, also after a worker restart), not `workerIndex`.

## Scope

- In: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `global-teardown.ts`, `database.ts`, `fixtures.ts`, `auth.setup.ts`, helpers that call `sql()` or build URLs, spec imports if they must use the shared fixtures, `.gitignore` (new `.next-e2e-*` and log paths), the e2e notes in `CLAUDE.md`.
- Out: `src/**`, test logic and assertions, deterministic seed data instead of the real-data clone, the known failing tests (tracked in `specs/BACKLOG.md`), the screenshot paths under `specs/alt-dashboard/screenshots/`.

## Safety net

- Baseline: one full serial run on `main` before any change; its pass/fail/skip set is the reference.
- After: full runs with 3 workers must match the baseline set (no new failures or skips). A difference has to be explained (a real order dependency between files) and fixed in the test setup, not by editing assertions.
- `npx tsc --noEmit` clean; unit tests pass.
- All tests pass before: [x] · after: [x] (same known-failing set; nothing that passed before fails now)

## Result (2026-11-18)

- Baseline, serial on bb0fcd9: 554 tests, 456 passed, 56 failed, 8 timed out, 34 did not run, 32.9 min.
- 3 workers (three full runs, the last one by the reviewer): 556 tests, 459-460 passed, 55-56 failed, 7 timed out, 34 did not run, 17.8-18.7 min. The 2 extra tests are the per-worker sign-ins. `theme-switch.spec.ts:36` (1280px and 360px) went from failing to passing; `upload-wizard-checks.spec.ts:145` is flaky in both setups.
- Red check: pointing every worker's `sql()` at worker 0's database made assistant and metric-dials tests fail.
- `npx tsc --noEmit` clean; unit 1042/1042. `E2E_WORKERS=1` checked on a subset only.
- Follow-ups (in `specs/BACKLOG.md`): the run lock is per checkout while ports and database names are shared across worktrees; `next dev` adds `.next-e2e-<i>/types` to `tsconfig.json` on every run.
