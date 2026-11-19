# Tasks: Metric dials

**Spec:** [spec.md](spec.md) v1.3 · **Plan:** [plan.md](plan.md) revision 3 (tasks unchanged in number; fixes in T002, T003, T005, T017, T020, T023, T024, T040, T041, T044, T045, T050, T052) · Renumbered in revision 2 (nothing implemented yet); the old-to-new id map is at the end.

Format: `- [ ] T### [P] [US#] Description (files)`, then **REQ** and **Done** (the command or observation that proves it). `[P]` only where a group says why.

**Global rules**
- **Batches** of about 300 changed lines (tests included) or one feature area; each ends with a **Review point** (reviewer runs `npx tsc --noEmit`, `npm run test:unit` and the batch's e2e files) and its **Commit points**. A batch that passes its estimate by more than ~50 lines stops at the next task boundary and reports.
- **Tests first** (constitution 1): unit tests are committed red immediately before the code that turns them green (one-commit red window, never the batch tip). E2E tests are written before the UI code and shown red against the current UI; every new or changed test is shown red once by breaking the code it protects. Time in e2e uses `page.clock`, never real waits.
- **Working state at every commit** (plan "Approach"): one way to set the goal, one to log the weight, no call the server rejects, no link to something missing. The user's `next dev` on :3000 reads this tree.
- **While iterating:** `npx tsx --test tests/unit/<file>.test.ts`, `npx playwright test <file> -g "<title>"`. **Once per batch:** `npm run test:unit` and one `npm run test:e2e` (foreground, serial, never two at once, nothing left on :3200). Never `next build` in place, never `npm run dev`.
- **Commits** path-limited, one concern each, message `US1 T012 REQ-3: <summary>`; never `specs/`; never `git add -A`; never `git checkout -- <file>` on a file that may hold the user's uncommitted edits.
- **Stops** (marked **STOP**): only with the user's yes at that moment.
- UI copy verbatim from the spec (es-MX). Older e2e debt is out of scope (D16); failures recorded in T001 are not this feature's.
- **E2E runs (user's decision, 2026-11-16):** every e2e run of this feature excludes the pre-existing failing test by name and never edits, skips or fixes it: `npx playwright test tests/e2e/dashboard.spec.ts --grep-invert "top bar: order of"`; full run `npm run test:e2e -- --grep-invert "top bar: order of"`. Every agent that runs e2e first backs up `specs/alt-dashboard/screenshots/*.png` (the dashboard tests overwrite them and the user holds uncommitted versions) and restores them byte-identically afterwards (confirmed with `cmp`).

## Phase 1: Setup

- [x] T001 [setup] Baseline (no files)
  - `npx tsc --noEmit`; `npm run test:unit` (count); `npx playwright test tests/e2e/dashboard.spec.ts` once (triage list). **REQ** housekeeping. **Done** counts and failing titles in the batch note.

## Phase 2: Foundational

None: each pure module lands with its story's first batch (`dial-logic.ts` US1, `weight-goal.ts` US2, `peso-logic.ts` US3).

## Phase 3: US1 (P1) Read-only dials

### Batch 1a: dependency (vendored file + ~10 lines)

- [x] T002 [US1] **STOP (approved in D2; confirm before running):** snapshot, then install (package.json, package-lock.json, src/components/kokonutui/detent-dial.tsx)
  - First: `git status --porcelain` and copies of package.json, package-lock.json, components.json, src/app/globals.css, src/lib/utils.ts to the scratchpad; record the modification time of `src/generated/prisma/client.ts`. Then `npm_config_ignore_scripts=true npx shadcn@latest add https://kokonutui.com/r/detent-dial.json`, "no" to every overwrite prompt (fallback `npx shadcn add …` with the same variable). Scripts are off so `postinstall: prisma generate` does not rewrite `src/generated/prisma` under the :3000 server; the CLI's own `npm install` inherits the variable (plan "No `postinstall` before T019"); no generate is needed, the schema is unchanged until T018. Copy the CLI's component file to the scratchpad.
  - **REQ** REQ-10. **Done** snapshots and the component copy exist; exit 0; `git status` lists what the CLI wrote; the `client.ts` modification time is unchanged (if not, tell the user at once that :3000 may log errors or need a restart).
- [x] T003 [US1] Review the CLI diff, pin, Node 20 check (package.json, package-lock.json)
  - For each touched file: `diff <snapshot> <file>` and `git diff <file>` saved to the scratchpad **before** any revert; restore unrelated files by copying the snapshot back. Set `"motion": "<installed exact version>"`; `npm install --ignore-scripts`; lockfile adds only motion, framer-motion, motion-dom, motion-utils (tslib if absent). Checks of plan "The dependency". Any failure: back-out from snapshots (its `npm install` also `--ignore-scripts`), then **STOP** and ask.
  - **Node 20 smoke** (tests that exist now): `npx tsc --noEmit`; `npm run test:unit` with T001's count; `npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/zz-motion-clock.spec.ts` once (foreground, serial, no other e2e run; the dashboard tests load `/` under the e2e `next dev` with motion installed).
  - **Motion clock check**, right after the install, in that same run: the temporary `zz-motion-clock.spec.ts` of plan "Motion under `page.clock`" (clock installed, motion's browser bundle on a blank page, a tween and a spring sampled part-way, then final). Write the outcome and the method the glide tests will use (clock sampling, or the real-frame fallback) into plan.md "Clock check (T003)" now, before T011. Delete the spec; nothing left on :3200, no `-e2e` database.
  - **REQ** REQ-10. **Done** `grep '"motion": "[0-9]' package.json`; `node -v` v20.x; the tsx import prints `function function` (`motion` is a proxy function; `typeof m.motion.div` is `object`); `npx tsc --noEmit` clean; unit count as T001; dashboard.spec only T001's failing titles; "Clock check (T003)" filled; `git status` shows no zz-motion-clock file; the `src/generated/prisma/client.ts` modification time still as recorded in T002; the snapshot diffs of components.json, globals.css and utils.ts are empty.
- [x] T004 [US1] Move the file verbatim, add the notice (src/components/nutrio/DetentDial.tsx, THIRD_PARTY_NOTICES)
  - **REQ** REQ-10, housekeeping. **Done** `diff <scratchpad copy> src/components/nutrio/DetentDial.tsx` empty; `npx tsc --noEmit`.

**Review point 1a.** **Commit point:** `US1 T003 REQ-10: add motion (pinned) and the Kokonut detent dial, verbatim`. Done 2026-11-16: reviewer PASS, commit `4d5f865`. Baseline (T001): type check clean, 876 unit tests, `dashboard.spec.ts` 29 pass with the pre-existing "top bar: order of" failure excluded.

### Batch 1b: measuring and the size decision (nothing committed)

- [x] T005 [US1] Measure in the e2e environment, record in plan.md "Measured (T005)" (temporary, uncommitted tests/e2e/zz-measure-dials.spec.ts; specs/metric-dials/plan.md)
  - Inject CSS reproducing the planned tile (readout row, D box, name, two-line line, − / + beside the dial; under it on compact). Largest D per window (1440×900, 1440×780, 1280×768, 1920×1080, 1920×800) with no page scroll and no clipped card, for **both options**: (a) fit-first with the 16px inside rule, (b) relaxed inside rule so all four readouts sit in the knob and the dials grow; D at 859 and 860 tall; tile widths at 360, 390, 937, 938, 1024; calibrate c with "≈ 12,345 kcal", "150.0 kg", "Meta 149.9 kg · faltan 119.9 kg"; Tab stops from "+" to the next control and to the toaster; a sonner top-right toast box (width 356, offsets 24/16px) against the − / + boxes at the five sizes, 390×844 and 360×800, at scroll 0 and with the Peso tile just below the sticky top bar; if it covers them, the bottom-centre box against the assistant button at 360px. Screenshots of (a) and (b) at the five sizes and 390×844. Run it with `npx playwright test zz-measure-dials` in the foreground, serial (the config's one worker), never alongside another e2e run; delete the spec afterwards.
  - **REQ** REQ-8, 9, 33, 45 (inputs), REQ-27 (toast reach). **Done** plan section filled; the provisional arithmetic (73 at 1440×900, 92 at 1920×800, the 859/860 step) confirmed or replaced; nothing left behind: `git status` shows no zz-measure file, nothing listens on :3200 (`lsof -i :3200` empty), no `*-e2e` database (`psql -l`).
- [x] T006 [US1] **STOP (always, D21a):** the user picks option (a) or (b) from the T005 screenshots and numbers, and sees the 859/860 step; record the choice, F_min, sizes and the toast position (top-right, or bottom-centre only if T005 found top-right covers − / +; a bottom-centre box over the assistant button is put to the user as a new question) in plan.md "Chosen (T006)" (specs/metric-dials/plan.md)
  - **REQ** REQ-9 (D4 priority), REQ-8. **Done** decision recorded; the inside rule is per row (D21b).

**Review point 1b** (planner or orchestrator reads the numbers; no code).

### Batch 1c: readouts, layout rules, tokens (~260 lines)

- [x] T007 [US1] Unit tests, red (tests/unit/metrics.test.ts, tests/unit/dial-logic.test.ts, tests/unit/dial-contrast.test.ts)
  - metrics: 25/32 → "78%", "25 de 32 comidas"; 26/32 → "81%"; 1/1 → "100%", "1 de 1 comida"; 0.78125 × 1,850 → "≈ 1,445 kcal", "meta 1,850 kcal"; × 112 g → "≈ 88 g", "meta 112 g"; no logs → "—", needle 0; no kcal target → Calorías and Proteína "—" without line; logged days, 0 done → "0%", "0 de 32 comidas", "≈ 0 kcal" with line, "≈ 0 g"; meter values per the REQ-43 table; without data min 0, max 100, now 0, text "Sin datos".
  - dial-logic: per-row inside rule (one dial failing puts all four above), end-label rule, readout font rule, with the T006 constants (a case each side of every threshold; "≈ 12,345 kcal" at the 360px tile ≥ 14px).
  - dial-contrast: parses tokens.css light and dark; each accent and dial token vs `--nt-ink-sub` in both themes: text ≥ 4.5, graphics ≥ 3.
  - **REQ** REQ-3, 4, 5, 6, 8, 9, 43, 44, 45. **Done** the three files red for the missing functions or tokens.
- [x] T008 [P] [US1] Readouts and meter values (src/lib/metrics.ts)
  - **REQ** REQ-3, 4, 5, 6, 43. **Done** `npx tsx --test tests/unit/metrics.test.ts` green.
- [x] T009 [P] [US1] Layout rules (src/components/nutrio/dial-logic.ts)
  - **REQ** REQ-8, 9, 45. **Done** `npx tsx --test tests/unit/dial-logic.test.ts` green.
- [x] T010 [P] [US1] Dial tokens (src/components/nutrio/tokens.css)
  - **REQ** REQ-1, 44. **Done** `npx tsx --test tests/unit/dial-contrast.test.ts` green.
  - `[P]` group T008/T009/T010: three source files, each turned green by its own test file from T007; no shared code.

**Review point 1c.** Done 2026-11-17: `npx tsc --noEmit` clean, `npm run test:unit` 892 pass (876 + 16 new), commits `953d62c` (red), `637da4b`, `8ec2cfb`, `ecc1bc5`. Unit run on Node 22 in the cloud clone; re-run on the Mac (Node 20) at the next e2e run. **Commit points:** `US1 T007 REQ-3: failing readout, layout and contrast tests`, then `US1 T008 REQ-3: …`, `US1 T009 REQ-8: …`, `US1 T010 REQ-44: …`.

### Batch 1d: our copy of the dial (~250 lines; not yet rendered)

- [x] T011 [US1] Dashboard look and read-only mode (src/components/nutrio/DetentDial.tsx, src/components/nutrio/detent-dial.css)
  - Plan "Our copy of the dial": `nt-dial-*` classes replace every stock Tailwind class; `readOnly` as a meter (no handlers, no tabindex, `touch-action: auto`); `readout`, `readoutPlacement`, `endLabels`, `formatEnd`, `valueText`; size from `--nt-dial-size`; programmatic moves glide and emit nothing; no entrance animation; `disabled`, `defaultValue`, in-knob label and double-click removed. No tile renders it yet, so no behaviour changes in this batch; the e2e of T012 proves it.
  - **REQ** REQ-1, 2, 7, 8, 43, 52 (glide mechanism). **Done** `grep -E "zinc|orange-|dark:" src/components/nutrio/DetentDial.tsx` empty; `npx tsc --noEmit`; dashboard e2e unchanged against T001.

**Review point 1d.** Done 2026-11-17: grep for stock colours empty, `npx tsc --noEmit` clean, commit `e82e6fb`; the dashboard e2e check is deferred to the batch 1e run on the Mac (the dial is not rendered yet). **Commit point:** `US1 T011 REQ-1: dashboard look and read-only mode for the dial`.

### Batch 1e: the dial on three tiles (~330 lines; CSS and dashboard area)

- [x] T012 [US1] E2E, written first and shown red (tests/e2e/metric-dials.spec.ts, tests/e2e/dashboard.spec.ts)
  - Rewrites in dashboard.spec.ts: ≈262 ("N de M comidas"), 352-363 (four tiles by name, tabs, values by `aria-valuetext`), 409-420 (five sizes fit, dial tiles in the clipped list, three dials equal), 456 (empty state).
  - New: `meter`, not `slider`, not focusable (Tab from the tabs never lands on them); drag, click and wheel change nothing and send no request; REQ-43 names and values with 25 of 32 meals and kcal 1,850 (SQL, restored), "Sin datos" without data; computed colours of fill, ticks, knob, text and end labels are token values, none `oklch(`, light and dark; **glide** with `page.clock`: after a tab change the indicator's rotation is strictly between the old and new angles after ≈100 ms, final after 2 s; with reduced motion final after one frame; end labels at and below the threshold; 390×844 and 937px 2×2, 938px four across, 360px no horizontal scroll; "≈ 12,345 kcal" not clipped at 360 and 938; 720×450 and 844×390 reflow; theme switch leaves dial colours unchanged.
  - **REQ** REQ-1, 2, 3, 4, 5, 6, 7, 8, 9, 43, 44, 45. **Done** `npx playwright test metric-dials` red against the old gauges.
- [x] T013 [US1] Tiles and layout (src/components/nutrio/DataColumn.tsx, src/components/nutrio/dashboard.css)
  - Read-only tiles for Adherencia, Calorías, Proteína from `metricReadouts`; Peso keeps `GaugeTile` and the modal (interim); `--nt-dial-size` per tier from T006; compact 2×2; readout fit with container units; white focus rule extended.
  - **REQ** REQ-1, 2, 3, 4, 5, 6, 7, 8, 9, 43, 44, 45. **Done** `npx playwright test metric-dials dashboard` green except T001's known failures.
- [x] T014 [US1] Pointer under §5.5 of specs/alt-dashboard/plan.md to specs/metric-dials/spec.md (local, not committed)
  - **REQ** housekeeping. **Done** one line added.
- [x] T015 [US1] Story e2e: `npm run test:e2e` once; triage against T001 (no files)
  - **REQ** REQ-10. **Done** only T001's known failures remain.

**Review point 1e.** Done 2026-11-17: T012 red (21 new metric-dials tests + 4 dashboard rewrites failed for missing meters), commit `df784d9`; T013 reviewer PASS (no blocking; MEDIUM: `readoutPlacement`/`aboveFont` and DetentDial's "above" branch unused under option (c), decide delete vs wire via spec-change; T013 also changed DetentDial.tsx: read-only `aria-valuenow` = clamped prop; LOW: plan's 859/860 step is now 899/900, duplicate 1280/899 media block), commit `7287759`; `npx tsc --noEmit` clean, unit 892/892, metric-dials 23/23. T014 pointer added (local). T015 full run (`--grep-invert "top bar: order of"`): 347 passed, 61 failed, 28 did not run (22.1 min); all failures are in the old specs BACKLOG lists as stale after the redesign (theme-palette 37, a-theme-visual 10, assistant-a11y 5, assistant-look 4, theme-switch 2, assistant-noscope 1, assistant-parity 1) plus the intermittent dashboard "KPI tile lifts" (also fails at HEAD before T013). No full-suite baseline existed before this run. Screenshots restored byte-identically. **Commit points:** `US1 T012 REQ-2: failing read-only dial e2e`, `US1 T013 REQ-9: Adherencia, Calorías and Proteína on dials`.

**Checkpoint:** US1 complete (interim: Peso keeps its gauge and modal).

## Phase 4: US2 (P2) Meta de peso

### Batch 2a: direction rule (~250 lines)

- [ ] T016 [US2] Unit tests, red (tests/unit/weight-goal.test.ts)
  - `toTenths` (70.04 → 70.0, 70.05 → 70.1); `latestWeight` (72.0 Nov 3, empty Nov 10 → 72.0); `latestRow` (Nov inserted before Oct → Nov); `goalDirection`: matching row; differing row (row 70 lose, goal 80, W 74.5 → gain); no row (70/74.5 lose; 80 or 74.5 gain; no W gain); no goal → null with a row; flip at W 69. `validateGoal` with W 74.5 (every REQ-13 case and text), no W (gain 40, gain 30, lose 150), missing fields. `inheritedNote` (Oct 2026 on 1 Dec 2026; Oct 2025 on 15 Nov 2026 with the year; same month null; row goal ≠ active null). `inferDirection` for the REQ-16 cases.
  - **REQ** REQ-12, 13, 14, 15, 16, 17, 20, 47. **Done** red for the missing module.
- [ ] T017 [US2] Direction rule and the history-row type (src/lib/weight-goal.ts, src/lib/types.ts)
  - Adds `WeightGoalMonthRecord` (the history-row values `weight-goal.ts` takes) to types.ts; the AppDb collection key stays for T020, after the migration.
  - **REQ** REQ-12, 13, 14, 15, 16, 17, 20, 47. **Done** `npx tsx --test tests/unit/weight-goal.test.ts` green; `npx tsc --noEmit` clean.

**Review point 2a.** **Commit points:** `US2 T016 REQ-17: failing direction rule tests`, `US2 T017 REQ-17: shared direction and goal validation`.

### Batch 2b: history table, migration, seed proof (~280 lines)

- [ ] T018 [US2] Schema and migration file (prisma/schema.prisma, prisma/migrations/20261115120000_weight_goal_months/migration.sql)
  - Model and relation; `git show HEAD:prisma/schema.prisma > <scratchpad>/schema.head.prisma`; DDL from `npx prisma migrate diff --from-schema <scratchpad>/schema.head.prisma --to-schema prisma/schema.prisma --script` (offline, plan); CHECKs by hand; seed between `-- seed:begin` / `-- seed:end` with `ON CONFLICT DO NOTHING`. No `db:generate` here.
  - **REQ** REQ-16, 47. **Done** the diff output equals the DDL part of migration.sql; the HEAD copy kept in the scratchpad; migration read by the reviewer.
- [ ] T019 [US2] **STOP:** migration and client generation, with the user's yes (no files)
  - Ask with plan "Running it": the suggested `pg_dump`; `npm run db:migrate` (`prisma migrate dev`; never accept or run a reset; fallback `npx prisma migrate deploy`; cancel if it asks to name a new migration); what it changes; how to undo. Then `npm run db:generate`, warning that it rewrites `src/generated/prisma` under the running :3000 server, which may need a restart by the user.
  - **REQ** REQ-16. **Done** `psql` shows the table, unique index and checks; one Nov 2026 row per user with a goal; no row for users without one; `_prisma_migrations` has the row; `npx tsc --noEmit` sees the new model.
- [ ] T020 [US2] Storage wiring, after T019 (src/lib/types.ts, src/lib/storage/db.ts, src/lib/storage/store.ts, src/lib/domain/queries.ts, tests/unit/memdb.ts, tests/shared/assistant-fixture.ts, tests/unit/memdb.test.ts)
  - `memdb.test` `RECORD_KEYS.weightGoalMonths` red first; collection (the record type from T017), `emptyDb`, `models`, `insertOrder`, `scalarFields`; `needs.dashboard`, `needs.chat`, `needs.weightGoal`; `memDb({ goalRows })`.
  - **REQ** REQ-17, 47. **Done** memdb test green; `npm run test:unit`; the dashboard on :3000 still loads.
- [ ] T021 [US2] E2E helpers and seed proof (tests/e2e/assistant-helpers.ts, tests/e2e/weight-goal-seed.spec.ts)
  - Helpers: `setGoalRow`, `clearGoalRows`; `removeUserRows` deletes `weight_goal_months` first (FK RESTRICT). Seed proof per plan: synthetic users on the e2e clone (goal 70 / latest 74.5; 80 / 74.5; 74.5 / 74.5; goal and no weight; 72.0 then an empty-weight day; no goal; an existing Nov row (99, gain)), the statement read from migration.sql, each row compared with `inferDirection`, a second run changes nothing, users deleted in `finally`. Shown red by temporarily swapping 'lose'/'gain' in the seed block of migration.sql, then restoring the file byte for byte (`diff` against a scratchpad copy) before any further Prisma command, since the migration is already applied.
  - **REQ** REQ-16, 17, 47. **Done** `npx playwright test weight-goal-seed` green; existing assistant e2e that create chat users still green.

**Review point 2b.** **Commit points** (all after T019): `US2 T018 REQ-16: weight goal history table with the November seed`, `US2 T020 REQ-47: load the goal history with the dashboard and the assistant`, `US2 T021 REQ-16: seed proof and goal history helpers`.

### Batch 2c: goal API (~250 lines)

- [ ] T022 [US2] Unit tests, red (tests/unit/schemas.test.ts)
  - `goalsSchema` save with direction, year, month: 20, 29.9, 150.1, 70.55 rejected; 30 and 150 accepted; month 0, 13, 1.5 and year 1.5 rejected, year 1900 accepted (N-01); removal `{ weight_goal_kg: null }`; `activity_goal_days` alone accepted. The goal-only body stays accepted in this batch (transitional; its rejection is T027).
  - **REQ** REQ-13, 48. **Done** red.
- [ ] T023 [US2] API e2e, written first and shown red (tests/e2e/weight-goal.spec.ts)
  - Through `request.put`: save writes goal and one row for the sent month; same month replaces; removal clears the goal, keeps rows, writes none; W 74.5 Disminuir 74.6 → 400, nothing changed; 20 and 70.55, each sent with a direction, year and month → 400; transitional: a goal-only body `{ weight_goal_kg: 70 }` → 200, active goal 70, no row written (accepted until T028 removes that branch; T027 turns this case into a 400); two overlapping saves leave one row matching the active goal; another user's goal and rows untouched; a forced route failure logs `[api/goals]` with the operation and without the value (`serverLog()`).
  - **REQ** REQ-12, 13, 15, 41 (goal), 47, 48, Privacy. **Done** `npx playwright test weight-goal -g "API"` red.
- [ ] T024 [US2] Goal write (src/lib/validation/schemas.ts, src/app/api/goals/route.ts)
  - Plan "Interfaces": session user only, latest weight from that user's logs, `validateGoal`, transaction, removal writes no row, transitional goal-only branch (20–400), logging without values. Between T024 and T028 a goal-only body is accepted from 20 to 400 (active goal only, no row): a documented, temporary departure from REQ-13 and REQ-48, kept so the modal still saves the goal until T028 removes its call and this branch together.
  - **REQ** REQ-12, 13, 15, 17, 41, 47, 48, Privacy. **Done** T022 and T023 green; the modal's goal save on :3000 still works.

**Review point 2c.** **Commit points:** `US2 T022 REQ-48: failing goal schema tests`, `US2 T023 REQ-12: failing goal API e2e`, `US2 T024 REQ-12: atomic goal and history write`.

### Batch 2d: Meta de peso in Configuración (~330 lines; settings area)

- [ ] T025 [US2] UI e2e, written first and shown red (tests/e2e/weight-goal.spec.ts)
  - W 74.5: "Tu peso actual: 74.5 kg", empty fields; no weight: "Aún no registras tu peso."; the "Objetivo" group by role; save Disminuir 70 → "Meta guardada" announced, focus unchanged, one row for the browser's month; save Aumentar 80 → still one row; inline refusals (both empty: two messages, focus on the choice; Disminuir 74.6: under "Meta (kg)", focus there; `aria-describedby`, cleared on change); "Quitar meta": "Meta quitada", fields empty, row kept, button disabled without a goal; inherited note (Oct row, Oct 2025 with the year) with `page.clock`; goal set by SQL with no row shows the inferred direction; failed save and removal via `page.route`: fields kept, toasts, nothing changed, and a console error naming `save-goal` / `remove-goal` that contains neither "70" nor the typed number; buttons disabled while in flight.
  - **REQ** REQ-11, 12, 13, 14, 15, 17, 37, 38, 46, Privacy. **Done** `npx playwright test weight-goal -g "Meta de peso"` red.
- [ ] T026 [US2] Form and page (src/components/settings/WeightGoalForm.tsx, src/components/settings/weight-goal.css, src/app/(dashboard)/settings/page.tsx)
  - Plan "Meta de peso" bullet and "Logging and privacy"; `article.card` like the other sections; `loadFor(user, "settings", "weightGoal")`.
  - **REQ** REQ-11, 12, 13, 14, 15, 37, 38, 46, Privacy. **Done** `npx playwright test weight-goal` green.

**Review point 2d.** **Commit points:** `US2 T025 REQ-46: failing Meta de peso e2e`, `US2 T026 REQ-11: Meta de peso in Configuración`.

### Batch 2e: close the old goal path (~100 lines)

- [ ] T027 [US2] Tests, red (tests/unit/schemas.test.ts, tests/e2e/dashboard.spec.ts, tests/e2e/weight-goal.spec.ts)
  - Unit: a goal without direction is rejected. E2E: dashboard.spec 366-375, the modal shows only "Peso de hoy (kg)" and saving it sends no `/api/goals` request; API: goal-only body → 400, nothing changed.
  - **REQ** REQ-17, 48. **Done** red.
- [ ] T028 [US2] Modal without "Meta (kg)" and the goal-only branch removed, in one commit (src/components/nutrio/DataColumn.tsx, src/components/nutrio/Dashboard.tsx, src/lib/validation/schemas.ts)
  - `saveWeight(weight)` no longer calls `/api/goals`; the schema drops the transitional branch.
  - **REQ** REQ-17, 48. **Done** T027 green; on :3000 the weight saves through the modal and the goal through Configuración.

**Review point 2e.** **Commit points:** `US2 T027 REQ-48: failing goal-without-direction tests`, `US2 T028 REQ-48: the modal no longer edits the goal`.

### Batch 2f: assistant link (~120 lines)

- [ ] T029 [US2] Tests, red (tests/unit/chat-metrics.test.ts, tests/e2e/assistant-progress.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - Unit: "Fijar mi meta" → `/settings#meta-de-peso` in the weight and goals answers (rows ≈240, 250, 434); "Registrar mi peso" stays "/". E2E: rewrite `assistant-progress.spec.ts:69` and `assistant-a11y.spec.ts:1112` to the settings href; choosing "Fijar mi meta" lands with "Meta de peso" in view.
  - **REQ** REQ-18. **Done** red.
- [ ] T030 [US2] Assistant link (src/lib/domain/chat-metrics.ts)
  - **REQ** REQ-18. **Done** T029 green.
- [ ] T031 [US2] Story e2e: `npm run test:e2e` once (no files)
  - **REQ** REQ-11 to 18, 37, 38, 46 to 48. **Done** only T001's known failures remain.

**Review point 2f.** **Commit points:** `US2 T029 REQ-18: failing Fijar mi meta tests`, `US2 T030 REQ-18: Fijar mi meta opens Meta de peso`.

**Checkpoint:** US2 complete (interim: the modal holds only "Peso de hoy (kg)").

## Phase 5: US3 (P2) Peso on the dial

### Batch 3a: limits and steps, pure (~230 lines)

- [ ] T032 [US3] Unit tests, red (tests/unit/peso-logic.test.ts, tests/unit/dial-logic.test.ts)
  - `dialLimits`: every REQ-22 example (30–35 for W 25, 27, 28; 145–150 for 155, 160; 30–75 for W 25 Aumentar 70; after Quitar meta W 80 → 75–85). `restingValue`: no W 50; Disminuir 70 → 65; Aumentar 40 → 45; W 28.0 → 30; 160.5 → 150. Limits only from the confirmed weight (W 80 → 68 → 63–73). `pageStep` and clamps (REQ-25). `holdSteps(1050)` = 8, stop at the limit. `savesNothing` (D21f): needle never moved; moved and back to the stored 71.0; stored 70.04 and end 70.0; no weight, moved, end 50.0 → saves 50.0; stored 28.0, needle 30, moved, end 30.0 → saves 30.0.
  - **REQ** REQ-15, 21, 22, 23, 24, 25, 26, 27, 50. **Done** red.
- [ ] T033 [US3] Limits and steps (src/components/nutrio/peso-logic.ts, src/components/nutrio/dial-logic.ts)
  - **REQ** REQ-21, 22, 23, 24, 25, 26, 27, 50. **Done** both files green.

**Review point 3a.** **Commit points:** `US3 T032 REQ-22: failing limits and steps tests`, `US3 T033 REQ-22: Peso limits, resting value, steps and no-op rule`.

### Batch 3b: save timing, pure (~260 lines)

- [ ] T034 [US3] Unit tests, red (tests/unit/peso-logic.test.ts)
  - Gesture scheduler, injected clock: keys at 0, 500, 1,000 → one send at 1,600; release then settle sends once at settle; flush in the pause or the coast sends the pending or target value at once. Save queue: one in flight, latest pending coalesced; the four REQ-40 outcomes (dial values, stored value); toast decisions per plan (D21h: save 1 fails, save 2 succeeds → error kept and Deshacer shown; a success replaces an older Deshacer; an error replaces a Deshacer); undo target (71.0 → 71.5 → 71.2 restores 71.5; overlapping 71.5/72.0 restores 71.5). Pausable timer: expiry at 8 s; paused 5–20 s → expires at 23 s.
  - **REQ** REQ-27, 29, 30, 40, 51. **Done** red.
- [ ] T035 [US3] Save timing (src/components/nutrio/peso-logic.ts)
  - **REQ** REQ-27, 29, 30, 40, 51. **Done** `npx tsx --test tests/unit/peso-logic.test.ts` green.

**Review point 3b.** **Commit points:** `US3 T034 REQ-27: failing gesture and save queue tests`, `US3 T035 REQ-27: gesture grouping, save queue and pausable timer`.

### Batch 3c: previous value and restore, server (~250 lines)

- [ ] T036 [US3] Unit tests, red (tests/unit/schemas.test.ts)
  - Restore: 28.0, 28.04 (unchanged) and null accepted; 500 and 19.9 rejected; `had_record: false` with a number rejected; `today` different from the date rejected (D21c).
  - **REQ** REQ-32. **Done** red.
- [ ] T037 [US3] API e2e, written first and shown red (tests/e2e/peso-dial.spec.ts)
  - Plain save returns `previous` (with and without a record today), one record for today, a second save overwrites. Restore: 28.0 and 28.04 stored unchanged; null on a day with a weight clears it; `had_record: false` on an empty row deletes it; with a meal ticked keeps the row and clears only the weight; `today` ≠ date → 400; 500 or 19.9 → 400; nothing changed on each 400.
  - **REQ** REQ-28, 29, 32. **Done** `npx playwright test peso-dial -g "API"` red.
- [ ] T038 [US3] `previous` on the plain save and the restore route (src/lib/validation/schemas.ts, src/app/api/daily-logs/[date]/route.ts, src/app/api/daily-logs/[date]/weight-restore/route.ts)
  - Plan "Interfaces" (20–400 kept on the plain save until T047; conditional delete as the soft-delete exception; logging).
  - **REQ** REQ-28, 29, 32, Privacy. **Done** T036 and T037 green; the modal's save on :3000 unchanged.

**Review point 3c.** **Commit points:** `US3 T036 REQ-32: failing restore schema tests`, `US3 T037 REQ-29: failing restore API e2e`, `US3 T038 REQ-29: previous weight and the Deshacer restore operation`.

### Batch 3d: slider mode of our dial (~150 lines; not yet rendered as a slider)

- [ ] T039 [US3] Slider additions (src/components/nutrio/DetentDial.tsx, src/components/nutrio/detent-dial.css)
  - `onValueChange(value, source)`, `onRelease`, `onSettle`, `knobRef`; slider aria with the limits; grab look; rescale glide; `touch-action: none` on the knob only; PageUp/PageDown from `pageStep`. No tile uses slider mode yet, so no behaviour changes; T040 proves it.
  - **REQ** REQ-25, 27, 31, 43, 49, 50, 52. **Done** `npx tsc --noEmit`; `npx playwright test metric-dials` still green.

**Review point 3d.** **Commit point:** `US3 T039 REQ-49: slider events and focus for the dial`.

### Batch 3e: the Peso tile (~450 lines; one feature area, the Peso tile)

- [ ] T040 [US3] E2E and the Peso metrics unit cases, written first and shown red (tests/e2e/peso-dial.spec.ts, tests/e2e/dashboard.spec.ts, tests/unit/metrics.test.ts)
  - Unit (`metrics.test.ts`, red until T041): "Peso uses the latest weight whatever the tab" (72.0 logged Nov 10, none since: 72.0 on every period tab, where today's code gives the period's last weight or null), "Peso has no progress ratio" (the weight metric carries no `ratio`, with or without a goal), "Peso without any weight is null"; the existing `m.weight.ratio` assertions (≈ lines 29, 43, 50, 56, including "weight moving away from the goal clamps at 0") are removed or rewritten to these (REQ-20, 36).
  - No dialog on click or Enter; "72.0 kg" whatever the tab; "—" with the needle at 50 / 65 / 45; limits from the direction, including a goal set by SQL with no row (inferred); drag 71.0 → 71.5 saves once; ArrowUp at 0, 500, 1,000 ms → one save at 1,600 (`page.clock`); ArrowUp ×5, PageUp/PageDown, Home/End at 66–76; wheel only when focused; double-click saves nothing; + once 71.1; hold 1,050 ms → 71.8 (`page.clock`); hold to 76.0 with + `aria-disabled` and focus kept; overshoot returns to 76.0; D21f cases (no move, back to the stored value: no request; 50.0 and 30.0 saved); rescale to 63–73 with the glide sampled as in T012; W 28.0 / 160.5 at the ends with the real readout; computed `touch-action` `none` on the knob and not on the card, and a swipe outside the knob scrolls at 390×844; focus order tabs → knob → "Bajar 0.1 kg" → "Subir 0.1 kg", ring ≥ 3:1, not clipped; slider min/max/value and "Sin registro de peso"; 44×44 at 390 and 360; "150.0 kg" with − and + at 360; five sizes fit with four equal dials; Peso fill equals the orange token; a failed save glides back to 71.0, shows "No se pudo guardar tu peso. Intenta de nuevo.", leaves the limits, and logs `save-weight` without "71.5". dashboard.spec 366-375: the modal test replaced by the dial save.
  - **REQ** REQ-1 (Peso), 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 33, 36, 43 (Peso), 44 (focus), 49, 50, 52, Privacy. **Done** `npx playwright test peso-dial` red for the UI rows; `npx tsx --test tests/unit/metrics.test.ts` red for the three Peso cases only.
- [ ] T041 [US3] Peso tile, hook and confirmed weight state (src/components/nutrio/PesoTile.tsx, src/components/nutrio/usePesoDial.ts, src/components/nutrio/useDailyLogs.ts, src/components/nutrio/DataColumn.tsx, src/components/nutrio/Dashboard.tsx, src/components/nutrio/dashboard.css, src/lib/metrics.ts, src/app/(dashboard)/page.tsx)
  - Dial, − / + (`aria-disabled`, hold schedule), scheduler and queue from `peso-logic`; `useDailyLogs` weight save returns the response and throws to its caller, `apply`/`drop` for confirmed results, meal saves unchanged; failure revert, error toast and log; `metrics` Peso uses the latest weight and loses `ratio`; the page passes the direction from `goalDirection`; `Dashboard` drops the goal state; the orange accent.
  - **REQ** REQ-1, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 30, 33, 36, 49, 50, 52, Privacy. **Done** `npx playwright test peso-dial` green; `npx tsx --test tests/unit/metrics.test.ts` green, including "Peso uses the latest weight whatever the tab", "Peso has no progress ratio" and "Peso without any weight is null" from T040. **Interim until T045 (plan "Working state"):** a successful dial save shows no confirmation (no Deshacer toast yet); a failed save reverts and shows its error toast. Checked on :3000.

**Review point 3e.** **Commit points:** `US3 T040 REQ-25: failing Peso dial e2e`, `US3 T041 REQ-27: Peso edited on the dial`.

### Batch 3f: overlapping saves, two tabs, leaving (~220 lines)

- [ ] T042 [US3] E2E, written first and shown red (tests/e2e/peso-dial.spec.ts)
  - In flight (delayed with `page.route`): the dial shows 72.0 throughout; both succeed → 72.0 stored, one record; first fails, second succeeds → dial 72.0, stored 72.0, error toast; first succeeds, second fails → dial back to 71.5; both fail → 71.0. Two tabs (two pages, one context): A 71.5, B 72.0 → 72.0 stored, A shows 71.5 until reload, no errors. Leaving 200 ms after ArrowUp sends the save at once; leaving while coasting sends the target; a failed flush shows no toast and logs `flush-weight` without the value.
  - **REQ** REQ-27, 30, 40, 41, 52, Privacy. **Done** `npx playwright test peso-dial -g "flight|tabs|leave"` red.
- [ ] T043 [US3] Overlap, flush and logging in the hook (src/components/nutrio/usePesoDial.ts)
  - Queue outcomes wired to the dial (never revert to an older value), `pagehide`/hidden/unmount flush with `keepalive`, logs per plan.
  - **REQ** REQ-27, 30, 40, 41, 52, Privacy. **Done** T042 green.

**Review point 3f.** **Commit points:** `US3 T042 REQ-40: failing overlap, tabs and leave e2e`, `US3 T043 REQ-40: overlapping saves and the leave flush`.

### Batch 3g: Deshacer toast and announcements (~300 lines)

- [ ] T044 [US3] E2E, written first and shown red (tests/e2e/peso-dial.spec.ts)
  - "Peso guardado: 71.5 kg · Deshacer" announced politely; with `page.clock`: gone at 8 s, kept while hovered from 5 s to 20 s and gone at 23 s, kept while focused; **Tab walk:** from "+" Tab reaches the toast and "Deshacer", one more Tab leaves to the next element in document order (not back to "+" or the toast), Shift+Tab returns into it; closing while focused puts focus on the knob; **error toast** (failed save): Tab reaches it and its close button, the next Tab leaves forward in document order, no return to "+", and expiry or close while focused puts focus on the knob; **both toasts at once** (first save failed, second succeeded): Tab walks through both toasts' controls in DOM order and the Tab after the last leaves forward, Shift+Tab walks back through both, never a loop; **Alt+T path** (known limit, plan Risks): Alt+T focuses the toast list, Tab reaches "Deshacer", the Tab after the last control returns focus once to the element focused before Alt+T, the next Tab moves forward in document order, and a later Tab into the toast and out of it leaves forward (no second return); Deshacer restores 71.0, no weight (dial 72.0 from Nov 10, or "—" at 50), 28.0, 71.5 after 71.0 → 71.5 → 71.2, 71.5 after overlapping 71.5/72.0, and "—" on the three read-only dials for a day with no record; "Peso, 71.0 kg" announced and no toast after Deshacer; the needle glides on Deshacer; a failed Deshacer keeps 71.5, shows its error in place of the Deshacer toast and logs `undo-weight` without the values; **REQ-40 with D21h:** first save fails, second succeeds → both the error toast and "Peso guardado: 72.0 kg · Deshacer" show; a newer success replaces an older Deshacer toast; two tabs: Deshacer in A gives 71.0, B catches up on reload; the toast at the T006 position never covers − / + at 1440×900 and 390×844 (two scroll positions).
  - **REQ** REQ-27, 29, 39, 40, 41, 51, 52, Privacy. **Done** `npx playwright test peso-dial -g "Deshacer|toast"` red.
- [ ] T045 [US3] Toast and announcements (src/components/nutrio/WeightToast.tsx, src/components/nutrio/usePesoDial.ts, src/components/nutrio/PesoTile.tsx, src/components/nutrio/dashboard.css)
  - Plan "Toasts, focus and announcements": `toast.custom` with `dismissible: false` and `data-dismissible="false"` on its focusables for the Deshacer toast and for the weight error toasts (failed save, failed Deshacer: `WeightToast` error variant, id "nt-weight-error", its own close button, sonner's error colour variables, sonner's default lifetime; T041's plain error toast replaced), pausable timer for Deshacer only (listening on the toast's `[data-sonner-toast]` element too), ids and replacement rules, position from T006, focus to the knob on close, live region.
  - **REQ** REQ-27, 29, 39, 40, 51, 52, Privacy. **Done** `npx playwright test peso-dial` green.

**Review point 3g.** **Commit points:** `US3 T044 REQ-29: failing Deshacer and toast e2e`, `US3 T045 REQ-29: Deshacer toast with pause and announcements`.

### Batch 3h: weight limit on the server, removal (~100 lines plus deletions)

- [ ] T046 [US3] Tests, red (tests/unit/schemas.test.ts, tests/e2e/peso-dial.spec.ts)
  - Plain save: 150.5, 29.9, 71.25, 28.0 rejected; 30.0, 150.0, null accepted. E2E API: plain save of 28.0 or 150.5 → 400, nothing changed (D21e: the current page's messages are covered by T040).
  - **REQ** REQ-32, 48. **Done** red.
- [ ] T047 [US3] Plain saves limited to 30–150 in tenths (src/lib/validation/schemas.ts)
  - **REQ** REQ-32, 48. **Done** T046 green.
- [ ] T048 [US3] Remove the modal and the old gauge (src/components/nutrio/DataColumn.tsx, src/components/nutrio/primitives.tsx, src/components/nutrio/primitives.css, src/components/nutrio/dashboard.css)
  - `WeightDialog`, `GaugeTile`, `parseKg`, `RadialGauge`, `.nt-gauge*`, `button.nt-gauge-tile`, `.nt-weight-form`, `.nt-weight-error`.
  - **REQ** REQ-19. **Done** `grep -rn "RadialGauge\|WeightDialog\|nt-gauge\|nt-weight-form" src tests` empty; `npx tsc --noEmit`.
- [ ] T049 [US3] Story e2e: `npm run test:e2e` once; screenshots to specs/metric-dials/screenshots (no committed files)
  - **REQ** REQ-19 to 33, 39 to 41, 49 to 52. **Done** only T001's known failures remain.

**Review point 3h.** **Commit points:** `US3 T046 REQ-32: failing weight limit tests`, `US3 T047 REQ-32: weight saves limited to 30–150 in tenths`, `US3 T048 REQ-19: remove the weight modal and the old gauge`.

**Checkpoint:** US3 complete (interim: the Peso card shows no goal information).

## Phase 6: US4 (P3) The goal on the Peso card

### Batch 4a: reached rule and assistant (~220 lines)

- [ ] T050 [US4] Unit tests, red (tests/unit/weight-goal.test.ts, tests/unit/dial-logic.test.ts, tests/unit/chat-metrics.test.ts, tests/unit/progress.test.ts, tests/shared/progress-fixture.ts)
  - The shared fixture's expected `weight` objects (`PARITY_EXPECTED` and `parityLogs().expected`) lose `ratio` and the progress comments here, with the tests that read them, so T050's tests depend on no later edit. The only other reader, `assistant-parity.spec.ts`, reads `latest` and `change`, not `ratio`, and stays green.
  - `pesoLine` (every REQ-35 example, 70.04 / 70.06, "Sin meta", 71.3 − 70.1 = 1.2); `goalMarkVisible` (70 in 65–79.5, at the end of 60–70, outside 55–65, no goal). Chat rows ≈227–234: first 60, now 80, Disminuir 70 → "Te faltan 10 kg para tu meta de 70 kg."; Aumentar 80 / 81.0 → "¡Ya alcanzaste tu meta de 80 kg!"; 70.04 reached; 70.06 "Te faltan 0.1 kg…"; no "0 kg" sentence. progress: `weightStats` without `goal`/`ratio`.
  - **REQ** REQ-34, 35, 36, 42. **Done** red.
- [ ] T051 [US4] Reached rule, Peso line and mark visibility (src/lib/weight-goal.ts, src/components/nutrio/dial-logic.ts)
  - **REQ** REQ-34, 35, 36. **Done** the two unit files green.
- [ ] T052 [US4] Assistant reached rule (src/lib/domain/chat-metrics.ts, src/lib/progress.ts; the fixture edit moved to T050)
  - **REQ** REQ-42. **Done** `npx tsx --test tests/unit/chat-metrics.test.ts tests/unit/progress.test.ts` green.

**Review point 4a.** **Commit points:** `US4 T050 REQ-42: failing reached rule tests`, `US4 T051 REQ-35: shared reached rule and Peso line`, `US4 T052 REQ-42: the assistant counts the goal by direction`.

### Batch 4b: mark and line on the card (~230 lines)

- [ ] T053 [US4] E2E, written first and shown red (tests/e2e/peso-goal.spec.ts)
  - Mark at 70 for W 74.5 Disminuir 70, at the end for W 65, absent for W 60 and without a goal; told apart from ticks in greyscale (distinct element and shape); every REQ-35 line; "Sin meta" and "Fijar nueva meta" look like links and open Configuración with "Meta de peso" in view; saving 69.8 with Disminuir 70 changes neither goal nor rows and no % shows; card and assistant agree (60/80/Disminuir 70; Aumentar 80 / 81.0; no goal; 70.04 / 70.06) through `/api/rag/chat`; "Meta 149.9 kg · faltan 119.9 kg" in full at 360px; mark contrast ≥ 3:1.
  - **REQ** REQ-33 (long line), 34, 35, 36, 42, 44 (mark), 53. **Done** `npx playwright test peso-goal` red.
- [ ] T054 [US4] Goal mark and Peso line (src/components/nutrio/DetentDial.tsx, src/components/nutrio/detent-dial.css, src/components/nutrio/PesoTile.tsx, src/components/nutrio/dashboard.css)
  - **REQ** REQ-34, 35, 36, 53. **Done** `npx playwright test peso-goal` green.
- [ ] T055 [US4] Story e2e: `npm run test:e2e` once (no files)
  - **REQ** REQ-34, 35, 36, 42, 53. **Done** only T001's known failures remain.

**Review point 4b.** **Commit points:** `US4 T053 REQ-53: failing goal mark and line e2e`, `US4 T054 REQ-35: goal mark and line on the Peso card`.

**Checkpoint:** US4 complete.

## Phase 7: Final

- [ ] T056 [housekeeping] Final `npm run test:e2e` after the last commit; red-by-breaking spot checks the reviewer asks for (no files)
  - **Done** only T001's known failures remain; no `next` on :3200, no `*-e2e` database.
- [ ] T057 [housekeeping] Screenshots for the final gate: the five sizes, 390×844, 360×800, dark (specs/metric-dials/screenshots, local)
  - **Done** files present; shown to the user.
- [ ] T058 [housekeeping] Spec Progress boxes and status (orchestrator; specs/metric-dials/spec.md, local)
  - **Done** boxes ticked after the user's final gate.
- [ ] T059 [housekeeping] **STOP:** any push of `alt-dashboard` only with the user's yes (no files)
  - **Done** the user's answer recorded.

## Batches

| Batch | Tasks | Est. lines | Review point |
|---|---|---|---|
| Setup | T001 | 0 | none |
| 1a dependency | T002–T004 | vendored + ~10 | 1a |
| 1b measuring, decision | T005–T006 | 0 committed | 1b |
| 1c readouts, rules, tokens | T007–T010 | ~260 | 1c |
| 1d dial rework | T011 | ~250 | 1d |
| 1e dials on three tiles | T012–T015 | ~330 | 1e |
| 2a direction rule | T016–T017 | ~250 | 2a |
| 2b table, migration, seed proof | T018–T021 | ~280 | 2b |
| 2c goal API | T022–T024 | ~250 | 2c |
| 2d Meta de peso | T025–T026 | ~330 | 2d |
| 2e old goal path closed | T027–T028 | ~100 | 2e |
| 2f assistant link | T029–T031 | ~120 | 2f |
| 3a limits, steps | T032–T033 | ~230 | 3a |
| 3b save timing | T034–T035 | ~260 | 3b |
| 3c restore (server) | T036–T038 | ~250 | 3c |
| 3d slider mode | T039 | ~150 | 3d |
| 3e Peso tile | T040–T041 | ~450 (one area) | 3e |
| 3f overlap, tabs, leave | T042–T043 | ~220 | 3f |
| 3g Deshacer toast | T044–T045 | ~300 | 3g |
| 3h server limit, removal | T046–T049 | ~100 + deletions | 3h |
| 4a reached rule | T050–T052 | ~220 | 4a |
| 4b mark, line | T053–T055 | ~230 | 4b |
| Final | T056–T059 | 0 | final gate |

Tasks per story: US1 14 (T002–T015), US2 16 (T016–T031), US3 18 (T032–T049), US4 6 (T050–T055); setup 1, final 4 (59 in total).

## Traceability

| REQ | Tasks |
|---|---|
| REQ-1 | T010, T011, T012, T013, T040, T041 |
| REQ-2 | T011, T012, T013 |
| REQ-3 | T007, T008, T012, T013 |
| REQ-4 | T007, T008, T012, T013 |
| REQ-5 | T007, T008, T012, T013 |
| REQ-6 | T007, T008, T012, T013 |
| REQ-7 | T011, T012, T013 |
| REQ-8 | T005, T006, T007, T009, T011, T012, T013 |
| REQ-9 | T005, T006, T007, T009, T012, T013 |
| REQ-10 | T002, T003, T004, T015 |
| REQ-11 | T025, T026, T031 |
| REQ-12 | T016, T017, T023, T024, T025, T026 |
| REQ-13 | T016, T017, T022, T023, T024, T025, T026 |
| REQ-14 | T016, T017, T025, T026 |
| REQ-15 | T016, T017, T023, T024, T025, T026, T032 |
| REQ-16 | T016, T017, T018, T019, T021 |
| REQ-17 | T016, T017, T020, T021, T024, T025, T027, T028, T040, T041 |
| REQ-18 | T029, T030, T031 |
| REQ-19 | T040, T041, T048 |
| REQ-20 | T016, T017, T040, T041 |
| REQ-21 | T032, T033, T040, T041 |
| REQ-22 | T032, T033, T040, T041 |
| REQ-23 | T032, T033, T040, T041 |
| REQ-24 | T032, T033, T040, T041 |
| REQ-25 | T032, T033, T039, T040 |
| REQ-26 | T032, T033, T040, T041 |
| REQ-27 | T005, T032, T033, T034, T035, T039, T040, T041, T042, T043, T044, T045 |
| REQ-28 | T037, T038, T040, T041 |
| REQ-29 | T034, T035, T036, T037, T038, T044, T045 |
| REQ-30 | T034, T035, T040, T041, T042, T043 |
| REQ-31 | T039, T040 |
| REQ-32 | T036, T037, T038, T046, T047 |
| REQ-33 | T005, T040, T041, T053 |
| REQ-34 | T050, T051, T053, T054 |
| REQ-35 | T050, T051, T053, T054 |
| REQ-36 | T040, T041, T050, T051, T053, T054 |
| REQ-37 | T025, T026 |
| REQ-38 | T025, T026 |
| REQ-39 | T044, T045 |
| REQ-40 | T034, T035, T042, T043, T044, T045 |
| REQ-41 | T023, T024, T042, T043, T044 |
| REQ-42 | T050, T052, T053 |
| REQ-43 | T007, T008, T011, T012, T013, T039, T040 |
| REQ-44 | T007, T010, T012, T013, T040, T053 |
| REQ-45 | T005, T007, T009, T012, T013 |
| REQ-46 | T025, T026 |
| REQ-47 | T016, T017, T018, T020, T021, T023, T024 |
| REQ-48 | T022, T023, T024, T027, T028, T046, T047 |
| REQ-49 | T039, T040, T041 |
| REQ-50 | T032, T033, T039, T040, T041 |
| REQ-51 | T034, T035, T044, T045 |
| REQ-52 | T011, T039, T040, T041, T042, T043, T044, T045 |
| REQ-53 | T053, T054 |
| NFR Privacy (logs carry no weight or goal) | T023, T024, T025, T026, T038, T040, T041, T042, T043, T044, T045 |

**Tasks without a REQ (housekeeping):** T001, T014, T056, T057, T058, T059 (T004 also adds the notice).

## Old to new ids (revision 1 → 2)

| Old | New | Old | New |
|---|---|---|---|
| T001–T010 | same ids | T027 | T028 (modal), T041 (direction to the dashboard) |
| T011 | T012 | T028 | T031 |
| T012 | T011 | T029 | T032, T034 |
| T013–T017 | same ids | T030 | T033, T035 |
| T018 | T018 (generation moved to T019) | T031 | T036, T046 |
| T019, T020 | same ids | T032 | T038 (`previous`), T047 (limit) |
| T021 | T022 (schema), T029 (chat) | T033 | T038 |
| T022 | T024 | T034 | T041 (folded after the failing T040) |
| T023 | T030 | T035 | T040 |
| T024 | T021 (helpers), T029 (assistant e2e) | T036 | T039 |
| T025 | T023 (API), T025 (UI), T027 (modal), T040 (dashboard no-row path) | T037 | T041, T043 |
| T026 | T026 | T038 | T037, T042, T044, T046 |
| T039 | T045 | T040 | T048 |
| T041 | T049 | T042–T047 | T050–T055 |
| T048–T051 | T056–T059 | new | T021 (seed proof), T027 |
