# Plan: Cooking mode ("Modo Cocina")

**Spec:** [spec.md](spec.md) v1.0 (approved) · **Plan revision:** 1 (Gate 2 approved by the user on 2026-11-17) · **Size:** large (6 stories, browser speech APIs), still no data-model or API change and no dependency

## Approach

Modo Cocina is its own server-rendered route in a new route group, so it gets the session guard but not the `AppShell` frame: `src/app/(cooking)/recipes/[id]/cook/page.tsx` serves `/recipes/<id>/cook`. Next.js allows it because only the `cook` segment lives under `(cooking)`; `(dashboard)/recipes/[id]` keeps the recipe page. The page loads the recipe as the recipe page does (`loadFor(user, "recipes")` + `findRecipe`, `notFound()` when missing) and today's schedule with `loadFor(user, "dashboard")` + `dashboardSummary` (the hero's source), passing only the meals whose options use this recipe and the user's daily logs.

Logic stays in pure, unit-tested modules (constitution principle 1); React only wires them to the screen:

- `cooking-logic.ts`: screens `before → step 1..n → done` (or `before → no-steps → done`; `before` skipped without ingredients), `next`, `back`, `toggle(i)`, the "which meal" rule (REQ-16) and the resume rules (REQ-20).
- `durations.ts`: finds a duration in a step's text (digits, "un/una", "medio/media", ranges "5 a 7", "minutos/min/segundos/seg/hora(s)"), returns seconds or null (REQ-18).
- `voice-commands.ts`: maps a transcript to `next | back | repeat | null` (accent and case folding with the existing `normalizeText`, word-boundary match, last command in the phrase wins, one action per result) (REQ-22), and builds the text to read for each screen (REQ-23).

Steps come from `recipeSteps(recipe.description)`; ingredient rows reuse `foodIcon`, `isReadableName` and `qty` from `src/components/dashboard/food.ts`, so recipe page, assistant and Modo Cocina agree. Marking the meal reuses `send("/api/daily-logs/<date>", "PUT", { meals_done })` with the dashboard's "rest + id" rule.

Browser APIs are thin hooks, each returning a status the UI shows (principle 6: no silent failure, and no `console.error`, which fails the e2e suite):

- `useWakeLock(active)`: `navigator.wakeLock.request("screen")`, re-request on `visibilitychange`, release on unmount → `"on" | "unavailable"` (REQ-3).
- `useTimers()`: timers stored as end times (not intervals) so a hidden tab or a resume stays exact; one `requestAnimationFrame`/1 s tick while visible; at zero, a short Web Audio tone and `navigator.vibrate` (REQ-19).
- `useVoiceControl(onCommand)`: its own `SpeechRecognition` (`es-MX`, `continuous`, `interimResults: false`), auto-restart on `end` while enabled, stop on hide or unmount, pause during speech (REQ-21 to REQ-25). It reuses `recognitionCtor` from `useDictation.ts` (exported for this second use, principle 3). The Whisper engine is not used: it transcribes recorded clips and cannot listen continuously for commands.
- `speak(text)`: `speechSynthesis` with an `es-MX` voice when present, else any `es-*`; resolves on end so recognition resumes (REQ-25).

## Components

| Component | Change | Files |
|---|---|---|
| Route group layout (session guard, no shell) | new | `src/app/(cooking)/layout.tsx` |
| Page (recipe, matching meals, logs) | new | `src/app/(cooking)/recipes/[id]/cook/page.tsx` |
| Pure rules | new | `src/components/cooking/cooking-logic.ts`, `durations.ts`, `voice-commands.ts` |
| UI | new | `src/components/cooking/CookingMode.tsx`, `BeforeYouStart.tsx`, `TimerChip.tsx`, `cooking.css` |
| Hooks | new | `src/components/cooking/useWakeLock.ts`, `useTimers.ts`, `useVoiceControl.ts`, `speak.ts` |
| `recognitionCtor` exported | modified | `src/components/shared/useDictation.ts` (export only) |
| "Modo Cocina" button; `?edit=1` opens the edit dialog (REQ-13) | modified | `src/components/recipes/RecipeDetail.tsx`, `recipes.css` |
| "Modo Cocina" link on the hero (REQ-4) | modified | `src/components/nutrio/Hero.tsx`, `dashboard.css` |

CSS class prefix `ck-` (no Tailwind utility names). The "Antes de empezar" screen borrows the recipe page's illustrated media (`rx-media` look, `recipeMeta` tone) for the friendly header. Light and dark themes from the existing tokens.

## Data model

None. Resume state in `localStorage` key `nm-cooking:<recipeId>`: `{ screen, checked: number[], timers: { step, endsAt, pausedLeft? }[], ingredients, steps, savedAt }`, all access in try/catch (REQ-20).

## Interfaces

None new. Uses `PUT /api/daily-logs/<date>`.

## Dependencies

| Dependency | Reason | Needs approval |
|---|---|---|
| none | Wake Lock, Web Speech (recognition and synthesis), Web Audio, Vibration and Pointer events are browser APIs | no |

## Testing strategy

- **Unit, fail-first** (`tests/unit/cooking-logic.test.ts`, `durations.test.ts`, `voice-commands.test.ts`): screen order with and without ingredients and steps; back from step 1; marks and "¡Todo listo!"; meal choice; resume valid, expired at 12 h, discarded on count change, storage throwing; durations (digits, words, ranges, hours, none, "2 cucharadita" not a time); commands (accents, phrases, synonyms, double word, unrelated speech); read-aloud text per screen.
- **E2E** (`tests/e2e/cooking-mode.spec.ts`) is written in T019 but **not run** while the user's e2e freeze holds (spec D10). Browser APIs are stubbed in the page (`addInitScript`) so wake-lock, timer and voice paths are deterministic.
- **Manual check** by the user on a phone (Safari and Chrome): voice in a real kitchen, wake lock, timer sound. Listed in tasks.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Chrome's recognition stops after silence (~7–60 s) | Voice seems to die | Auto-restart while on (REQ-24); unit-test the restart decision; manual phone check. |
| iOS Safari recognition needs a user gesture and may ask permission each visit | Friction on iPhone | Toggle is the gesture; clear status text; documented in the manual check. |
| App hears itself reading | Loops ("siguiente" inside a step) | Pause recognition while speaking (REQ-25). |
| No `es-MX` synthesis voice on some devices | Odd accent | Fall back to any `es-*` voice. |
| Steps split oddly ("Para cocinar, Al sartén…") | Odd boundaries | Same split as the recipe page; out of scope. |
| `alt-dashboard` keeps moving (metric dials, sidebar) | Conflicts in `Hero.tsx`, `dashboard.css` | Hero task last and small; branch created only when the user says the dials work is committed. |

## Constitution check

- [x] 1 Tests: unit fail-first per rule; e2e written, run when the freeze lifts (status stays `partial` until then).
- [x] 2 Specs: implementation starts after plan approval.
- [x] 3 No speculative abstraction: `recognitionCtor` exported for a real second use; no shared meal helper unless identical.
- [x] 4 No new dependency.
- [x] 5 No secrets.
- [x] 6 Errors explicit: wake-lock, voice and save-failure messages.
- [x] 7 One concern per commit.
