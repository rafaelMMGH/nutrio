# Tasks: Dashboard polish

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`
`[P]` = can run in parallel with other `[P]` tasks in the same phase (touches different files).
Per batch: `npx tsc --noEmit`, `npm run test:unit`, then only that batch's e2e titles (`npx playwright test <file> -g "<title>"`), one run at a time. Each new or changed test is shown red first. Batches stay at or under ~300 changed lines.

## Phase 1: Setup

- [x] T001 [Setup] Commit the annotations already in the working tree, with no new edits, as its own commit in the first batch: `specs/cooking-mode/spec.md`, `specs/cooking-mode/checklists/manual.md`, `specs/alt-dashboard/plan.md`, `specs/metric-dials/spec.md` (status implemented), plus `specs/dashboard-polish/`. Leave `specs/refactors/e2e-db-per-worker.md` out (D1, D21, constitution 7)

## Phase 2: Foundational

None. Each story's groundwork is inside its own batch.

## Phase 3: US1 (P1) Mark a meal done with the action button

### Batch US1a: save, tap and advance rules (≈300 lines)

- [x] T002 [P] [US1] Unit tests for the save core: a failed `save` resolves false and the toast callback fires once (REQ-4); `setMeal` applies one meal optimistically and rolls back only that meal on failure (REQ-9, REQ-25d); a stale request's late success or failure never overwrites a newer action (REQ-25c); per-date queue: A's request hangs, B is tapped → B's request is not sent until A settles, each body built at send time from the current optimistic log; A then fails → only A rolls back and B's body never carried A (tests/unit/day-log-saves.test.ts)
- [x] T003 [P] [US1] Unit tests for tap and advance rules: taps ignored while pending (REQ-25a) and for 400 ms after an accepted tap (REQ-25b), meals independent (REQ-25d); `nextPending` wraps and returns none when nothing is pending; `createAdvance` with `mock.timers`: does not fire at 800 ms, fires by 1000 ms, reads the done ids at fire time, does nothing when none is pending, and `cancel()` before firing (manual switch, unmark, rollback) prevents it; a new `start` after a cancel restarts the 900 ms (REQ-6) (tests/unit/mark-logic.test.ts)
- [x] T004 [US1] Implement `createDaySaves({ send, read, write, onError })` with the per-date queue and per-meal sequence so T002 passes (src/components/nutrio/day-log-saves.ts)
- [x] T005 [P] [US1] Implement `TAP_LOCK_MS`, `ADVANCE_DELAY`, `acceptTap`, `nextPending`, `createAdvance(timers)` (`start(from, meals, readDoneIds, go)`, `cancel()`) so T003 passes (src/components/nutrio/mark-logic.ts)
- [x] T006 [US1] Wire the core into the hook: `save` → `Promise<boolean>`, new `setMeal`, single toast, refresh after the queue drains (REQ-4, REQ-9) (src/components/nutrio/useDailyLogs.ts)
- [x] T007 [US1] `toggleMeal` uses `setMeal` and returns its result; `saveWeight` calls `void logs.save(...)`: the boolean needs no handling because the hook already toasts and rolls back, and the promise never rejects (no unhandled rejection, constitution 6) (src/components/nutrio/Dashboard.tsx)

**Checkpoint:** US1a reviewed and committed (T001 as a separate commit first). Screen unchanged (HoldToConfirm still in place); tsc and unit tests green.

### Batch US1b: in-house action button (≈280 lines)

- [x] T008 [P] [US1] Unit test for `changedLetters(prev, next)`: unchanged letters stay, changed ones rise, for the label pairs idle↔pending, pending→success, success→idle (REQ-7) (tests/unit/letter-diff.test.ts)
- [x] T009 [P] [US1] Contrast unit test, light and dark (REQ-26): label ≥4.5:1 and arrow ≥3:1 vs `--nt-surface` (idle, pending); spinner ≥3:1 vs `--nt-surface`; label ≥4.5:1 and check ≥3:1 vs `--nt-ink` (done fill); focus ring ≥3:1 for outer `--nt-ink` vs the hero background `--nt-bg`, outer `--nt-ink` vs inner `--nt-surface` (idle), inner `--nt-surface` vs `--nt-ink` (done fill) (tests/unit/action-button-contrast.test.ts)
- [x] T010 [US1] Implement `changedLetters` so T008 passes (src/components/arc/action-button/letter-diff.ts)
- [x] T011 [US1] Write `ActionButton` in-house with motion and lucide-react, header comment crediting uiarc.dev/components/action-button as the look and motion reference (no copied source): controlled `state` and `onPress`, no reset timer or inner status region, `aria-pressed`/`aria-busy`/`aria-disabled` while pending, one hidden stable name with `aria-hidden` letters, presses ignored while pending, `instantKey` (next state paints with no motion), per-letter blur rise, width spring, 0.97 press. Icon slot: arrow (idle), 14 px partial-ring spinner beside "Guardando" (pending; rotates, static under reduced motion), check drawn with `pathLength` (success). Reduced motion: instant fade only (REQ-3, REQ-7, REQ-8) (src/components/arc/action-button/action-button.tsx)
- [x] T012 [US1] Plain CSS with `arc-ab-*` classes: REQ-2 sizes and colours via `--nt-*`, 44×44 hit area via `::before` (clip on the label slot, not the button), two-tone focus ring (2 px `--nt-surface` inner, 2 px `--nt-ink` outer), spinner rotation inside `prefers-reduced-motion: no-preference` only, forced colours: explicit border, `Highlight` outline, `CanvasText` check (REQ-2, REQ-26, REQ-27) (src/components/arc/action-button/action-button.css)

**Checkpoint:** US1b reviewed and committed. The component compiles and its unit tests pass; not yet on screen.

### Batch US1c: e2e rewrites, red against the hold UI (≈250 lines)

- [x] T013 [US1] Rewrite the helpers and the three titles: a `mark()` click helper replaces `holdToConfirm`; "saves the meal…" asserts "Guardando" with `aria-busy` and `aria-pressed` false behind a held route, then "Cumplida" and `aria-pressed` true, no move at 600 ms, moved by 1300 ms, focus still on the button; "last pending" stays on its slide; the Comidas title only swaps the helper here (US2 rewrites it) (REQ-1, 3, 6, 8, 9) (tests/e2e/dashboard.spec.ts)
- [x] T014 [US1] New title '"Marcar cumplida": failed save, double tap and reduced motion': 500 route under `expectIssues` (never "Cumplida", toast once inside `section[aria-live]`, dials roll back); failed unmark returns to "Cumplida"; `dblclick` gives one PUT; unmark within one frame; status-region texts; reduced motion with no transform, width animation or stroke animation; forced colours with a visible edge (REQ-4, 5, 7, 24, 25, 27) (tests/e2e/dashboard.spec.ts)
- [x] T015 [P] [US1] Rewrite "REQ-3: marking one more meal done moves Adherencia, Calorías and Proteína without a reload" to a single click (tests/e2e/metric-dials.spec.ts)

**Checkpoint:** US1c reviewed; titles shown red against the current hold UI. Commit with US1d (green together).

### Batch US1d: hero integration (≈200 lines)

- [x] T016 [US1] Hero uses `ActionButton` (no `key` per meal; `instantKey={meal.id}`), per-meal `saving` and lockout via `acceptTap`, `createAdvance` started on "saved" and cancelled on switch, unmark or rollback, status region outside `.nt-hero-copy` (REQ-1 to REQ-9, REQ-24, REQ-25) (src/components/nutrio/Hero.tsx)
- [x] T017 [US1] Delete HoldToConfirm, its logic, CSS and unit test; drop the `.nt-done` hold rules (D19, REQ-1) (src/components/nutrio/HoldToConfirm.tsx, hold-to-confirm-logic.ts, hold-to-confirm.css, tests/unit/hold-to-confirm.test.ts, src/components/nutrio/dashboard.css)
- [ ] T018 [US1] Run tsc, unit tests and the US1 e2e titles (T013 to T015); `grep -r "Mantén presionado\|HoldToConfirm" src` is empty (REQ-1)

**Checkpoint:** US1 complete. Review, commit US1c+US1d, then continue.

## Phase 4: US2 (P2) Racha KPI

### Batch US2a: streak rules (≈200 lines)

- [x] T019 [P] [US2] Unit tests for `streaks`: the REQ-11, REQ-12 and REQ-13 Givens except the free-day ones (unreachable with today's static schedule, Q7): complete, incomplete, unknown ids ignored, plan grows, earliest-log start, today incomplete not breaking, best never below current, unmark lowering best; plus empty `slotIds` gives `{ current: 0, best: 0 }` (tests/unit/streak.test.ts)
- [x] T020 [P] [US2] Unit tests for `streakText`: all REQ-14 Givens, "1 día" (tests/unit/kpis.test.ts)
- [x] T021 [P] [US2] Unit tests for `nextToday(current, now)`: same local day returns `current` unchanged; past local midnight returns the new key (REQ-28) (tests/unit/use-today.test.ts)
- [x] T022 [US2] Implement `streaks({ logs, slotIds, today })` (src/lib/streak.ts)
- [x] T023 [US2] Add `streakText` (src/lib/kpis.ts)
- [x] T024 [US2] `useToday()` with exported `nextToday`, recomputed on `focus` and `visibilitychange` (REQ-28) (src/components/nutrio/useToday.ts)

**Checkpoint:** US2a reviewed and committed; unit tests green, screen unchanged.

### Batch US2b: Racha tile and e2e (≈300 lines)

- [ ] T025 [US2] Rewrite "KPI tiles show real counts with at least two digits" (order Racha first, "N días" and context), the first-tile comment in "KPI tiles still animate when the OS asks for reduced motion", and "makes the Comidas number go up by one" → "Racha goes up by one when today's last meal is marked" (REQ-10, 14, 15) (tests/e2e/dashboard.spec.ts)
- [ ] T026 [US2] New title "Racha: streak rules, 999 at 360px and midnight": SQL-seeded past logs restored in `finally`, 2×2 at 360 px, "999 días" with "¡Tu mejor racha!" not clipped, `ariaSnapshot` phrase, midnight via `page.clock` and `focus` (REQ-10 to 14, 28, 29) (tests/e2e/dashboard.spec.ts)
- [ ] T027 [US2] KpiRow: Racha tile first with `Flame`, `RollingNumber` (`minDigits` 1, no dash) plus unit, one hidden phrase, visible parts `aria-hidden`; Planes, Recetas, Compras unchanged (REQ-10, 14, 29) (src/components/nutrio/DataColumn.tsx)
- [ ] T028 [US2] Dashboard computes `streaks` from the optimistic `logs.list()` with `useToday()`; remove `countDoneToday`, `contexts.meals` and their test cases (REQ-10, 15, 28) (src/components/nutrio/Dashboard.tsx, src/lib/kpis.ts, tests/unit/kpis.test.ts)
- [ ] T029 [US2] Tile fit for "999 días" plus "¡Tu mejor racha!" at 360 px and 200% zoom (REQ-29) (src/components/nutrio/dashboard.css)
- [ ] T030 [US2] Run tsc, unit tests and the US2 e2e titles (T025, T026)

**Checkpoint:** US2 complete. Review, commit, then continue.

## Phase 5: US3 (P3) Modo Cocina glass pill (≈280 lines)

- [ ] T031 [P] [US3] Contrast unit test: `--nt-cook-*` tokens composited over the dish's lightest and darkest stops, light and dark, translucent and opaque: title and subtitle ≥4.5:1, edge ≥3:1; focus ring outer `--nt-ink` and inner `--nt-surface` ≥3:1 vs those stops and each other (REQ-19, REQ-20) (tests/unit/cook-pill-contrast.test.ts)
- [ ] T032 [P] [US3] Rewrite "REQ-4/5: the dashboard hero links to Modo Cocina, and an unknown recipe is a 404": one link (the pill), href `/recipes/<id>/cook`, name "Modo Cocina: <dish>", no pill without a recipe (REQ-16, 18, 20) (tests/e2e/cooking-mode.spec.ts)
- [ ] T033 [US3] New title "Modo Cocina pill: layout, truncation and states": no text link and no tooltip; subtitle follows the carousel; width ≤70% of the plate at 1280 and 938, ≤60% with no subtitle at 937/390/360, inside the plate; pill box unchanged and `getAnimations()` empty while the plate animates in, layer `mask-image: none`; 80-character name cut on one line; empty name; ≥44 px; Tab ring; hover change within 150 ms and none under reduced motion; forced colours; reduced transparency (CDP); pill and "Marcar cumplida" not clipped at 200% zoom, light and dark (non-functional); recipe page icon unchanged (REQ-16, 17, 19 to 23, 30, 31) (tests/e2e/dashboard.spec.ts)
- [ ] T034 [US3] Add the `--nt-cook-*` tokens, light and dark (smoked dark glass, white text, Q5), so T031 passes (src/components/nutrio/tokens.css)
- [ ] T035 [US3] Hero: remove the "Modo Cocina" text link, `COOK_DOT` dot and tooltip; add `.nt-cook-layer` as an unkeyed sibling after `.nt-plate` holding the pill link (Beef badge, title, optional subtitle, accessible name) (REQ-16, 17, 18, 20, 22, 23, 31) (src/components/nutrio/Hero.tsx)
- [ ] T036 [US3] CSS: remove `.nt-cook`, `.nt-plate-dot`, `.nt-cook-dot`, `.nt-cook-tip`; group `.nt-cook-layer` with `.nt-plate` in the base, `max-width: 1279px` and `max-width: 937px` geometry rules (mask and animation stay plate-only); `.nt-cook-pill` at 44%/55%, pointer-events auto, 70%/60% limits, ellipsis, 44 px, two-tone focus, hover and press ≤150 ms, reduced motion, reduced transparency, forced colours, subtitle hidden at `max-width: 937px` (REQ-17, 19 to 22, 30) (src/components/nutrio/dashboard.css)
- [ ] T037 [US3] Run tsc, unit tests and the US3 e2e titles (T032, T033); capture light, dark, 938 px and 360 px screenshots into the session scratchpad for the user (not committed)

**Checkpoint:** US3 complete. Review, commit, then **stop for the user's visual check** of the T037 screenshots.

## Phase 6: Snapshots (gated)

- [ ] T038 [US3] Only after the user approves the visuals at the US3 checkpoint (their explicit yes in the conversation; skip otherwise): regenerate `npx playwright test tests/e2e/a-theme-visual.spec.ts -g "home looks as it did" --update-snapshots` (local, gitignored) and run `tests/e2e/dashboard.spec.ts -g "screenshot"` to rewrite `specs/alt-dashboard/screenshots/dashboard-*.png`; commit the PNGs on their own (specs/alt-dashboard/screenshots/)
