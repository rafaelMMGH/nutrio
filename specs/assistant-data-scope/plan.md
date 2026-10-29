# Plan: Assistant data scope

**Spec:** [spec.md](spec.md) (v1.6) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md) · **Checklist:** [checklists/ux.md](checklists/ux.md) · **Also:** chat-polish REQ-23 ([assistant-chat-polish/spec.md](../assistant-chat-polish/spec.md) v1.9) · **Revision 7** (2026-10-29): batches re-estimated with tests after 1a2 and split at ~450 (revision 6: unit-first cadence, spec v1.6).

**User asks (nothing else needs a yes):** (1) `npm install fuse.js@7.5.0 --save-exact` (T025; yes already given in the spec); (2) the one snapshot refresh at the end of Batch E (T057); (3) the manual ≤1 s check on real data before merge (T065); (4) push and PR.

## Decisions

- **D1 Server sends every button; the client derives nothing.** The repeat rule (chat-polish REQ-5) moves to the server, which knows the message and applies it to follow-ups only (REQ-5). Page suggestions, `chipsFor` and the scope-based chip lists are deleted. The per-page subtitle stays as a label only and never reaches the request (since v1.4, REQ-4).
- **D2 Resolution trace, test-only.** `resolved` (topic, slot ref, recipe ids, option, page or period) is added to the response only when the request carries `x-e2e-trace: 1` and `testHooks()` accepts it; production never returns it. Early US1/US3 tests may assert it while builders are pending, but **no REQ is covered by `resolved` alone**: every REQ has a test asserting answer text, kind or buttons (Coverage table in [tasks.md](tasks.md), audited in T063).
- **D3 Interim answers.** Until its builder lands, a topic answers with a one-block placeholder ("Pronto podré responder sobre <Title>."). No test asserts it, button sweeps (unit and e2e) fail on it explicitly, and a T063 grep for "Pronto podré" returning nothing is a named merge precondition.
- **D4 Test hooks.** `testHooks(headers, env)` (src/lib/server/test-hooks.ts) returns `{ today?, fail?, trace }` from `x-e2e-today: YYYY-MM-DD`, `x-e2e-fail: chat` and `x-e2e-trace: 1`, only when `env.E2E_HOOKS === "1"` and `env.NODE_ENV !== "production"`; otherwise it returns `{ trace: false }`. `playwright.config.ts` sets `E2E_HOOKS=1` in `webServer.env` (done, T003). The guard is unit-tested (T005). The route reads request headers only through `testHooks()` (reviewer checklist item plus a T063 grep).
- **D5 Server log capture.** The e2e `webServer.command` becomes `sh -c "npx next dev -p 3200 2>&1 | tee tests/e2e/.server.log"` (gitignored). A helper reads the file from an offset taken before the request. Fallback if tee buffering proves flaky: the logger also appends to `E2E_SERVER_LOG` when set (test env only). The first e2e run is the targeted 3a2 merge run (Testing strategy, Batch gate; it does the same port/DB check); the first full run is Batch E: T076 checks there that teardown leaves no `next` on :3200 and no cloned DB (the T003 first-run check).
- **D6 Normalizer scope (since v1.4).** `normalizeText` (`src/lib/assistant.ts`, rewritten to spec Terms) is used by every chat path, the matcher and the shared step splitter only. `nutrition.ts normalize` (persisted by `canonicalHash`/`ingredientKey`) and `food.ts normalize` (dashboard, recipe page labels) are untouched; the chat stops importing `nutrition.normalize`.
- **D7 `kind` of a 2-block answer** is the first block's kind. The live region text and plain `answer` concatenate both blocks.
- **D8 Invalid or unparsable body** (malformed JSON, zod failure) returns 400 with no error-level log (since v1.4). Anything that throws after a successful parse returns 500.
- **D9 Shared weekly math takes an end day.** `progress.ts` week functions take `endDay`: the dashboard passes Sunday, the chat passes today. No future day can be logged from the dashboard and no test seeds one, so results are identical (since v1.4 Assumptions).
- **D10 Unit tests (since revision 6, spec v1.6).** `npm run test:unit` = `tsx --test tests/unit/*.test.ts`: Node 20 `node:test` + `node:assert/strict` through the installed tsx, no new dependency. The directory stays flat because Node 20 `--test` does not expand globs and npm's `sh` treats `**` like `*`. `@/` resolves through tsx's own tsconfig `paths` support (the `src/` modules use it internally, so relative imports in tests alone would not be enough); T073 proves it, fallback `tsx --tsconfig tsconfig.json --test …`, otherwise stop and report (tsconfig-paths is not allowed). Unit tests import only modules that do not transitively import `queries.ts`, `storage/store.ts`, `storage/pg.ts`, Prisma or `next/*` (e.g. `assistant.ts`, `chat*.ts`, `progress.ts`, `recipe-steps.ts`, `test-hooks.ts`, `validation/schemas.ts`, and through `chat.ts` also `plans.ts` (→ `storage/db`, `node:fs`, `pdf-plan` → unpdf), `cart.ts`, `nutrition.ts`), never a route; T073's smoke test exercises the `chat.ts` chain in U0. `memDb()` (tests/unit/memdb.ts) builds an in-memory `AppDb` from `emptyDb()` plus the same deterministic fixture the e2e `seedPlan` uses: `planFixture` moves to tests/shared/assistant-fixture.ts (no Playwright import) and both sides import it, so the fixtures cannot drift. Logic tests call `ragAnswer(db, user, message, today)`, the same path as `ask()`, with today passed directly (spec NFR Testability).

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
| Unit runner and fixture (D10) | new; `test:unit` script only, no dependency | package.json (`scripts`); tests/unit/*.test.ts, memdb.ts; tests/shared/assistant-fixture.ts; tests/e2e/assistant-helpers.ts (imports the shared fixture) |
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
- Batch 1a2 adds `blocks` and `buttons` but changes behavior (no scope, server repeat rule, new kinds); the old top-level `lead`, `body`, `sections`, `follow_ups` are kept only so the old client compiles, and are removed in T016 (Batch 1b2). Likewise `ScopeKey`, `SCOPE_LABEL` and the suggestion builders stay exported (unused after 1b1) until T016, so `npx tsc --noEmit` passes at each task's final commit (tsc rule in Testing strategy).
- Errors: 400 = JSON parse or zod (`badRequest`, issues kept), no `console.error`. 500 = inline in the route: `console.error("[api/rag/chat]", { userId, messageLength }, error)` and `json({ error: "Internal error" }, 500)`. The client's `api()` throws `ApiError` with `status`; a 500 shows "Algo salió mal al responder. Intenta de nuevo."; other failures keep chat-polish REQ-8.
- UI rule: question buttons render only under the latest answer and are `aria-disabled` while pending. Links render on every answer. The live region holds the full text, and for option blocks adds a visually hidden "<n> opciones: a, b, c".

## Dependencies

| Dependency | Reason | Needs approval |
|---|---|---|
| fuse.js, exactly 7.5.0 | Fuzzy dish-name and did-you-mean ranking over multi-word phrases (REQ-3, REQ-26, REQ-29). Word-level typos stay in-house. Zero runtime deps, typed, Node ≥10. The spike (T024) fixes the threshold before it enters the repo. | **Given** by the user (spec Decisions, 2026-10-28). The orchestrator runs `npm install fuse.js@7.5.0 --save-exact` (T025). |
| prompt-kit `response-stream` | Copied source (zero deps) with MIT attribution, not a package. | no |

## Testing strategy

Unit tests first (spec v1.6 NFR Testability, D10); e2e tests are still written with every task but run only in Batch E. Each story has its own e2e spec file and chat user (chat-polish D2 pattern) and its own unit file(s) in `tests/unit/`.

- **Unit (logic, fail-first proof):** every check that needs no browser, DB or server: `normalizeText`/`matchWord` and the REQ-2 table, `testHooks`, `serverToday`, `chatSchema` stripping, the date parser and labels (REQ-14 table with today passed in), `progress.ts` metrics, the resolver (REQ-6), the dish matcher (REQ-3 table on `memDb()`), slots, ordinals, option paging and labels, detail, `recipeSteps`, metric builders and copy (pluralization, units, empty ranges), variants (REQ-28), greeting/no-match/did-you-mean, multi-topic and clarify, identity, missing data. Each is shown red (unit run) before its code. The REQ-2/3/14 tables live only in unit tests.
- **e2e (written per task, run in Batch E):** UI (rendering, buttons, bubbles, avatar, typing, live region, focus, keyboard, nav closing, 360 px layout, snapshots), API contract over HTTP (400/500/log, `{ message }` only, `resolved` absent without the header, the pin header), REQ-16 chat-vs-dashboard parity (needs the dashboard), and per logic REQ one or two representative rows through `ask()`, so every REQ keeps an e2e test (spec v1.6).
- **tsc rule:** `npx tsc --noEmit` covers `tests/`, so it must pass at each task's final commit and at every batch checkpoint. A red tests-only commit (tests importing a module or signature not yet written) is exempt, but is never left as the batch tip or a worktree's merge tip. Since 1a2, each code task's red tests are committed immediately before that task's code (one-commit red window), never all up front.
- **Harness (T004) and fixture (T074):** the deterministic fixture (19 generic names, "Pollo asado", "Ensalada de pollo", "Sándwich de atún"; distractors "Sopa de lima", "Atole de avena", "Chilaquiles verdes", "Tacos de frijol") lives in tests/shared/assistant-fixture.ts; `seedPlan` inserts it over SQL, `memDb()` builds it in memory. Real recipe names are used only in the T024 spike, in a scratch copy outside the repo.
- **Button sweeps (REQ-5):** unit `sweep(db, answers, today)` re-asks every question button through `ragAnswer` and compares blocks; it fails on an empty set or a D3 placeholder. Since T020 (1a2 review M2) it also checks each button against an expected-topic map from the Topics "Button" column: exactly one `resolved` intent with that topic plus a text or `kind` assertion, since comparing two calls of a stateless function alone always passes; its `skip` list of pending builders shrinks as they land. Each story extends it (T072, T021, T026, T028, T031, T034, T046, T048, T050). The e2e `resendSweep` runs in T072 (partial) and T063 (final, every reply kind).
- **Parity (REQ-16), e2e only:** T066 records the dashboard tiles for seeded logs (`timezoneId: "America/Mexico_City"`, `page.clock`); T042, T044 and T046 extend it to the chat. Run once, targeted, at the 3a2 merge (Batch gate exception), then first in Batch E. Before that, T075 pins `progress.ts` to the same hand-computed numbers in unit tests; logs and expected numbers live once in tests/shared/progress-fixture.ts, used by T066 and T075.
- **NFR (T064):** synthetic dataset (32 recipes, 69 meals, 365 daily_logs, goals, name, add-ons) over HTTP, one question per topic after a warm-up; no 500, ≤5 s, timings logged. Manual ≤1 s check on real data by the user (T065).
- **Old-UI specs:** not run until Batch E (no red window). T008, T013, T016 and T069 still prune or rewrite them so they compile and match the new behavior; grep gates replace the runs.
- **Batch gate:** `npx tsc --noEmit` and `npm run test:unit`, nothing else; the reviewer re-runs only these two. While iterating, an agent runs only the unit files of the code it touches (`npx tsx --test tests/unit/<file>.test.ts`); the full unit run happens once per batch. **Single exception (user decision 2026-10-29):** at the merge of Batch 3a2 (T066 baseline, T038 refactor) the orchestrator runs `npx playwright test assistant-parity.spec.ts -g "dashboard"` once in the main checkout: one server start, one DB clone, nothing else running, foreground; afterwards `lsof -i :3200` is empty and `psql -l` shows no `*-e2e` DB. It uses the e2e config from T003 (already in). A failure blocks the 3a2 checkpoint and is fixed in 3a2; the result is recorded in the 3a2 batch note.
- **Batch E (stabilization):** one full `npm run test:e2e` (foreground, nothing else running), up to 3 fix rounds that rerun only the affected spec files, the red-by-breaking demo for e2e-only behavior (T077), the single snapshot refresh (T057), then one full rerun.
- **Known failures on main:** `dashboard.spec.ts:91`, `:213` (data-dependent), the `a-theme-visual` cart snapshot.

## Batches

Sizes are changed lines including tests (revision 7: the earlier estimates left tests out; 1a2 came in at ~557 vs ~360, tests ~64%, so remaining estimates are the old ones × ~1.6, except batches that were already mostly tests). Cap ≤ ~450. A batch whose running count passes its estimate by > ~50 lines stops at the next task boundary and is reported. Where one test task covers two code tasks, a split divides the test task by the code it covers (`part 1`/`part 2`, each committed just before its code). Worktrees only where marked; everything else is sequential because chat.ts, chat-intent.ts, chat-meals.ts and chat-metrics.ts are shared.

| Batch | Tasks | Lines | Parallel |
|---|---|---|---|
| F1a, U0, F1b, 1a1, 1a2 | T003–T011, T072–T074 | done (1a1 +46/-390; 1a2 +449/-108) | F1b beside 1a1 |
| 1b1a / 1b1b | T012, T014, T015 / T069 | ~430 / ~190 | — |
| 1b2 test churn, leftovers | T013, T016 | ~360 | — |
| 1c1 / 1c2 | T017–T019 / T070, T020 | ~380 / ~380 | 3a1–3a2 may run beside 1c1–3b2 |
| 1d1 / 1d2 | T021 pt 1, T022 / T021 pt 2, T023 | ~330 / ~170 | idem |
| 1e | T024–T027 | ~300 | idem |
| 2a1 / 2a2 | T028 pt 1, T029 / T028 pt 2, T030 | ~330 / ~170 | idem |
| 2b1 / 2b2 | T031 pt 1, T032 / T031 pt 2, T033 | ~300 / ~180 | idem |
| 2c1 / 2c2 | T034 pt 1, T035 / T034 pt 2, T036 | ~170 / ~340 | idem |
| 3a1 progress.ts / 3a2 dashboard refactor | T075, T037 / T066, T038 | ~320 / ~270 | one worktree from the 1b2 tip; merged before 3c |
| 3b1 / 3b2 | T039–T041 / T067, T068 | ~420 / ~350 | idem (3a beside) |
| 3c1 water / 3c2 exercise | T042, T043 pt 1 / pt 2 | ~260 / ~250 | — |
| 3d1 weight / 3d2 meals done | T044, T045 pt 1 / pt 2 | ~310 / ~200 | — |
| 3e | T046, T047 | ~430 | — |
| 4a / 4b1 / 4b2 | T048, T049 / T050 pt 1, T051 / T050 pt 2, T052 | ~460 / ~250 / ~290 | — |
| 5 identity | T053, T054 | ~240 | — |
| 6a1 / 6a2 | T055 (e2e, not run) / T056 | ~250 / ~260 | — |
| 6b1 / 6b2 / 6c | T058 / T059, T060 / T061, T062 | ~110 / ~370 / ~350 | — |
| E stabilization | T076, T077, T057 | ≤ ~450 per fix round incl. tests; T077 commits nothing | — |
| Final | T063–T065 | ~200 | — |

39 batches (5 done, 34 to go). The user accepted 1a1, 1a2, 1b1, 4b, 2c, 3c, 3d, 6a over the old ~300 target (2026-10-29); 1b1, 1d, 2a, 2b, 2c, 3c, 3d, 4b, 6a, 6b are now split (conservative). 4a (~460) has no clean split and sits at the cap.

**Worktree rules:** created from the current feature-branch tip; only write code and run tsc and unit tests (never e2e); path-limited per-task commits; each worktree needs `node_modules` (a symlink to the main checkout's is fine) for tsc and unit tests. Merged back by the orchestrator by cherry-pick or `git merge --no-ff` (a fast-forward is impossible once the main line has advanced), which then reruns tsc and `npm run test:unit` on the merged tip. T025 changes package.json after the 3a worktree is created, so the merged tip runs `npm ci` (or at least tsc) before the unit run. If a parallel batch finds it must edit a file the other batch owns, it stops and the two run sequentially.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Big-bang e2e at the end (no e2e run from F1b to 6c except the targeted 3a2 merge run) | Many failures surface at once in Batch E; UI regressions found late | Logic covered by unit tests per batch; small batches; e2e specs type-checked at each task's final commit and checkpoint; Batch E has up to 3 fix rounds rerunning only affected specs, then a full rerun; a 4th round goes to the user. |
| Dashboard refactor (T038) checked against T066 only by one targeted run before Batch E | Tile numbers change unnoticed | T075 pins `progress.ts` to T066's hand-computed numbers; reviewer diffs T038 for identical inputs and `endDay` = Sunday; at the 3a2 merge the orchestrator runs `npx playwright test assistant-parity.spec.ts -g "dashboard"` once (Batch gate exception; a failure blocks the 3a2 checkpoint); T066 is also the first spec run in Batch E. |
| tsx does not resolve `@/` or an import pulls Prisma/Next | Unit runner unusable | T073 proves it with an import chain through `@/`; `--tsconfig` fallback; import rule in D10; otherwise stop and report (no new package). |
| Unit fixture drifts from the e2e seed | Unit green, e2e red | One shared fixture module (T074) used by both. Shared data does not guarantee shared shape: `memDb` builds records directly while the SQL seed goes through `toRecord`/`extra` (extra-column keys, date formats). T074's memdb.test.ts compares the fixture records' key sets with the seed columns plus `extra` keys; value formats (dates) remain e2e-only. |
| Dev Proxy throws on a collection the chat did not load | 500s in dev and e2e | `needs.chat` covers every builder's reads (memDb has no Proxy, so only e2e catches it); T064 asks one question per topic on a synthetic full-size dataset. |
| Dashboard uses browser date, chat Mexico City | Off-by-one near midnight for a non-MX browser | Accepted by the spec; parity tests pin `timezoneId` and the clock. |
| Test-only `resolved` masks missing copy | REQ "green" with no visible answer | D2; Coverage table lists a text-asserting test per REQ; T063 audit. |
| Hooks leak to production | Pinned date or forced 500 in prod | Guard on `NODE_ENV` + `E2E_HOOKS`; unit test with a non-test env; route reads headers only via `testHooks()` (reviewer item, T063 grep). |
| Snapshot diffs (`assistant-look`, `a-theme-visual`) | Blocked gate | One refresh (T057) at the end of Batch E after the user's yes; reviewer judges confinement per test from the diff image. |
| fuse threshold too loose or tight | Wrong dish opened | Spike first (T024); unit REQ-3 table plus distractors. |
| `next dev` dies mid-run behind `\| tee` (D5, no `pipefail`) | Exit status is tee's; the run fails with a less clear message | Accepted; read tests/e2e/.server.log first. |
| Typing changes height after scroll decisions | Jumpy scroll (chat-polish REQ-11) | Lay out the full lead invisibly and type into an overlay. |
| tee log flaky, or orphan `next`/clone after teardown | REQ-23 log assertion fails; :3200 busy | Poll up to 2 s with the D5 fallback; T076 first-run orphan check. |
| Batch estimates leave out tests (1a2: ~557 vs ~360) | Long review rounds | Revision 7 counts tests (× ~1.6) and caps at ~450; running-estimate stop at +50 lines (tasks.md Global rules). |
| Shared files across stories | Mixed-concern commits, worktree conflicts | Commit each task before the next touches the same file; worktrees only where the Batches table allows. |

## Constitution check

- [x] 1 Tests prove behavior: every logic REQ has a unit test shown red before its code; UI- and HTTP-only behavior has an e2e test proven red by breakage in Batch E (T077); every REQ keeps an e2e test (Coverage table; `resolved` never suffices). **Tension:** the principle's parenthetical says "today that means a Playwright e2e test"; spec v1.6 (user decision) adds unit tests. This is an explicit user waiver (2026-10-29): the Constitution is not amended; the fail-first proof is a unit test for logic and the T077 demo for UI-only/HTTP-only behavior.
- [x] 2 The spec is the source of truth: plan follows spec v1.6; no spec edits here.
- [x] 3 No speculative abstraction: `progress.ts` (dashboard, chat), `recipe-steps.ts` (recipe page, chat), `normalizeText` replaces a second normalizer, `testHooks` (route, unit test), the shared fixture (e2e seed, `memDb`). The 500 handler is inlined (one route returns 500).
- [x] 4 Dependencies: only fuse.js 7.5.0 (user's yes on record). The unit runner adds a script, not a package.
- [x] 5 No secrets: hooks use a non-secret env flag; `.env.local` untouched.
- [x] 6 Errors: the 500 path logs route, user id, message length and stack; invalid input is 400 without an error log.
- [x] 7 Small changes: per-task path-limited commits; batch sizes (tests included) in the Batches table, cap ~450 after the revision 7 re-estimate; done overs 1a1 (~436) and 1a2 (~557) accepted by the user 2026-10-29; the other accepted overs (1b1, 2c, 3c, 3d, 4b, 6a) are now split; 4a sits at ~460.
