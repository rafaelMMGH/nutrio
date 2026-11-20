# Backlog

Open work for future sessions. The orchestrator should read this at session start and offer the top open item. Tick items when done; move finished items to "Done" with the date.

_Last updated: 2026-11-18 (PRs #12 and #13 merged: upload wizard, cooking mode, metric dials and the dashboard redesign are on `main`; `specs/`, `docs/` and `.claude/` versioned)_

## In progress

- [ ] **Dashboard polish follow-ups** (spec `implemented`, PR #16): T037 (US3 screenshots for the user) and T038 (regenerate the home visual snapshot and `specs/alt-dashboard/screenshots/` after the user approves the visuals) were never ticked.
- [ ] **Real data on the dashboard cards** (`specs/dashboard-real-data/`, spec v1.2 `planned`, Feature route, size large): today's meal timeline replaces the fake Calorías card (US1), real plan-compliance counts in Cumplimiento (US2). US1 and US2 complete 2026-11-19 (42 of 46 tasks). Next: housekeeping T039–T041, then the user's visual check, then gated T042. Low notes for T039 or later: rename `.nt-today-empty` to a shared `.nt-empty` outside meal-timeline.css (counts card uses it too); dead `.nt-small`; arc track ~2:1 non-text contrast (raise opacity to ~0.7); no forced-colours rule for the arc; "Planes desde" (plan created_at, Mexico City day) and "Desde" on Cumplimiento (version created_at, local day) can differ; Adherencia "5 de 24" (selected range) next to Cumplimiento "5 de 12" (since version) may confuse, consider a copy clarification; no UTC-straddle test for created_at. Low notes: the fade-band click test clicks mid-visible-row, not strictly inside the fade; REQ-19 reveal is keyboard-only (`:focus-visible`), so AT focus after a mouse click may not reveal; note it in the spec at T039. Pre-existing failure: dashboard.spec.ts "top bar: order of §5.1…" (centring gap 110px).
- [ ] **Hero placeholders (later phases, by decision 2026-11-19):** star rating from shared recipes (multi-user phase); prep progress from Modo Cocina's stepper. They stay unmarked until then.
- [ ] **Parser keeps the full time window** ("Entre 7 a 8 am" → 07:00–08:00); today only the start is stored (`pdf-plan.ts` parseTimeWindow).
- [ ] **Possible bug (hero pager):** if the last meal is removed while it's shown, the index clamp leaves no pager dot selected. Kept as-is by Gate 2 decision (dashboard-real-data REQ-22); needs a bug-fix route if the user wants it fixed.

## Dashboard redesign (on `main` since PR #13; follow-ups)

Plan, reference, screenshots and the delivery summary are in `specs/alt-dashboard/` (`entrega.md`). Built outside the spec route at the user's request: the plan is the spec. Not re-checked since the merge:

- [ ] Old e2e specs written for the previous shell and home (theme-palette, theme-switch, a-theme-visual snapshots, assistant-parity/look and others) still reference removed elements (`.home-*`, "Editar horarios", weight popover). They need a rewrite or removal per test.
- [ ] Open questions in `entrega.md` (emblem approval, real photos, real calories/protein, visual-only cards).
- [ ] **E2E debt from 2026-11-15:**
  - `dashboard.spec.ts` screenshots can catch the KPI entrance mid-flight: pass `animations: "disabled"` to `page.screenshot`, make the `settle` helper tolerate cancelled animations, then regenerate `specs/alt-dashboard/screenshots/`.
  - The top-bar test (first in the serial file, so it skips the rest) still expects the old centring and a "Notas" button.
  - Nothing covers 768–937px wide (the compact range) or 860–899px tall.
- [ ] **Calories card clipped between 860 and 899px tall** (up to about 40px at 860). Option: keep the compact card layout up to about 916px tall, which changes the look at 1440×900. Needs the user. See `specs/bugs/dashboard-fit-scroll.md`.
- [ ] **Not yet seen in a browser by an agent:** the 768–937px look and the plate's cut edge at short heights.

## Needs the user

- [ ] **Metric dials: status vs code.** The spec is now `implemented` (the user, 2026-11-18), but only US1 (read-only dials) is in the code. US2 "Meta de peso" (with its `weight_goal_months` migration), US3 (Peso edited on the dial) and US4 (goal mark and line) were not built, and the Progress list in `specs/metric-dials/spec.md` is unticked. Decide: drop them through a spec-change (and revert the uncommitted v1.9.2 amendment in `specs/assistant-data-scope/spec.md` if it is still there), or keep them as a new feature.
- [ ] **Modo Cocina: phone check and e2e.** Merged in PR #13, spec still `partial`: `specs/cooking-mode/checklists/manual.md` and `tests/e2e/cooking-mode.spec.ts` (written, not yet run) are left before `implemented`.
- [ ] **Manual phone check** for the assistant (13 items, `specs/assistant-chat-polish/tasks.md` T041): iPhone Safari + VoiceOver, Android Chrome + TalkBack.
- [ ] **Restart Claude Code** so the new speed rules load. These are scout and size triage before grilling, sub-batches of about 300 lines, running only the affected tests while iterating plus one full run per batch, tests shown failing on purpose, and minor findings folded into the next batch. They live in `.claude/agents/*.md` and `docs/agent-workflow.md`, both versioned since 2026-11-18.
- [ ] **Decide on uncommitted local changes** that have been kept out of every commit so far: the deletion of `src/server.js` and `package.json` dropping the `legacy:dev` script (both inside `stash@{0}`).

## E2E infrastructure (follow-ups from `refactor/e2e-db-per-worker`)

- [ ] **Cross-worktree collision (MEDIUM, destructive).** The run lock lives per checkout, but ports 3200-3202 and the `<name>-e2e*` databases are shared by every checkout and worktree. A second checkout's setup or teardown (`DROP … WITH (FORCE)`) can kill a live run elsewhere. Fix: a lock in the OS temp dir keyed by the database name, or a per-checkout port and database suffix. Until then, run e2e from one session at a time.
- [ ] **`tsconfig.json` dirtied by every run:** `next dev` adds `.next-e2e-<i>/types/**/*.ts`. Commit those includes once, or keep restoring the file after runs.
- [ ] **Flaky `upload-wizard-checks.spec.ts:145`** ("DELETE fails", focus on the X button): `toBeFocused` sometimes gets "inactive".
- [ ] **Deterministic seed data** instead of cloning the real database, so data- and time-dependent failures go away.

## Assistant chat (follow-ups)

- [ ] **Optional spec-change:** combined questions on a recipe page ("¿Qué lleva y cómo se hace?") currently show only Preparación (today's narrowing rule, kept by spec v1.4). Decide whether they should show both sections.
- [ ] **Safe areas:** the app sets no `viewport-fit=cover`, so `env(safe-area-inset-*)` is 0; the REQ-15 safe-area check is weak.

## Shopping list

Findings, with file:line references: `specs/bugs/shopping-list-findings.md`.

- [ ] **Pre-existing e2e failures on main** (found 2026-10-24 reviewing #2, fail without the fix too). Serial mode skips every later test when they fail:
  - `dashboard.spec.ts:213` "the newest shopping list can be checked off": the newest list in the cloned data has 0 items, so `.home-shop .home-count` never appears. The test depends on the data.
  - `dashboard.spec.ts:91` "intake rings count the equivalents of meals marked done": gets 7, expects > 7. Probably depends on the time of day. Not stash-checked.
  - `dashboard.spec.ts:848` "Modo Cocina pill": expects the pill title "Modo Cocina", gets "Abrir Modo Cocina" (found 2026-11-19 in US1c, stash-checked).
  - `cooking-mode.spec.ts:68` REQ-1/2/6/8/10: `getByText('Paso 1 de 2')` matches 2 elements (strict mode) (2026-11-19, stash-checked).
  - `cooking-mode.spec.ts:171` REQ-21/22/23/25: expects `step-0`, gets `step-1` (2026-11-19, stash-checked).
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

- 2026-11-19: **Dashboard polish** merged as PR #16 (spec `implemented`): one-tap "Marcar cumplida", Racha KPI, Modo Cocina glass pill.
- 2026-11-18: **E2E database and server per worker** (`refactor/e2e-db-per-worker`): 3 workers by default (`E2E_WORKERS`), full suite 32.9 → about 18 min with the same results. Note: `specs/refactors/e2e-db-per-worker.md`.
- 2026-11-18: **Upload wizard stepper** merged as PR #12 (spec v1.3.4 `implemented`; T016 e2e gate passed). **Dashboard redesign, Modo Cocina and metric dials (US1)** merged as PR #13 (`alt-dashboard`).
- 2026-11-18: **`specs/`, `docs/` and `.claude/` versioned** (`refactor/version-specs-docs-agents`): they were gitignored since `c006995`, so specs for cooking-mode, metric-dials and upload-wizard-stepper, the PRD and the agent definitions existed only on this machine. Note: `specs/refactors/version-specs-docs-agents.md`.

- 2026-11-15: **`alt-dashboard` session** (all on the branch, not pushed): KPI tiles in glass (`05e2f46`); the `prefers-reduced-motion` rule removed from `CLAUDE.md` at the user's request (`2046b9c`); playful KPI tile motion, CSS only, with three e2e tests (`1caee72`); hairline on the profile pill (`c0ffcd2`); dashboard fits wide, short windows without a page scrollbar (`a2560ec`, note `specs/bugs/dashboard-fit-scroll.md`); "Notas" button removed (`e6e7708`); compact breakpoint moved from 767px to 937px project-wide with a `CLAUDE.md` rule and Tailwind `md` at 938px (`f3a71b7`).

- 2026-11-14: **E2E run guard** merged as PR #8 (`tests/e2e/run-lock.ts`, lock at config load, 10 unit tests; known limits in `specs/bugs/e2e-run-guard.md`). `stash@{0}` still holds the user's own unrelated changes (the `src/server.js` deletion and `package.json` dropping `legacy:dev`): never pop or drop it without the user.
- 2026-11-14: **Escape in popups** (`fix/escape-popups`, merged as PR #9): an open popup takes Escape first. Note: `specs/bugs/escape-popups.md`.
- 2026-11-14: **Period planner** (`fix/period-planner-days`, merged as PR #10): exact split (7 days x 2 recipes = 4+3), blocked when recipes > days, `period_days` min 1 on the server. Note: `specs/bugs/period-planner-days.md`; full e2e 403/403.

- 2026-11-14: **Assistant data scope** merged as PR #7 (`feature/assistant-data-scope`, spec v1.9.1, 91 of 91 task ids, unit 823/823, full e2e 399/399 at the T088 run). Status `implemented`; `assistant-chat-polish` closed with it (REQ-23 delivered). Future, not in this feature: conversation memory so "¿y la cena?" works (the design is stateless, so it can be added).

- 2026-11-14: **Constitution principle 1 amended** (unit tests are the fail-first proof, a Playwright e2e test at the end; the user's decision). **Spec v1.9.1** Progress refresh (91 of 91). **Cart snapshot made deterministic** (`specs/bugs/cart-snapshot-fixture.md`: seeded fixed cart, masked date and nav counts; baselines regenerated locally; full e2e 401/401).

- 2026-11-13: **Delete local branch `backup/assistant-9a-before-split`**: closed, nothing to delete (the branch no longer existed when checked).

- 2026-10-28: **Assistant chat polish**, `feature/assistant-chat-polish`, spec v1.8 implemented (22 REQs, US1–US5). Merged as PR #6 on 2026-10-28.

- 2026-10-23: **Theme switcher (light/dark)**, `feature/theme-switcher` (24 commits), merged as PR #1. Its visual snapshots (`tests/e2e/*-snapshots/`) are gitignored on purpose and stay local. It took about 8 h of agent time and about 2.3M subagent tokens. The retrospective led to the speed rules above.
- 2026-10-24: Speed rules added to the agent definitions and `docs/agent-workflow.md`, including small-feature limits in `verifier-spec` analyze mode.
- 2026-10-26: **Shopping cart quick fixes**, `fix/shopping-list-quick`, merged as PR #2. #2: soft-deleted recipes no longer count (restore brings them back). #5: a meal's add-ons count once, scaled by its largest option (planner 4+3 → ×4, accepted trade-off), plus the test hardening from review. Note: `specs/bugs/shopping-list-quick.md`.
- 2026-10-26: **Project docs**, `docs/agent-workflow`, merged as PR #3: `CLAUDE.md`, `CONSTITUTION.md`, `docs/agent-workflow.md`, this backlog and `specs/bugs/shopping-list-findings.md`.
