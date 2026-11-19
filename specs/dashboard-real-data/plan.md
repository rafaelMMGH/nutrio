# Plan: Dashboard real data

**Spec:** [spec.md](spec.md) · **Version:** 1.2 · **Tasks:** [tasks.md](tasks.md)

## Approach

Two stories on the same pair of cards, US1 → US2, in review batches of about 300 changed lines (see tasks.md). Both are client-side computations over data the dashboard already holds; the only new input is the active plan version's `created_at`, passed through the existing page props. No schema, migration, endpoint, request or dependency change (D13).

**Foundation.** `page.tsx` passes `planCreatedAt: string | null` = `summary.activePlan?.current_version?.created_at` when `summary.schedule` is non-null, else `null`. `null` means "Sin plan activo"; a non-null value with `meals: []` means "Tu plan no tiene comidas" (REQ-10, REQ-15). Today `meals` alone cannot tell those apart. The cards keep their fixed light colours in both themes (`--nt-yellow` and `--nt-sky` are not overridden in dark), but `--nt-ink` flips in dark. So the new content uses new card-scoped tokens, never `--nt-ink` (see Tokens).

**US1, logic.** `src/components/nutrio/timeline-logic.ts` is pure and unit-tested first:
- `timelineRows(meals, doneIds)` returns `{ rows: { id, time, name, state }[], hasTimes }`, with state `"done" | "next" | "pending"`; "next" is the first unchecked meal in plan order, found inline (REQ-2). `time` is `time_window` as stored, or `null` when empty. The order is never changed (REQ-3). The name goes through `mealLabel`, like the hero.
- No `firstPending` or `resolveShown` (spec v1.2): the hero keeps its own opening and clamp rules verbatim (below), so neither would have two real uses (constitution 3).
- `rowLabel(row)` returns "07:00, Desayuno, Siguiente", or "Cena, Cumplida" when the time is absent (REQ-4).
- `listScrollTop({ top, bottom, scrollTop, height, pad })` returns the list's new `scrollTop` that brings a row fully into view, clear of the fade (`pad`), or the same value when it is already visible. Uses: following the selection (REQ-5) and the focused row (REQ-19). The list is scrolled with `list.scrollTo`, never `scrollIntoView`, so the page never moves.

**US1, selection and marking lifted into Dashboard (REQ-5, REQ-20).** Today Hero.tsx keeps `index`, the advance timer, the saving set, the tap lock and the status text, and `go(next)` ties them together. A row activation needs what `go` does, so all of that state moves up, verbatim, into `Dashboard`, and Hero becomes presentational. Hero's selection behaviour does not change (spec v1.2):
- Moved unchanged: `index` (with its `useState` initializer, "first pending, else 0"), `saving`, `lockedUntil`, `said`, `live`, `advance`, `advanceFor`, `mounted`, `reannounce`, `say`, `go(next)` and `press(id)`. `go` stays the one selection path for arrows, dots and the auto-advance, so clicking the dot of the meal already shown still re-announces it ("" then "Cumplida" after 80 ms, dashboard-polish REQ-24).
- Stale selection: `index` is never reset; Hero keeps `meals[Math.min(index, meals.length - 1)]`, so after a `router.refresh()` that changes the meals the hero clamps to the nearest index, as today. `Dashboard` derives `shownId = meals[Math.min(index, meals.length - 1)]?.id` for `live` and the timeline.
- Same-row activation: the caller decides, with no new handler or parameter (constitution 3). `Dashboard` passes MealTimeline `onSelect={(id) => (id === shownId ? advance.cancel() : go(meals.findIndex((meal) => meal.id === id)))}`. A click on the shown meal's row cancels a pending auto-advance, like a dot, and adds no announcement, consistent with REQ-20; any other row runs `go` exactly like a dot.
- Hero's pager `tablist` is renamed from "Comidas de hoy" to "Elegir comida" (spec v1.2), so only the list carries "Comidas de hoy". No e2e looks the pager up by name (all use `.nt-pager button`); T010 asserts the new name.
- Hero's dot `ref` callback refocuses the active dot only when focus is already in the pager, so a row activation never pulls focus to the hero (REQ-19). The meals do not change at midnight, so the index, and the selected row, are kept (Edge cases).

**US1, `MealTimeline.tsx`** (new, in place of `CaloriesCard` in `.nt-pair`, same `tone="yellow"` card, class `.nt-today`):
- Structure: the header is the `HandPlatter` icon (DESIGN §7 "Comidas de hoy") and `<h2>` "Comidas de hoy". Then `<ul aria-label="Comidas de hoy">` with one `<li>` per meal, each holding a native `<button aria-label={rowLabel} aria-current={selected ? "true" : undefined}>`.
- Row grid: `auto minmax(0,1fr) auto` (time, name with one-line ellipsis, state). The time column is left out when `!hasTimes`. Cumplida shows a lucide `Check` plus the word, Siguiente the word in a bordered pill, Pendiente the muted word. Every visible part is `aria-hidden`, because the button's `aria-label` carries the name.
- Behaviour:
  - Edge fades: a `scroll` listener plus a `ResizeObserver` set `data-fade-top` and `data-fade-bottom`.
  - An effect on `shownId` calls `scrollTo` on the list only. It uses `behavior: "instant"` under `prefers-reduced-motion: reduce` and `"smooth"` otherwise.
  - `onFocus` brings the focused row clear of the fade (REQ-19).
  - On click, `onSelect(id)` (Dashboard's same-row check, then `go`). Then, if `matchMedia("(max-width: 937px)")` matches, `window.scrollTo` puts the hero's top at the `.nt-topbar` bottom edge (REQ-9). This is instant under reduced motion and focus is never moved.
- Empty states (REQ-10): "Sin plan activo" plus a native "Subir plan" `<button>` that calls `useShell().openUpload()` (spec v1.2), or "Tu plan no tiene comidas".
- DOM order in `.nt-data` stays KpiRow, MetricsCard, then `.nt-pair` with `MealTimeline` before `ComplianceCard`; no CSS `order` reorders them, so Tab reaches Métricas before the rows (REQ-19).

**US1, CSS (`meal-timeline.css`, new).**
- Row sizing (REQ-7) is pure CSS. The list is a flex column with `flex: 1 1 0; min-height: 0; overflow-y: auto`, and rows are `flex: 1 1 0; min-height: 44px; max-height: <row>`. Rows stay at the default height while they fit, shrink evenly to 44px, then the list scrolls.
- Where the page itself scrolls (`max-width: 1279px`, spec v1.2), the list is `flex: none; height: min(calc(var(--nt-tl-rows) * <row>), <cap>)` with `--nt-tl-rows` set inline. So 7 or more meals tighten, then scroll.
- Fade: a `mask-image` on the list made of two linear gradients whose sizes come from `--nt-tl-fade-top` and `--nt-tl-fade-bottom` (0 or `<fade>`). A mask cannot catch pointer events and does not cover the card colour. `scroll-padding-block: <fade>`.
- Under `prefers-reduced-transparency: reduce`, `prefers-contrast: more` and `forced-colors: active`, the mask is replaced by a 1px `--nt-on-accent-line` border on the faded edges. The fade change is never transitioned (no motion to remove).
- Focus ring: 2px `--nt-on-accent` outline with a negative offset, inside the row box, so the list's overflow cannot clip it.
- Selected cue: a 4px `border-inline-start` in `--nt-on-accent` plus a name weight of 600. In forced colours it is `CanvasText`.
- Hover: background `--nt-yellow-hover`, 150ms ease-out, inside `prefers-reduced-motion: no-preference` only. Pressed: `--nt-yellow-press` with `transition: none` on `:active`. No scale or translate in any mode (REQ-18).
- The `.nt-cal-*`, `.nt-bars` and `.nt-hours` rules and their short-screen overrides are deleted from `dashboard.css`.

**US2, logic.** `src/lib/compliance.ts` (pure, string dates, `daysBetween` from `progress.ts`, like `streak.ts`) exports `compliance({ logs, slotIds, start, today })`, which returns `{ planned, done, unmarked, pending }`:
- `start` is clamped to `today` (REQ-12).
- Each day counts `new Set(meals_done) ∩ slotIds`, for days from `start` through `today` only. Duplicate ids, foreign ids and out-of-range dates are dropped (REQ-13).
- `pending` = `slotIds.length` minus today's done; `unmarked` = `planned − done − pending` (REQ-13, REQ-14). Empty `slotIds` gives all zeros.

`kpis.ts` gets `sinceLabel(startKey, today)`. It reuses the existing `SHORT_MONTHS` ("sep" for September, the app's existing abbreviation), giving "Desde 12 nov" or "Desde 12 nov 2025". The month names are written out by hand on purpose: `Intl` output differs between Node and browsers (`specs/bugs/meal-time-hydration.md`). `Dashboard` computes `start = dateKey(new Date(planCreatedAt))` (browser-local, Assumptions) and `compliance` from the optimistic `logs.list()`, so check-offs and rollbacks move the figures with no request (REQ-16).

**US2, card.** `ComplianceCard({ counts, since, hasPlan })` is rewritten in `DataColumn.tsx`:
- Header: "Desde …" replaces "En vivo". The black arrow is removed.
- Arc: a `role="img"` SVG with `aria-label` "X de Y comidas cumplidas". The track is a hairline; the fill is a `--nt-sky-deep` stroke using `pathLength="100"` and `stroke-dasharray`, so it is empty at 0 of 0.
- Figures: Planificadas at the centre; Cumplidas, Sin marcar and Pendientes below. Each has its text label and plain numbers. No "%" and no "Omitidas" anywhere.
- The "Sin plan activo" plus "Subir plan" empty state is shared with the timeline.
- The raw `#fff` and `#ffffff` in the SVG and dots are replaced by tokens.

## Components

| Component | Change | Files |
|---|---|---|
| Timeline rules | new (pure) | `src/components/nutrio/timeline-logic.ts` |
| Meal timeline card | new (replaces `CaloriesCard`) | `src/components/nutrio/MealTimeline.tsx`, `meal-timeline.css` |
| Hero | modified: presentational; selection, marking and announcement state move out; pager named "Elegir comida" | `src/components/nutrio/Hero.tsx` |
| Dashboard and page | modified: `planCreatedAt`, the lifted state, `go`, `press`, compliance | `Dashboard.tsx`, `src/app/(dashboard)/page.tsx` |
| Compliance rules | new (pure) | `src/lib/compliance.ts`, `sinceLabel` in `src/lib/kpis.ts` |
| Compliance card | rewritten | `DataColumn.tsx`, `dashboard.css` |
| Card tokens | new tokens | `src/components/nutrio/tokens.css` |
| Invented times | deleted (`mealTime`, `DEFAULT_TIMES`) | `src/components/dashboard/food.ts` |
| Docs | §8.12, §3.2, §3.5 | `DESIGN.md` |

## Data model

None. Records already carry `plan_versions.created_at` and `meal_types.time_window`; nothing is stored.

## Interfaces

- `DashboardProps.planCreatedAt: string | null`.
- `Hero({ meals, doneIds, index, saving, said, onSelect(index), onPress(id) })`, with `onSelect = go`. No ref, no imperative handle.
- `MealTimeline({ meals, doneIds, hasPlan, shownId, onSelect(id) })`.
- `ComplianceCard({ counts, since, hasPlan })`.
- `compliance({ logs, slotIds, start, today })`, `sinceLabel(startKey, today)`.
- `timelineRows`, `rowLabel`, `listScrollTop`.

## Tokens (DESIGN §3, "pedir un token nuevo cuando falte")

The new tokens are added in `.nt` only. The cards look the same in both themes, so no dark override is needed. The unit test still checks both themes, so a future dark override cannot regress unnoticed. The palette primitives (`--neutral-600`, `--butter-100`, ...) exist only as a proposal in DESIGN.md §11; `tokens.css` and the rest of `src` define none (`grep -- --neutral- src` is empty) and use raw hex. So a token is a `var(--…)` only where an existing `--nt-*` token holds the same colour and is not overridden in dark; otherwise it is hex with the primitive named in a comment. Adding the primitive layer is out of scope. `--nt-ink` (`#0e0e10`) cannot be reused: it flips in dark.

| Token | Value | Use | Ratio to measure (T003) |
|---|---|---|---|
| `--nt-on-accent` | `#0e0e10` (neutral-900) | text, icons, focus ring, selected marker on yellow and sky | ~15.5 yellow, ~13.4 sky |
| `--nt-on-accent-sub` | `#4b4e55` (neutral-600) | "Pendiente", times, labels | ~6.7 yellow, ~5.8 sky; also ≥4.5 on hover and press |
| `--nt-on-accent-line` | `var(--nt-on-accent-sub)` | 1px dividers that replace the fade | ≥3:1 |
| `--nt-yellow-hover` | `#faf1cc` (butter-100) | row hover | text pairs ≥4.5 on it |
| `--nt-yellow-press` | `var(--nt-yellow-accent)` (butter-300) | row pressed | text pairs ≥4.5 on it |

The arc fill stays `--nt-sky-deep` (~5.6:1 on sky, ≥3:1 required). DESIGN.md records the measured ratios (T039).

## Measurements (T002; fills the REQ-7 numbers)

The spec defaults are a 56px row, 44px minimum, 336px cap and 16px fade. The available list height in the current `.nt-cal` card (card content box minus header and gap) was never measured. The scout's estimate is about 200px at 1440×900, consistent with the 273px card in `specs/bugs/dashboard-fit-scroll.md`. T002 measures the card at 1440×900, 1440×780, 1280×768, 1920×1080, 1920×800, 937×900 and 390×844 and records the results here. It then fixes `<row>`, `<cap>` and `<fade>` (the 44px minimum is fixed) before any CSS is written.

| Viewport | card h | header + gap | list h | rows at 56 | Chosen |
|---|---|---|---|---|---|
| (to fill in T002) | | | | | |

## Dependencies

| Dependency | Reason | Needs approval |
|---|---|---|
| none | lucide `HandPlatter` and `Check` are in lucide-react 0.468.0, already installed | no |

## Testing strategy

Unit tests (`npm run test:unit`) are written first and shown red:
- `timeline-logic.test.ts`: REQ-2 example (C, S, C, P), all done, none done, foreign and duplicate ids; REQ-3 no times or partial times with order kept; REQ-4 labels; `listScrollTop` above, below, visible, clamped.
- `compliance.test.ts`: the REQ-12, REQ-13 and REQ-17 worked examples; the REQ-14 invariant over a deterministic grid of plans, logs (foreign, duplicate, before start, after today) and dates; start after today; no meals; the REQ-11 rollover, where the same logs on the next day make yesterday's unchecked meals Sin marcar.
- `kpis.test.ts`: `sinceLabel`. `real-data-contrast.test.ts`: the Tokens table, both themes.

E2E: a new `tests/e2e/dashboard-real-data.spec.ts` with its own SQL scenario helper. It backs up `meal_types`, `daily_logs` and `plan_versions.created_at` and restores them in `afterEach`, as the `metric-dials` helper does. The helper inserts `e2e-tl-*` meal types (names, times, count) into the active version and soft-deletes the originals. Midnight uses `page.clock` and a `focus` dispatch, as in the Racha title. Reduced transparency uses CDP `Emulation.setEmulatedMedia`. Contrast is read from computed styles in both themes. Failed saves run under `expectIssues`. Request counts use `page.on("request")` on `/api/`. Rewrites: the dashboard "yellow and sky cards are static" title, the fit and screenshot titles (`.nt-cal` → `.nt-today`), and the metric-dials clipped-cards list. The "home" snapshot and the screenshot PNGs are regenerated only after the user's visual check (Phase 6). E2E runs one at a time, only the batch's titles while iterating, and one full run of each affected file per batch. Five `dashboard.spec.ts` titles write the tracked `specs/alt-dashboard/screenshots/*.png` ("screenshot at", "screenshot in the dark theme", "fits 1440×780", "empty state", "account menu"). Full runs before T042 use `--grep-invert "screenshot"` and then `git checkout -- specs/alt-dashboard/screenshots/`; `git status --short` on that folder must be empty before any commit.

Fail-first is visible in history: each red e2e batch is committed on its own on the feature branch ("test(...): ... (red)"), then the implementation batch that turns it green. Each is one concern (constitution 7).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Lifting Hero's state breaks the shipped carousel, advance, tap lock or announcements | regressions in dashboard-polish REQ-6, REQ-24, REQ-25 | Lines move verbatim, `go` included; US1c and US1d rerun the carousel, "Marcar cumplida", failed-save and Racha titles; US1c also `cooking-mode.spec.ts`; T010a pins the active-dot re-announcement and the clamp before and after the lift |
| Today's clamp leaves no dot selected when `index` is past the end (only the last meal removed while shown) | pager shows no active dot; the timeline still marks the shown row | Preserved as is (spec v1.2, keep today's behaviour); not asserted; a fix is a separate bug |
| Dashboard grows by ~70 lines | harder to read | Accepted over a one-use hook or ref handle (constitution 3) |
| Body height at 1280×768 holds only 2–3 rows, so most plans scroll on short laptops | feels cramped | Accepted by REQ-7; T002 numbers shown to the user at the US1 checkpoint |
| SSR computes `today` and the plan start in the server's timezone, the client in the browser's | hydration mismatch near midnight | Same machine today (as `useToday`); e2e midnight uses `page.clock` after load |
| Browsers apply `mask-image` and `scroll-padding` differently on a scroll container | fade over the focused row | `listScrollTop` sets the scroll explicitly on focus; e2e checks the ring box against the fade |
| A held save crossing midnight | wrong day changed | `toggleMeal` captures the date at press; the per-date queue in `day-log-saves`; T022. If T022 fails, conditional T026a/T026b fix it |

## Constitution check

- [x] 1 Unit tests first (logic, counts, contrast). Each e2e batch is shown red and committed red on its own before the code that turns it green. The lift changes no behaviour, so T010a is a guard that passes before and after it; the new behaviours (pager name, same-row silence and advance cancel) are red in T010 first.
- [x] 3 No speculative abstraction. `listScrollTop` has two real uses; `firstPending` and `resolveShown` are dropped. No new selection handler: the timeline's caller chooses between `advance.cancel()` and `go`. No ref handle, no new hook, no new context.
- [x] 4 No dependency. 6 Save failures keep the existing toast and rollback path. 7 One concern per commit: DESIGN.md and PRODUCT.md tracked alone, then the D14 annotations (T001), each red test batch, each implementation commit, PNGs alone (T042).

## Gate 2 outcome (2026-11-19)

1. "Subir plan" is a button that opens the upload wizard (`openUpload`); spec v1.2 rewords REQ-10, REQ-15 and REQ-19.
2. DESIGN.md and PRODUCT.md are tracked: T001 commits them alone; T039 is committed normally. `.claude/agents/impeccable-*` and `.codex/` stay out.
3. The list cap at 938–1279px is accepted (same `<cap>` rule as ≤937px).
4. The hero pager is renamed "Elegir comida"; the list keeps "Comidas de hoy".
5. Hero selection stays as today: the active dot re-announces; a stale selection clamps to the nearest index.
6. A click on the shown meal's row cancels a pending auto-advance, like a dot, and is silent.
