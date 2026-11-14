# Backlog

Open work for future sessions. The orchestrator should read this at session start and offer the top open item. Tick items when done; move finished items to "Done" with the date.

_Last updated: 2026-11-14 (assistant-data-scope spec v1.9 planned; Phase 11 analyze round 1 PASS)_

## In progress

- [ ] **Assistant data scope: spec v1.9 planned, next is Gate 2 for the Phase 11 difference.** Branch `feature/assistant-data-scope` (local, never pushed; see `git log` for the tip). **Start here: `specs/assistant-data-scope/HANDOFF.md`** (state, what remains, rules, traps). Spec v1.9 (`planned`; v1.8 6fda37f, v1.9 65a0046), plan revision 11; tasks: the 78 of v1.7 done plus Phase 11 T081-T091 (4 done: the bug-fix batch B1/B8/B4 and the `ReplyKind` cleanup, 3316cd6, e24a633, c56b7aa, 61fea0c), 82 ticks of 91 ids. Gates: tsc clean, unit 819/819; e2e after the bug-fix batch 8 files 158 passed; last full e2e 398/398 at 027e90e (before the batch). Bug notes: `specs/bugs/assistant-option-announcement.md`, `assistant-identity-before-dish.md`, `assistant-generic-custom-slot.md`. Also delivers chat-polish REQ-23 (HTTP 500), which keeps `assistant-chat-polish` in `partial` until this merges.
  - What remains (HANDOFF.md section 2): (1) Gate 2 with the user's decisions B (T086), E (T088: one full e2e), BF2 yes/no (T085, T087) and who does the 360 px visual check (T089); (2) BF2 and the full e2e if accepted; (3) the manual ≤1 s check on real data at :3000 (T090); (4) the Constitution principle 1 reminder (below); (5) optional cart-snapshot decision; (6) push and PR, with the user's yes; (7) T091 final docs (ticks and results). Worktree/branch cleanup: done 2026-11-13.
  - Future (not in this feature): conversation memory so "¿y la cena?" works; the design is stateless so it can be added.

- [ ] **E2E run guard** (no branch now: `fix/e2e-run-guard` had no commits of its own and was DELETED on 2026-11-13 during the branch cleanup; restart from `main`, and the PR targets `main`). The bug note is `specs/bugs/e2e-run-guard.md`. **Still open (2026-11-13):** a second concurrent e2e run can still break the first; assistant-data-scope does not depend on it (it ran e2e one at a time).
  - **⚠️ The code is in `stash@{0}`, not in the working tree.** On 2026-10-24 at 18:27 another Claude session stashed it ("fix/e2e-run-guard WIP: run guard + local server.js/package.json changes") and switched to `fix/shopping-list-quick`.
  - **The stash also holds the user's own unrelated changes:** the `src/server.js` deletion and `package.json` dropping `legacy:dev`. **Never pop or drop `stash@{0}` without the user.** To resume, together with the user:
    1. Wait until no other session is working in this folder.
    2. From `main`: `git switch -c fix/e2e-run-guard`, then take the guard code from `stash@{0}` with the user (e.g. check out only the guard files from the stash; do not pop it over her unrelated changes without her).
    3. Keep `src/server.js` and `package.json` out of the guard commit.
  - **Files:** `tests/e2e/run-lock.ts` (new), `tests/e2e/global-setup.ts`, `tests/e2e/global-teardown.ts`, `.gitignore`.
  - **Review round 1: FAIL.** Fix these, then re-review:
    1. **Blocking:** Playwright deletes `test-results/` ("clear output") before the webServer and globalSetup run, so a second run still breaks the first run's traces. Check the lock at config load in `playwright.config.ts` (e.g. `assertNoLiveRun()`, allowing `process.pid`/`process.ppid` for workers), or use a per-run `outputDir`. Then re-test the overlap: run 1 must pass completely.
    2. **Blocking (accuracy):** the comment in `global-setup.ts` saying teardown runs after a busy-port abort is wrong. Teardown runs only when globalSetup was reached (e.g. it threw on the lock), not after a busy-port abort.
    3. **Minor:** create the lock atomically already filled in (write a temp file, then `linkSync`); ignore ENOENT and re-check the holder before removing a stale lock; include the lock path and "delete it if no Playwright run is active" in the error; treat `holder.pid === process.pid` as stale; say "unreadable lock" for an empty file.
  - **Root cause wording to put in the bug note:** see the reviewer's version. A second run always wiped `test-results/`. If it got past the port check, its globalSetup re-cloned the database with `DROP … WITH (FORCE)`, and its teardown dropped the shared database. Nothing reported load.
  - **Resolved:** the two tests that failed under heavy load ("privacidad, stored dark, light OS" and "Marcar como hecha") passed at normal load. They were load-related, not bugs.
  - **Still needed:** one clean full suite (173 tests) on a quiet machine with no other session running e2e. Then commit path-limited with the bug note `specs/bugs/e2e-run-guard.md` (still untracked in the working tree), and push only with the user's yes.

## Needs the user

- [ ] **REMIND THE USER when assistant-data-scope finishes:** CONSTITUTION principle 1 still says tests are "today ... a Playwright e2e test", but this feature treats `node:test` unit tests as the fail-first proof for logic (spec v1.6). The user decided on 2026-10-29 NOT to amend the Constitution. Ask once more at the end whether to leave it or propose a one-line amendment (a Constitution change needs a team PR).
- [ ] **Manual phone check** for the assistant (13 items, `specs/assistant-chat-polish/tasks.md` T041): iPhone Safari + VoiceOver, Android Chrome + TalkBack.

- [ ] **Push `fix/e2e-run-guard` and open its PR** after the branch is recreated from `main` and the guard is committed (the old branch was deleted 2026-11-13), with base `main`.
- [ ] **Restart Claude Code** so the new speed rules load. These are scout and size triage before grilling, sub-batches of about 300 lines, running only the affected tests while iterating plus one full run per batch, tests shown failing on purpose, and minor findings folded into the next batch. They live in `.claude/agents/*.md`, which is gitignored and local only, and in `docs/agent-workflow.md`.
- [ ] **Decide on uncommitted local changes** that have been kept out of every commit so far:
  - the deletion of `src/server.js` and `package.json` dropping the `legacy:dev` script (both currently inside `stash@{0}`, see the run guard above)
  - `.claude/`, which is gitignored; un-ignore it to share the agents with the repo

## Assistant chat (follow-ups)

- [ ] **Optional spec-change:** combined questions on a recipe page ("¿Qué lleva y cómo se hace?") currently show only Preparación (today's narrowing rule, kept by spec v1.4). Decide whether they should show both sections.
- [ ] **Fragile snapshot:** `a-theme-visual` "signed in, light › cart looks as it did" failed on main because local cart data grew (1882 px vs 900). Refreshed on 2026-11-13 (assistant-data-scope T057, cart only, the user's yes); it stays fragile: it depends on the real cart's item count (cloned DB) and shows today's date in an unmasked `<p>` (CartView.tsx:64). Options: seed deterministic cart data or mask the header (test-side); the user has not decided.
- [ ] **Escape in app popups (pre-existing):** `src/components/useDismiss.ts:13` (UserMenu) and `src/components/groceries/ManualAddForm.tsx:65` don't `preventDefault` on Escape, so one Escape also closes the open assistant panel. Small bug fix.
- [ ] **Safe areas:** the app sets no `viewport-fit=cover`, so `env(safe-area-inset-*)` is 0; the REQ-15 safe-area check is weak.

## Shopping list

Findings, with file:line references: `specs/bugs/shopping-list-findings.md`.

- [ ] **Pre-existing e2e failures on main** (found 2026-10-24 reviewing #2, fail without the fix too). Serial mode skips every later test when they fail:
  - `dashboard.spec.ts:213` "the newest shopping list can be checked off": the newest list in the cloned data has 0 items, so `.home-shop .home-count` never appears. The test depends on the data.
  - `dashboard.spec.ts:91` "intake rings count the equivalents of meals marked done": gets 7, expects > 7. Probably depends on the time of day. Not stash-checked.
- [ ] **Bug fix:** the period planner overcounts days (#1). **Decision needed:** for 7 days with 2 recipes, split 4+3 or 7 each?
- [ ] **Spec-change:** the unit policy (#3, #4), and the meaning of "Entrenamiento", supplements and alternatives (#8, #9).
- [ ] **Spec-change: deleted lists vs templates (#11).** Filtering deleted lists alone would make a template load empty after its backing list is deleted. Options: A) read `reference_snapshot.items` at read time (no migration); B) copy the snapshot into the cart at load; C) store the snapshot on the cart item (migration). Also decide whether a template in the Papelera still counts.
- [ ] **Refactor:** make the "Ingredientes" catalog use the same totals as the cart (#6), and remove the dead `practical_*` code and the misleading template "snapshot" wording (#10, #11).
- [ ] **Feature (later, needs a spec):** a day-by-day meal-slot expansion to replace the `period_days` multiplier.

## Small cleanups (optional)

- [ ] `tests/e2e/theme-login.spec.ts`: remove the unused `edges` field in `lookOf` / `Look`.
- [ ] `tests/e2e/theme-audit.ts`: un-export the types `Finding`, `RunResult`, `Toolkit` and `Audit`, which have no outside users.
- [ ] `specs/theme-switcher/tasks.md` header and `checklists/ux.md` still cite spec v1.4 (the spec is v1.6; v1.5 and v1.6 were wording-only).
- [ ] Optional: in `src/lib/client/theme.ts`, after a real reveal-update failure, call `applyTheme(next)` as a fallback so the stored choice and the page agree.

## Done

- 2026-11-13: **Delete local branch `backup/assistant-9a-before-split`**: closed, nothing to delete (the branch no longer existed when checked).

- 2026-10-28: **Assistant chat polish**, `feature/assistant-chat-polish`, spec v1.8 implemented (22 REQs, US1–US5). Merged as PR #6 on 2026-10-28.

- 2026-10-23: **Theme switcher (light/dark)**, `feature/theme-switcher` (24 commits), merged as PR #1. Its visual snapshots (`tests/e2e/*-snapshots/`) are gitignored on purpose and stay local. It took about 8 h of agent time and about 2.3M subagent tokens. The retrospective led to the speed rules above.
- 2026-10-24: Speed rules added to the agent definitions and `docs/agent-workflow.md`, including small-feature limits in `verifier-spec` analyze mode.
- 2026-10-26: **Shopping cart quick fixes**, `fix/shopping-list-quick`, merged as PR #2. #2: soft-deleted recipes no longer count (restore brings them back). #5: a meal's add-ons count once, scaled by its largest option (planner 4+3 → ×4, accepted trade-off), plus the test hardening from review. Note: `specs/bugs/shopping-list-quick.md`.
- 2026-10-26: **Project docs**, `docs/agent-workflow`, merged as PR #3: `CLAUDE.md`, `CONSTITUTION.md`, `docs/agent-workflow.md`, this backlog and `specs/bugs/shopping-list-findings.md`.
