# Tasks: Dashboard real data

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`
`[P]` = can run in parallel with other `[P]` tasks in the same phase (touches different files).

Per batch:
- Run `npx tsc --noEmit`, then `npm run test:unit`, then only that batch's e2e titles (`npx playwright test <file> -g "<title>"`), one run at a time. The global setup holds a lock.
- Run each affected e2e file in full once at the end of the batch. Every full run of `dashboard.spec.ts` before T042 adds `--grep-invert "screenshot"`, and is followed by `git checkout -- specs/alt-dashboard/screenshots/`: the "fits 1440×780", "empty state" and "account menu" titles also write tracked PNGs. `git status --short specs/alt-dashboard/screenshots/` must be empty before any commit.
- Show each new or changed test red first. A red e2e batch is committed on its own on the feature branch (`test(...): ... (red)`), so the fail-first proof is visible; the implementation batch that turns it green is the next commit.
- Keep each batch to about 300 changed lines or less. Never run `next build` in place.

## Phase 1: Setup

- [x] T001 [Setup] On `feature/dashboard-real-data` (from `main`), two commits (spec v1.2, constitution 7):
  - First, `DESIGN.md` and `PRODUCT.md` as they are in the working tree, alone ("docs: track DESIGN.md and PRODUCT.md").
  - Then the annotations: the D14 notes in `specs/metric-dials/spec.md`, `specs/dashboard-polish/spec.md`, `specs/alt-dashboard/plan.md` and `specs/alt-dashboard/entrega.md`, `specs/BACKLOG.md`, and `specs/dashboard-real-data/`. First fix the alt-dashboard plan note's "(borrador, …)" to read approved.
  - Leave `.claude/agents/impeccable-*` and `.codex/` untracked and out of both commits (DESIGN.md, PRODUCT.md, specs/)
- [x] T002 [Setup] Measure the current `.nt-cal` card with the e2e harness. Use a throwaway spec run once and deleted, never committed. Alternatively, use an isolated `next dev` on a cloned DB with `NEXT_DIST_DIR=.next-e2e-measure`. Never `next build`.
  - Viewports: 1440×900, 1440×780, 1280×768, 1920×1080, 1920×800, 937×900 and 390×844.
  - Measure: card height, padding, header height plus gap, and the resulting list height.
  - Record the numbers in plan.md §Measurements and fix the row default, phone cap and fade height (44px minimum fixed) (REQ-7) (specs/dashboard-real-data/plan.md)

## Phase 2: Foundational (blocks all stories)

- [x] T003 [P] [Foundational] Contrast unit test, light and dark (NFR, REQ-7, REQ-18). Read tokens.css and fail while the tokens are missing:
  - Against `--nt-yellow`, `--nt-yellow-hover` and `--nt-yellow-press`: `--nt-on-accent` ≥4.5:1 and `--nt-on-accent-sub` ≥4.5:1.
  - Against `--nt-yellow`: focus ring, selected marker and check icon (`--nt-on-accent`) ≥3:1, and `--nt-on-accent-line` ≥3:1.
  - Against `--nt-sky`: `--nt-on-accent` and `--nt-on-accent-sub` ≥4.5:1, and the arc fill `--nt-sky-deep` ≥3:1.
  (tests/unit/real-data-contrast.test.ts)
- [x] T004 [Foundational] Add `--nt-on-accent`, `--nt-on-accent-sub`, `--nt-on-accent-line`, `--nt-yellow-hover` and `--nt-yellow-press` to `.nt` so T003 passes. Values per plan §Tokens: `--nt-yellow-press: var(--nt-yellow-accent)` and `--nt-on-accent-line: var(--nt-on-accent-sub)`; the other three are hex with the primitive named in a comment (neutral-900, neutral-600, butter-100), because no primitive variables exist in `src` (DESIGN §11 is a proposal only) and `--nt-ink` flips in dark. Add a comment with the measured ratios (src/components/nutrio/tokens.css)
- [x] T005 [P] [Foundational] Pass `planCreatedAt` (the current version's `created_at` when `summary.schedule` is non-null, else `null`) from the page. Add it to `DashboardProps`; it is unused until T015 (REQ-10, REQ-12) (src/app/(dashboard)/page.tsx, src/components/nutrio/Dashboard.tsx)

**Checkpoint:** Foundation reviewed and committed; screen unchanged; tsc and unit tests green.

## Phase 3: US1 (P1) Today's meal timeline

### Batch US1a: timeline rules (≈150 lines)

- [x] T006 [US1] Unit tests (tests/unit/timeline-logic.test.ts):
  - `timelineRows`:
    - REQ-2: 4 meals with the 1st and 3rd done read done, next, done, pending; all done gives no "next"; foreign and duplicate done ids are ignored.
    - REQ-3: no times gives `hasTimes` false; only the 2nd meal timed gives `null` time elsewhere and the order unchanged; never sorted by time.
    - Names go through `mealLabel`.
  - `rowLabel`: "07:00, Desayuno, Siguiente", "Cena, Cumplida", and a 60-character name kept whole (REQ-4).
  - `listScrollTop`: a row above or below the view scrolls by the fade pad; a visible row keeps `scrollTop`; the result is clamped to 0 and the maximum (REQ-5, REQ-19).
- [x] T007 [US1] Implement `timelineRows` ("next" found inline), `rowLabel` and `listScrollTop` so T006 passes. No `firstPending` or `resolveShown` (plan, spec v1.2) (src/components/nutrio/timeline-logic.ts)

**Checkpoint:** US1a reviewed and committed; screen unchanged.

### Batch US1b: e2e for content, selection and check-off, red against the static card (≈300 lines)

- [x] T008 [US1] Add a scenario helper. `withMeals([{ name, time }], { done, createdAt })` inserts `e2e-tl-*` meal types into the active version, soft-deletes the originals, seeds `daily_logs` and sets the version's `created_at`. It backs up and restores `meal_types`, `daily_logs` and `plan_versions` in `afterEach` (tests/e2e/dashboard-real-data.spec.ts)
- [x] T009 [US1] Title "Comidas de hoy: rows, times and states" (tests/e2e/dashboard-real-data.spec.ts):
  - REQ-1: 07:00, 14:00 and 20:00 rows show in order; at 360px a 60-character name is cut with an ellipsis while the time and state are fully visible, with no horizontal scroll.
  - REQ-2: Cumplida with its check, Siguiente and Pendiente words.
  - REQ-3: no times, and partial times.
  - REQ-8: the title is "Comidas de hoy"; none of 1,850, "+12.8%", "Comidas completadas", "Promedio por comida", the bars, the hours or "Hoy" is present.
- [x] T010 [US1] Title "Comidas de hoy: a row selects the meal in the hero and follows the carousel" (tests/e2e/dashboard-real-data.spec.ts):
  - REQ-4: a click, Enter or Space shows the meal and changes no state; row accessible names.
  - REQ-5: exactly one `aria-current="true"`; it follows the arrows and dots; it follows the auto-advance at 900 ms ±100 after "Cumplida"; the selected and Siguiente row shows the marker, the heavier weight and the word.
  - REQ-20: the list is named "Comidas de hoy" and the hero pager `tablist` "Elegir comida" (spec v1.2), so exactly one element carries "Comidas de hoy"; the status region reads "Guardando" then "Cumplida" once each; activating a done meal's row adds no message of its own.
  - Same row (spec v1.2): with a done meal shown, activating its own row leaves the status text unchanged and adds no message, consistent with REQ-20. After "Marcar cumplida" saves and "Cumplida" shows, activating the shown meal's row within 900 ms cancels the auto-advance: 1.5 s later the hero and `aria-current` are still on that meal.
- [x] T010a [US1] Title "Hero selection is unchanged: the active dot re-announces and a stale selection clamps" (tests/e2e/dashboard-real-data.spec.ts). Hero-only, so it passes today, at T014a and at T018: a guard for the lift, which changes no behaviour (spec v1.2):
  - With a done meal on screen, clicking its active dot clears the status region and then reads "Cumplida" again after about 80 ms (dashboard-polish REQ-24). With a pending meal shown, clicking its dot leaves the region empty.
  - Clamp (seed Alfa, Beta, Gama with Gama done, so Alfa is the first pending meal and the seed separates keep-index-and-clamp from jump-to-first-pending): with Beta shown (index 1), the helper soft-deletes Beta and appends Delta; saving today's weight in Métricas triggers `router.refresh()`; the hero then shows Gama (same index), not Alfa, and exactly one dot is selected. Then with Delta shown (index 2), the helper soft-deletes Delta and a refresh shows Gama (clamped to the last meal), not Alfa. The dot state in that last case is not asserted (plan, Risks).
  - Fallback if the weight save does not trigger the refresh reliably: the helper changes the meals and the test calls `page.reload()`. A reload remounts Dashboard, so it proves only the opening rule ("first pending, else the first meal"), not the clamp; record that in the checkpoint report, and the clamp then rests on the verbatim `Math.min` line.
- [x] T011 [US1] In the `failed saves` describe (`expectIssues`), title "Comidas de hoy: rows flip at once and roll back" (tests/e2e/dashboard-real-data.spec.ts):
  - REQ-6: behind a held route the row reads Cumplida before the response and Siguiente moves; on a 500 the row returns.
  - Request count: the check-off sends exactly the one daily-log save to `/api/` and nothing else; activating a row sends no request.
  - REQ-20: the toast "No se pudo guardar tu registro del día" shows once inside `section[aria-live]` and the status region stays empty.
  - The timeline has no check-off control.
- [x] T012 [US1] Title "Empty states: no active plan and a plan with no meals", timeline part only. No plan: "Sin plan activo" and a "Subir plan" button (role "button") that opens the upload wizard (spec v1.2), with no rows and no times. No meals: "Tu plan no tiene comidas". Rewrite "yellow and sky cards are static…" as "Comidas de hoy replaces the static yellow card; the old dashboard is gone; the assistant still opens", scoped to the timeline and `.nt-today`: "Comidas de hoy" title, no `.nt-cal`, the fab still below `.nt-comp`. Drop the old `.nt-cal`/`.nt-comp` "no button or link" count. Every `.nt-comp` content assertion stays in T034 (REQ-8, REQ-10) (tests/e2e/dashboard-real-data.spec.ts, tests/e2e/dashboard.spec.ts)

**Checkpoint:** US1b reviewed; titles shown red. Commit them alone as the red commit.

### Batch US1c: timeline markup, then selection and marking lifted into Dashboard (≈270 changed lines, ~70 of them moved; three commits: markup, lift, pager rename)

- [x] T013 [US1] `MealTimeline` markup (src/components/nutrio/MealTimeline.tsx):
  - `tone="yellow"` card `.nt-today` with the `HandPlatter` header "Comidas de hoy".
  - `<ul aria-label="Comidas de hoy">` with native row buttons: `aria-label={rowLabel}`, `aria-current`, `aria-hidden` visible parts; time column only when `hasTimes`; `Check` plus "Cumplida", "Siguiente" pill and "Pendiente" word.
  - Empty states: "Sin plan activo" with a "Subir plan" button that calls `openUpload` (spec v1.2), and "Tu plan no tiene comidas".
  - Row activation calls `onSelect(id)`. The component is not rendered until T015 (REQ-1 to REQ-4, REQ-8, REQ-10).
- [x] T014 [US1] Lift per plan "selection and marking lifted into Dashboard" (src/components/nutrio/Hero.tsx, src/components/nutrio/Dashboard.tsx):
  - Move `index` (with its initializer), `saving`, `lockedUntil`, `said`, `live`, `advance`, `advanceFor`, `mounted`, `reannounce`, `say`, `go` and `press` from Hero into Dashboard, unchanged. `go` keeps re-announcing the shown meal's dot; `index` is never reset, so a stale selection clamps as today (spec v1.2).
  - Dashboard derives `shownId = meals[Math.min(index, meals.length - 1)]?.id` for `live` (and the timeline in T015).
  - Hero takes `{ meals, doneIds, index, saving, said, onSelect: go, onPress: press }`, keeps its `Math.min` line, arrow keys, the status region, the pager and the dot focus callback. No ref, no imperative handle.
  - In its own commit after the lift, rename the pager `tablist` `aria-label` from "Comidas de hoy" to "Elegir comida" (spec v1.2). `grep -rn "Comidas de hoy" tests/e2e` finds no pager lookup today (all use `.nt-pager button`); rerun it and update any hit that targets the pager.
  - REQ-5, REQ-20.
- [x] T014a [US1] Run tsc, unit tests, T010a (still green), and in `dashboard.spec.ts` the carousel, "Marcar cumplida", "failed saves", Racha and empty-state titles; then `cooking-mode.spec.ts` in full. Restore the screenshots folder.

**Checkpoint:** US1c reviewed and committed; screen unchanged; T009 to T012 still red.

### Batch US1d: timeline card rendered (≈150 lines)

- [x] T015 [US1] Dashboard renders `MealTimeline` in place of `CaloriesCard`, passing `shownId`, `onSelect={(id) => (id === shownId ? advance.cancel() : go(meals.findIndex((meal) => meal.id === id)))}` (a same-row click cancels a pending auto-advance and is silent, spec v1.2; no new handler, constitution 3), the optimistic `todayLog.meals_done` and `hasPlan = planCreatedAt !== null`. DOM order inside `.nt-data` stays KpiRow, MetricsCard, then `.nt-pair` with `MealTimeline` first and `ComplianceCard` second, with no CSS `order`, so Métricas precedes the rows (REQ-19). Delete `CaloriesCard`, `BARS`, `HOURS`, its `// TODO: solo visual` comment and unused imports (REQ-5, REQ-6, REQ-8, REQ-11) (src/components/nutrio/Dashboard.tsx, src/components/nutrio/DataColumn.tsx)
- [x] T016 [P] [US1] Delete `mealTime` and `DEFAULT_TIMES`, which invented hours; `grep -rn mealTime src tests` is empty (D12, REQ-3) (src/components/dashboard/food.ts)
- [x] T017 [US1] Base CSS (src/components/nutrio/meal-timeline.css, src/components/nutrio/dashboard.css):
  - Row grid `auto minmax(0,1fr) auto`, one-line ellipsis name, time and state never shrink.
  - State styles with `--nt-on-accent` and `--nt-on-accent-sub`; selected marker plus weight 600.
  - Delete `.nt-cal-*`, `.nt-bars`, `.nt-hours` and their short-screen rules from `dashboard.css`.
  - REQ-1, REQ-2, REQ-5, REQ-8.
- [x] T018 [US1] Run tsc, unit tests, T009 to T012 and T010a, and the carousel, "Marcar cumplida", "failed saves", Racha and empty-state titles in `dashboard.spec.ts`. Restore the screenshots folder.

**Checkpoint:** US1d reviewed and committed (turns the US1b red commit green). Timeline on screen with base layout.

### Batch US1e: e2e for overflow, phone, keyboard and midnight, red (≈300 lines)

- [x] T019 [US1] Title "Comidas de hoy: 8 meals tighten, then scroll with edge fades" (REQ-7) (tests/e2e/dashboard-real-data.spec.ts):
  - At 1280×768: rows ≥44px, every row reachable by scroll and by Tab, a bottom fade until the end and then a top fade, and no page scrollbar at all 5 desktop viewports.
  - 1 meal: rows at the T002 row height and the card box unchanged.
  - At 390×844: list capped at the T002 cap.
  - The fade does not intercept pointer input.
  - Reduced transparency (CDP), `prefers-contrast: more` and forced colours: a 1px divider ≥3:1 instead of the fade.
  - Reduced motion: no transition on the fade.
- [x] T020 [US1] Title "Comidas de hoy: phone row tap brings the hero below the top bar; desktop only scrolls the list" (tests/e2e/dashboard-real-data.spec.ts):
  - REQ-9: at 390px the hero top is at or just below `.nt-topbar` and focus is still on the row; under reduced motion this is instant; at ≥938px a row activation leaves `scrollY` unchanged.
  - REQ-5: with 8 meals and the page not scrolled, selecting meal 8 changes only the list's `scrollTop`. Under `reducedMotion: "reduce"`, the list's `scrollTop` already equals its final value in the first animation frame after the selection (no smooth scroll).
- [x] T021 [US1] Title "Comidas de hoy: keyboard path, focus, hover, contrast, forced colours" (tests/e2e/dashboard-real-data.spec.ts):
  - REQ-19:
    - Tab order: hero controls, then Métricas, then rows in plan order, then the counts card.
    - Focus stays on row 3 after marking meal 3 in the hero, and the list does not jump.
    - The row-6 focus ring is fully visible and clear of the fade.
  - REQ-18: hover change within 150 ms; instant under reduced motion with no transform; ring ≥3:1 also on the selected row, in both themes.
  - NFR: measured contrast of the time, "Pendiente", icons and the marker in both themes; forced colours show rows, icons, cue and ring.
- [x] T022 [US1] Title "Midnight: rows reset on focus; an in-flight save settles against its day" (REQ-11, timeline part):
  - Use `page.clock` and a `focus` dispatch: all rows Cumplida become Pendiente, with the first one Siguiente.
  - A check-off is held across midnight, then fails: yesterday's meal returns to unchecked and today's rows are untouched.
  - The selected row is kept.
  - If the in-flight case still fails once T025 and T026 are in, the bug is in `toggleMeal`/`press` (Dashboard.tsx) or `day-log-saves.ts`, not in the timeline: run T026a/T026b.
  (tests/e2e/dashboard-real-data.spec.ts)
- [x] T023 [P] [US1] Change `.nt-cal` to `.nt-today` in the "fits W×H without scrolling" titles. The list scroller is not a clipped card (REQ-7) (tests/e2e/dashboard.spec.ts)
- [x] T024 [P] [US1] Change `.nt-cal` to `.nt-today` in the "REQ-9: … no card is clipped at the five window sizes" list (tests/e2e/metric-dials.spec.ts)

**Checkpoint:** US1e reviewed; T019 to T021 and T023 shown red; T022 and T024 are green guards on arrival (2026-11-19: midnight already settles against its day; `.nt-cal` matched nothing since T015). Commit them alone as the red commit.

### Batch US1f: overflow and interaction (≈250 lines)

- [x] T025 [US1] Overflow and state CSS (src/components/nutrio/meal-timeline.css):
  - REQ-7: flex list with rows `flex: 1 1 0; min-height: 44px; max-height: <row>`; the `<cap>` rule with `--nt-tl-rows` under `max-width: 1279px` (spec v1.2); the `mask-image` fade driven by `--nt-tl-fade-top` and `--nt-tl-fade-bottom`; `scroll-padding-block`; 1px `--nt-on-accent-line` dividers under reduced transparency, more contrast and forced colours; short-screen rules from 1280px.
  - REQ-18: hover in 150 ms only under no-preference; pressed `transition: none`; inset 2px focus ring. The shell rule `.nt :is(a, button, [tabindex]):focus-visible` (primitives.css:99, specificity 0,3,0) replaces outlines with a box-shadow and beats `.nt-today-row:focus-visible`; use `.nt .nt-today-row:focus-visible { outline: 2px solid var(--nt-on-accent); outline-offset: -2px; box-shadow: none; }` (precedent dashboard.css:122, :134) so the ring is inset and survives forced colours.
  - REQ-5: forced-colours marker in `CanvasText`.
  - REQ-1: no horizontal scroll at 360px.
  - Also check one width in 938–1279 (e.g. 1100×900).
- [x] T026 [US1] `MealTimeline` behaviour (src/components/nutrio/MealTimeline.tsx):
  - REQ-7: edge fades from `scroll` and `ResizeObserver`.
  - REQ-5: an effect on `shownId` calls `list.scrollTo(listScrollTop(...))`, instant under reduced motion.
  - REQ-19: `onFocus` brings the row clear of the fade.
  - REQ-9: on activation at `max-width: 937px`, `window.scrollTo` puts the hero top at the top bar's bottom edge, instant under reduced motion; focus is never moved.
- [x] T026a [US1] (not needed: T022 stayed green after T026) (conditional, only if T022's in-flight case fails after T026) Unit test that reproduces it: a save started for day D and settled after midnight changes only D's log, including on rollback. Show it red (tests/unit/day-log-saves.test.ts)
- [x] T026b [US1] (not needed) (conditional, after T026a is red) Fix the date capture in `toggleMeal`/`press` or the per-date queue so T026a and T022 pass (src/components/nutrio/Dashboard.tsx, src/components/nutrio/day-log-saves.ts)
- [x] T027 [US1] Run tsc, unit tests and T019 to T024. Then run `dashboard-real-data.spec.ts`, `dashboard.spec.ts --grep-invert "screenshot"` and `metric-dials.spec.ts` in full, once each, and restore the screenshots folder. Save screenshots to the session scratchpad: 1440×900, 1280×768 with 8 meals, 390×844, and dark. Report the T002 numbers.

**Checkpoint:** US1 complete. Review, commit, show the screenshots, then continue.

## Phase 4: US2 (P2) Real plan-compliance counts

### Batch US2a: count rules (≈200 lines)

- [x] T028 [P] [US2] Unit tests for `compliance` (tests/unit/compliance.test.ts):
  - REQ-12: 4 meals, created 12 nov, today 14 nov gives Planificadas 12.
  - REQ-13: 4 + 3 + 2 done gives 9 / 2 / 1; with 13 nov missing, 6 / 4 Sin marcar.
  - REQ-17: day 1 with 1 done gives 4 / 1 / 3 / 0.
  - REQ-12: a start after today counts as today.
  - REQ-13: foreign, duplicate, before-start and after-today ids are ignored.
  - REQ-14: the invariant and no negative figure over a deterministic grid; 23:59 with 2 unchecked gives Pendientes 2.
  - REQ-10 and REQ-15: no meals gives 0 / 0 / 0 / 0.
  - REQ-11: the same logs with today + 1 move yesterday's unchecked meals to Sin marcar.
- [x] T029 [P] [US2] Unit tests for `sinceLabel`: "Desde 12 nov" in the current year, "Desde 12 nov 2025" otherwise, and the September abbreviation from `SHORT_MONTHS` (REQ-15) (tests/unit/kpis.test.ts)
- [x] T030 [P] [US2] After T028 is shown red, implement `compliance({ logs, slotIds, start, today })` so T028 passes (src/lib/compliance.ts)
- [x] T031 [P] [US2] After T029 is shown red, implement `sinceLabel(startKey, today)` on the existing `SHORT_MONTHS` so T029 passes (src/lib/kpis.ts)

**Checkpoint:** US2a reviewed and committed; screen unchanged.

### Batch US2b: e2e for the counts card, red (≈220 lines)

- [x] T032 [US2] Title "Cumplimiento del plan: real counts since the plan began" (REQ-12 to REQ-15) (tests/e2e/dashboard-real-data.spec.ts):
  - Seeded 9 of 12 shows "Planificadas" 12 at the centre, and Cumplidas 9, Sin marcar 1, Pendientes 2 with labels.
  - The arc `role="img"` is named "9 de 12 comidas cumplidas" and is 75% filled; "Desde 12 nov", or with the year.
  - No "%", no "Omitidas", no "En vivo" and no arrow.
  - Day-1 plan gives Sin marcar 0.
- [x] T033 [US2] In `failed saves`, title "Cumplimiento del plan: counts move at once and roll back" (REQ-16): Cumplidas +1 and Pendientes −1 before the response with Sin marcar unchanged; back on a 500; the check-off sends exactly one request to `/api/` (the daily-log save), so the counts add none (tests/e2e/dashboard-real-data.spec.ts)
- [x] T034 [US2] Extend the T012 and T022 titles and add one: no plan shows "Sin plan activo" plus "Subir plan" on the counts card, with no figures and no arc (the empty state shared with the timeline, plan.md); no meals shows 0, 0, 0, 0 with an empty arc and "0 de 0 comidas cumplidas"; midnight moves yesterday's unchecked meals to Sin marcar; four-digit figures fit at 360px and at 200% zoom, light and dark (REQ-10, REQ-11, REQ-15, NFR) (tests/e2e/dashboard-real-data.spec.ts)

**Checkpoint:** US2b reviewed; titles shown red. Commit them alone as the red commit.

### Batch US2c: counts card (≈220 lines)

- [x] T035 [US2] Rewrite `ComplianceCard({ counts, since, hasPlan })` (src/components/nutrio/DataColumn.tsx):
  - "Desde …" header in place of "En vivo"; arrow removed.
  - Arc `role="img"` with its text, a hairline track and a `--nt-sky-deep` fill via `pathLength` and `stroke-dasharray`.
  - Planificadas at the centre; Cumplidas, Sin marcar and Pendientes with labels; plain numbers.
  - Empty states; no raw hex.
  - Remove the `// TODO: solo visual` comment.
  - REQ-12, REQ-15.
- [x] T036 [US2] Dashboard computes `compliance` from the optimistic `logs.list()`, with `start = dateKey(new Date(planCreatedAt))` and `useToday()`, and `sinceLabel`. It passes them to `ComplianceCard` (REQ-11, REQ-12, REQ-13, REQ-16) (src/components/nutrio/Dashboard.tsx)
- [x] T037 [US2] CSS (src/components/nutrio/dashboard.css): arc and figure layout for four-digit figures at 360px and at 200% zoom, with labels in `--nt-on-accent-sub` and the short-screen rules. Delete `.nt-live`, the `.nt-card.tone-sky .nt-arrow` rule and the gradient (REQ-15, NFR).
- [x] T038 [US2] Run tsc, unit tests and T032 to T034. Then run `dashboard-real-data.spec.ts`, `dashboard.spec.ts --grep-invert "screenshot"` and `metric-dials.spec.ts` in full, once each, and restore the screenshots folder.

**Checkpoint:** US2 complete. Review, commit (turns the US2b red commit green), then continue.

## Phase 5: Housekeeping

- [ ] T039 [P] [Housekeeping] DESIGN.md (tracked since T001), committed on its own (DESIGN.md):
  - Rewrite §8.12 (drop "solo visuales"): «Comidas de hoy» timeline and «Cumplimiento del plan» counts.
  - §3.2: add the new semantic tokens.
  - §3.5: add the ratios measured in T003.
  - §7: card icons `hand-platter` and `check`; the hero pager is named "Elegir comida".
  - D14.
- [ ] T040 [P] [Housekeeping] `grep -rn "solo visual" src` is empty; tick the spec's Progress list (all three items); update the BACKLOG entry for this feature (specs/dashboard-real-data/spec.md, specs/BACKLOG.md)
- [ ] T041 [Housekeeping] Final run, one at a time: tsc, unit tests, then `dashboard-real-data.spec.ts`, `dashboard.spec.ts --grep-invert "screenshot"`, `metric-dials.spec.ts` and `cooking-mode.spec.ts` in full; restore the screenshots folder. Save light, dark, 1280×768 (8 meals), 938px and 360px screenshots to the session scratchpad for the user. These are not committed.

**Checkpoint:** Feature complete. **Stop for the user's visual check** of the T041 screenshots.

## Phase 6: Snapshots (gated)

- [ ] T042 [Housekeeping] Only after the user's explicit yes to the visuals:
  - Regenerate the "home" snapshot with `npx playwright test tests/e2e/a-theme-visual.spec.ts -g "home looks as it did" --update-snapshots` (local, gitignored).
  - Rerun `tests/e2e/dashboard.spec.ts -g "screenshot|fits 1440×780|empty state"` to rewrite `specs/alt-dashboard/screenshots/dashboard-*.png` (the only task allowed to change them). This also closes dashboard-polish T038.
  - Commit the changed `dashboard-*.png` on their own; restore `account-menu-*.png` if touched (specs/alt-dashboard/screenshots/).
