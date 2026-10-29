# Plan: Assistant data scope

**Spec:** [spec.md](spec.md) (v1.5) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md) · **Checklist:** [checklists/ux.md](checklists/ux.md) · **Also:** chat-polish REQ-23 ([assistant-chat-polish/spec.md](../assistant-chat-polish/spec.md) v1.9)

## Decisions

- **D1 Server sends every button; the client derives nothing.** The repeat rule (chat-polish REQ-5) moves to the server, which knows the message and applies it to follow-ups only (REQ-5). Page suggestions, `chipsFor` and the scope-based chip lists are deleted. The per-page subtitle stays as a label only and never reaches the request (since v1.4, REQ-4).
- **D2 Resolution trace, test-only.** `resolved` (topic, slot ref, recipe ids, option, page or period) is added to the response only when the request carries `x-e2e-trace: 1` and `testHooks()` accepts it; production never returns it. Early US1/US3 tests may assert it while builders are pending, but **no REQ is covered by `resolved` alone**: every REQ has a test asserting answer text, kind or buttons (Coverage table in [tasks.md](tasks.md), audited in T063).
- **D3 Interim answers.** Until its builder lands, a topic answers with a one-block placeholder ("Pronto podré responder sobre <Title>."). No test asserts it, button sweeps skip it explicitly, and a T063 grep for "Pronto podré" returning nothing is a named merge precondition.
- **D4 Test hooks.** `testHooks(headers, env)` (src/lib/server/test-hooks.ts) returns `{ today?, fail?, trace }` from `x-e2e-today: YYYY-MM-DD`, `x-e2e-fail: chat` and `x-e2e-trace: 1`, only when `env.E2E_HOOKS === "1"` and `env.NODE_ENV !== "production"`; otherwise it returns `{ trace: false }`. `playwright.config.ts` sets `E2E_HOOKS=1` in `webServer.env`. The route reads request headers only through `testHooks()` (reviewer checklist item plus a T063 grep).
- **D5 Server log capture.** The e2e `webServer.command` becomes `sh -c "npx next dev -p 3200 2>&1 | tee tests/e2e/.server.log"` (gitignored). A helper reads the file from an offset taken before the request. Fallback if tee buffering proves flaky: the logger also appends to `E2E_SERVER_LOG` when set (test env only). T003 checks on first run that teardown leaves no `next` on :3200 and no cloned DB.
- **D6 Normalizer scope (since v1.4).** `normalizeText` (`src/lib/assistant.ts`, rewritten to spec Terms) is used by every chat path, the matcher and the shared step splitter only. `nutrition.ts normalize` (persisted by `canonicalHash`/`ingredientKey`) and `food.ts normalize` (dashboard, recipe page labels) are untouched; the chat stops importing `nutrition.normalize`.
- **D7 `kind` of a 2-block answer** is the first block's kind. The live region text and plain `answer` concatenate both blocks.
- **D8 Invalid or unparsable body** (malformed JSON, zod failure) returns 400 with no error-level log (since v1.4). Anything that throws after a successful parse returns 500.
- **D9 Shared weekly math takes an end day.** `progress.ts` week functions take `endDay`: the dashboard passes Sunday, the chat passes today. No future day can be logged from the dashboard and no test seeds one, so results are identical (since v1.4 Assumptions).

## Approach

**Server pipeline** (`ragAnswer(db, user, message, today)`), all pure over `AppDb`:
1. `words()` → `matchPhrases()` (multi-word entries first, longest wins, consumed words removed) → word matches (exact, stem, then fuzzy with the per-length allowance, first-letter rule and never-fuzzy list; Damerau OSA distance in-house).
2. `resolve()` applies REQ-6 in order. Output: `Intent[]` (at most 2 answered, the rest overflow buttons, REQ-24).
3. The date parser (`chat-dates.ts`) runs once and attaches a `Period` (or "default + fallback line") to metric intents.
4. Builders return `Block`s plus follow-ups. `reply()` merges blocks, applies the 2-block and one-option-block rules, the repeat rule, deterministic variants (REQ-28: index = hash of the normalized question mod the variant count; numbers come from one computed value shared by all variants) and the plain `answer`.

**Modules** (new unless noted; Constitution 3: each has at least two callers or replaces existing code):

| Component | Change | Files |
|---|---|---|
| Normalizer, words, wire types | modified: Terms normalizer; `Block`, `Button`, `ReplyKind`, `Intent`; scope types and page suggestions removed | src/lib/assistant.ts |
| Word/phrase matcher | edit distance, allowance, plural forms, phrase consumption | src/lib/domain/chat-match.ts |
| Vocabulary and topic table | rewritten: Topics table, starters | src/lib/domain/chat-topics.ts |
| Intent resolution | REQ-6 order, possessor, combinations | src/lib/domain/chat-intent.ts |
| Dish matcher | fuse.js over non-generic names, threshold from spike | src/lib/domain/chat-dish.ts |
| Slots, options, detail | slot refs and ordinals, almuerzo/merienda/snack, paging, labels, detail, complements | src/lib/domain/chat-meals.ts |
| Date phrases, today | `serverToday(now)` (America/Mexico_City via `Intl`, T011); phrase table, labels, clamp, fallback (US3) | src/lib/domain/chat-dates.ts |
| Shared progress math | pure, client-safe: Monday, week days, water goal (clamp 4–12), capped water, meals done, exercise days, weight stats; `endDay` param (D9) | src/lib/progress.ts |
| Metric answers | water, exercise, weight, meals done, goals, weekly progress | src/lib/domain/chat-metrics.ts |
| Answer assembly | rewritten: `ragAnswer`, `reply`, variants; cart and recipe-list builders kept | src/lib/domain/chat.ts |
| Step splitter | shared with the recipe page | src/lib/recipe-steps.ts; RecipeDetail.tsx |
| Route and errors | modified: 400 for parse/zod, inline 500 + `console.error` otherwise, hooks, `loadFor(user, "chat")` | src/app/api/rag/chat/route.ts; src/lib/server/test-hooks.ts; src/lib/domain/queries.ts (`needs.chat`) |
| Client state | modified: no scope or page suggestions; status-aware error; nav close | src/components/app/assistant.tsx; src/lib/client/api.ts (`ApiError` with `status`) |
| UI | modified: blocks, buttons (question or link, vertical variant, ArrowUpRight), bubbles, avatar, typing; ScopeSwitcher deleted; search bar without menu | src/components/shared/{AssistantChat,AssistantTurn,PromptSuggestion}.tsx, ResponseStream.tsx (copied), assistant-chat.css; AppShell.tsx; DashboardView.tsx; RecipeDetail.tsx; GroceriesChat.tsx |

## Data loading

- `needs.chat = union(cartCollections, recipeCollections, ["mealTypes", "mealOptions", "dailyLogs"])`. This covers sharedAddOns and their ingredientUsages (`source_type = "add_on"`). `db.users[0]` gives the name and goals.
- The dev Proxy throws on any collection not loaded; that surfaces as a 500 with a logged error. T064 asks one question per topic over a synthetic full-size dataset.
- Logs are mapped once to `Map<date, DayLog>` (about 365 rows per year).

## Interfaces (wire model; behavior in [contracts/chat-api.md](contracts/chat-api.md))

```ts
type Button =
  | { type: "question"; label: string; message: string; layout?: "option" }
  | { type: "link"; label: string; href: string };            // "/", "/plans", "/recipes/<id>"
type Block = { title: string | null; lead: Rich; sections: Section[]; buttons: Button[] }; // options, paging, nav links
type ReplyKind = "answer" | "options" | "detail" | "clarify" | "did_you_mean" | "greeting" | "no_match" | "empty";
type ChatAnswer = { answer: string; context_used: "Todo el sistema"; sources: string[]; kind: ReplyKind;
  blocks: Block[]; buttons: Button[] /* follow-ups then overflow, or starters/clarify */;
  resolved?: Intent[] /* only with x-e2e-trace under testHooks (D2) */ };
```

- The request is `{ message }`; zod strips `scope` and `recipe_id` from old clients.
- Batch 1a2 adds `blocks` and `buttons` but changes behavior (no scope, server repeat rule, new kinds); the old top-level `lead`, `body`, `sections`, `follow_ups` are kept only so the old client compiles, and are removed in T016 (Batch 1b2). Likewise `ScopeKey`, `SCOPE_LABEL` and the suggestion builders stay exported (unused after 1b1) until T016, so `npx tsc --noEmit` passes at every task commit.
- Errors: 400 = JSON parse or zod (`badRequest`, issues kept), no `console.error`. 500 = inline in the route: `console.error("[api/rag/chat]", { userId, messageLength }, error)` and `json({ error: "Internal error" }, 500)`. The client's `api()` throws `ApiError` with `status`; a 500 shows "Algo salió mal al responder. Intenta de nuevo."; other failures keep chat-polish REQ-8.
- UI rule: question buttons render only under the latest answer and are `aria-disabled` while pending. Links render on every answer. The live region holds the full text, and for option blocks adds a visually hidden "<n> opciones: a, b, c".

## Dependencies

| Dependency | Reason | Needs approval |
|---|---|---|
| fuse.js, exactly 7.5.0 | Fuzzy dish-name and did-you-mean ranking over multi-word phrases (REQ-3, REQ-26, REQ-29). Word-level typos stay in-house. Zero runtime deps, typed, Node ≥10. The spike (T024) fixes the threshold before it enters the repo. | **Given** by the user (spec Decisions, 2026-10-28). The orchestrator runs `npm install fuse.js@7.5.0 --save-exact` (T025). |
| prompt-kit `response-stream` | Copied source (zero deps) with MIT attribution, not a package. | no |

## Testing strategy

Playwright only (Constitution 1). Each story has its own spec file and chat user (chat-polish D2 pattern). Node-side tests in the same runner import pure modules (`testHooks`, `serverToday`, `matchWord`).

- **Harness (T004):** `seedPlan` seeds a deterministic fixture, never real data: 19 generic names spread over the slots ("Desayuno opcion 1", "Comida opcion 1", …, "Colacion opcion 4"), the REQ-3 fixtures "Pollo asado", "Ensalada de pollo", "Sándwich de atún", and distractors that must never fire for any REQ-3 row (e.g. "Pasta poblana", "Sopa de lima", "Atole de avena"). Real recipe names are used only in the T024 spike, in a scratch copy outside the repo. Tests needing other shapes pass their own `meals`.
- **REQ-3 fixture (spec v1.5, user-approved):** the committed REQ-3 table runs on the seeded deterministic fixture above; real recipe names are used only in the T024 spike and its batch note.
- **Button sweeps (REQ-5):** helper `resendSweep(request, answers)` re-sends every question button of the given answers as a first message and compares blocks; it fails if the swept set is empty or any answer is a D3 placeholder. Each story extends it to the buttons it creates (T072, T021, T026, T028, T031, T034, T048, T050); T063 runs the final sweep over every reply kind.
- **Parity (REQ-16):** Batch 3a first records a dashboard-only baseline of tile numbers for seeded logs (`timezoneId: "America/Mexico_City"`, `page.clock`), green before and after the refactor (T066). Each chat-side parity assertion is written before its builder, with the same pin: water and exercise in T042 (before T043), meals done and weight change in T044 (before T045), goals and weekly progress in T046 (before T047).
- **NFR (T064):** synthetic dataset (32 recipes, 69 meals, 365 daily_logs, goals, name, add-ons), one question per topic after a warm-up request; asserts no 500 and the spec v1.5 bound of 5 s, and logs the timings. Before merge the user runs the manual ≤1 s check on the real data (T065 batch note).
- **Red window (1a1 to 1b2):** T008 (Batch 1a1, on unchanged code) runs `npx playwright test --list` and commits the exact titles expected to go red (old-UI scope/chip tests) to `tests/e2e/.red-window.txt`. The grep covers the whole `tests/e2e/` directory; non-assistant hits (theme-palette "home scope menu") are recorded as "edited in task X". T008 also deletes or rewrites every assistant-api.spec.ts test tied to scope, the old kinds or the old follow-up lists, so assistant-api stays green at every checkpoint and is never listed. At the 1a2 and 1b1 checkpoints the failing set must be a subset of that file (` # ` suffixes are comments, stripped before comparing). An unlisted failure is either fixed in the same batch if it tests removed UI, or added by the orchestrator with a one-line reason if traced to the scope/chip removal; anything else blocks. `test.skip`, `test.fixme` and `test.fail` are forbidden on listed tests. The non-assistant specs (dashboard, theme-*, a-theme-visual; there are no recipes/groceries/plans spec files) and the new assistant specs run explicitly at both checkpoints. T013 deletes the file and moves the helpers to the new shape; T016 first checks that `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor" tests/e2e` is empty and tsc passes; the full suite gates the end of 1b2 and every later batch.
- **Every batch:** affected files while iterating, then one full `npm run test:e2e` (except 1a1, 1a2 and 1b1, see above). Runs are never parallel. Every new test is shown red by breaking its code.
- **Known failures on main:** `dashboard.spec.ts:91`, `:213` (data-dependent), the `a-theme-visual` cart snapshot.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Dev Proxy throws on a collection the chat did not load | 500s in dev and e2e | `needs.chat` covers every builder's reads; T064 asks one question per topic on a full-size synthetic dataset. |
| Dashboard parity regresses while math moves to `progress.ts` | Different numbers in chat and tiles | Batch 3a writes the dashboard baseline test (T066) first, green before and after T038; T042, T044 and T046 extend it to the chat before each builder. |
| Dashboard uses browser date, chat Mexico City (since v1.4 Assumption) | Off-by-one near midnight for a non-MX browser | Accepted by the spec; parity tests pin `timezoneId` and the clock. |
| About 190 assistant tests depend on chips, scope and the old matcher | Long red window; regressions hidden among expected failures | Exact red titles committed in `tests/e2e/.red-window.txt` (T008); failing ⊆ list at 1a2/1b1, no skip/fixme; 1b1 swaps state, renderer and pages; 1b2 churns tests and deletes the list; full run at the end of 1b2. |
| Test-only `resolved` masks missing copy | REQ "green" with no visible answer | D2 rule, Coverage table lists a text-asserting test per REQ, T063 audit. |
| Hooks leak to production | Pinned date or forced 500 in prod | Guard on `NODE_ENV` + `E2E_HOOKS`; node-side test with a non-test env; reviewer checklist item and grep that the route reads headers only via `testHooks()`. |
| Snapshot diffs (`assistant-look`, `a-theme-visual`) | Blocked gate | Reviewer judges confinement from the diff image, listed per test; two refreshes, T071 (end of 1b2) and T057 (end of 6c), each after the user's yes. |
| fuse threshold too loose or tight | Wrong dish opened | Spike first (T024); REQ-3 table plus distractors is the acceptance test. |
| Typing changes height after scroll decisions | Jumpy scroll (chat-polish REQ-11) | Lay out the full lead invisibly and type into an overlay. |
| tee log capture flaky, or orphan `next`/clone after teardown | REQ-23 log assertion fails; :3200 busy | Poll up to 2 s with the D5 fallback; T003 first-run orphan check. |
| Shared files across stories (chat.ts, chat-intent, chat-meals, chat-metrics) | Mixed-concern commits | Commit each task before the next task touches the same file; path-limited commits. |

## Constitution check

- [x] 1 Tests prove behavior: every REQ maps to a text-asserting e2e test before its code (Coverage table; `resolved` never suffices).
- [x] 2 The spec is the source of truth: plan follows spec v1.5; no spec edits here.
- [x] 3 No speculative abstraction: `progress.ts` has 2 users (dashboard, chat); `recipe-steps.ts` has 2 (recipe page, chat); `normalizeText` replaces chat's second normalizer. `testHooks` is one guard for three hooks with two callers (route, node-side REQ-13 test), kept as a module so the test can import it without Next (testability, REQ-13). The 500 handler is inlined in the route because no other route returns 500.
- [x] 4 Dependencies: only fuse.js 7.5.0, justified above with the user's yes on record.
- [x] 5 No secrets: hooks use a non-secret env flag; `.env.local` untouched.
- [x] 6 Errors: the 500 path logs route, user id, message length and stack; invalid input is 400 without an error log; no catch-all 400.
- [x] 7 Small changes: 26 review batches (F1a to 6c, plus Final), about 120–420 changed lines each including tests; 22 are at or under about 330. Over: 1a2 (~360, the former 1a) and 4b (~340) because of test tables (code ≤ ~250 each), and 1b1 (~400) because the page search-bar/subtitle edits must land with the tests that assert them; about 45% of 1b1 is deletions (code added ≤ ~220). These three are accepted by the user. New in revision 5: 1a1 (~420, about 80% assistant-api test deletions, no `src/` change), pending the user's confirmation. Path-limited commits per task.
