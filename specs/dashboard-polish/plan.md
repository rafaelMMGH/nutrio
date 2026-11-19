# Plan: Dashboard polish

**Spec:** [spec.md](spec.md) · **Version:** 1.3 · **Tasks:** [tasks.md](tasks.md)

## Approach

Three stories on the same surface, in priority order US1 → US2 → US3, split into review batches of at most ~300 changed lines (see tasks.md). `Hero.tsx` is edited by US1d and US3 only, one after the other.

**US1, persistence first.** Today `useDailyLogs.save()` swallows failures and rolls back the whole day log, and `toggleMeal` posts a full `meals_done` array computed from possibly stale state. That cannot satisfy REQ-4 or REQ-25 (per-meal rollback, last action wins). A pure core, `day-log-saves.ts`, owns the rules and is unit-tested with a fake `send`:
- `save(date, patch)` resolves `true` or `false` instead of swallowing (D15, constitution 6). The toast stays in one place, the hook, so it shows once. A boolean instead of a rethrow keeps the weight caller free of unhandled rejections.
- `setMeal(date, mealId, done)` changes one meal's membership optimistically and resolves `"saved" | "failed" | "stale"`. Each (date, meal) has a sequence number; only the latest action's failure rolls back, and only that meal (REQ-25c, d).
- Per-date request queue (user decision Q6): requests for one date run one after the other, each body built at send time from the current optimistic log. A rolled-back mark can never reach the server through a later request, and responses cannot arrive out of order. Meal B tapped while A's save for the same date hangs waits for A; A's later failure rolls back only A.

**US1, button (written in-house, Q4).** `src/components/arc/action-button/` is our own code on motion 14.14.0 and lucide-react (both installed). uiarc's action button is only the look and motion reference, credited in a header comment (uiarc.dev/components/action-button); no source is copied. Shape:
- Controlled: `state: "idle" | "pending" | "success"` and `onPress()`; no internal state or reset timer. `aria-pressed = state === "success"`, `aria-busy` while pending, presses ignored while pending (focusable, `aria-disabled`). One visually hidden copy of `label` is the stable name; the animated letters are `aria-hidden` (REQ-8). No `role="status"` inside: the hero owns the single region.
- `instantKey` prop: when it changes (another meal on screen) the next state paints with no letter, width or stroke motion (REQ-3). The button is **not** remounted per meal (today `key={meal.id}` remounts it), so focus survives auto-advance (REQ-6).
- Per-letter blur rise (spec note): the label is split into letters; a pure `changedLetters(prev, next)` (index-aligned) picks which letters rise from a soft blur with a small stagger; unchanged letters stay still. Width springs to fit; press scales to 0.97.
- Icon slot: idle arrow, pending a 14 px partial-ring spinner, success a check drawn with `pathLength`. **Spinner decision:** "Guardando" text plus the spinner (as in the reference); it rotates under normal motion and is a static partial ring under reduced motion.
- Reduced motion (REQ-7): instant fade only; no scale, width spring, stroke draw, letter rise or spinner rotation.
- Plain `action-button.css` with `arc-ab-*` classes mapping REQ-2 values through `--nt-*`. The label slot clips, not the button, so a `::before` extends the hit area to 44×44 px (REQ-2). Focus ring, two-tone box-shadow: 2 px inner `--nt-surface`, then 2 px outer `--nt-ink` (today's `--nt-focus` is about 2.2:1 on white, REQ-26). Forced colours: explicit border, `outline` in `Highlight`, `CanvasText` check (REQ-27).

**US1, hero.** `mark-logic.ts` (pure) holds `TAP_LOCK_MS = 400`, `ADVANCE_DELAY = 900`, `acceptTap({ pending, lockedUntil, now })`, `nextPending(meals, doneIds, from)` and `createAdvance(timers)` → `{ start(from, readDoneIds, go), cancel() }`: the target is computed at fire time from the latest done ids, and `cancel` is called on manual switch, unmark and rollback (REQ-6). Hero keeps per-meal `saving` (Set) and `lockedUntil` (Map). Button state = `saving ? pending : done ? success : idle`, with `done` read from the optimistic log: `saving` hides a mark until `"saved"`, while an unmark (never `saving`) shows idle at once and a rollback restores "Cumplida". The dials and Racha read the same log, so they move at once (REQ-9). The status region is a visually hidden `role="status"` placed **outside** `.nt-hero-copy` (already `aria-live`, must not nest): "Guardando", "Cumplida", "Comida desmarcada" for the meal on screen, "Cumplida" after a move to a done meal, silent on failure (REQ-24). HoldToConfirm (component, logic, CSS, unit test) is deleted (D19).

**Toast and assistive tech (spec note).** Sonner 2.0.7 renders `<section aria-live="polite">` (`node_modules/sonner/dist/index.mjs:1084`), mounted once in `ThemeRuntime.tsx`. The e2e failure test asserts the toast text sits inside that section; actual reading is a manual screen-reader check.

**US2.** `src/lib/streak.ts` (pure, string-date math via `daysBetween` from `progress.ts`) exports `streaks({ logs, slotIds, today }) → { current, best }` (REQ-11 to REQ-13). Planned meals are the schedule's `slotIds`, the same every day, so the free-day rule is unreachable today (Q7); an empty schedule gives `{ 0, 0 }`. `kpis.ts` gets `streakText({ current, best }) → { value, context }` (REQ-14); `countDoneToday` and `contexts.meals` go with their tests. Dashboard computes Racha from `logs.list()` (already optimistic: REQ-15 with no request). `useToday()` holds the date and recomputes it on `focus` and `visibilitychange` through a pure, exported `nextToday(current, now)` that returns `current` unchanged on the same local day (REQ-28). The tile gets an optional `unit` next to `RollingNumber` (`minDigits=1`, no dash); its visible parts are `aria-hidden` and one hidden phrase reads "Racha, N días, <context>" (REQ-29). Icon: lucide `Flame`.

**US3, pill in a sibling layer (Q1).** The text link, `COOK_DOT` dot and tooltip go. A new `.nt-cook-layer` is a sibling placed right after `.nt-plate` inside `.nt-plate-clip`. It is not keyed per meal, has no mask and no animation, and gets `z-index: 1`, `pointer-events: none`. It shares the plate's geometry by grouping selectors (`.nt-plate, .nt-cook-layer`) in the three existing rules: base (left 6%, width 128%, aspect 1.12, translate 0 -46%), `max-width: 1279px` (30% / 78%) and `max-width: 937px` (8% / 120%, translate 0 -38%). `mask-image` and `nt-plate-in` stay on `.nt-plate` alone. So the pill sits at the old dot point (44%, 55%, centred), follows the compact offsets, stays still while the plate animates in (REQ-30), and its `backdrop-filter` is not clipped by the mask. Only the pill has `pointer-events: auto`.

The pill is one `<Link className="nt-cook-pill">`: an `aria-hidden` round badge with lucide `Beef`, the title, and a subtitle `<span>` omitted when the trimmed name is empty; `aria-label` "Modo Cocina: <dish>" or "Modo Cocina" (REQ-20, 31). Look (Q5): smoked dark glass with white text in both themes, tokens scoped to the pill in `tokens.css` (`--nt-cook-glass`, `--nt-cook-glass-alpha`, `--nt-cook-edge`, `--nt-cook-sub`, `--nt-cook-opaque`, light and dark), so a unit test can composite them over the dish's lightest and darkest stops. Rules: `max-width: 70%` of the layer (= plate width); 60% and subtitle hidden at `max-width: 937px`; `min-height: 44px`; subtitle one line with ellipsis; opaque under `prefers-reduced-transparency: reduce`; explicit border and outline under `forced-colors`; hover and press brightness/scale in 120 ms, none under reduced motion; same two-tone focus ring as the button. Geometry at 360 px: plate 120% of the hero, pill centred at 44% of it, widest right edge about 97% of the hero: inside.

## Components

| Component | Change | Files |
|---|---|---|
| Day-log save rules | new (pure) | `src/components/nutrio/day-log-saves.ts` |
| useDailyLogs | modified: `save` → boolean, `setMeal`, per-date queue | `src/components/nutrio/useDailyLogs.ts` |
| Tap and advance rules | new (pure) | `src/components/nutrio/mark-logic.ts` |
| Action button (in-house) | new | `src/components/arc/action-button/{action-button.tsx,action-button.css,letter-diff.ts}` |
| Hero | modified (US1d, then US3) | `src/components/nutrio/Hero.tsx`, `dashboard.css` |
| Hold-to-confirm | deleted | `HoldToConfirm.tsx`, `hold-to-confirm-logic.ts`, `hold-to-confirm.css`, `tests/unit/hold-to-confirm.test.ts` |
| Streak | new (pure) | `src/lib/streak.ts` |
| KPI copy, tiles, today | modified / new | `src/lib/kpis.ts`, `DataColumn.tsx`, `Dashboard.tsx`, `useToday.ts` (new) |
| Pill tokens | modified | `src/components/nutrio/tokens.css` |

## Data model

None. No schema, migration, endpoint or request-shape change; the PUT body stays `{ meals_done }` / `{ weight_kg }`.

## Interfaces

- `useDailyLogs`: `save(date, patch): Promise<boolean>`; `setMeal(date, mealId, done): Promise<"saved" | "failed" | "stale">`.
- `Hero` props: `onToggle(mealId, done) => Promise<"saved" | "failed" | "stale">`.
- `ActionButton`: `{ label, pendingLabel, successLabel, state, onPress, instantKey?, className? }` plus native button attributes.
- `streaks({ logs, slotIds, today })`, `streakText({ current, best })`, `nextToday(current, now)`.

## Dependencies

| Dependency | Reason | Needs approval |
|---|---|---|
| none | motion 14.14.0 and lucide-react 0.468.0 are already installed; the button is our own code | no |

## Testing strategy

Unit tests (`npm run test:unit`, `node:test` with `mock.timers` for time) are written first and shown red:
- `day-log-saves.test.ts`: REQ-4 failure reported once; REQ-25c/d; queue (A hangs, B waits, A fails → only A rolls back).
- `mark-logic.test.ts`: REQ-25a/b; REQ-6 next pending, wrap, none; advance fires at 900 ms and not before, target read at fire time, cancelled by switch, unmark and rollback.
- `letter-diff.test.ts`: REQ-7. `streak.test.ts`: REQ-11 to REQ-13. `kpis.test.ts`: REQ-14. `use-today.test.ts`: REQ-28.
- `action-button-contrast.test.ts` (REQ-26), pairs per theme: label and arrow vs `--nt-surface` (idle and pending); label, check vs `--nt-ink` (done); spinner vs `--nt-surface`; focus ring outer `--nt-ink` vs the hero's background `--nt-bg`, outer `--nt-ink` vs inner `--nt-surface` (idle, inner merges with the fill), inner `--nt-surface` vs `--nt-ink` (done fill). The hero has no card: its background is the page's `--nt-bg`.
- `cook-pill-contrast.test.ts`: REQ-19/20, default and opaque, both themes, over the dish's lightest and darkest stops; focus ring pairs as above against the plate stops.

E2E (D20 plus Q2), run per batch with `npx playwright test <file> -g "<title>"`, one run at a time. Rewrites are written before the code they cover and shown red against the old UI:
- **US1:** the three "Marcar cumplida" titles and metric-dials "REQ-3: marking one more meal…" become a click via a `mark()` helper; they assert "Guardando", `aria-busy`, `aria-pressed` behind a held `page.route` (REQ-3, 8, 9), the advance window (not moved at 600 ms, moved by 1300 ms) and focus kept. New title '"Marcar cumplida": failed save, double tap and reduced motion' (REQ-4, 5, 7, 24, 25, 27): 500 route under `expectIssues`, `dblclick` counting PUTs, `emulateMedia({ reducedMotion, forcedColors })`, toast inside `section[aria-live]`.
- **US2:** rewrite "KPI tiles show real counts…", the reduced-motion comment, and the Comidas title → "Racha goes up by one when today's last meal is marked" (REQ-10, 14, 15). New title "Racha: streak rules, 999 at 360px and midnight": past `daily_logs` seeded via SQL and restored in `finally`; midnight via `page.clock.install` at real now, `setSystemTime(+1 day)` and a `focus` dispatch (avoids an SSR date mismatch); `ariaSnapshot` for the phrase.
- **US3:** rewrite cooking-mode "REQ-4/5: the dashboard hero links…". New title "Modo Cocina pill: layout, truncation and states" (REQ-16 to 23, 30, 31): widths at 1280/938/937/390/360, pill box unchanged and `getAnimations()` empty while the plate animates in, layer computed `mask-image: none`, 80-character name via SQL, empty name, forced colours, reduced transparency via CDP `Emulation.setEmulatedMedia`.
- **After the user's visual check (Q3):** regenerate the local `home` snapshot and the dashboard screenshot files.

Per batch: `npx tsc --noEmit`, `npm run test:unit`, then the batch's e2e titles. Never `next build` in place.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Timing assertions (900 ms, 400 ms, "Guardando") flake under load | false reds | Exact values in unit tests with mock timers; e2e holds responses with `page.route` and asserts windows |
| Per-date queue delays a second meal's save | longer "Guardando" on slow networks | Accepted (Q6) |
| Overlay layer drifts from the plate if a later change edits only `.nt-plate` | pill off the plate | Grouped selectors, plus the e2e box check at five widths |
| Pill at 360 px and dark theme unseen in a browser | poor look | Token contrast test; screenshots for the user at the US3 checkpoint |
| Dropping `key={meal.id}` from the button leaks state between meals | wrong label after a move | `instantKey` plus state derived from the meal on screen; carousel e2e |

## Constitution check

- [x] 1 Tests first: unit tests red before each module; e2e rewrites red before the hero and tile code. The hold-to-confirm test goes with its only user (D19).
- [x] 3 `day-log-saves`, `mark-logic`, `streak` and `nextToday` are pure extractions for testability (as `hold-to-confirm-logic` was), one caller each. `ActionButton` has one use and no options beyond the spec.
- [x] 4 No new dependency. 6: save failures reach the caller and the toast. 7: one commit per batch; the pre-existing annotations commit with the first batch as their own commit.
