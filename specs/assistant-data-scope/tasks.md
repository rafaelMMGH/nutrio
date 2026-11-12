# Tasks: Assistant data scope

**Spec:** [spec.md](spec.md) (v1.7) · **Plan:** [plan.md](plan.md) (revision 9) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`. `[P]` = parallel with other `[P]` tasks in the same batch (different files, no shared dependency). IDs T066–T068 were added in plan revision 2; T069–T070 in revision 3; T071 in revision 4 (removed in revision 6, ID kept); T072 in revision 5; T073–T077 in revision 6 (unit-first cadence, spec v1.6); T078–T079 in revision 8 (spec v1.7; T025 dropped, ID kept); T080 in revision 9 (analyze round 1 of spec v1.7, split out of T079). They sit where they run.

**Batches:** each `Batch` is one implement/review cycle ending in a **Review checkpoint**. Sizes include tests. Batch table and worktree map: [plan.md Batches](plan.md#batches).

**Gate per batch (F1b to 6c):** `npx tsc --noEmit` and `npm run test:unit`, nothing else. The reviewer re-runs only these two. No e2e run before Batch E, with one exception: the targeted 3a2 merge run (Review checkpoint 3a2).

**Global rules:**
- **Unit first.** Every logic check (no browser, DB or server needed) is a unit test in `tests/unit/*.test.ts` (flat directory, plan D10), shown red before its code; that red unit run is the fail-first proof. Unit tests import only the pure modules listed in plan D10 and build data with `memDb()`.
- **e2e still written, not run.** Each task writes its e2e tests (UI, HTTP contract, a11y, focus, typing, navigation, chat-vs-dashboard parity, and one or two representative rows per logic REQ through `ask()`). They must type-check per the tsc rule below. They run first in Batch E (single exception: `npx playwright test assistant-parity.spec.ts -g "dashboard"` once at the 3a2 merge, user decision 2026-10-29; see Review checkpoint 3a2); UI-only and HTTP-only behavior gets its fail-first proof there (T077).
- **While iterating, run only what you touch:** `npx tsx --test tests/unit/<file>.test.ts` for the unit files of the code being changed. The full `npm run test:unit` runs once per batch, at the checkpoint.
- **Batch size ≤ ~450 changed lines including tests** (≈ the old ~300 src-only target; in 1a2 tests were ~64% of the lines: +330/-26 tests vs +119/-82 src, 557 total vs 360 planned). Estimates in the batch headers and plan Batches count tests (revision 7: previous src-only estimates × ~1.6). Done over the old target and accepted by the user 2026-10-29: 1a1 (~436), 1a2 (~557). Splits proposed in revision 7 are conservative (plan Batches).
- **Added vs deleted lines (after T013: +187/-989 vs ~360 estimated, 454 of them one whole-file deletion):** estimates and the ~450 cap count ADDED lines; deleted lines are tracked in a separate column. A whole-file deletion or rewrite task is its own batch.
- **Parallel rule (user, 2026-10-29):** when a reviewer reviews code the next code-writer phase will not modify or use, that phase starts in parallel with the review (in a worktree if the reviewer's tsc/test runs could be disturbed; on the same branch if the file sets are disjoint). If the review finds a problem in files the parallel phase touched, the orchestrator merges the fixes afterwards. Planner/spec edits (tasks.md, plan.md) always run in parallel with code work; the orchestrator commits docs path-limited.
- **Running estimate:** when a batch's running count of added lines (tests included) passes its estimate by more than ~50 lines, the implementer stops at the next task boundary, commits, and reports; the rest becomes a follow-on batch.
- **Split test tasks:** where a batch is split between two code tasks that one test task covers, the test task is split by the code task its rows cover ("part 1", "part 2"); each part is committed just before its code, so every batch tip is tsc- and unit-green.
- **Worktrees only where the plan marks batches independent:** F1b beside 1a1 (from the U0 tip), and 3a1–3a2 beside 1c1–3b2 (from the 1b2 tip, merged before 3c). Worktrees are created from the current feature-branch tip, only write code and run tsc and unit tests (never e2e), commit path-limited per task, need `node_modules` (a symlink is fine), and are merged back by the orchestrator by cherry-pick or `git merge --no-ff` (no fast-forward once the main line advanced), which reruns tsc and `npm run test:unit` on the merged tip. If one side must edit a file the other owns, both run sequentially instead. Everything else is sequential: chat.ts, chat-intent.ts, chat-meals.ts and chat-metrics.ts are shared.
- **e2e runs** (Batch E and Final only) are sequential and in the foreground (one cloned DB, port 3200); never two at once, never in the background, nothing else running.
- **tsc rule:** `npx tsc --noEmit` must pass at each task's final commit and at every batch checkpoint. A red tests-only commit is exempt but is never left as the batch tip or a worktree's merge tip (plan Testing strategy). **Red window (decided after 1a2):** red tests are committed per code task, immediately before that task's code, so the tsc-red window is one commit; a batch does not commit all its red tests up front (1a2 did: db42b49 left tsc red until 1b3be66).
- **Grep gates over old specs:** gates that look for removed names search `src` plus the old specs only: tests/e2e/assistant-{api,answers,next-step,a11y,composer,look}.spec.ts, tests/e2e/assistant-scope.spec.ts (until T013 deletes it), tests/e2e/theme-palette.spec.ts and tests/e2e/assistant-helpers.ts. The new negative-assertion files tests/e2e/assistant-noscope.spec.ts and tests/unit/chat-answer.test.ts are excluded explicitly; negative assertions on removed names live only there.
- Commits are path-limited and per task, tests first then code, the test commit separate from and just before its code commit (red window rule above); messages cite US, T and REQ IDs. Commit a task before the next task touches the same file; never `git add -A`. No `specs/` in commits unless the user asks.
- Never run `next build` in place, never add packages (spec v1.7: none; T025 dropped), no migrations.
- Copy is verbatim from spec Copy (es-MX).
- `resolved` (test-only, plan D2) may be asserted while a builder is pending, but no REQ is covered by it alone; each REQ's text assertion is listed in the Coverage table.
- **Known failures on main** (not this feature): `dashboard.spec.ts:91`, `dashboard.spec.ts:213` (data-dependent), and the `a-theme-visual` cart snapshot. Listed in the Batch E and Final notes.
- **Snapshots:** one refresh only, T057 at the end of Batch E, after the user's explicit yes. Confinement to the assistant panel/FAB or the dashboard search bar (REQ-4) is judged by the reviewer from the diff image, per test name.
- **prompt-kit attribution** (copied or adapted files): `// Adapted from prompt-kit (https://github.com/ibelick/prompt-kit), MIT License` plus the verbatim copyright line.

## Phase 1: Setup

- [x] T001 [setup] Create `feature/assistant-data-scope` from `main` (local, no push).
- [x] T002 [setup] Baseline: `npx tsc --noEmit` and a full `npm run test:e2e`. Record the pass/fail list (expect only the known failures). Nothing is committed.

## Phase 2: Foundational (blocks all stories)

**Batch F1a: harness** (done: 46e8553, bf7108e)

- [x] T003 [P] [foundational] e2e server env and log (playwright.config.ts, .gitignore). Its first-run orphan check moves to T076 (the first e2e run).
- [x] T004 [P] [foundational] Harness (tests/e2e/assistant-helpers.ts)

**Batch U0: unit runner and in-memory fixture**, about 200 lines

- [x] T073 [setup] Unit runner (package.json `scripts` only, tests/unit/smoke.test.ts), about 50 lines
  - Add `"test:unit": "tsx --test tests/unit/*.test.ts"` (plan D10: flat directory; Node 20 `--test` does not expand globs and `sh` treats `**` like `*`). No dependency change: `git diff package-lock.json` is empty.
  - Smoke test with `node:test` and `node:assert/strict` that imports through `@/` with a transitive `@/` value import (e.g. `words` from `@/lib/assistant`, `emptyDb` from `@/lib/storage/db`, which imports `@/lib/domain/nutrition`). It also imports `@/lib/domain/chat` and `@/lib/domain/plans` (plans.ts → storage/db, node:fs, pdf-plan → unpdf; plan D10) and calls the current `ragAnswer` on `emptyDb()`, so that chain is proven in U0. Shown red with a deliberately wrong assertion, then green.
  - If `@/` does not resolve: switch the script to `tsx --tsconfig tsconfig.json --test tests/unit/*.test.ts`. If that fails too, stop and report; relative imports in tests are not a fix (the `src/` modules use `@/` internally) and tsconfig-paths must not be installed.
  - Confirm `npx tsc --noEmit` type-checks `tests/unit` (tsconfig `include`) and Playwright ignores it (`testDir: ./tests/e2e`).
- [x] T074 [foundational] Shared fixture and `memDb()` (tests/shared/assistant-fixture.ts, tests/e2e/assistant-helpers.ts, tests/unit/memdb.ts, tests/unit/memdb.test.ts)
  - Move `planFixture`, its recipe/ingredient/description data, the add-on specs, `DEFAULT_MEALS`, `TIME_WINDOWS` and `PLAN_NAME` into tests/shared/assistant-fixture.ts (no Playwright or SQL import). assistant-helpers.ts imports them; `seedPlan` inserts exactly what it did before (a pure move, reviewed as such).
  - Helper fixes (F1a review), separate commit: `seedRecipes` calls `clearPlan()` first (meal_options/plan_version_recipes FK to recipes; doc comment and the seeders comment at ~line 111 say "reseeding recipes clears the plan"), and its `ingredient_usages` delete is limited to recipe sources (add-on usages stay with their shared_add_ons). `SERVER_LOG` is built from `__dirname`, not cwd.
  - `memDb({ meals?, times?, fixture?, supplements?, objective?, logs?, goals?, name?, cart? })` returns `{ db, user }` built from `emptyDb()`: user, plan, current version with `structured_data`, meal types, recipes with ingredient usages, meal options, plan_version_recipes, shared add-ons with `add_on` usages, daily logs and cart, with the same ids and fields as the SQL seed.
  - memdb.test.ts: fixture counts (19 generic, 3 table recipes, 4 distractors), slot and option numbers, add-ons; each memDb collection's record key set equals the keys the seed's rows produce through `toRecord` (model columns plus `extra` keys), checked against a key list kept beside the seed (no Prisma import). Value formats (e.g. dates) stay e2e-only (plan Risks). Shown red by breaking a count.

**Review checkpoint U0:** `npx tsc --noEmit`; `npm run test:unit` green. Batch note: how `@/` resolved.

**Batch note U0 (done, reviewer PASS in round 2; 4+2 commits 1dbe044..1967ec9):** `@/` resolved directly under `tsx --test` (no `--tsconfig` fallback needed). memDb defaults: `fixture: true`, `times: "all"`, name "Asistente memdb", user id `chat-e2e-memdb` (the e2e `seedPlan` keeps `fixture` off by default). Round 1 caught `__dirname` being undefined under Playwright's ESM loader; `SERVER_LOG` now uses `fileURLToPath(import.meta.url)`, and that load path is first proven in the 3a2 targeted run or Batch E. Carry-over notes: T010 must update `tests/unit/smoke.test.ts` (its `kind === "unknown"` assertion and the `ragAnswer(db, userId, message)` call change with the new `(db, user, message, today)` signature; hola should become `greeting`). T008 must know `seedRecipes` now clears the plan, so `assistant-api.spec.ts` lines ~411, ~424 and ~516 lose the plan after `seedPlan`; by reading chat.ts those answers don't use the plan. Optional (LOW): pin the plan/version/add-on id formats in memdb.test.ts.

**Batch F1b: test hooks, 500 path (chat-polish REQ-23)**, about 250 lines. May run in a worktree beside 1a1 (plan Batches).

- [x] T005 [chat-polish REQ-23] Tests
  - Unit (tests/unit/test-hooks.test.ts): `testHooks()` with a non-test env (no `E2E_HOOKS`, or `NODE_ENV=production`) ignores `x-e2e-fail`, `x-e2e-today` and `x-e2e-trace`; with the test env it returns them (plan D4). Red first (module missing).
  - e2e, written (tests/e2e/assistant-errors.spec.ts): injected failure → 500, body has no internal text, the log has route, user id, message length and stack; 501 characters → 400 with issues and no log entry; malformed JSON (`{"message":`) → 400, no error-level log; panel: 500 shows "Algo salió mal al responder. Intenta de nuevo." with Reintentar (retry works), 400 keeps "No pude responder en este momento.". UI injection via `page.route` adding `x-e2e-fail: chat` (unroute before Reintentar) and `postData: '{"message":'`; the UI itself never sends `x-e2e-*`.
- [x] T006 [chat-polish REQ-23] Server (src/lib/server/test-hooks.ts, src/app/api/rag/chat/route.ts)
  - `testHooks(headers, env)` per plan D4; the route reads headers only through it.
  - Route: JSON parse or zod failure → `badRequest`. Anything after → inline 500 with `console.error` (plan Interfaces). The `fail` hook throws inside the builder call.
- [x] T007 [chat-polish REQ-23] Client (src/lib/client/api.ts, src/components/app/assistant.tsx, src/components/shared/AssistantTurn.tsx)
  - `ApiError` with `status` (message unchanged for other callers).
  - The error turn records `server: status === 500` and renders the 500 copy. Reintentar is unchanged.
  - If this batch must touch tests/e2e/assistant-helpers.ts, it is no longer parallel with 1a1.

**Review checkpoint F1b:** tsc + unit. Reviewer checklist: hooks inert without `E2E_HOOKS` or under production (unit); **the route reads headers only through `testHooks()`**; 400 paths log nothing at error level (by reading the code; proven in Batch E).

**Batch note F1b (done; T005–T007, commits bd537de, 10f9b28, 9536424 in worktree branch worktree-agent-a961a3030b18fbcc7):** `testHooks(headers, env)` is active only when `E2E_HOOKS === "1"` and `NODE_ENV !== "production"`; it parses `x-e2e-today` (strict YYYY-MM-DD, a real calendar day), `x-e2e-fail: chat` and `x-e2e-trace: 1`. Route: a JSON parse or zod failure → `badRequest` (no log); everything after → 500 `{ error: "Internal error" }` with `console.error("[api/rag/chat]", { userId, messageLength }, error)`. Client: `ApiError(message, status)`; the error turn records `server: status === 500`. Unproven until Batch E: assistant-errors.spec.ts (500 status and body, the log format `messageLength:\s*N`, the 2 s fixed waits for "no log entry", the `page.route` injections). Any e2e run before Batch 1b2 (e.g. the 3a2 targeted run if it touches these files) shows the old-copy failures listed in T013 (500 mocks in assistant-next-step, -a11y, -answers, -look).

**Batch note F1b review:** reviewer verdict PASS (HIGH none). Findings folded into T013 (500-mock list, MEDIUM), T072 first sub-bullet (assistant-errors.spec.ts retry proof MEDIUM, sentinel instead of sleep LOW, renamed no-header test LOW), T011 (`x-e2e-today` warning, LOW), T010 (typed `body` in route.ts, LOW) and the Coverage row for chat-polish REQ-23.

## Phase 3: US1 (P1) Understand me, about everything

**Batch 1a1: assistant-api pruning**, about 390 lines (about 80% deletions; no `src/` change). May run beside F1b.

- [x] T008 [US1] assistant-api pruning (tests/e2e/assistant-api.spec.ts, tests/e2e/assistant-helpers.ts)
  - Grep the whole `tests/e2e/` directory for `home-search-filter`, `home-scope`, `Alcance`, `Preguntar en Todo`, `follow_ups`, `out_of_scope`, `missing_recipe`, `overview`, `chipsFor`, `defaultScope` and the `scope` request field. Record each hit in the batch note as "edited in task X": theme-palette.spec.ts:82-91 (`sharedUi` "home scope menu") → T069; assistant-api.spec.ts `FOLLOW_UPS`, `expectTopic`, `expectFixedReply`, the `FollowUp`/`ScopeKey` imports and their tests → T008; assistant-helpers.ts `ask` scope/`recipeId` parameters → T008; `buildAnswer`, `mockChat`, `UNKNOWN_LEAD`, `UNKNOWN_ANSWER`, `CAPABILITY_LINE` and the old-shape imports → T013; the old-UI assertions in assistant-scope, -answers, -next-step, -a11y, -composer, -look → T013. Known false positives to note and ignore: `.user-chip` (theme-switch, theme-palette), the `scope` option of `auditNow` (theme-audit.ts, theme-login), and bare `scope`/`overview` hits in theme-* files that do not touch the assistant.
  - Delete every assistant-api.spec.ts test asserting scope, recipe_id, `unknown`/`out_of_scope`/`missing_recipe`/`overview` kinds, UNKNOWN_LEAD, context_used by scope, or the old FOLLOW_UPS lists. Supersession for the batch note (title → task): chat-polish REQ-19 winners table, unknown reply in Todo, whole-word rule → T070 (unit) and T017; chat-polish REQ-20 scope/overview/missing-recipe tests, `context_used` by scope, the "Carrito actual" alias → T072; old fallback texts, the unknown-reply test, chat-polish REQ-6 "unrecognized question" → T048; Plan activo overview and Recetario "hola" → T048 and T050; "Esta receta" builder tests → T034; chat-polish REQ-5 follow-ups and page suggestions → T072 and T012; the `sources` test drops its out-of-scope case. Builder tests on cart, recipe list, plan and meal times stay, minus their `expectTopic`/scope parts, asserting no `follow_ups` and no kind other than `answer`.
  - `ask(request, message, { today?, fail?, trace? })` loses the legacy string form and its `ScopeKey` use (T004). `seedPlan`'s `fixture` stays opt-in (old specs seed recipes before the plan); every new spec passes `fixture: true`. Replace the "T008/T013 flip the default" comment (~line 177) with that rule.
  - Path-limited sub-commits are allowed (the helper edit; one per pruned test group).

**Review checkpoint 1a1:** tsc + unit; `grep -En "ScopeKey|FollowUp|FOLLOW_UPS|follow_ups|UNKNOWN_LEAD|expectTopic|scope|recipe_id|overview|out_of_scope|missing_recipe" tests/e2e/assistant-api.spec.ts` returns nothing; no `test.skip`/`fixme`/`fail` added. Batch note: the "edited in task X" hits and each deleted title with its superseding task.

**Batch note 1a1 (done; T008, commit babeb85, worktree branch worktree-agent-ab226b2ae9a589034, +46/-390):** about 50 generated tests deleted, each mapped to its superseding task (supersession list in T008); a single commit because tsc must pass. `ask(request, message, { today, fail, trace })` has no legacy string form; `fixture` stays opt-in; an `answer()` helper replaces `expectTopic`. Edited in task X: theme-palette.spec.ts:82-91 → T069; assistant-helpers.ts `buildAnswer`/`mockChat`/cart literals → T013; old-UI assertions in assistant-scope, -answers, -next-step, -a11y, -look → T013. False positives: assistant-helpers.ts:64 "scoped to the user", the `auditNow` `scope` option (theme-login, theme-audit), `.user-chip`.

**Batch 1a2: wire model and scope-free server**, about 360 lines planned, ~557 actual. After F1b (both touch route.ts).

- [x] T072 [US1] Tests REQ-4 (API), REQ-5, REQ-13 clock
  - First commit of the batch (these hold on the current server; tests/e2e/assistant-api.spec.ts): two e2e tests: (1) empty recipe book: `seedRecipes([])`, then `answer(chatContext, "¿Qué recetas tengo?")` asserts the lead "Aún no tienes recetas.", sections `[]` and sources `[]`; (2) soft-deleted recipe: `softDeleteRecipe` on one seeded recipe, then it is missing from the "Recetas" list. 1a1 review cleanups (LOW) in the same commit: drop the redundant `expect(body.kind).toBe("answer")` in the two REQ-18 tests (`answer()` already checks it), the double blank line after the header comment (~19-20), and reword or drop the stale comment at ~104 ("They need the builders of Batch 2b, so this group stays red until then"). F1b review cleanups in tests/e2e/assistant-errors.spec.ts, same commit: (a, MEDIUM) "Reintentar works" (~94-97) also asserts the panel does not contain `REQUEST_ERROR_COPY`, the Reintentar button has count 0, and the live region is non-empty (or matches the known answer text once T048 fixes it); (b, LOW) `expectNoErrorLog` (~29-32) drops the 2 s sleep: after the 400, send `ask(request, "x", { fail: true })` as a sentinel, wait with `logWith(log, INJECTED)`, then assert `LOG_MARK` occurs exactly once in `log.since()`; (c, LOW) rename "without the hook header the question is answered" (~50) so it no longer claims REQ-23's outside-test-environment criterion (that guard is unit-covered; see Coverage).
  - Unit (tests/unit/chat-answer.test.ts, tests/unit/schemas.test.ts, tests/unit/chat-dates.test.ts): over `memDb()`, `ragAnswer(db, user, message, today)` returns a `kind` in the allowed `ReplyKind` set (plan Interfaces), asserted against that set rather than the removed names; `context_used` = "Todo el sistema"; `blocks` and `buttons` present; `answer` equals the concatenated blocks; `resolved` only with the trace option. The server repeat rule on follow-ups. Add `sweep(db, user, answers, today)` to tests/unit/memdb.ts (plan Testing strategy) and sweep the starters and follow-ups whose builders exist (cart, recipes, meal times, plan); it fails on placeholders or an empty set. `chatSchema.parse({ message, scope, recipe_id })` deep-equals `{ message }`. `serverToday(new Date("2026-10-29T03:00Z"))` = "2026-10-28". Red first.
  - e2e, written (tests/e2e/assistant-noscope.spec.ts): the same answer with and without `scope` and `recipe_id` (incl. "Receta" + a recipe id) via raw `request.post`; `resolved` absent without the trace header; `resendSweep` over the starters. First fix `resendSweep` against vacuous passes (assistant-helpers.ts): per message assert `again.status` is 200, `body.kind` is defined, `first.body.blocks` is a non-empty array before the equality, and run the placeholder check over each input's block text too. REQ-5 is claimed only after T063.
- [x] T009 [US1] Wire types `Button`, `Block`, new `ReplyKind`, `Intent`, optional `resolved`. Keep old top-level fields so the old client compiles (src/lib/assistant.ts)
- [x] T010 [US1] Server answer (src/lib/domain/chat.ts, src/lib/domain/chat-topics.ts)
  - `ragAnswer(db, user, message, today)` with no scope; `reply()` builds blocks, buttons and `answer`.
  - Follow-ups become question buttons per the Topics table; server repeat rule; the 4 Topics starters.
  - `resolved` filled only when the route passes `trace`; topics with no builder use the D3 placeholder.
  - Update tests/unit/smoke.test.ts in the same commit: the new `ragAnswer(db, user, message, today)` call, and "hola" → `greeting` instead of `kind === "unknown"`. Revisit the `sources` test in assistant-api.spec.ts: `sourcesOf("¿Qué hago ahora?")` stays `[]` once it becomes `no_match`, and the test also asserts that kind (finalized in T048).
  - F1b review (LOW): when the route's `ragAnswer` call changes, type `let body;` (src/app/api/rag/chat/route.ts:13) as `z.infer<typeof chatSchema>`.
- [x] T011 [US1] Request, loading, today (src/lib/validation/schemas.ts, src/lib/domain/queries.ts, src/lib/domain/chat-dates.ts, src/app/api/rag/chat/route.ts)
  - `chatSchema` = `{ message }`; `needs.chat`; the route uses `loadFor(user, "chat")`.
  - `serverToday(now)` via `Intl` in America/Mexico_City; the route passes `serverToday(new Date())` and `trace` from `testHooks()`.
  - F1b review (LOW; src/lib/server/test-hooks.ts:24-25, tests/unit/test-hooks.test.ts): with hooks enabled, an `x-e2e-today` that is present but not a real day `console.warn`s once (or throws so the test fails loudly); still ignored in production. Unit test first.

**Review checkpoint 1a2:** tsc + unit. The old client still compiles (old top-level fields kept until T016).

**Batch note 1a2 (done; T072, T009–T011, commits 3a83c8a, db42b49, 606cf91, d7f42d5, 1b3be66; +449/-108, ~557 lines vs ~360 planned, tests ~64%):** reviewer PASS (HIGH none); findings folded into T020, T021, T039, T040, T048, T050, the smoke-test note in T017/T020 and the Global rules (running estimate, red window). Accepted implementer judgment calls: legacy kinds kept in `ReplyKind` until T016; `chipsFor` default branch; `follow_ups` derived from question buttons with scope "auto"; `context_used` literal; the TOPICS titles/follow-ups table done ahead (T020 owns triggers); minimal exact-word greeting/thanks (T049 owns variants and fuzzy); `answer` option-label lines left for T032; `x-e2e-today` parsed but unused until T041.
- **Order (LOW L2):** T011's warn test was committed with its code (d7f42d5), so its fail-first order is unproven; future tasks keep "test first, separate commit". db42b49 committed all red tests up front (tsc red until 1b3be66); from 1b1 on the red-window rule applies.
- **Expected red (MEDIUM M3):** assistant-noscope.spec.ts "REQ-5 every starter button…" stays red until the US3 builders (weight T045, weekly progress T047) and T021/T029–T032 ("Mi cena de hoy" → cena options) land. Batch E triage must not read it as a regression.
- **Interim UI until 1b1 (LOW L3):** the old client renders server follow-ups that now lead to `no_match` (e.g. Plan → "¿Cuál es mi meta?"), and `no_match` shows the page suggestions instead of the starters (assistant.tsx:48).
- **Unproven until Batch E:** noscope REQ-4 and REQ-13 `resolved`-over-HTTP tests; the two assistant-api tests that should hold today (empty recipe book, soft-deleted recipe); the `sources` test's `no_match` kind; assistant-errors sentinel check and Reintentar proof; the tee log path; the dev Proxy over `needs.chat`. Old-UI specs that contradict the new server are T013's, not regressions.

**Batch 1b1a: scope-free client state and button renderer**, about 430 lines with tests (revision 7 split of 1b1; ~45% deletions)

- [x] T012 [US1] Tests REQ-4 UI, REQ-5 client, e2e only, written (tests/e2e/assistant-noscope.spec.ts)
  - On a recipe page, "¿Qué hay en mi carrito?" gives the cart answer.
  - The search bar opens the panel and sends "¿Cuál es mi peso?"; the request carries only `{ message }` (copy asserted in T044).
  - No "Alcance", scope menu or "Preguntar en Todo" on `/`, `/recipes/<id>`, `/groceries` or `/plans`.
  - The 4 starters on every page; the same question on `/recipes/<id>` and on `/groceries` (different subtitles) gives identical visible answer text and buttons.
  - 360 px header row 1: title, "Nueva conversación" and ×, each ≥44×44, no overlap.
  - Placeholder "Pregunta por tu plan, tu avance o tus compras" and aria name "Preguntar al asistente".
- [x] T014 [US1] Client state (src/components/app/assistant.tsx, src/components/app/AppShell.tsx)
  - Remove scope state, `chipsFor`, page suggestions and `askInScope` scope; `send({ message })`, `askAssistant(message)`.
  - So every task commit type-checks: `askAssistant`/`askInScope` keep an optional, ignored `scope?: ScopeKey` and the page-context type keeps `defaultScope?`/`suggestions?` optional until T069 removes the call sites and then these parameters. `ScopeKey`, `SCOPE_LABEL` and the suggestion builders stay in src/lib/assistant.ts until T016.
  - The `AssistantChat`/`ScopeSwitcher` props stay optional or are still passed by AppShell until T015 removes them, or T014 and T015 land as one commit.
- [x] T015 [US1] Renderer and header (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/shared/assistant-chat.css; delete src/components/shared/ScopeSwitcher.tsx)
  - Render blocks (title, lead, sections, block buttons) and answer buttons; question buttons only under the latest answer; links (`next/link`) on every answer. Header row 2 removed.

**Review checkpoint 1b1a:** tsc + unit.

**Batch note 1b1a (done; T012, T014, T015, commits 43ef91c, ea7284e, 536d1a5; +244/-306, ~550 changed vs ~430 planned):** reviewer PASS (HIGH none); findings folded into T013 (MEDIUM 3, LOW 1), T016 (MEDIUM 1), T060 (MEDIUM 2) and T056 (LOW 2).
- **Size (LOW 4):** 303 lines are deletions in src (ScopeSwitcher 133, scope CSS, `chipsFor`). T014 and T015 landed as one commit (allowed: `Turn`/`AssistantRequest` live in AssistantTurn.tsx), so there was no earlier task boundary to stop at.
- **Recovery:** a partial edit was saved as a patch in the scratchpad (tsc red on its own) and re-applied after the T012 tests were committed, keeping test-first order.
- **360 px (LOW 3):** the T012 test applies the ≥44×44 check to "Nueva conversación" and × only, not the title (accepted reading of "each ≥44×44"; Batch E does not reopen it).
- **Expected red until T069:** assistant-noscope.spec.ts "REQ-4 the dashboard has no scope control…" and "REQ-4 the search bar opens the panel…" (placeholder and aria name).
- **Left for later:** `layout: "option"` styling → T032/T056; `sources` still rendered as "Basado en:"; the panel placeholder "Escribe tu pregunta" is unchanged (the spec placeholder applies to the search bar, T069).
- **Unproven until Batch E:** the T012 UI tests; the 360 px header grid; `next/link` rendering (first links arrive with T034/T048); the starters on all 4 pages; the request recorder seeing only `{ message }`; every `mockChat` spec red until T013; plus the 1a2 list above.

**Batch 1b1b: pages**, about 190 lines with tests
- [x] T069 [US1] Pages (src/components/dashboard/DashboardView.tsx, src/components/dashboard/home.css, src/components/recipes/RecipeDetail.tsx, src/components/groceries/GroceriesChat.tsx, src/components/app/assistant.tsx, src/components/app/AppShell.tsx, tests/e2e/theme-palette.spec.ts)
  - Search bar: scope menu, filter button and their CSS removed; fixed placeholder and aria name (spec Copy); `onAsk(message)`.
  - In the same commit as the CSS removal: delete the `sharedUi` entry "home scope menu" in tests/e2e/theme-palette.spec.ts (~82-91; it feeds the sweeps at ~336 and ~406). Named in the batch note.
  - RecipeDetail and GroceriesChat register a subtitle label only. Then drop the temporary optional parameters from T014.

**Review checkpoint 1b1b:** tsc + unit; `grep -rEn "home-search-filter|home-scope" src tests/e2e --exclude=assistant-noscope.spec.ts` returns nothing (old-spec grep rule in Global rules).

**Batch note 1b1b (done; T069, commit 9955f0e; +18/-91 vs ~190 estimated, 7 files):** reviewer PASS (no HIGH/MEDIUM); LOW findings folded into T013 (LOW 1), T057 (LOW 2) and T016 (LOW 3). `.home-search` padding changed `0 8px 0 20px` → `0 20px` (the 8px only seated the removed filter button); `useDismiss` kept (still used elsewhere in DashboardView); `HomeView.tsx` unchanged. The two T012 dashboard tests in assistant-noscope.spec.ts should now be satisfied.
- **Unproven until Batch E:** the T012 dashboard tests; subtitle-as-label parity on /recipes/<id> and /groceries; theme-palette sweeps without the scope menu; the home-dashboard snapshot diff (T057); plus the 1b1a list. assistant-answers, -next-step, -a11y and -look stay red until T013.

**Batch 1b2: test churn and leftovers**, about 360 lines with tests (mostly test rewrites and deletions, already counted)

- [x] T013 [US1] Test churn (tests/e2e/*.spec.ts, tests/e2e/assistant-helpers.ts)
  - Delete tests/e2e/assistant-scope.spec.ts. Move `buildAnswer`/`mockChat` to the new shape; replace `UNKNOWN_LEAD`/`UNKNOWN_ANSWER`/`CAPABILITY_LINE` and every `follow_ups` use.
  - 1b1a review (MEDIUM 3): `buildAnswer` in tests/e2e/assistant-helpers.ts (~405) returns `blocks: [], buttons: []`, so every `mockChat` user (assistant-a11y, -answers, -composer, -look, -next-step, -scope) renders an empty mocked answer and loses its content assertions until this task; assistant-composer.spec.ts joins the old-UI list below.
  - 1b1a review (LOW 1): in assistant-noscope.spec.ts "the subtitle is a label only", add `expect(recipe.buttons.length).toBeGreaterThan(0)` so the `buttons` equality cannot pass on `[] == []`.
  - Old specs that mock a 500 and expect "No pude responder en este momento." now get "Algo salió mal al responder. Intenta de nuevo." (F1b, T007; F1b reviewer line numbers, where the copy is asserted): assistant-next-step.spec.ts 317-318, 372, 391 and 512 (the "REQ-5 with REQ-8" describe), assistant-a11y.spec.ts 385 and 715, assistant-answers.spec.ts:84, assistant-look.spec.ts:112 (a snapshot, refreshed in T057). Vacuous after the change: next-step 330 and 338 (`not.toContainText(ERROR_COPY)` after the retry) assert the copy actually shown. Unaffected: a11y 185 and 480, next-step 402 and 427 (abort/timeout keep the generic copy); mocks of a 400 or a network error keep the old copy. Rule: a test about REQ-23 behaviour asserts the server-error copy; a test meant to cover chat-polish REQ-8's generic copy switches its mock to a non-500 status, at least one of them to 503 (today only 400 and abort cover "any other non-2xx"); a vacuous `not.toContainText` asserts the copy actually shown.
  - Rewrite to the new behavior, or delete, every test in assistant-answers, -next-step, -a11y, -composer and -look that asserts chips, scope, "Alcance", "Preguntar en Todo", the old placeholder, `follow_ups`, or the kinds `out_of_scope`/`missing_recipe`/`overview` (found by grep; 1b1b review LOW 1: also grep `Buscar en`, `menuitemradio` and `askFromSearchBar`, the search-bar scope helpers otherwise found only through "scope": assistant-next-step.spec.ts:54-60 `askFromSearchBar` and its callers at :180, :216, :246, `ASK_ALL` at :25 and the switcher at :63; assistant-answers.spec.ts:61 and its "Alcance: Todo" button assertions; assistant-a11y.spec.ts "Alcance: Todo" at ~138-143, 582-614, 771-773 and "Preguntar en Todo" at ~461-468, 668-675; assistant-look.spec.ts ~77, 178, 198-199; assistant-scope.spec.ts:388 `barScope` goes with the file). Batch note: each title rewritten or deleted, with its superseding task. No `test.skip`/`fixme`/`fail`.

**Batch note 1b2a (done; T013, commits c4e5954, 217975e, 026995c, 7b4a84f; +187/-989 vs ~360 estimated, 454 of the deleted lines one whole file):** reviewer PASS (no HIGH). c4e5954 deletes assistant-scope.spec.ts (-454); 217975e composer +54 (the four scope-free search-bar tests moved in); 026995c noscope +2 (non-empty buttons, LOW 1); 7b4a84f helpers/answers/next-step/a11y/look +131/-535, one commit because the helper exports changed and five files depend on them. Deleted tests → superseding tasks as reported: scope-only tests → T012/T015/T069; no-match tests → T048; server repeat rule → T072; 500 server copy and two 503 tests per the 500-copy rule above (applied).
- **Unproven until Batch E:** every rewritten or new test; the focus-wrap assumptions (first Tab stop "Nueva conversación"; empty thread: close button first; starters not in the Tab walk because the log has tabIndex -1, checked against AssistantChat.tsx); the one-row header geometry; 500/503/abort copy; the server repeat rule and starters in the real-API tests.
- **Carry-over (next task touching the file; T063 checks):** (L4) `ui.labels toHaveCount(0)` is trivially true except noscope:102; drop assistant-answers.spec.ts:38 and :51 and assistant-next-step.spec.ts:161. (L5) assistant-next-step.spec.ts:90-105 (thread kept across navigation): add `await expect(ui.userTurns).toHaveCount(1)` and `await expect(ui.assistantTurns).toHaveCount(1)` right after the navigation. (L6) re-add "renaming the recipe re-registers the page context" (subtitle "Sobre Ensalada verde" → "…2") as a subtitle-only test in assistant-noscope.spec.ts, or record it in T063 as an accepted loss.
- [x] T016 [US1] Leftovers (tests/e2e/assistant-api.spec.ts, src/lib/assistant.ts, src/lib/domain/chat.ts)
  - First, as the tests-first commit: move every remaining top-level `lead`/`sections`/`body` assertion in tests/e2e/assistant-api.spec.ts to `blocks`.
  - Gate before removing anything: `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor" tests/e2e` returns nothing, `grep -En "\.lead|\.sections|\.body" tests/e2e/assistant-api.spec.ts | grep -v "blocks"` returns nothing, and tsc passes. A hit goes back to T013. In this gate `.body` means the removed top-level response field `body`, not the HTTP `{ status, body }` that `ask()` returns; the gate was made literally empty by restructuring the file (see Batch note 1b2b).
  - Remove `ScopeKey`, `SCOPE_LABEL`, the suggestion builders and the old top-level response fields. 1b1b review (LOW 3): `Chip`, `dashboardSuggestions`, `groceriesSuggestions` and `recipeSuggestions` in src/lib/assistant.ts have no src consumers after T069 (reviewer grep), so their removal is safe.
  - 1b1a review (MEDIUM 1): one source for the 4 starters. `STARTERS` in src/components/shared/AssistantTurn.tsx:395 duplicates `STARTERS` in src/lib/domain/chat-topics.ts:44 (greeting/no_match); keep one client-safe constant (e.g. in src/lib/assistant.ts) imported by both, with a unit test (red first) pinning the four strings against the spec Copy.
  - T013 review (L7): delete the transitional `MockAnswer` type and use `ChatAnswer`; the checkpoint grep for `MockAnswer` over src returns nothing.
- T071 removed in revision 6 (the mid-feature snapshot refresh; the only refresh is T057 in Batch E).

**Review checkpoint 1b2:** tsc + unit; `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor|out_of_scope|missing_recipe|Preguntar en Todo" src tests/e2e --exclude=assistant-noscope.spec.ts` returns nothing (src plus the old specs; tests/unit and the new negative-assertion files excluded per Global rules). The 3a worktree may start from this tip.

**Batch note 1b2b (done; T016, commits c0d163a, a081709, df22634, 131d262, 6a48a8a; +88/-137 (reviewer numstat) vs ~250 added / ~150 deleted estimated):** reviewer PASS (no HIGH). c0d163a: assistant-api.spec.ts asserts lead/sections on `blocks` (+64/-61). a081709: red starters test. df22634: one `STARTERS` constant in src/lib/assistant.ts; AssistantTurn.tsx's export renamed `STARTER_BUTTONS`, AssistantChat.tsx follows; the duplicate in chat-topics.ts deleted. 131d262: removed `ScopeKey`, `SCOPE_LABEL`, `toScopeKey`, `FollowUp`, `LegacyReplyKind` (overview/unknown/out_of_scope/missing_recipe), `Chip`, `dashboardSuggestions`, `groceriesSuggestions`, `recipeSuggestions` and the top-level `lead`/`body`/`sections`/`follow_ups`; `ChatAnswer` is now `answer`, `context_used`, `sources`, `kind`, `blocks`, `buttons`, `resolved?` per plan Interfaces; `ReplyKind` = the eight contract kinds; schemas.ts keeps a comment that zod strips `scope`/`recipe_id`. 6a48a8a: `MockAnswer` deleted, `ChatAnswer` used. The step-1 `.body` gate was made literally empty by restructuring assistant-api.spec.ts: `answer()` returns the ChatAnswer directly, callers read `blocks[0].lead`, and `ask(...).body` spots destructure; `sourcesOf` and `nothing` were rewritten only to pass the literal gate.
- **Unproven until Batch E:** assistant-api.spec.ts reading `blocks[0]` was never run (the two tests that should hold today, empty recipe book and soft-deleted recipe, go through the new shape); the `STARTER_BUTTONS` rename at runtime; `buildAnswer`/`mockChat` typed as `ChatAnswer` (type-only); the `sourcesOf`/`nothing` rewrites.
- **Carry-over:** (M) `answer()` in tests/e2e/assistant-api.spec.ts (~line 61) says "with one block" but asserts nothing → T050 (or the first earlier batch touching the file). (L3) `askInScope` still carries "scope" → T056. (L4) `STARTERS` (src/lib/assistant.ts:10) is a mutable `string[]` shared by client and server: make it readonly/`as const`; done in 1c1 as a tiny commit if tsc allowed (T018).

**Batch 1c1: normalizer and word matcher**, about 380 lines with tests

- [x] T017 [US1] Unit tests REQ-2 (tests/unit/chat-match.test.ts)
  - The full REQ-2 matcher table on `matchWord`, each ✓ and ✗ row (incl. "una planta" ≠ "plan"), plus multi-word phrase consumption and `normalizeText` per spec Terms (ñ→n, punctuation → space). Red first.
- [x] T018 [US1] `normalizeText` per spec Terms and `words` (src/lib/assistant.ts)
  - 1b2b review (L4): make `STARTERS` (src/lib/assistant.ts:10) readonly/`as const` as a tiny separate commit; record "done in 1c1" if tsc allowed, else carry it.
- [x] T019 [US1] Matcher (src/lib/domain/chat-match.ts)
  - OSA distance and length allowance (≤4 exact, 5–7 one edit, ≥8 two); singular/plural (s, es, z→ces); `*` stems exact prefix only.
  - First-letter rule, never-fuzzy words, no fuzzy when the word exactly equals any entry.
  - Multi-word phrases with per-word allowance; the longest phrase consumes its words.

**Review checkpoint 1c1:** tsc + unit (T017 green).

**Batch note 1c1 (done; T017, T018, T019; +136/-10 vs ~380 estimated; reviewer PASS on all three, no HIGH; ~110 independent probe rows incl. the full REQ-2 table, none divergent):** commits 23b5660 (tests/unit/chat-match.test.ts +63, red), 07b3cab (src/lib/domain/chat-match.ts new ~60 lines + test tweaks, +65/-3), 3e441c1 (src/lib/assistant.ts + chat.ts, +10/-9), 488d61f (`STARTERS` readonly tuple `as const`, +1/-1; 1b2b L4 done). T-label swap: the commit messages carry the wrong T ids vs this file (07b3cab says T018 but is T019, the matcher; 3e441c1 and 488d61f say T019 but are T018, normalizer and STARTERS); history not rewritten (needs the user's say). `normalizeText` per spec Terms: NFD, strip `\p{M}`, every non-letter/non-digit run → one space, trim; chat.ts `planSummary` uses it and chat.ts no longer imports `nutrition.normalize`; nutrition.ts and food.ts untouched (persisted fingerprints safe). API: `matchWord(word, entries)` returns the matched entries; `matchPhrases(tokens, phrases)` returns `{ phrase, from, to }`, longest first, consumed words not reused. Plurals live in the matcher (entry, +s, +es, z→ces; allowance computed on the singular length); `*` stems exact prefix only, never fuzzy; never-fuzzy words exact-only as input and as entries; first letter must match; OSA distance (swap = 1 edit); 22 table rows run. Deviation accepted: the test file was edited inside code commit 07b3cab (row-order fix: the original lleva row asserted a non-match of an exact entry). Accepted: `ñ` compares as `n` (spec Terms), so año/ano and caña/cana collide. Decimals split under `normalizeText` ("1,5 L" → "1 5 l"): number and date parsing must not rely on `words` for decimals (noted in T039, T040, T043, T045). Step-splitter move to `normalizeText` deferred to T035 (recipe-steps.ts does not exist yet). Unproven until later batches: chat-match.ts has no caller until T070/T020; stems inside phrases in `matchPhrases` untested.

**Batch 1c2: vocabulary through the answer path**, about 380 lines with tests (incl. the 1a2 sweep fix in T020)

- [x] T070 [US1] Tests REQ-1, REQ-2
  - Unit (tests/unit/chat-answer.test.ts): through `ragAnswer` on `memDb()`, the REQ-1 Givens whose topic list equals the matched topics in order of first appearance (`resolved` plus answer text for cart, recipes, meal times, plan); the REQ-2 table end to end (each ✓ row resolves to its topic, each ✗ row does not, incl. "una planta" not resolving to Plan); "¿Qué hago ahora?" and "¿Qué cosas tengo?" → `no_match` with the starters; the chat-polish REQ-19 winners table re-created in the new vocabulary. Red first.
  - 1c1 review, FIRST step of 1c2, red unit test first (tests/unit/chat-match.test.ts, then src/lib/domain/chat-match.ts): (M) `matchPhrases` loses exact-beats-fuzzy between rival phrases: `matchPhrases(["me","llevo"], ["me lleva","me llevo"])` returns `me lleva`; it must return `me llevo`. (L2) missing rows: peso→pero ✗, peso→paso ✗, an 8-letter one-edit ✓ and a 3-edit ✗, a 9-letter 3-edit ✗, "panes"→"pan" ✓. (L3) a rival-phrase ✗ case, "hola hola" returns two matches, and the tie order of equal-length phrases.
  - e2e, written (tests/e2e/assistant-match.spec.ts): through `ask()`, one REQ-1 Given with answer text, one ✓ typo row and one ✗ row of REQ-2.
- [x] T020 [US1] Vocabulary (src/lib/domain/chat-topics.ts, src/lib/domain/chat.ts)
  - Every Topics trigger, the frozen recipe-list filter words, the Button/Title/Follow-ups table, the starters.
  - Interim until T023: the intent list is the matched topics in order of first appearance, capped at 2 plus overflow, no REQ-6 rules.
  - chat.ts drops its `nutrition.normalize` import (plan D6; done in 1c1, 3e441c1).
  - 1c1 review (L5): the matcher does not normalize entries and NEVER_FUZZY is accent-free, so vocabulary entries are listed in the singular and normalized (accent-free) when the vocabulary is built; a unit test asserts every entry equals `normalizeText(entry)`. Known: the `es` form is generated for every entry (contrived inputs like "carritoex" match "carrito"), accepted.
  - 1a2 review (MEDIUM M2, LOW L7), tests first in a separate commit before the code (tests/unit/memdb.ts, tests/unit/chat-answer.test.ts, tests/e2e/assistant-helpers.ts, tests/unit/smoke.test.ts): `sweep` and `resendSweep` today compare two calls of a stateless function, so "same blocks" always passes. Add an expected-topic map built from the Topics "Button" column (message → topic) and, per swept button, assert exactly one `resolved` intent with that topic plus a text or `kind` assertion (lead text, or kind ≠ `no_match`); `resolved` is never the only evidence. Drop "Mi cena de hoy" from the "with a builder" sweep test (chat-answer.test.ts ~102-106) and add it to `skip` until T021. smoke.test.ts also asks "¿Qué hay en mi carrito?" on `emptyDb()` so the chat → cart chain stays exercised.

**Review checkpoint 1c2:** tsc + unit.

**Batch note 1c2 (done; T070, T020 plus the T019/T017 carry-over items; review round 1 FAIL (tests only), round 2 PASS; code commits 01c5d3b..0b2ae4c, fix commits 8102f7d..ecb2925; tsc clean and unit 342/342 at ecb2925):** the code matches the spec; every finding is a missing or weak test. T070 and T020 stay unticked until the re-review passes. Fix round 1 (code-writer; tests/unit plus src/lib/domain/chat.ts) covers: (H1) a data-driven vocabulary table that runs every Topics trigger through `ragAnswer` (exact and one typo where the allowance permits); (H2) a test that freezes the recipe-filter word list (`DROPPED_WORDS`) against spec Terms; (M1) pin the TOPICS table (title, button, follow-ups per topic); (M2) de-dup buttons in `ragAnswer`, so "agua, ejercicio y peso" yields a single "Mi peso"; (M3) tests for the block cap (2) and first-appearance order, plus the overflow buttons; (L3/M7) rows for tie order between equal-length phrases, stem-prefix matching and NEVER_FUZZY isolation (a never-fuzzy word neither fuzzy-matches nor is fuzzy-matched). Findings the fix round does not cover were given owners: M4 → T048/T049, M5 → T021/T022, M6 → T023, T029, T047, T052, T054, T063, T076 (see those tasks). Open questions for the user (LOW spec gaps, not decided here): see "Open questions 1c2" below. Commit-label notes: bd015f8's "REQ-19 rows" means **chat-polish** REQ-19 (the old winners table), not this spec's REQ-19 (Weight); the 1c1 review items (matchPhrases exact-beats-fuzzy, L2/L3 rows) were filed under T070 here but committed under T019/T017 labels. History is not rewritten. Fix-round commits 90f5458 (stem-prefix, never-fuzzy isolation, tie-order rows) is labeled T019; the rest T020. Round-2 follow-ups (not blocking) were folded in: MEDIUM third topic without a button → T021 part 2/T023; LOW chat-match rows (cuantos/cuanta/cuantas vs cuando, reverse-order `matchPhrases`) → T021 part 1; LOW recipe-filter prefix mid-word → T021 part 2; maintenance notes on chat-answer.test.ts filter-word rows, `deepEqual(TOPICS, SPEC_TOPICS)` and the "no entry ends in s" assertion → T023, T026, T028.

**Open questions 1c2 (for the user; the current behavior stays until answered):**
1. "receta del pollo" / "ingredientes del pollo": the spec lists only "de" as a dish cue, so "del" is not one. Add "del" (and "de la")?
2. "nombre del plan" / "¿Cómo se llama el plan?" resolve to Plan, not Identity (REQ-31 plan name). Should they be Identity?
3. "¿A qué hora ceno?" shows all meal times because "ceno" (4 letters) is exact-only and is not a listed slot word. Add verb forms (ceno, desayuno, como) as slot words?
4. "recetas de pollo" becomes a dish cue, so after T079 it is a not-found/did-you-mean on "pollo" rather than a recipe-list filter. Is that the intended reading? Note (analyze round 1, L11): spec v1.7 says "Open questions: None", so this item is not a spec gap on record yet; T026 part 2 pins the current reading as CURRENT behavior pending the user's answer, and the answer is recorded in spec.md at the next spec-change (with the 1d1/1d2 lists).
5. The `compr*` stem makes "comprendo" a cart question. Narrow the stem (e.g. compra*, compro, comprar)?
6. Never-fuzzy words are exact-only only in their listed form: "objetos" (plural of never-fuzzy "objeto") is not on the list, so it fuzzy-matches "objetivo" and returns Goals. Should the never-fuzzy list also cover plurals (objetos, pasos, peros)?

**Batch 1d1: resolver**, about 330 lines with tests (revision 7 split of 1d)

- [x] T021 [US1] Tests REQ-6
  - Unit (tests/unit/chat-intent.test.ts): the REQ-1 Givens left out of T070; via `resolved` and answer text where a builder exists: ingredientes + desayuno, cuándo/hora + compro, ingredientes + comprar, meta de peso, recetas + plan, the button "¿Qué recetas hay en mi plan?", nombre de mi plan, cuántas comidas llevo, qué lleva la cena, cuánto llevo. Every Topics Button, Follow-up and starter of topics that exist at 1d resolves to exactly its topic; `sweep()` extended to them, each with the T020 expected-topic and text/kind assertion. "Mi cena de hoy" stays in the PENDING `skip` list (amended in 1d2 review L3; it returns to the sweep with T029/T032, when the cena slot and its options text land), and the `skip` list (PENDING: "¿Cuál es mi meta?", "Mi peso", "Mi avance de la semana") shrinks as each builder lands (T021, then T045, T047). "<Slot ref>" buttons move to T028, "¿Qué lleva <receta>?" to T026. Red first.
  - 1c2 review (M5), part 1 rows: meals-done phrases today match adjacent words only, so "¿Cuántas comidas ya llevo?" resolves to slotOptions + ambiguous. Add rows where "comidas … llevo" with words in between ("cuántas comidas ya llevo", "cuántas comidas llevo hoy", "cuántas comidas me llevo") resolve to mealsDone alone, winning over ambiguous and over a slot reading of "comidas"; T022 implements it (meals-done detection over the question's words, not only an adjacent phrase).
  - **Part 1 done** (commit 4e6e12a, reviewer PASS in 1d1; see Batch note 1d1). **Part 2 done** (commit 4c8771e plus a4c944d, reviewer PASS in 1d2; see Batch note 1d2).
  - Split (Global rules "Split test tasks"): part 1, committed just before T022, holds the rows asserted on `resolve()` directly (chat-intent.test.ts); part 2, committed just before T023, holds the `ragAnswer`-level rows, the sweep and the e2e.
  - 1c2 review round 2 (LOW), part 1 rows (tests/unit/chat-match.test.ts): "cuantos", "cuanta", "cuantas" vs "cuando" are ✗ (NEVER_FUZZY, word side); `matchPhrases` with phrases given in reverse length order (`["dias","buenos dias"]`) still returns "buenos dias" (REQ-6 relies on longest-wins regardless of list order).
  - 1c2 review round 2 (MEDIUM), part 2 row (tests/unit/chat-answer.test.ts): a third topic with no button is omitted silently from the overflow (REQ-24), e.g. "agua, ejercicio y cómo me llamo" yields no stray/empty button; kills the mutation of `TOPICS[topic].button ?? []` in the overflow line of src/lib/domain/chat.ts. Re-assert after T023 changes the selection.
  - 1c2 review round 2 (LOW), part 2 row (tests/unit/chat-answer.test.ts): a filter-word prefix mid-word (e.g. "descomprar") does not count as a filter word, so the recipe list still narrows (pins `startsWith`, not `includes`).
  - e2e, written (tests/e2e/assistant-match.spec.ts): two REQ-6 Givens with answer text through `ask()`.
  - 1d1 review, part 2 (batch 1d2; tests/unit/chat-intent.test.ts unless noted): rows that kill the surviving mutants: the weak-reading order (all meal times, then ambiguous, then Plan) pinned as CURRENT behavior pending Q-c in "Open questions 1d1"; "llevo la comida" and "qué comida llevo"; "agua y cuántas comidas llevo"; two identity phrases "cómo se llama mi plan y mi nombre" → identity:plan | identity:name; "cena y mi cena" deduped to one intent; "resumen de comidas llevo". Correct the edit-count comments of the cuánta/cuántas rows in tests/unit/chat-match.test.ts (cuánta→cuando is 2 edits, cuántas 3; only cuántos vs cuando truly exercises the NEVER_FUZZY word side).
- [x] T022 [US1] Resolver (src/lib/domain/chat-intent.ts)
  - REQ-6 steps 1–8, with hooks for step 2 (US2) and step 4 (T079, matcher T027); phrase consumption.
  - Combinations: time + slot, goal + metric, "plan" possessor, Plan only when alone, ingredientes + cart, a time word without a slot ignored. At most 2 topics plus overflow.
  - 1c2 review (M5): mealsDone when "comidas" and "llevo" both occur, not only adjacent (rows in T021 part 1).
  - 1d1 review cleanup (batch 1d2, code-writer): remove the dead `TIME_WORDS` and the unreachable `|| goalAt !== undefined` branch in src/lib/domain/chat-intent.ts.
**Review checkpoint 1d1:** tsc + unit.

**Batch note 1d1 (done; T021 part 1, T022; commits 4e6e12a (tests) and 3ba4332 (resolver); reviewer PASS, no HIGH; tsc clean, unit 421/421):** `resolve()` in src/lib/domain/chat-intent.ts covers REQ-6 (identity, slot times, goal + metric, possessor, ambiguous) with meals-done detected apart from adjacency ("comidas … llevo"). Folded into batch 1d2 (code-writer, already assigned): the dead-code cleanup under T022 and the kill-mutant rows plus the edit-count comment fix under T021 part 2. Commit-label note: 4e6e12a is labelled "(red)" but its chat-match.test.ts rows were already green; only chat-intent.test.ts was red (history not rewritten). L3 (optional, T023/T027): typos of plural "comidas" (comdias, comidsa, comidass) resolve to slot "comida" because `allMeals` tests `tokens[hit.at] === "comidas"` exactly (REQ-2 intent conflict); now T080 (optional, revision 9). L6: see T079 (optional recipe argument, exact recipe names before "dish cue + slot → slot wins").
Decisions accepted by the reviewer (record in spec.md at the next spec-change): plural "comidas" is the all-meal-times trigger and yields to other topics; several slots/metrics each become their own intent, in order of appearance; Plan triggers yield to any other topic; Recipes yields to a slot, a dish cue or the cart; dish cue + slot → slot wins; identity phrases are ordinary positioned intents; (M3) one "llevo" may be shared between meals-done and another topic ("cuánta agua llevo y qué comida sigue" → water | mealsDone).

**Open questions 1d1 (for the user; the current behavior stays until answered and nothing changes without a spec-change):**
- Q-a (M1): a goal word applies to every metric in the message: "meta de peso y cuánta agua llevo" → goals:weight | goals:water, though the user asked water progress. Should a metric bind to a goal word only when adjacent/after it with no "y" in between?
- Q-b (M2): "cuánto llevo de comidas" → mealTimes, but "cuánto llevo de comida" → slotOptions:comida, because the phrase "cuanto llevo" (ambiguous) consumes "llevo" before the meals-done pairing. Should meals-done win?
- Q-c: order of weak readings when there is no primary topic: all meal times, then ambiguous, then Plan ("cuándo voy" → mealTimes; "horario y plan" → mealTimes). Correct?
- Q-d (optional): "plan de comidas" → mealTimes. Should it be the Plan summary?

**Batch 1d2: resolver wiring**, about 170 lines with tests

- [x] T023 [US1] Wire the resolver into `ragAnswer`, replacing T020's first-appearance list (src/lib/domain/chat.ts)
  - 1c2 review (M6), owned here: tests/e2e/assistant-api.spec.ts:262 `sourcesOf("¿Qué recetas hay en mi plan?")` expects `["Recetario"]`; update it to the sources of the Recipes answer under the possessor rule. tests/e2e/assistant-next-step.spec.ts fails until this lands (the "Recetas" heading at ~103 and the chips at ~56, ~94, ~178); update those assertions here and list them in the T063 re-check.
  - 1c2 review round 2 (LOW): once the resolver changes first-block selection (`recipeBlock` takes `blocks[0]`), rewrite (do not delete) the recipe filter-word rows in tests/unit/chat-answer.test.ts so they still assert the filter on the Recipes block; re-run the T021 "third topic with no button" row against the new selection.

**Review checkpoint 1d2:** tsc + unit.

**Batch note 1d2 (done; T021 part 2, T022 cleanup, T023; commits 4c8771e (tests, red), 1b66c96 (T022 cleanup), 544ece5 (T023 wiring), a4c944d (T021 row); reviewer PASS on all three, no HIGH; tsc clean, unit 437/437 at a4c944d):** `ragAnswer` now answers the resolver's intents (at most 2 blocks, overflow as buttons) instead of the first-appearance topics; `recipeList` is exported for the filter rows.
- **Fix round DONE** (pre-authorized by the user; commits 1b2e197, fb976a9, c6737e3, 569fb19): row "llevo agua y comidas" → mealsDone | water plus the cuántas edit-count comment fix (1b2e197); e2e section-title heading level 3→4 at five assertions (assistant-next-step.spec.ts:105, :177; assistant-answers.spec.ts:69, :88, :121; section titles `<h4>`, block titles `<h3>`) (fb976a9); a second-block `sources` row, red (c6737e3); `sources` de-dup in `ragAnswer` (569fb19). Final tip checked by the orchestrator: `npx tsc --noEmit` clean, `npm run test:unit` 440/440.
- Intended behavior changes seen by the reviewer (record in spec.md at the next spec-change, with the 1d1 list): a time word beside another topic is ignored; the "plan" possessor rule ("¿Qué recetas hay en mi plan?" → Recipes, not Plan); Recipes yields to a slot or the cart; goal + metric is a single block; "carrito y horario" → cart only.
- Open questions: unchanged (Open questions 1c2 items 1–6, Open questions 1d1 Q-a..Q-d).
- L1 (process): 1b66c96 is tsc-red, so the red window spans two commits (4c8771e and 1b66c96) instead of one; the "two topics" row was rewritten inside code commit 544ece5. Accepted; no history rewrite.
- L2 (interim): "¿A qué hora es el desayuno y la cena?" yields two identical mealTimes blocks, each listing all slots. T029 owns REQ-8 (per-slot times); T051 owns the one-option-block and 2-block rules.
- L3: T021's sweep line amended: "Mi cena de hoy" stays in PENDING until T029/T032.
- L5: `matchTopics` is now used only by tests/unit/chat-topics.test.ts; consider switching that test to `topicHits` and removing `matchTopics` (any later US1/US4 task touching chat-topics.ts; optional).
- L6 (candidate for the pending spec-change): 2-block follow-ups can offer the topic already answered ("agua, ejercicio y peso" offers "¿Cuánta agua llevo?"). Not changed here; goes with the spec-change and T051.
- Re-check list for Batch E (T076 triage) and T063: the heading levels fixed in fb976a9 (h4 section titles at tests/e2e/assistant-next-step.spec.ts:105, :177 and tests/e2e/assistant-answers.spec.ts:69, :88, :121; unproven until the first run); the stale `Plan activo` source assertion for "¿Cuál es mi objetivo?" in tests/e2e/assistant-api.spec.ts (:68, :199, :237, :260, :272) is owned by T047/T054; the Quesadillas assertion in tests/e2e/assistant-match.spec.ts: `seedPlan({ fixture: true })` reseeds recipes (`seedRecipes` deletes the user's recipes first), so Quesadillas is likely gone regardless of the 8-item cap; T026 part 2 fixes it (revision 8; T078's 25-recipe base does not change this).

**Batch 1e1: fixture and dish matcher**, about 350 lines with tests (330 + the analyze round 1 rows) (revision 8: spec v1.7, no fuse.js, no install; split of 1e)

- [x] T024 [US1] Spike, outside the repo (done 2026-10-29; scratch copy with the spike sources: `/private/tmp/claude-501/-Users-rafael-Desktop-Nutritional-Manager/862dbdad-b5f9-4d59-8571-65294721e82a/scratchpad/fuse-spike/`)
  - Result on the spec rows and the real recipe names (in-house matcher vs fuse.js 7.5.0): spec-row failures 0 vs 0; mismatches 5 vs 10; wrong dishes opened 0 vs 1; a result for 17 vs 31 of 57 non-recipe words; timings both far under 1 s (in-house about 22 ms at 5,000 names, fuse about 10 ms). The user chose the in-house matcher (spec v1.7, Decisions). Real names never entered the repo.
- [ ] ~~T025 [US1] Install fuse.js exactly 7.5.0~~ **Dropped by spec v1.7 (user decision 2026-10-29): no dependency is added.** No install, no package.json or package-lock.json change; `git diff package.json package-lock.json` stays empty through 1e1/1e2.
- [x] T078 [foundational] Fixture per spec v1.7 REQ-3 (tests/shared/assistant-fixture.ts, tests/unit/memdb.ts, tests/e2e/assistant-helpers.ts, tests/unit/memdb.test.ts)
  - Base in insertion order: 19 generic names, "Pollo asado", "Ensalada de pollo", "Sándwich de atún", then "Atole de avena", "Chilaquiles verdes", "Tacos de frijol" ("Sopa de lima" leaves the base). `planFixture(meals, { extras })`: `extras: true` appends "Pollo asado con verduras", "Sopa de lima", "Pan de horno" in this order, outside the plan (slot null), so base slots and option numbers are identical in both fixtures. `memDb({ extras })` and `seedPlan({ extras })` pass it through (one line each). Update the doc comment (distractors, extras).
  - memdb.test.ts first (red): base = 25 recipes (19 generic, 3 table, 3 distractors), 50 recipe usages, 23 meal options / plan_version_recipes, Comida 7 options (Pollo asado 6, Ensalada de pollo 7 unchanged), "Sopa de lima" absent; extras = 28 recipes in the order above, the three extras with no meal option.
  - Effect on other tests (grep at ff321d2): only memdb.test.ts names "Sopa de lima" or counts recipes/options; chat-answer.test.ts builds its own recipes for the filter rows; the Recipes list cap (8) shows generic names first either way. Later tasks count Comida as 7 options (T031 paging, T034). e2e specs with `fixture: true` (assistant-noscope, -parity, -match) do not name it.
- [x] T026 [US1] Tests REQ-3, REQ-29 matching, REQ-6 step 4, REQ-11 (a slot ref is not a dish name)
  - **Part 1 done** (commits ee9c829 and 0a0884a, reviewer PASS in 1e1; see Batch note 1e1). **Part 2 done** (commit e2292a0, reviewer PASS in 1e2; see Batch note 1e2, incl. the carry-forwards: the `sweep()` rows moved to T036/T048 and the REQ-3 row "la comida opcion 1" to T031).
  - **Part 1** (tests/unit/chat-dish.test.ts, committed just before T027; red: module missing). On `memDb()` recipes filtered like `ragAnswer` (owned, not deleted, non-generic, seq order), calling `matchDish`/`rankDish` directly: every REQ-3 table row except "la comida opcion 1" (T031), the base rows on the base fixture and the "With the extra recipes" rows on `memDb({ extras: true })`, asserting kind plus recipe name or the candidate names in order: "el pollo asao", "el pollo asdao", "el sandwich de atun" → found; "el pollo" → Pollo asado, Ensalada de pollo (base) and + Pollo asado con verduras (extras); "la pizza", "la opcion 1" → none, `dishName` true; "pizza con atún" → didYouMean Sándwich de atún alone; extras: "el pollo asado" → Pollo asado; "pollo asado con verduras" → it; "asado pollo" → Pollo asado; "la lima" → Sopa de lima; "agua de lima" → didYouMean Sopa de lima alone; "el orno" → none; "agua", "peso", "plan", "mañana", "segunda colación", "colación 2", "ab" → none with `dishName` false. Every other base row gives the same result on the extras fixture (loop). The phrase is taken after the cue and leading article, as `resolve` will pass it.
  - Part 1 rule rows: symmetric word match (typo allowance from either word; first letter must match); exact-wins per name, never blocking other names; REQ-3 stop words incl. "al", "y", "a" removed from phrase and names, and the frozen filter list untouched (`DROPPED_WORDS` pin still green); generic names and distractors never candidates; a soft-deleted recipe never a candidate; tied candidates in insertion order; at most 3 candidates; "Sándwich de atún" exact (rule 1) for each fixture recipe's "¿Qué lleva <receta>?" phrase.
  - Part 1 not-a-dish-name rows (analyze round 1, L4), each → none with `dishName` false, one per category: masculine ordinal "primer desayuno"; date cues "ayer" and "hoy"; day-part words "tarde" and "noche"; the empty phrase "". Rule-1 exception (L8): an ad-hoc recipe list with a name made only of slot, date-cue and stop words, "Desayuno de hoy" → `matchDish("desayuno de hoy", …)` is found by exact match (rule 1 beats the not-a-dish-name rule), while "desayuno" alone stays none with `dishName` false. (The slot-word name "Cena de pollo" beating the slot reading is the T026 part 2 resolve row.)
  - Part 1 REQ-29 rows on the base fixture, `rankDish` over the whole question minus stop words (never found): "una ensalada rica" → Ensalada de pollo; "pollo atún ensalada" → Ensalada de pollo, Pollo asado, Sándwich de atún; "estoy buscando algo rico con atún" → Sándwich de atún; "¿Cuál es la capital de Francia?" → no candidate. Answer text for these stays in T048.
  - **Part 2** (committed just before T079; tests/unit/chat-intent.test.ts, tests/unit/chat-answer.test.ts): `resolve(q, recipes)` rows: "¿Qué lleva el pollo asao?" → dish intent with the recipe id; "¿Qué lleva la cena?" → slotOptions cena; "¿Qué lleva el agua?" → water; "¿Qué lleva la segunda colación?" → not a dish (slot ref; slot rows complete in T028/T030); "¿Qué lleva ab?" and "¿Qué lleva la pizza?" → dish not-found; "¿Qué lleva?" → dish with an empty phrase (REQ-25 clarify later, T050); an exact recipe name containing a slot word (an ad-hoc recipe, e.g. "Cena de pollo") beats the slot reading; `resolve(q)` without recipes keeps today's results (existing rows unchanged). `ragAnswer` rows: it passes only owned, non-deleted, non-generic recipes in seq order (a soft-deleted and another user's recipe are never found); `sweep()` gains the "¿Qué lleva <receta>?" message for each non-generic fixture recipe, each resolving to that recipe. Open question 1c2 item 4 ("recetas de pollo" now a dish cue): pin the current reading as CURRENT behavior, pending the answer.
  - Part 2 e2e, written (tests/e2e/assistant-match.spec.ts): "¿Qué lleva el pollo asado?" resolves to the recipe and "¿Qué lleva la pizza?" to not-found through `ask()` with `resolved` (text in T034, T048); after `softDeleteRecipe`, that recipe's name is not found. Fix the Quesadillas assertion here (Batch note 1d2 re-check list): `seedPlan({ fixture: true })` reseeds recipes (`seedRecipes` deletes the user's recipes first), so "Quesadillas" is gone before the "¿Qué recetas hay en mi plan?" test; assert a name the Recipes answer shows on the fixture instead (check with `memDb()`), or drop the `seedRecipes` line.
- [x] T027 [US1] In-house dish matcher (src/lib/domain/chat-dish.ts, src/lib/domain/chat-dates.ts)
  - Plan D11: `matchDish(phrase, recipes)` → found / didYouMean (≤3, best first) / none with `dishName`; `rankDish(phrase, recipes)` for REQ-29; `isGeneric(name)`; built on `matchWord` from chat-match.ts (no new matcher, no package). REQ-3 stop words as their own constant (spec Terms; separate from the frozen filter words). Open only at recall = 1 with an exact match or a second candidate strictly worse on (recall, precision).
  - Not a dish name: under 3 chars after normalization, or only topic trigger words (chat-topics.ts vocabulary), slot words, ordinal words (spec Terms, both genders, accents optional), date cues and day-part words mañana/tarde/noche, or a slot word followed only by a number. Date cues: export the always-cue words of spec Terms from chat-dates.ts (one list; T040 reuses it).
  - An exact recipe-name match (rule 1) beats the not-a-dish-name rule: rule 1 runs first, so a recipe whose whole name is trigger, slot or date-cue words (e.g. "Desayuno de hoy") is still found (rows in T026 part 1).
  - 1c2 review round 2 (LOW): when T026/T027, T079 or T028 fill null `title`/`button` entries in TOPICS, update `SPEC_TOPICS` in tests/unit/chat-answer.test.ts in the same commit (the `deepEqual(TOPICS, SPEC_TOPICS)` pin); the "no vocabulary entry ends in s" assertion may trip on a new entry (e.g. a dish or slot word): keep entries singular, or narrow the assertion with a reasoned exception.

**Review checkpoint 1e1:** tsc + unit; `git diff package.json package-lock.json` empty.

**Batch note 1e1 (done; T078, T026 part 1, T027; commits 69a380a (T078 tests, red), 452abbc (T078 fixture), ee9c829 (T026 part 1, red: module missing), a60f66d (T027 matcher), 0a0884a (T026 kill-mutant rows); reviewer PASS; tsc clean, unit 468/468 at 0a0884a; no dependency change; 339 added lines vs ~350 planned):** the fixture follows spec v1.7 REQ-3 (base 25 recipes, "Sopa de lima" in the extras, Comida 7 options); src/lib/domain/chat-dish.ts holds the in-house `matchDish`/`rankDish` over `matchWord` and `DATE_CUES` is exported from chat-dates.ts; 0a0884a adds the rows that killed surviving mutants (recall counts a phrase word once; `rankDish` returns nothing for a not-a-dish-name question).
- Scope note: T027 also exported `isExact` from src/lib/domain/chat-match.ts (not in the task's file list). Accepted.
- Process note (no action): code commit a60f66d edited two rows of the red test commit ee9c829 ("sasado" → "esado", and a stop-word row). History is not rewritten.
- **Open item for the user (spec decision; goes into the next spec-change, with Open questions 1c2/1d1):** `isNotDishName` (src/lib/domain/chat-dish.ts:41-46 at 0a0884a) uses fuzzy `matchWord` against the date cues and day-part words, so a dish-name typo near one of them ("sasado" ~ "sábado", "lunas" ~ "lunes") counts as not-a-dish-name and gets the not-found reply instead of a dish match. Options: (a) exact-only for date cues and day-part words; (b) accept fuzzy as is. Test gap: no test covers this case; add one (red first if (a)) once the user decides. Owner: assigned at the spec-change (a small red-then-code pair on src/lib/domain/chat-dish.ts and tests/unit/chat-dish.test.ts).

**Batch 1e2: REQ-6 step 4 wiring**, about 200 lines with tests (about 230 with the optional T080)

- [x] T079 [US1] REQ-6 step 4 and 7 plumbing (src/lib/domain/chat-intent.ts, src/lib/domain/chat.ts)
  - 1d1 review (L6): `resolve(question, recipes?: readonly Recipe[])`, optional so existing tests keep working. The dish phrase is the words after the dish cue minus the cue and leading article. An exact normalized recipe-name match runs before the "dish cue + slot → slot wins" rule. A dish-name phrase ends the answer with the matcher's outcome (dish intent carrying the recipe id, the candidates or not-found, plus the phrase as typed for REQ-26); a not-a-dish-name phrase does not consume its words and resolution continues (steps 5–6); a dish cue left unresolved gives step 7 (empty phrase → clarify REQ-25; otherwise not-found).
  - `ragAnswer` passes `db.recipes` filtered to the user, `!deleted_at`, `!isGeneric(name)`, in seq order. Until T036/T049 land, the dish intent answers with the D3 placeholder (no test asserts it); REQ-29 at step 8 stays with T049, which calls `rankDish`.
- [x] T080 [US1] Optional: plural "comidas" typos (tests/unit/chat-intent.test.ts, src/lib/domain/chat-intent.ts). Its own commits (red row, then code), separate from T079; in 1e2 only if the batch has room under its estimate, otherwise it moves to Batch 2a1 beside T029 (which touches the slot words). Split out of T079 (analyze round 1, L5).
  - 1d1 review (L3): typos of plural "comidas" (comdias, comidsa, comidass) resolve to slot "comida" because `allMeals` tests `tokens[hit.at] === "comidas"` exactly; use the matched entry's plural form instead (REQ-2 intent conflict). Rows (red first): each typo resolves like "comidas" (all meal times), and "comida" still resolves to the slot.

**Review checkpoint 1e2:** tsc + unit.

**Batch note 1e2 (done; T026 part 2, T079, T080; commits e2292a0 (T026 part 2 tests, red: tsc-red allowed for a tests-only commit), 507b8d1 (T079), 227b1b1 (T080 red rows), a566f10 (T080 code); tip a566f10, the docs commit d1d4170 sits before them; reviewer PASS; tsc clean, unit 482/482 at a566f10; no dependency change; ~140-157 added lines vs ~230 estimated):**
- What landed: `resolve(question, recipes?)` in src/lib/domain/chat-intent.ts runs REQ-6 step 4 (a dish cue plus a dish-name phrase ends the answer with the matcher's outcome: found, didYouMean or notFound, with the phrase as typed for REQ-26; a not-a-dish-name phrase falls through to steps 5-6) and step 7 (an unresolved dish cue: empty phrase → clarify for REQ-25, otherwise notFound). `ragAnswer` passes the user's owned, non-deleted, non-generic recipes in seq order. `resolve(q)` without recipes keeps the earlier results.
- `Intent` gains `outcome` and `phrase`. They are visible only to tests through `resolved`, so contracts/chat-api.md needs no change; optionally add a one-line note at the next spec-change.
- T080: `isPlural(word, entry)` is exported from src/lib/domain/chat-match.ts (not in the task's file list; accepted). Typos of "comidas" (comdias, comidsa, comidass) resolve to all meal times; "comida" stays the slot.
- e2e: tests/e2e/assistant-match.spec.ts gains the dish found/not-found rows and the soft-deleted row, and the Quesadillas assertion is fixed (Batch note 1d2 re-check list). These were written but not run; they run first in Batch E.
- **Carry-forwards:**
  - (a) `sweep()` was not extended with the "¿Qué lleva <receta>?" rows from T026 part 2. T036 or T048, whichever lands the dish builder, must add them (one per non-generic fixture recipe, each resolving to that recipe).
  - (b) The test "REQ-6 step 4: a generic option name is never a dish" (tests/unit/chat-answer.test.ts:311) pins "¿Qué lleva desayuno opcion 1?" → notFound. Re-scope it when T031/REQ-10 lands (a slot-option reference then answers with that option).
  - (c) The REQ-3 row "la comida opcion 1" stays deferred to T031.
- **Open item for the user (MEDIUM; spec decision at the next spec-change, with the `isNotDishName` item of Batch note 1e1):** the `isPlural` tie rule (src/lib/domain/chat-match.ts:30) reads a word as plural when it is as near the plural as the singular. So any single trailing extra character ("comidaa", "comidad") reads as plural "comidas" (all meal times) instead of the comida slot. The tie is what makes the swap typo "comidsa" plural. Options: (a) accept and record the tie rule in the spec; (b) tighten it: a tie counts as plural only when the word contains an "s". Either way, add a "comidaa" row (red first if (b)) in tests/unit/chat-intent.test.ts. Owner: assigned at the spec-change.

**Checkpoint:** US1 resolution (REQ-1 to REQ-6) green in unit tests, except the REQ-3 row "la comida opcion 1" (T031); text coverage for REQ-3 and the slot/metric rows of REQ-1/REQ-6 completes in US2–US4.
**Status (after 1e2, tip a566f10):** reached. Every Phase 3 task is ticked (T025 dropped, not counted); unit 482/482. Excluded as planned: the REQ-3 row "la comida opcion 1" (T031) and the US1 e2e rows, written but unrun until Batch E. Two spec decisions stay open for the user (`isNotDishName` fuzzy, Batch note 1e1; `isPlural` tie rule, Batch note 1e2); neither blocks US2.

## Phase 4: US2 (P1) Meal detail

**Batch 2a1: slots and times**, about 330 lines with tests (revision 7 split of 2a)

- [x] T028 [US2] Tests REQ-7, REQ-8, REQ-11 (duplicates)
  - Unit (tests/unit/chat-meals.test.ts): REQ-7 almuerzo question and buttons (1 or 2), merienda/snack → colación, not in plan; REQ-8 one slot's time highlighted, a slot without a time, all slots; REQ-11 two colaciones → 2 buttons with "(<time>)", "colación 2" and "segunda colacion", 11 slots → "Colación 11", masculine ordinals; `sweep()` over every "<Slot ref>" and almuerzo-clarify button; answer text for the slot Givens of REQ-1 and REQ-6. Red first.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): an almuerzo question and the duplicate-colación buttons through `ask()`; one REQ-8 slot-time row through `ask()` covering a single slot's time highlighted, a slot without a time, and all slots.
  - Split: part 1 (just before T029) = REQ-7, REQ-8 and the REQ-11 labels/ordinals on the slot builders; part 2 (just before T030) = typed ordinals, "colación 2", "segunda colacion", the sweep and the e2e.
  - **Part 1 done** (commit a930790, tests red: module missing; reviewer PASS in 2a1; see Batch note 2a1). **Part 2 done** (commit 65ab143, tests red, tsc-exempt; L3 rows in 0503efd; reviewer PASS in 2a2; see Batch note 2a2). The answer-level row below asserts only the resolved slotOptions/colación/ordinal 2; the title/lead and option labels move to T031 part 2 / T032 (Batch note 2a2, carry-forward (a)).
  - Part 2 answer-level row (analyze round 1, M2; REQ-11 with REQ-6 step 4 fallthrough, resolve-level row in T026 part 2): unit (tests/unit/chat-meals.test.ts) `ragAnswer("¿Qué lleva la segunda colación?")` lists the second colación slot's options (its option labels, in plan order) and gives no not-found reply (kind neither `did_you_mean` nor `no_match`); e2e, written (tests/e2e/assistant-meals.spec.ts), the same question through `ask()` with the same assertions. Ordering: the options builder lands in T032 (2b1), after this part, so here the row asserts the no-not-found kind plus `resolved` slotOptions for the second colación and the slot's title/lead; the option-label assertion is added in T031 part 2 (just before T033), keeping each batch tip green.
- [x] T029 [US2] Slots (src/lib/domain/chat-meals.ts)
  - Slot list from `activeSchedule`, word-to-slot mapping, almuerzo/merienda/snack rules.
  - Slot refs and ordinals (feminine/masculine, >10), slot buttons (times vs options message); slot times builder and variants.
  - T013 review (M2): the "meal times" real-API test (tests/e2e/assistant-answers.spec.ts:117-125) still expects the heading "Comidas" and the source "Basado en: Plan activo:"; update it to the "Horarios" block when this builder replaces the old meal-times answer.
  - 1c2 review round 2 (LOW): filling TOPICS titles/buttons here updates `SPEC_TOPICS` in tests/unit/chat-answer.test.ts in the same commit (see T027 note).
  - 1c2 review (M6), owned here: tests/e2e/assistant-api.spec.ts "¿A qué hora es la cena?" (lines 261, 273, 277) and "¿Cuándo desayuno?" (line 298) assert the old meal-times answer and sources; rewrite them to the slot-time builder's text and sources.
**Review checkpoint 2a1:** tsc + unit.

**Batch note 2a1 (done; T028 part 1, T029; commits a930790 (T028 part 1 tests, red: chat-meals module missing) and 9fd81fa (T029 code); tip 9fd81fa; reviewer PASS; tsc clean, unit 495/495; no dependency change; 248 added / 18 deleted vs ~330 estimated):**

- Landed: src/lib/domain/chat-meals.ts (new) with `planSlots`, `chooseSlot`, `slotTimeLead` and the types `Built`, `Slot`, `SlotPlan`. chat.ts: `Built` moved to chat-meals.ts; `mealTimes` answers the named slot, or lists all slots when none is named; builders receive the intent; in `ragAnswer` a builder's own buttons and a `clarify` kind replace the topic follow-ups. Slots are now read from `activeSchedule` (`mealTypes`). The e2e rows (T029 M6 rewrite in assistant-api.spec.ts, T013 M2 in assistant-answers.spec.ts) were rewritten but not run (Batch E).
- Carry-forwards from the review:
  - **M1 (MEDIUM):** in a 2-block answer the buttons come from the first block that has any (chat.ts ~147), so REQ-24 is only partly met; T051 owns the rule. T050 part 1 must include rows for a clarify plus another topic, and a not-in-plan answer plus a second block, and decide whether follow-ups and overflow survive in each (recorded in T050/T051).
  - **M2 (MEDIUM):** there is no "Tu <slot> es: **<time>**." variant yet; REQ-28 variants belong to T048/T049, and T049 must carry the slot-times variant. The new 2a1 tests assert the canonical copy "Tu horario de cena: …"; T048/T049 must make them variant-agnostic (recorded in T048/T049).
  - **M3 (MEDIUM, interim dead end):** duplicate-slot buttons loop back to the same clarify until T030 (2a2) resolves "<slot> <n>"; options-version buttons reach the D3 placeholder until T032 (2b1). Do not ship or demo the branch between batches.
  - **L2 (LOW):** tests/unit/chat-meals.test.ts:52 pins "No tienes un plan activo."; T052 flips it to the spec Copy no-active-plan reply; prefer asserting `sources` is `[]` there (recorded in T052).
  - **L5 (LOW, open question):** whether the all-times list section title stays "Comidas"; confirm with the user or at the next review (HANDOFF section 6).
  - **L1, M4 and the L3 test gaps** are being fixed in batch 2a2 (code-writer running), with T028 part 2 and T030.

**Batch 2a2: slot resolution**, about 170 lines with tests

- [x] T030 [US2] Resolver: slot words, typed ordinals and "<slot> <n>" for duplicated slots (src/lib/domain/chat-intent.ts)

**Review checkpoint 2a2:** tsc + unit.

**Batch note 2a2 (done; T028 part 2, T030, plus the 2a1 fixes L1, M4 and the L3 gaps; commits 5cc2ec6 (L1 red), 04113f5 (L1 fix), cc48320 (M4 e2e assertion), 65ab143 (T028 part 2 tests, red, tsc-exempt), 1d705c4 (T030 code), 0503efd (L3 rows); tip 0503efd; reviewer PASS, no HIGH/MEDIUM; tsc clean, unit 517/517; no dependency change; src+tests +200/-13 by the reviewer's numstat (code-writer reported +185/-12) vs ~170 est plus the small fixes):**

- Landed: `Intent` gains an optional `ordinal`. The resolver reads an ordinal word before or after a slot word, or a number right after one ("colación 2", "segunda colacion", "colación segunda"). `chooseSlot` takes an optional ordinal: on a duplicated slot it picks that slot; out of range it re-asks ("Tienes 2 colaciones. ¿Cuál?"); on a single slot it is ignored. The 2a1 dead end (M3, duplicate-slot buttons looping on the clarify) is fixed; options-version buttons still reach the D3 placeholder until T032. Plural "snacks" maps like "snack". M4: the zero-meals e2e also asserts the schedule answer (title fixed). L3 rows: merienda without colación, masculine ordinal past ten, starters with no slots.
- Tests: new tests/e2e/assistant-meals.spec.ts (4 tests); tests/shared/assistant-buttons.ts gains the slot time buttons. e2e unrun until Batch E.
- Carry-forwards:
  - **(a)** The T028 part 2 row "¿Qué lleva la segunda colación?" (unit and e2e) asserts only the resolved slotOptions / colación / ordinal 2 and the no-not-found kind; the slot's title/lead is not assertable until the options builder exists. Recorded in T031 part 2 / T032: add the title/lead and the option labels in plan order.
  - **(b)** "<slot> <n>" on a non-duplicated slot falls back to the slot (the number is ignored). T033 must intercept it before the slot reading and read it as option n (recorded in T033).
  - **(c)** The sweep covers only the slot time buttons. Options buttons and the masculine/"Colación 11" buttons join `BUTTON_TOPICS` at T032 (recorded in T032).
  - **(d) LOW:** `ORDINAL_WORDS` is a plain object, so "constructor" looks up `Object`; being fixed in 2b1. The ordinal lookup is greedy in both directions ("desayuno primera colación" → desayuno ordinal 1; "colación segunda cena" → colación 2); it only matters with no conjunction between slot words; not needed now. A bare number after a slot word counts as an ordinal even when it is a clock time ("colación 2 am"); acceptable per REQ-11; optionally pin it with a row or exclude a following am/pm (candidate for T033's rows).

**Batch 2b1: options builder**, about 300 lines with tests (revision 7 split of 2b)

- [x] T031 [US2] Tests REQ-9, REQ-10, REQ-11 (option buttons)
  - **Part 1 done: 5ca5925; part 2 done: 510639d (red, 23 failing), post-red fixes in 379570e; see Batch note 2b2.**
  - Unit (tests/unit/chat-meals.test.ts): 5 options → 3 + "Ver más opciones"; page 2 → 4–5 + "Opciones anteriores"; 7 options → page 3 shows option 7 with "Opciones anteriores" only; page 9 → last page. Labels: "Opción 2: Pollo, Arroz, Brócoli…" (4 ingredients), exactly 3 → no "…", 0 → "Opción <n>". "cena opción 2", "cena opcion 2", "la 2 de la cena" equal; "cena opción 7" → "Tu cena tiene 4 opciones." + first page. REQ-11: "Segunda colación" lists the second slot's options with buttons sending "Segunda colación, opción <n>". REQ-3 row "la comida opcion 1": option selection, comida, option 1, `kind` neither `did_you_mean` nor `no_match`. `sweep()` over option and paging buttons. Red first.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): one UI flow tapping through the pages (the user turn shows the sent message); "cena opción 2" through `ask()`.
  - Split: part 1 (just before T032) = page contents, labels and the out-of-range lead on the builder; part 2 (just before T033) = the selection/paging message rows, the REQ-3 row, the sweep and the e2e.
  - Carry-forward from 1e2 (b): re-scope the test "REQ-6 step 4: a generic option name is never a dish" (tests/unit/chat-answer.test.ts:311), which pins "¿Qué lleva desayuno opcion 1?" → notFound, to the REQ-10 reading in the same commit as the REQ-3 row "la comida opcion 1" (deferred here from T026, carry-forward (c)).
  - Part 2 (analyze round 1, M2 follow-up): extend the T028 part 2 row "¿Qué lleva la segunda colación?" (unit and e2e) with the second colación's option labels in plan order.
  - Carry-forward from 2a2 (a): that row currently asserts only the resolved slotOptions / colación / ordinal 2 and the no-not-found kind. Once T032 lands, also assert the slot's title/lead (unit and e2e), together with the option labels above.
- [x] T032 [US2] Options builder: lead variants, `layout: "option"` buttons in plan order, labels, paging messages, out-of-range (src/lib/domain/chat-meals.ts)
  - Carry-forward from 2a2 (a): the options lead/title makes the "¿Qué lleva la segunda colación?" title/lead assertion possible (added in T031 part 2).
  - Carry-forward from 2a2 (c): the button sweep covers only slot time buttons; add the options buttons and the masculine-ordinal / "Colación 11" buttons to `BUTTON_TOPICS` (tests/shared/assistant-buttons.ts) here. (Not done in 2b1; moved to batch 2b2, see Batch note 2b1 (f).)

**Review checkpoint 2b1:** tsc + unit.

**Batch note 2b1 (done; T031 part 1, T032, plus the 2a2 (d) `ORDINAL_WORDS` fix; commits 315346d (L2 red), 940188f (L2 fix: `ORDINAL_WORDS` is a Map, so Object property names are no ordinal), 5ca5925 (T031 part 1 tests, red: `slotOptions` export missing; amended once before moving on, history linear), f949d75 (T032 code); docs commit 90cd7ad sits between; tip f949d75; reviewer PASS, no HIGH; tsc clean, unit 529/529; no dependency change; src+tests +188/-11 vs ~300 est):**

- Landed: `slotOptions(db, userId, intent, question, { page, asked })` and `SlotOptionsView` in src/lib/domain/chat-meals.ts, wired at `BUILDERS.slotOptions` in chat.ts. `Slot` gained `id`. A slot with no options says "Tu plan no tiene opciones para tu <slot>."; a count of 1 reads "1 opción". One `layout: "option"` button per option, message "<Ref>, opción <n>" (n absolute, in plan order); paging buttons "<Ref>, más opciones (página n)", with "Ver más opciones" before "Opciones anteriores" (the spec does not fix the order). The page is clamped; `asked` > count gives "Tu <slot> tiene <n> opciones." plus page 1. Three REQ-9 lead variants, chosen by the private `pickVariant` (hash of the normalized question; deterministic, no `Math.random`/`Date`). A single-option slot lists its one option for now (the detail redirect is T034).
- Carry-forwards:
  - **(a)** `pickVariant` is private to chat-meals.ts and gives all four starter-button questions the same variant (index 2). Export or move it when T049 and the other REQ-28 sites arrive; T048/T049 should improve variety.
  - **(b)** REQ-24 interim merge: in a 2-block answer only the first block's buttons show, while the second block's lead promises options. T051 owns it (T050 rows). Do not ship between batches.
  - **(c)** `slotOptions` does not sanitize `page` (NaN, 1.5): T033 must parse integers only.
  - **(d)** Option labels use the position in the filtered option list, not `option_number`. T033 and T034 must index the same filtered list.
  - **(e)** Interim loop: "Cena, opción 2" and "Cena, más opciones (página 2)" return the slot's first page until T033.
  - **(f)** Being closed in 2b2 (with T031 part 2 and T033): `BUTTON_TOPICS` entries for the options buttons (and the 2a2 (c) masculine/"Colación 11" buttons), plus builder test gaps (`option_number` order, soft-deleted options skipped, 1-page cases, the variants actually used).

**Batch 2b2: option selection and paging**, about 180 lines with tests

- [x] T033 [US2] Resolver step 2: option selection and paging, incl. page 1 and no number = page 2 (src/lib/domain/chat-intent.ts)
  - Carry-forward from 2a2 (b): "<slot> <n>" on a non-duplicated slot currently falls back to the slot (T030 reads n as an ordinal only for duplicated slots). Intercept it before the slot reading and read it as option n ("cena 2" → cena option 2), with a red row first; keep "colación 2" with two colaciones as the slot ordinal.
  - Optional, from 2a2 (d): pin or exclude "colación 2 am" (a bare number followed by am/pm read as an ordinal).
  - Carry-forwards from 2b1 (c)–(e): parse the page as an integer only (`slotOptions` does not sanitize NaN or 1.5); index options in the same filtered list the labels use (not `option_number`); this closes the interim loop where "Cena, opción 2" and "Cena, más opciones (página 2)" return the first page.

**Review checkpoint 2b2:** tsc + unit.

**Batch note 2b2 (done; T031 part 2, T033, plus the 2b1 (f) carry-forwards; commits b2cd0b2 (2b1 builder test gaps, green on arrival), 0892693 (`BUTTON_TOPICS`), 510639d (T031 part 2 tests, red, 23 failing), 379570e (T033 code plus post-red test fixes); docs commit 0b43ff5 sits before them; tip 379570e; reviewer PASS, no HIGH, 8 break-and-revert checks each failed the intended test; tsc clean, unit 555/555; no dependency change; src +55/-11, src+tests +246/-17 vs ~180 est plus carry-forwards):**

- Landed: resolver step 2 in src/lib/domain/chat-intent.ts, before the dish step. Paging: "<slot>, más opciones [(página n)]"; no number = page 2; page 1 = the plain options answer; integer-only page; a huge page is clamped. Option selection: "<slot> opción n" and "la 2 de la cena". "<slot> <n>" is emitted as an ordinal plus the new optional `Intent.numbered`; `slotOptions` reads it as option n only when the slot is not duplicated ("colación 2" with two colaciones stays the slot ordinal). A number followed by am/pm is no ordinal (closes 2a2 (d)). `slotOptions` takes page/asked from the intent, so `BUILDERS` is unchanged. `BUTTON_TOPICS` gained the option, paging, masculine-ordinal and "Colación 11" buttons; the 2b1 (f) builder test gaps are closed. e2e rows (API flow, and a UI tap-through of the pages) are written, unrun; they assume cena has 5 options. The REQ-10 "same answer" rows compare buttons, not blocks, because the lead variant depends on the typed question.
- Carry-forwards (recorded on T034, T036 where relevant):
  - **MEDIUM-1:** restore full-answer equality (blocks) in the REQ-10 "same answer" rows (tests/unit/chat-meals.test.ts ~343, tests/e2e/assistant-meals.spec.ts:83) once the detail lands, or pick the lead variant independent of the typed text for option selection.
  - **MEDIUM-2:** the e2e rows run at Batch E.
  - **MEDIUM-3 (spec gap):** "colación opción 2" on a duplicated slot with no ordinal asks which colación and loses the option. Record as a known limit at the next spec-change, or accept (HANDOFF section 6).
  - **MEDIUM-4 (interim):** an in-range option selection shows the options page 1 until T034/T036 open the detail. Do not demo.
  - **LOW-1:** `selectionAt` is loose: "cena es la mejor opción 2 veces" and "comí 2 de la cena" read as option 2; "cena 2 veces" reads as option n (correct by REQ-11; add a probe row); "cena opción 2.5" reads as option 2 (no integer guard on the option); "cena opción 0" and "la 0 de la cena" are treated as in range (T034 must guard option 0); "cena más opciones 3" without "página" and "(página -1)" give page 2.
  - **LOW-2 (accepted):** with several slots in one message only the first slot's selection is answered (at-most-one rule).
  - **LOW-3:** "cena hora opción 2" answers the time because step 2 is skipped when `timed`; not pinned by a test.
  - **LOW-4 (cosmetic):** a long doc comment near chat-intent.ts ~76 and a stray double blank line near ~41.

**Batch 2c1: shared step splitter**, about 170 lines with tests (revision 7 split of 2c)

- [x] T034 [US2] Tests REQ-12, REQ-11 (single option), REQ-3 text
  - **Part 1 done: a87a443; part 2 done: 73e8cfd (red: tsc clean, 556 pass / 15 fail); see Batch note 2c2.**
  - Unit (tests/unit/recipe-steps.test.ts): `recipeSteps` returns no steps for "Extraído de plan.pdf", "EXTRAÍDO DE plan.pdf" and "Extraido de plan.pdf"; "¿Listo? Ásalo. Él sirve." keeps its split. Red first.
  - Unit (tests/unit/chat-meals.test.ts): 12 ingredients all shown; steps 1–2 equal `recipeSteps(description)` 1–2, plus the "Ver receta completa" link to `/recipes/<id>`; "Extraído de plan.pdf" → the no-preparation item; complement "Agua natural · 1 vaso", none → no heading; by dish name, complements only if the recipe is in exactly one slot; ingredient formats with no unit and with neither; a generic-name lead; a single-option slot goes straight to the detail; a recipe with zero ingredients and zero steps still gets a detail answer (lead, no empty headings); every detail answer's `sources` equals `["Receta: <name>"]` (contract keeps `sources`); REQ-3 text: each found row shows the detail lead and "la comida opcion 1" shows comida option 1's detail; end-of-US2 `sweep()` over every existing Topics, slot, option, paging and "¿Qué lleva <receta>?" button.
  - Split: part 1 (just before T035) = the recipe-steps.test.ts rows and the recipe-page e2e; part 2 (just before T036, Batch 2c2) = the chat-meals.test.ts rows and the remaining e2e.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): the recipe page shows the empty-steps state for the three import notes and keeps the accented split (display unchanged by T035); "Ver receta completa" opens `/recipes/<id>`; one detail answer through `ask()`.
  - Carry-forwards from 2b2 (part 2 unless noted):
    - MEDIUM-1: restore full-answer equality (blocks, not only buttons) in the REQ-10 "same answer" rows (tests/unit/chat-meals.test.ts ~343, tests/e2e/assistant-meals.spec.ts:83) once the detail lands; alternatively T036 picks the detail lead variant independent of the typed text.
    - MEDIUM-4: in-range option selection currently shows options page 1; the rows for "cena opción 2" / "la 2 de la cena" → detail are red here and go green with T036.
    - LOW-1: guard option 0 ("cena opción 0", "la 0 de la cena" → out-of-range, not in range) and non-integer options ("cena opción 2.5"); add probe rows for "cena 2 veces" (option n by REQ-11, pinned as intended), "comí 2 de la cena" and "cena es la mejor opción 2 veces" (decide: pin as current or tighten `selectionAt`), "cena más opciones 3" and "(página -1)" (pin as page 2 or tighten).
    - LOW-3: add a row for "cena hora opción 2" (pin the time answer as current, or let step 2 win).
    - MEDIUM-3 stays a spec item (HANDOFF section 6); add a row pinning the current clarify for "colación opción 2" so a later change is visible.
- [x] T035 [US2] Shared `recipeSteps(description)` using `normalizeText`, used by the recipe page (no display change) (src/lib/recipe-steps.ts, src/components/recipes/RecipeDetail.tsx)
  - 1c1: the step-splitter move to `normalizeText` was deferred here from T018.
**Review checkpoint 2c1:** tsc + unit.

**Batch note 2c1 (done; T034 part 1, T035; commits a87a443 (T034 part 1 tests, red: module src/lib/recipe-steps missing; tests/unit/recipe-steps.test.ts with 3 tests, plus a recipe-page e2e in tests/e2e/assistant-meals.spec.ts) and 5dcd43a (T035 code); docs commit 05b3d57 sits between them; tip 5dcd43a; reviewer PASS, no HIGH/MEDIUM, 5 break-and-revert mutations each failed the intended test; the reviewer verified that the code-writer's `git checkout -p` slip lost nothing; tsc clean, unit 558/558; no dependency change; +49/-10 vs ~170 est):**

- Landed: `recipeSteps(description = "")` moved from src/components/recipes/RecipeDetail.tsx to src/lib/recipe-steps.ts. The import-note guard is now `normalizeText(text).startsWith("extraido de")`, so case and accents no longer matter; the split regex is unchanged. RecipeDetail.tsx imports it and dropped its local `steps()` and the unused normalize import. Display is unchanged for real data.
- Reviewer probed 22 inputs. Five punctuation/whitespace variants ("Extraído  de" with a double space, "Extraído, de", "¡Extraído de", "- Extraído de", "Extraído\nde") now give no steps, because `normalizeText` collapses non-letter runs. This is intended: the importer writes "Extraído de <file>".
- e2e written, unrun (Batch E); the selectors `.rx-steps li p` match the markup.
- Carry-forwards / LOW:
  - **LOW-1:** the comment at src/lib/recipe-steps.ts:3-4 says the assistant shares the function; true only once T036 lands. Keep it if T036 follows immediately (2c2); otherwise reword.
  - **LOW-2 (no change):** the unit test is a characterization test; its only fail-first proof is the missing module.
  - **LOW-3 (note only):** numbered steps ("1. Picar la cebolla. 2. Freír.") split as ["Picar la cebolla. 2.", ...]. Existing quirk, not a regression.

**Batch 2c2: dish detail**, about 340 lines with tests

- [x] T036 [US2] Detail builder: lead, uncapped "Ingredientes", "Preparación" (2 steps + link), "Acompaña con" from the slot's add-ons and `add_on` usages (src/lib/domain/chat-meals.ts)
  - **Done: 9a3585e; see Batch note 2c2.**
  - Carry-forward from 1e2 (a), with T048 (whichever lands the dish builder first adds them): `sweep()` in tests/unit/chat-answer.test.ts gains "¿Qué lleva <receta>?" for each non-generic fixture recipe, each resolving to that recipe (red row before the builder).
  - Carry-forwards from 2b2: open the detail for an in-range option selection (MEDIUM-4), indexing the same filtered option list the labels use (2b1 (d)); reject option 0 and non-integer options as out of range (LOW-1); either make the detail lead independent of the typed text or let T034 part 2 compare buttons plus content, so the REQ-10 rows can assert full-answer equality (MEDIUM-1). Optional LOW-4 cleanup in chat-intent.ts (long doc comment ~76, double blank line ~41) if the file is touched.
  - Carry-forward from 2c1 (LOW-1): the detail builder imports `recipeSteps` from src/lib/recipe-steps.ts, which makes its comment (lines 3-4, "the assistant shares it") true; if T036 does not use it, reword the comment.

**Review checkpoint 2c2:** tsc + unit.

**Batch note 2c2 (done; T034 part 2, T036; commits 73e8cfd (T034 part 2 tests, red: tsc clean, 556 pass / 15 fail) and 9a3585e (T036 code); docs commit 9e26b91 sits before them; tip 9a3585e; reviewer PASS, no HIGH, nothing blocking; tsc clean, unit 571/571; no dependency change; src+tests +273/-18 (+291/-23 with docs) vs ~340 est):**

- Landed: `recipeDetail(db, userId, recipe, spot?)` in src/lib/domain/chat-meals.ts. Two lead variants, "**<receta>** lleva:" and "Esto lleva **<receta>**:"; a generic option name leads with "<Slot ref>, opción <n>". Sections: "Ingredientes" (uncapped; omitted when empty), "Preparación" (`recipeSteps` steps 1-2, or the no-preparation item), "Acompaña con" (one item per `add_on` usage; for a dish asked by name, only when the recipe is an option in exactly one slot). `sources` = `["Receta: <name>"]`; kind `detail`. `Built` gained `blockButtons` and the kind "detail". The "Ver receta completa" link is added only when there are more than 2 steps, as a block button.
- Wiring: `slotOptions` opens the detail for an in-range option and for a single-option slot, indexing the same filtered, `option_number`-sorted list as the labels (closes 2b1 (d), 2b2 MEDIUM-4). Option 0, decimals ("2.5", "2,5") and past-count give "Tu <slot> tiene <n> opciones." plus page 1 (closes 2b2 LOW-1 guard); `selectionAt` reads a typed decimal as option 2.5 so the guard sees it. A found dish opens the detail; did-you-mean and not-found stay placeholders until T048/T049.
- MEDIUM-1 (2b2) resolved: the detail lead variant is picked from the dish name, not the typed text, so the REQ-10 "same answer" rows assert full-answer equality in unit and e2e. See M2 below for the spec wording.
- Tests: `sweep()` rows for the 6 non-generic fixture recipes (closes 1e2 (a)); `BUTTON_TOPICS` gained 6 dish entries; `OPTIONS_LEAD` accepts "lleva". Pinned current behavior: "cena 2 veces" opens option 2's detail; "cena 12 veces" gives the out-of-range message; "cena hora opción 2" answers the time (2b2 LOW-3); "colación opción 2" on a duplicated slot asks which colación (2b2 MEDIUM-3, still a spec item). e2e rows written, unrun until Batch E.
- Carry-forwards (owners recorded on the tasks named):
  - **M1 (MEDIUM, test gap) → cleanup rows, Batch 3b1 note:** add a row asserting both detail lead variants occur across fixture names ("Pollo asado" gives "Esto lleva…", "Ensalada de pollo" gives "…lleva:"; the always-variant-0 mutation survives today), and a 3-step recipe row expecting the link (the threshold mutation `> 3` survives today).
  - **M2 (MEDIUM, spec wording) → next spec-change (HANDOFF section 6):** REQ-28 says variants are picked "from the normalized question" (spec.md:246), but the detail lead is picked from the dish name. Record "the detail's lead is picked from the dish" so code and spec agree.
  - **M3 (MEDIUM, test gap) → cleanup rows, Batch 3b1 note:** three surviving mutants need rows: a soft-deleted add_on, a soft-deleted add_on usage, and a soft-deleted mealOption in another slot when a dish is asked by name (the "exactly one slot" rule). Also the fixture add-on name equals its ingredient name, so no test can tell which name the item uses (the code uses the ingredient name): give the fixture add-on a distinct name and assert the ingredient name.
  - **L1 (LOW) → T041 (touches chat-intent.ts), red row in the cleanup rows:** the decimal regex at src/lib/domain/chat-intent.ts:57 scans the whole message, so "a las 2.30 cena opción 2" reads option 2.3; anchor it to the option token.
  - **L2 (LOW, accepted-current readings, not pinned) → HANDOFF section 6 for the user:** "comí 2 de la cena" and "cena es la mejor opción 2 veces" open option 2's detail; "cena más opciones 3" and "(página -1)" give page 2; "cena 2.5" opens option 2; "cena opción -1" opens option 1; "cena opción 2 y 3" opens option 2. Pin the ones the user accepts, tighten the rest at the spec-change.
  - **L3 (LOW, cosmetic) → cleanup rows:** stale doc comment on `SlotOptionsView.asked` (src/lib/domain/chat-meals.ts ~171).
  - **L4 (LOW) → cleanup rows:** the "Mi cena de hoy" PENDING skip in tests/unit/chat-answer.test.ts:102-104 is stale (builder exists since T032; the reviewer showed un-skipping passes 122/122). Un-skip it; optionally give `BUTTON_TOPICS["Mi cena de hoy"]` `OPTIONS_LEAD`.
  - **L5 (LOW) → T051 (with a T050 row), see also T047:** option-detail answers have no follow-ups (`slotOptions` topic `followUps: []` in src/lib/domain/chat-topics.ts:39) while the spec lists "¿A qué hora es mi <slot>?".
  - **L6 (LOW) → T060 (already owns it), check in T062 and T076:** block-level buttons (now incl. the detail's "Ver receta completa" link) render inside `.assistant-turn-live` (src/components/shared/AssistantTurn.tsx ~62-80); REQ-33 keeps buttons outside the live region.
  - **L7 (note only):** `formatQty` allows 2 decimals (the recipe page uses it too); left as is.
  - **L8 (LOW, optional) → cleanup rows:** the `user_id` filter in `BUILDERS.dish` is untested (defense in depth); optionally add a row with another user's recipe of the same name.

**Checkpoint:** US2 code complete (REQ-7 to REQ-12), unit-green; e2e in Batch E.
**Status (after 2c2, tip 9a3585e):** reached. Every Phase 4 task (T028–T036) is ticked; unit 571/571. Excluded as planned: the US2 e2e rows (assistant-meals.spec.ts and the detail/option rows), written but unrun until Batch E; the did-you-mean/not-found answers for dishes (T048/T049); the REQ-24 2-block button merge (T051). Open spec decisions for the user (next spec-change; none blocks US3): MEDIUM-3 "colación opción 2" on a duplicated slot (Batch note 2b2); M2 detail lead picked from the dish, not the question (REQ-28 wording); L2 accepted-current `selectionAt` readings; plus the US1 items (`isNotDishName` fuzzy, `isPlural` tie rule) and L5 "Comidas" title (Batch note 2a1).

## Phase 5: US3 (P2) Weekly goals and date-based data

**Batch 3a1: shared progress math**, about 320 lines with tests. Worktree from the 1b2 tip, beside 1c1–3b2; touches only the files below.

- [x] T075 [US3] Unit tests for progress.ts (tests/shared/progress-fixture.ts, tests/unit/progress.test.ts)
  - tests/shared/progress-fixture.ts: the parity log rows (both sides of Monday, a capped water day, none after today) and their hand-computed expected numbers for today 2026-10-28; T066 uses the same file.
  - `mondayOf`, `weekDays`, `waterGoalGlasses` (clamp 4–12, 2 L default), `weekWater` (capped), `mealsDoneOn` (filtered to slot ids, clamped), `weekMeals`, `weekExercise` with `endDay` = Sunday and = today (D9), `weightStats` (latest, before Monday, change, goal ratio) equal the expected numbers. Red first (module missing).
- [x] T037 [US3] Pure module (src/lib/progress.ts)
  - UTC date-key helpers, `mondayOf`, `weekDays`, `waterGoalGlasses(liters)`.
  - `weekWater`, `mealsDoneOn`, `weekMeals`, `weekExercise`, each with `endDay`; `weightStats`.

**Review checkpoint 3a1:** tsc + unit.

**Batch note 3a1 (done; T075, T037; +206/-0 vs ~320 estimated; reviewer PASS on both, no HIGH):** commits c3cc859 (tests/shared/progress-fixture.ts +41, tests/unit/progress.test.ts +92; red, tests only) and 64aa494 (src/lib/progress.ts +73) on worktree branch worktree-agent-a3363d28dbb97f395, to be cherry-picked onto the feature branch by the orchestrator after 1c1 finishes. progress.ts: `weekDays(monday, endDay)` = Monday..endDay (≤7); `weekWater`/`weekMeals`/`weekExercise` take `endDay` (dashboard passes Sunday, chat passes today); water capped per day at the goal; `waterGoalGlasses` clamps 4–12 with a 2 L default, liters = glasses × 0.25; `mealsDoneOn` counts slot ids and clamps to the slot count; `weightStats(entries, today, monday, goal)` → `{ start, latest, latestDate, beforeWeek, change, ratio }`, `change` null when no weight before Monday (like the dashboard) and 0 only when the latest weight is itself the one before Monday; date-key math in UTC (independent of the machine timezone). Fixture expected values hand-derived from the dashboard rules: water 16 glasses = 4 L of 14 L; meals 8 of 28; exercise 1; weight start 67, latest 66.2, before-week 66.6, change −0.4, ratio 0.2. Exercise is now windowed to `endDay` like water/meals (the dashboard counted all 7 days); safe because the UI cannot log future exercise/weight (ActivityTile/WeightTile act on today only; water/meals disabled for future days), but the server schema does not reject future dates: client-side guarantee only, already an Assumption. Reviewer ran progress.test.ts under TZ America/Mexico_City, Pacific/Auckland, Pacific/Kiritimati and UTC: all pass; 11 mutations, 8 caught (gaps go to the 3a2 first step in T066). Accepted (L7): `mondayOf`/`addDays` have no guard against malformed keys (callers pass pinned or validated keys). Unproven until the 3a2 targeted run: the dashboard's rendered tiles vs these numbers (T066/T038), local-time vs UTC date handling, weight-tile rounding and kg()/liters() formatting (they stay in DashboardView).

**Batch 3a2: dashboard refactor**, about 270 lines with tests. Same worktree; merged before 3c.

- [x] T066 [US3] e2e, written: dashboard baseline for REQ-16 (tests/e2e/assistant-parity.spec.ts)
  - First commit of 3a2 (3a1 review M1, tests first; tests/shared/progress-fixture.ts, tests/unit/progress.test.ts): `mealsDoneOn` with `["m1","gone"]` → 1 (slot filter) and `["m1","m1","m1","m1","m1"]` → 4 (clamp); a weight exactly on Monday (pins `date < monday`, not `<=`); a latest weight before Monday (`latestDate < monday`, change per the 3a1 batch note); a goal above the start weight (gaining) and a ratio < 0 or > 1; `weekDays` with `endDay` before Monday = `[]`. Keep T066's expected numbers consistent.
  - The chat user's dashboard with `timezoneId: "America/Mexico_City"` and no clock pinning (the server renders `today` from the real date; a pinned browser clock would cause a hydration console.error, 3a2 review HIGH, fixed): logs from `parityLogs(monday)` in tests/shared/progress-fixture.ts, relative to the real Monday of the current week in Mexico City, mapping the positional fixture meal ids m1..m4/"gone" to the seeded meal ids (3a1 review L6); tile strings (water liters, meals D de N, exercise days, weight and weekly change, is-today/is-future day counts) equal the expected values built with the dashboard's own `liters()`/`kg()`. The test title contains "dashboard" (the 3a2 targeted run filters `-g "dashboard"`). Written (commits 7617104, 0fa5e26); first run in the 3a2 targeted run, then Batch E.
- [x] T038 [US3] DashboardView uses `progress.ts` with `endDay` = Sunday and identical output (src/components/dashboard/DashboardView.tsx)
  - 3a1 review M4: also delete the duplicate `WATER_GOAL_LITERS`/`WATER_GLASS_LITERS` in src/components/dashboard/food.ts:15-16 and import them from `@/lib/progress`; delete the local `waterGlasses` clamp (DashboardView.tsx ~131) and the local week math (`mondayOf` ~645) where progress.ts covers them; keep `dateKey`/`addDays` (browser local time) and `kg()`/`liters()` formatting in the dashboard. Written (commit 8119341), reviewer PASS; ticked after the 3a2 targeted run passes.

**Review checkpoint 3a2:** tsc + unit. Reviewer reads the T038 diff for identical inputs, rounding and `endDay` = Sunday (plan Risks). At the merge into the feature branch, the orchestrator runs `npx playwright test assistant-parity.spec.ts -g "dashboard"` once (the only e2e run before Batch E; user decision 2026-10-29): needs the e2e config from T003 (already in) and a T066 test title containing "dashboard"; one server start, one DB clone, nothing else running, foreground; afterwards `lsof -i :3200` is empty and `psql -l` shows no `*-e2e` DB. A failure blocks this checkpoint and is fixed in 3a2. The result is recorded in the 3a2 batch note.

**Batch note 3a2 (done; reviewer PASS on T038 and T066; targeted run PASS; +104/-30 original plus +85/-10 HIGH fix vs ~270 estimated):** worktree branch worktree-agent-a4fb1720775853511 = base 0a93ca2 + the cherry-picked 3a1 commits 1c73e99, 02a3c51 (copies of c3cc859/64aa494, which are NOT merged separately), then 6433bf7 (tests/unit/progress.test.ts +33: slot filter, clamp, Monday boundary, `endDay` before Monday, unclamped goal ratios), 50ed7da (assistant-helpers.ts `chatContext` forwards `timezoneId`, +3/-3), 7617104 (assistant-parity.spec.ts +48, first dashboard baseline), 8119341 (T038: DashboardView +20/-24, food.ts -3; uses progress.ts with `endDay` = Sunday; `WATER_*` constants live only in progress.ts; weight tile uses `progress.weightStats`; local `waterGlasses` clamp, `mealIds` set and `mondayOf` removed; `dateKey`/`addDays`/`parseKey`/`kg()`/`liters()`/streak kept), bb2a118 (tests/shared/progress-fixture.ts `parityLogs(monday)` + unit tests, +68/-1) and 0fa5e26 (assistant-parity.spec.ts rewrite, +17/-9). T038: rendered output identical for every log state the UI can create (old/new compared line by line; 8 mutations killed). T066 HIGH (fixed): the first version pinned the browser clock with `page.clock.setFixedTime(2026-10-28)` while DashboardView renders `today = dateKey(new Date())` on the server with the real date, so the day strip would differ and React 19 would log a hydration console.error, failing the test through the `issues` fixture. Fix: no clock pinning; `test.use({ timezoneId })` kept; the Monday key is computed in the spec (Intl en-CA, UTC weekday math); logs: monday−8 weight 67; monday−3 weight 66.6; Monday water 6 glasses, meals `["m1","m2","gone"]`, exercised, weight 66.2; weight goal 63, activity goal 3 (all in-week logs on Monday, so the numbers do not depend on the weekday). Expected: water "1.5 L" of "Meta 14.0 L", meals "2 de 28", activity "1 de 3 días", weight "66.2 kg", "Meta 63 kg", badge "−0.4 kg esta semana" (U+2212); `.tone-activity li.is-today` count 1 and `li.is-future` count 6 − weekdayIndex(today). The multi-day `PARITY_*` cap/clamp fixture and its unit tests stay; the new unit describe uses `parityLogs("2026-10-26")` with `endDay` Monday/Wednesday/Sunday; mutation `beforeWeek = weights.slice(0,-1).at(-1)` fails two named tests. Accepted (L): 6433bf7 pins existing behavior, so it was not red first; proven by mutation. Unproven until the targeted run: selectors and text formats vs the real DOM; the is-today/is-future counts; zero hydration console errors (the cause is removed, the run still checks it); the meal id mapping `${chatUserId()}-plan-v1-meal-N` (0-based); `timezoneId` vs the browser date; the first-run proof of the ESM `import.meta.url` `SERVER_LOG` path in assistant-helpers.ts (Batch note U0); D9 "future days can't be logged" holds only through the UI (PUT /api/daily-logs/[date] has no future-date guard; already an Assumption, L). Targeted run: `npx playwright test assistant-parity.spec.ts -g "dashboard"` once, foreground, nothing else running; then `lsof -i :3200` empty and `psql -l` shows no `*-e2e` DB. Merge: cherry-pick the range 0a93ca2..worktree-agent-a4fb1720775853511 (includes the two 3a1 copies) onto the feature branch. Run result (2026-10-29): merged with `git cherry-pick 0a93ca2..worktree-agent-a4fb1720775853511` (feature-branch commits 33aab9f..0ff4ea2); tsc clean, unit 360/360; `npx playwright test assistant-parity.spec.ts -g "dashboard"` PASSED (2 passed incl. auth setup, 13.3s); afterwards port 3200 free and no `*-e2e` DB. Proven by this run: selectors and tile strings vs the real DOM, is-today/is-future counts, zero hydration console errors, the meal id mapping, `timezoneId` vs the browser date, the ESM `SERVER_LOG` path and T003's webServer config. Worktree branch merged; deleting it awaits the user's yes.

**Batch 3b1: date parser**, about 420 lines with tests (3a may run beside it)

- **US2 cleanup rows: DONE in cleanup batch 2c3 (ae11be6 M3, 7f134f5 M1, 7d0497b L4, e3e0cc8 L3, 3d8225d L8; see Batch note 2c3), except the L1 red row, which stays with T041.** Original scope, kept for reference (from Batch note 2c2; fold in at the start of 3b1, or run as a small cleanup batch of about 60-80 lines if 3b1 would pass the cap): tests/unit/chat-meals.test.ts gains M1 (both detail lead variants across fixture names: "Pollo asado" → "Esto lleva…", "Ensalada de pollo" → "…lleva:"; a 3-step recipe shows "Ver receta completa") and M3 (soft-deleted add_on, soft-deleted add_on usage, soft-deleted mealOption in another slot for a dish asked by name; the fixture add-on gets a name distinct from its ingredient and the row asserts the ingredient name); optional L8 (another user's recipe with the same name is never the detail). tests/unit/chat-answer.test.ts:102-104: un-skip "Mi cena de hoy" (L4), optionally `BUTTON_TOPICS["Mi cena de hoy"]` = `OPTIONS_LEAD` (tests/shared/assistant-buttons.ts). L1 red row "a las 2.30 cena opción 2" → option 2 (code in T041). L3: fix the stale `SlotOptionsView.asked` comment (src/lib/domain/chat-meals.ts ~171). These are characterization rows except L1; mutation-check M1/M3 as the reviewer did.

**Batch note 2c3 (done; US2 cleanup rows M1, M3, L3, L4, L8 from Batch note 2c2; test-only plus one comment, so no reviewer: the orchestrator verified it; commits ae11be6, 7f134f5, 7d0497b, e3e0cc8, 3d8225d on top of 9a3585e; tip 3d8225d; tsc clean, unit 575/575; no package or specs change; src+tests +52/-17 vs 60-80 target; no task ids ticked, count stays 47 of 78):**

- ae11be6 (M3): rows for a soft-deleted add_on, a soft-deleted add_on usage, and a soft-deleted mealOption in another slot when a dish is asked by name ("exactly one slot" rule). Fixture add-ons renamed "Complemento del desayuno" and "Complemento de la cena", with a new `ingredient` field in `addOnSpecs` (tests/shared/assistant-fixture.ts), mirrored in tests/unit/memdb.ts and tests/e2e/assistant-helpers.ts; tests/unit/memdb.test.ts pins the new names. Pinned current rule: with its usage soft-deleted, the add-on is listed by its own name ("Complemento del desayuno"), the "add-on without usages" rule.
- 7f134f5 (M1): both detail lead variants across dishes ("Pollo asado" gives "Esto lleva Pollo asado:", "Ensalada de pollo" gives "Ensalada de pollo lleva:"); a 3-step recipe shows the "Ver receta completa" link.
- 7d0497b (L4): "Mi cena de hoy" un-skipped in tests/unit/chat-answer.test.ts; its `BUTTON_TOPICS` entry expects `OPTIONS_LEAD`.
- e3e0cc8 (L3): stale `SlotOptionsView.asked` comment fixed (src/lib/domain/chat-meals.ts).
- 3d8225d (L8): row for the `user_id` filter in `BUILDERS.dish` (defense in depth; the resolver already filters by user).
- Break-and-restore proof (code-writer): M1 two mutants, M3 three mutants plus one extra, L4 two, L8 one; each failed the intended test and was restored.
- Left open: L1 red row "a las 2.30 cena opción 2" → option 2, with its code, in T041 (batch 3b1).

- [ ] T039 [US3] Tests REQ-13, REQ-14 periods
  - Unit (tests/unit/chat-dates.test.ts): every REQ-14 phrase → its period bounds with today passed in (cue and period-noun rules); no fallback for "Mi avance de la semana", "¿Cuántos días hice ejercicio?", "a la semana", "en la semana"; "en el mes" = this month. 1a2 review (LOW L4): a pre-2022 summer case, `serverToday(new Date("2022-07-01T05:30:00Z"))` = "2022-07-01" (CDT, UTC−5). 1c1 review: a row with a decimal or comma number in the phrase. Red first.
  - e2e, written (tests/e2e/assistant-progress.spec.ts): the `x-e2e-today` pin moves the period bounds in `resolved`; a pin header without the trace header changes no field shape.
- [ ] T040 [US3] Date parser: cue and period-noun rules, the phrase table → `Period` (src/lib/domain/chat-dates.ts)
  - 1a2 review (LOW L4): `serverToday` calls `formatToParts` once per call (today once per part, chat-dates.ts:7).
  - 1c1 review: `normalizeText` splits decimals ("1,5 L" → "1 5 l"); parse numbers from the raw message, not from `words`.
- [ ] T041 [US3] The route passes the pinned today from `testHooks()` (else `serverToday`); the resolver attaches the period to metric intents (src/app/api/rag/chat/route.ts, src/lib/domain/chat-intent.ts)
  - 2c2 review (L1): the decimal regex at chat-intent.ts:57 scans the whole message ("a las 2.30 cena opción 2" reads option 2.3); anchor it to the option token (the red row "a las 2.30 cena opción 2" → option 2 is written in T041, before the code; it was not part of cleanup batch 2c3). Clock times also matter for the period parsing here.

**Review checkpoint 3b1:** tsc + unit.

**Batch 3b2: period labels, clamp, fallback**, about 350 lines with tests

- [ ] T067 [US3] Unit tests REQ-14 labels (tests/unit/chat-dates.test.ts)
  - Every REQ-14 row → its label (es-MX); year suffix; future-day cut; "últimos 400 días" → 366 days plus the clamp flag; fallback for "hace dos semanas", "31 de febrero", "el mes anterior". Red first. (e2e for REQ-14 text: T042.)
- [ ] T068 [US3] Labels (es-MX abbreviations in code), year suffix, future-day cut, clamp, fallback line (src/lib/domain/chat-dates.ts)

**Review checkpoint 3b2:** tsc + unit. The 3a worktree is merged before 3c starts.

**Batch 3c1: water**, about 260 lines with tests (revision 7 split of 3c; no clean task boundary, so T042 and T043 are split by metric)

- [ ] T042 [US3] Tests REQ-15, REQ-17, REQ-18, REQ-13/14 text, REQ-16
  - Unit (tests/unit/chat-metrics.test.ts, `memDb({ logs })`, today passed in): water today plus the week line; "hoy" only; "ayer" only; uncapped 10 glasses with the week line counting 2 litros; range totals, average and days met. Exercise: week remaining with singular "Te falta 1 día", the met line, today yes/no, another single day, full week vs other ranges. Every REQ-14 label row through water or exercise answers; the clamp line ("Solo puedo revisar hasta 366 días; te muestro los últimos 366.") and the fallback line ("No entendí la fecha; te muestro <periodo>."). REQ-13: a log dated after today leaves "Esta semana (…)" liters unchanged. REQ-27 empty ranges: 0 with the period label. Metric Givens of REQ-1 and REQ-6. Red first.
  - e2e, written: extend T066 (tests/e2e/assistant-parity.spec.ts) with the same pin header, chat water week liters and exercise days equal the tiles; through `ask()` with `today` pinned, "¿Cuánta agua tomé hoy?" changes with the pin and one exercise answer (tests/e2e/assistant-progress.spec.ts).
  - Split: part 1 (3c1) = the water rows, REQ-13 future-day log, the label/clamp/fallback rows through water, the water e2e; part 2 (3c2) = the exercise rows, the remaining label rows, the exercise e2e.
- [ ] T043 [US3] Water and exercise builders on `progress.ts`, `endDay` = today, incl. the 0-with-label empty range (src/lib/domain/chat-metrics.ts). Part 1 (3c1) water, part 2 (3c2) exercise.
  - 1c1 review: any liters/number read from the message comes from the raw text, not `words` (decimals split under `normalizeText`).

**Review checkpoint 3c1:** tsc + unit.

**Batch 3c2: exercise**, about 250 lines with tests: T042 part 2, then T043 part 2.

**Review checkpoint 3c2:** tsc + unit.

**Batch 3d1: weight**, about 310 lines with tests (revision 7 split of 3d; T044 and T045 split by metric)

- [ ] T044 [US3] Tests REQ-19, REQ-20, REQ-14 text, REQ-16 (meals, weight), REQ-27 (weight)
  - Unit (tests/unit/chat-metrics.test.ts): REQ-19 exact sentence; no week line without a record this week; "sin cambio"; "meta alcanzada"; no goal → "Fijar mi meta"; last record over 7 days → the line + "Registrar mi peso"; range min/max. REQ-20: today 3 de 5, week ×7, a range with %. REQ-14 range labels and the fallback line in weight and meals answers. REQ-27: no weight logs → "Aún no registras tu peso." + "Registrar mi peso" (/); an empty weight range → "<Periodo>: no registraste tu peso."; an empty meals range → 0 with the label. Red first.
  - e2e, written: extend T066 (meals done D de N, weight change) (tests/e2e/assistant-parity.spec.ts); the T012 search-bar question shows the weight copy (tests/e2e/assistant-noscope.spec.ts); no weight logs through `ask()` (tests/e2e/assistant-progress.spec.ts).
  - Split: part 1 (3d1) = REQ-19, REQ-27 weight rows, weight labels/fallback, the weight e2e and parity; part 2 (3d2) = REQ-20, the meals labels and empty range, the meals parity.
- [ ] T045 [US3] Weight and meals-done builders, incl. the no-weight-logs reply and empty ranges; the no-active-plan reply for meals done is left to T052 (src/lib/domain/chat-metrics.ts). Part 1 (3d1) weight, which also removes "Mi peso" from the sweep `skip` list; part 2 (3d2) meals done.
  - 3a1 review: the REQ-19 week line needs `weightStats` `latestDate >= monday` and `beforeWeek !== null` (`change` alone is not enough).
  - 1c1 review: any weight number read from the message (e.g. "66,5") comes from the raw text, not `words` (decimals split under `normalizeText`).

**Review checkpoint 3d1:** tsc + unit.

**Batch 3d2: meals done**, about 200 lines with tests: T044 part 2, then T045 part 2.

**Review checkpoint 3d2:** tsc + unit.

**Batch 3e: goals, weekly progress**, about 430 lines with tests

- [ ] T046 [US3] Tests REQ-21, REQ-22, REQ-16
  - Unit (tests/unit/chat-metrics.test.ts): REQ-21 bare goals, narrowed water goal, no active plan; a plan of 1 L → "Tu meta de agua es **4 vasos** (1 litro) al día."; 4 L → "**12 vasos** (4 litros)". REQ-22: 4 items / 3 without a weight change / no plan. `sweep()` over metric follow-ups ("Fijar mi meta"/"Subir mi plan" are links, excluded). Red first.
  - e2e, written: parity of the goals answer's exercise and water goals and every weekly-progress item with the tiles under the T066 pin (tests/e2e/assistant-parity.spec.ts); one goals answer through `ask()` (tests/e2e/assistant-progress.spec.ts).
- [ ] T047 [US3] Goals and weekly-progress builders, incl. the no-plan line and "Subir mi plan"; removes "¿Cuál es mi meta?" and "Mi avance de la semana" from the sweep `skip` list (src/lib/domain/chat-metrics.ts)
  - 3a1 review: the weekly-progress weight item uses the same rule as T045 (`latestDate >= monday` and `beforeWeek !== null`).
  - 1c2 review (M6), owned here: tests/e2e/assistant-api.spec.ts asserts "¿Cuál es mi objetivo?" → "Tu objetivo: …" (lines 68, 199-200, 237-240, 260, 272; also the joined text at ~215 and the lead at ~230); rewrite them to the Goals answer when this builder lands. The plan-summary lead part of those tests (if it keeps the objective) changes again in T054.
  - 1d2 review: those same lines also assert a stale `Plan activo` source for "¿Cuál es mi objetivo?" (assistant-api.spec.ts :68, :199, :237, :260, :272); fix the source assertions together with the text (T054 for the plan-summary part).
  - 2c2 review (L5, note): the option-detail follow-up "¿A qué hora es mi <slot>?" is owned by T051; if this task edits the topic follow-ups in chat-topics.ts, leave `slotOptions` to T051.

**Checkpoint:** US3 code complete (REQ-13 to REQ-22), unit-green; parity (REQ-16) proven in Batch E.

## Phase 6: US4 (P2) Chat-like edge cases

**Batch 4a: greeting, variants, no-match, did-you-mean**, about 490 lines with tests (revision 9 added the REQ-26/REQ-29 answer rows; no clean task boundary; over the ~450 cap, decision pending: plan Batches)

- [ ] T048 [US4] Tests REQ-23, REQ-26, REQ-28, REQ-29, REQ-3 text
  - Carry-forward from 1e2 (a): closed by T036 (2c2 added the "¿Qué lleva <receta>?" sweep rows for the 6 non-generic recipes). Here the dish did-you-mean/not-found answers replace the placeholders T036 left.
  - Unit (tests/unit/chat-edges.test.ts): "hola" → greeting + 4 buttons; thanks; "Hola, ¿cuánto peso?" → weight. Pizza not-found quotes "pizza"; pollo → did-you-mean with 2 buttons (no distractor offered); "la opcion 1" → not found. The same question twice → the same variant; for each answer with variants, questions hitting different variants show identical numbers and units (REQ-28). Capital de Francia → no-match + 4 starters; a near recipe name → did-you-mean. No-match asserts the exact lead (one of the two spec Copy variants), exactly the 4 starter buttons, and no objective or meal name anywhere in the answer. 1a2 review (LOW L6): starters are not filtered by the repeat rule: greeting and no_match list all 4 starters even when the message equals a starter-like text. Negative assertion (tests/unit/chat-answer.test.ts): the old fallback texts "No encontré esa información en tu plan activo." and "No encontré esa información en el sistema." never appear. `sweep()` over greeting, no-match and did-you-mean buttons. Red first.
  - REQ-26/REQ-29 answer-text rows (analyze round 1, M1; tests/unit/chat-edges.test.ts, base fixture): "¿Qué lleva la pizza con atún?" → kind `did_you_mean`, lead "No encontré exactamente 'pizza con atún'. ¿Quisiste decir…?", exactly one button "Sándwich de atún" sending "¿Qué lleva Sándwich de atún?", no detail opened (no detail block, kind ≠ `detail`); "¿Qué lleva el agua?" → the water answer, not a REQ-26 reply (no "No encontré" lead, kind neither `did_you_mean` nor not-found); '<frase>' is the phrase as typed without the cue and leading article ("¿Qué lleva la Pizza Con Atún?" quotes "Pizza Con Atún", and the quote never starts with "la"/"el" or contains "lleva"); the three REQ-29 table rows at answer level, each the "¿Quisiste decir…?" lead with buttons in order: "una ensalada rica" → Ensalada de pollo; "pollo atún ensalada" → 3 buttons Ensalada de pollo, Pollo asado, Sándwich de atún; "estoy buscando algo rico con atún" → Sándwich de atún; a whole question that is exactly a recipe name, "Pollo asado" alone (no dish cue), → did-you-mean with "Pollo asado" first, never a detail.
  - e2e, written (tests/e2e/assistant-edges.spec.ts): through `ask()`, "hola", pollo did-you-mean, pizza not found, the same question twice, and one REQ-29 did-you-mean row ("pollo atún ensalada": the lead and the 3 buttons in order). Finalize the `sources` test in assistant-api.spec.ts: "¿Qué hago ahora?" → kind `no_match` and `sources` `[]`.
  - 1c2 review (M4): greetings and thanks are exact-only today (`GREETING_WORDS`), but REQ-2 makes "buenos días" a fuzzy multi-word entry and Greeting is a Topics row like any other. Rows: "grasias" (1 edit, 7 letters), "gracia" (singular of gracias), "buenso dias" (swap), "buenas tarde", "buenos dia" → greeting/thanks; "hoal" stays `no_match` (4 letters, exact only). T049 routes greetings through `matchWord`/`matchPhrases`.
  - 2a1 review (M2), with T049: rows for the REQ-28 slot-times variant ("Tu <slot> es: **<time>**."); make the 2a1 slot-time tests in tests/unit/chat-meals.test.ts (canonical "Tu horario de cena: …") and the rewritten e2e rows variant-agnostic (either spec Copy variant).
  - T013 review (M1), with T049: the REQ-29 no-match test in tests/e2e/assistant-next-step.spec.ts:113-118 hard-codes the first lead variant and the 4 starters; make it variant-agnostic (either spec Copy variant, since REQ-28 picks one by hashing the question).
- [ ] T049 [US4] Builders and variant picker; REQ-29 matching on the whole question minus stop words (src/lib/domain/chat.ts)
  - Revision 8: REQ-29 calls `rankDish` from T027 (matcher rows already in T026 part 1); this task adds the step-8 call and the did-you-mean/not-found builders in chat.ts only. src/lib/domain/chat-dish.ts is not changed here (revision 9, analyze L6).
  - 1c2 review (M4): greeting and thanks words go through the REQ-2 matcher (fuzzy, phrases) instead of the exact `GREETING_WORDS` set; rows in T048.
  - 2a1 review (M2): carry the slot-times variant "Tu <slot> es: **<time>**." in the variant picker (src/lib/domain/chat-meals.ts `slotTimeLead`); rows in T048.
  - 2b1 carry-forward (a): `pickVariant` is private to chat-meals.ts and gives all four starter-button questions the same variant (index 2). Export or move it so every REQ-28 site shares one picker, and improve variety (rows in T048).

**Review checkpoint 4a:** tsc + unit.

**Batch 4b1: multi-topic**, about 250 lines with tests (revision 7 split of 4b)

- [ ] T050 [US4] Tests REQ-24, REQ-25, REQ-27
  - Unit (tests/unit/chat-edges.test.ts): "agua, ejercicio y peso" → 2 titled blocks + "Mi peso"; desayunar y cenar → options + "¿Cuál es mi cena?". Clarify answers stand alone; "¿Cuánto llevo?" → 3 buttons; a dish cue with no dish → 3 recipe buttons, or slot buttons when none. REQ-27 cases not tested earlier: no active plan for plan, slot and meals-done questions; "¿Qué puedo cenar?" without cena → "Tu plan no tiene cena." + one button per slot, starters when none; a slot with no options; an empty recipe book: "¿Qué recetas tengo?" → lead "Aún no tienes recetas.", no sections, `sources` `[]`. `sweep()` over clarify, did-you-mean and overflow buttons; none resolves to another question or no-match. Red first.
  - e2e, written (tests/e2e/assistant-edges.spec.ts): the multi-topic question and "¿Cuánto llevo?" through `ask()`; one no-active-plan slot question.
  - 1a2 review (LOW L5): once 2-block answers exist (T051), one literal assertion of a 2-block plain `answer` string (both blocks concatenated, D7); applies to T048–T050 wherever a 2-block answer is first produced.
  - 1b2b review (MEDIUM): in tests/e2e/assistant-api.spec.ts `answer()` (~line 61) add `expect(body.blocks, message).toHaveLength(1)` (its comment says "with one block"; for lead/sections it is the exact equivalent of the old flattening), before REQ-24 adds 2-block answers; do it in the first earlier batch that touches the file, if any.
  - 2a1 review (M1), part 1: rows for a clarify plus another topic, and a not-in-plan slot answer plus a second block; each row decides and asserts whether follow-ups and overflow buttons survive (today chat.ts ~147 takes the buttons of the first block that has any).
  - Split: part 1 (just before T051) = the multi-topic rows and the literal 2-block `answer`; part 2 (just before T052, Batch 4b2) = clarify, REQ-27 rows, the sweep and the e2e.
- [ ] T051 [US4] `reply()` 2-block rules: titles, one option block, follow-ups then overflow, a later clarify omitted (src/lib/domain/chat.ts)
  - 2a1 review (M1): replace the interim "buttons from the first block that has them" (chat.ts ~147) with the REQ-24 merge, per the T050 part 1 rows.
  - 2b1 carry-forward (b): today a 2-block answer shows only the first block's buttons while the second block's options lead promises options; the REQ-24 merge must fix it (add a T050 row: slot options as the second block keep their option buttons).
  - 2c2 review (L5): option-detail answers have no follow-ups (`slotOptions` topic `followUps: []`, src/lib/domain/chat-topics.ts:39) while the spec lists "¿A qué hora es mi <slot>?"; add the follow-up (row in T050) and decide how it merges with the detail's block button "Ver receta completa" (`blockButtons`). If T047 touches chat-topics.ts first, keep the table pin (`SPEC_TOPICS`) in step.
**Review checkpoint 4b1:** tsc + unit.

**Batch 4b2: clarifications and missing data**, about 290 lines with tests

- [ ] T052 [US4] Clarify replies and the missing-data replies tested in T050 only (src/lib/domain/chat-meals.ts, src/lib/domain/chat-metrics.ts)
  - 1c2 review (M6), owned here: tests/e2e/assistant-api.spec.ts:117-118 ("¿Cuál es el objetivo de mi plan?" → "No tienes un plan activo.") and :307 use the old copy; rewrite to the spec Copy no-active-plan reply ("Aún no tienes…") for the topic each question resolves to.
  - 2a1 review (L2): tests/unit/chat-meals.test.ts:52 pins "No tienes un plan activo."; flip it to the spec Copy reply in the T050 red commit, and prefer asserting `sources` is `[]` over the exact old text.

**Checkpoint:** US4 code complete (REQ-23 to REQ-29), unit-green.

## Phase 7: US5 (P3) Identity

**Batch 5: identity**, about 240 lines with tests

- [ ] T053 [US5] Tests REQ-30, REQ-31
  - Unit (tests/unit/chat-identity.test.ts): "Te llamas Rafael." highlighted; a blank name; "Plan octubre.PDF" → "Plan octubre"; the plan summary lead has the name; no plan → REQ-27; answer text for the identity Givens of REQ-6. Red first.
  - e2e, written (tests/e2e/assistant-identity.spec.ts): "¿Cómo me llamo?" and the plan name through `ask()`.
- [ ] T054 [US5] Identity builders and the plan-summary lead (src/lib/domain/chat.ts)
  - 1c2 review (M6): the plan-summary lead change touches the assistant-api.spec.ts objective/plan tests rewritten in T047 (lines ~199-240); update their lead assertions here, and their `sources` (stale `Plan activo`, 1d2 review; see T047).

**Checkpoint:** US5 code complete (REQ-30, REQ-31), unit-green.

## Phase 8: US6 (P3) Conversation UI

UI-only: e2e tests are written here and proven in Batch E (T076 run, T077 breakage demo).

**Batch 6a1: UI tests, written**, about 250 lines (revision 7 split of 6a; e2e only, not run, so a tests-only batch is green on tsc + unit)

- [ ] T055 [US6] e2e, written: REQ-32, REQ-34, REQ-35 visuals (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - Sides and avatar (32 px `Bot`, aria-hidden, also on errors).
  - Contrast in both themes: text 4.5:1, boundary 3:1, for bubbles, avatar and the `ArrowUpRight` icon (3:1 against its button).
  - 360 px: a 500-character message and an 80-character token have no overflow.
  - Vertical option buttons stretch, wrap, ≥44 px; nav links ≥44×44 px at 360 px.
  - Visible focus ring on option buttons and nav links, both themes. Bubbles are not keyboard-focusable: no tabindex, skipped by Tab.
  - Only the last answer has question buttons; `aria-disabled` while pending (focusable, sends nothing); links work on old answers.
  - The arrow icon is aria-hidden; the accessible name equals the label.
**Review checkpoint 6a1:** tsc + unit.

**Batch 6a2: bubbles, avatar, button variants**, about 260 lines

- [ ] T056 [US6] Single button component with `option` and `link` variants (`ArrowUpRight`); bubbles and avatar with theme tokens only (src/components/shared/PromptSuggestion.tsx, src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)
  - 1b2b review (L3): rename `askInScope` (e.g. `ask`) in src/components/app/assistant.tsx:110 and src/components/app/AppShell.tsx:47, 68; do it here or in T058, whichever UI batch touches those files first.
  - 1b1a review (LOW 2): question buttons still use native `disabled` (PromptSuggestion → base-ui Button); switch to `aria-disabled` while pending (REQ-34).

**Review checkpoint 6a2:** tsc + unit.

**Batch 6b1: response stream**, about 110 lines (revision 7 split of 6b)

- [ ] T058 [US6] Fetch https://prompt-kit.com/c/response-stream.json into the scratchpad (no install); adapt it with attribution (src/components/shared/ResponseStream.tsx)
**Review checkpoint 6b1:** tsc + unit.

**Batch 6b2: typing and live region**, about 370 lines with tests

- [ ] T059 [US6] e2e, written: REQ-33 (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - A long lead completes within 1 s; buttons appear only after it; tapping completes it; reduced motion → immediate.
  - The live region changes once and includes "3 opciones" and the labels.
  - No replay after close/reopen or navigation; the scroll uses the final height.
- [ ] T060 [US6] Type the first lead only (precomputed full-height layout); fades ≤200 ms; reduced motion; typed-once flag; hidden option count in the live region (src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)
  - 1b1a review (MEDIUM 2), owned here: block-level buttons render inside `.assistant-turn-live` (AssistantTurn.tsx:438, :476); move them outside the live region, leaving only the hidden option count and labels (plan UI rule, ux checklist v1.2, chat-polish REQ-17 as amended). Between T032 (2b1) and here, option buttons sit inside the region; no e2e runs before Batch E, so this lands before any tested UI sees them. e2e (with T059, tests/e2e/assistant-a11y.spec.ts): no `button` inside the live region, and the region holds "3 opciones" plus the labels.
  - 2c2 review (L6): since T036 the detail's "Ver receta completa" link is also a block-level button inside `.assistant-turn-live` (AssistantTurn.tsx ~62-80); the move must cover link buttons too, and the e2e must assert no `a` or `button` inside the region.

**Review checkpoint 6b2:** tsc + unit.

**Batch 6c: keyboard, focus, navigation**, about 350 lines with tests

- [ ] T061 [US6] e2e, written: REQ-35, REQ-34 navigation close (tests/e2e/assistant-a11y.spec.ts)
  - Tab order, Enter/Space.
  - Focus after option, paging, slot, clarify and did-you-mean buttons (360 px: log while pending, then the new turn; desktop: input).
  - At 360 px, "Registrar mi peso", "Fijar mi meta" and "Subir mi plan" each close the sheet; on the same destination, focus goes to the FAB.
  - On desktop, "Ver receta completa" keeps the panel open with focus in the page's main heading or content.
- [ ] T062 [US6] Navigation handling (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/app/assistant.tsx)
  - A link click closes the sheet at ≤640 px; on the same destination it only closes and focuses the FAB.
  - On desktop, after the path change, focus `main h1` (fallback `main`, tabIndex -1).
  - 2c2 review (L6): confirm T060 moved the block-level buttons (incl. "Ver receta completa") out of `.assistant-turn-live`; if not, move them here before the navigation handling.

**Checkpoint:** US6 code complete (REQ-32 to REQ-35); proven in Batch E.

## Phase 9: e2e stabilization

**Batch E: e2e stabilization.** Up to 3 review rounds, each fix round ≤ ~300 lines.

- [ ] T076 [setup] Full run and fix rounds (tests/e2e/*, plus the src/ files a fix needs)
  - Preconditions: no other Playwright run, `lsof -i :3200` empty, nothing in the background; the user's :3000 is not touched.
  - Run 1: one full `npm run test:e2e`, in the foreground. Then the T003 first-run check: `lsof -i :3200` empty and `psql -l` shows no `<name>-e2e`; if either is left over, stop and report. Look at T066 (dashboard baseline) first.
  - Triage every failure in the batch note: (a) known failure on main; (b) the test contradicts spec v1.6 → fix the test; (c) code bug → fix it, with a unit test first (red, then green) when the cause is logic, otherwise the failing e2e is the proof; (d) snapshot-only diff → T057. In run 1 the `assistant-look` and `a-theme-visual` snapshots are expected red until T057. 1c2 review (M6): an assistant-noscope `MESSAGES` pass is not evidence (vacuous until T063 strengthens it). 1d2 review: check the re-check list in Batch note 1d2 (h4 section-title levels fixed in fb976a9 at assistant-next-step.spec.ts:105, :177 and assistant-answers.spec.ts:69, :88, :121; stale `Plan activo` sources owned by T047/T054; the Quesadillas assertion in assistant-match.spec.ts: verify the T026 part 2 fix). 2c2 review: the US2 detail/option e2e rows (assistant-meals.spec.ts) run for the first time here, incl. the REQ-10 full-answer equality row; the a11y check that no block button (L6, "Ver receta completa") sits inside `.assistant-turn-live`.
  - Fix rounds (up to 3): path-limited commits citing the failing test and REQ; gate = tsc + `npm run test:unit` + a rerun of only the affected spec files, one at a time. Failures left after round 3 go to the user.
  - After T077 and T057: one final full `npm run test:e2e`. If it shows a new snapshot-only diff, the user is asked again for a refresh (same T057 procedure) before the checkpoint.
- [ ] T077 [setup] Red-by-breaking demo for e2e-only behavior (Constitution 1, spec v1.6). Nothing is committed.
  - For each item: make an uncommitted breaking edit, run only that test (`npx playwright test <file> -g "<title>"`), record red, restore with `git checkout -- <file>`, rerun green. One break may prove several tests. `git status` is clean at the end.
  - Items: chat-polish REQ-23 route (500 + log, 400 without log, malformed JSON; T005); REQ-4 UI (no scope menu, `{ message }` only, subtitle never changes the answer incl. the identical visible answer on `/recipes/<id>` and `/groceries`; T012); the T035 RecipeDetail.tsx change (the recipe page keeps its display: empty-steps state and accented split; T034 e2e); the REQ-9/10 UI paging flow (T031 e2e); REQ-13 pin header (T039); REQ-16 parity (T066, T042, T044, T046); bubbles, avatar, contrast, 360 px overflow, button sizes, focus ring, bubbles not focusable, question buttons only on the last answer, `aria-disabled` while pending (T055); typing within 1 s, buttons after typing, tap to complete, reduced motion, live region once, no replay (T059); Tab order, focus after buttons, nav closing at 360 px, FAB focus, desktop heading focus (T061); the `assistant-look` snapshot (e.g. a bubble color; trivially red before T057, so it is demonstrated after T057).
  - Batch note: a table of item, break, test title, red, green.
- [ ] T057 [US6] Snapshot refresh, the only one (tests/e2e/*-snapshots): the reviewer lists each snapshot-only diff per test name with the confinement judgment; only after the user's explicit yes, `--update-snapshots` for those tests only (assistant-look, a-theme-visual); commit the images alone. An unconfined diff is a regression and goes back to a T076 fix round. Expected from T069 (1b1b review LOW 2): tests/e2e/a-theme-visual.spec.ts-snapshots/home-dashboard-darwin.png, confined to the search bar (filter icon removed, placeholder text, 8px padding).

**Review checkpoint E:** final full run green apart from the known failures; T077 table complete; T057 done (or waiting on the user's yes, which blocks the checkpoint).

## Phase 10: Final verification

**Batch Final**, about 200 lines with tests

- [ ] T063 [setup] Coverage audit and merge preconditions (tests/unit/chat-answer.test.ts, tests/e2e/assistant-api.spec.ts)
  - Every REQ-1 to REQ-35 and chat-polish REQ-23 maps to a passing unit and/or e2e test that asserts answer text, kind or buttons; no REQ is covered by `resolved` alone (table below).
  - Final REQ-5 sweep over one answer of every reply kind and every button type: `sweep()` (unit) and `resendSweep` (e2e).
  - Merge precondition 1: `grep -rn "Pronto podré" src` returns nothing (no D3 placeholder).
  - Merge precondition 2: `grep -n "headers" src/app/api/rag/chat/route.ts` shows header access only through `testHooks()`; `resolved` is set only under `trace`.
  - T013 review (M3): re-check the hard-coded follow-up expectations in tests/e2e/assistant-next-step.spec.ts (:49, :57, :87, :94, :178, and the starters at :116) whenever T021/T028/T031/T034 change the Topics follow-ups; confirm the 1b2a carry-overs L4–L6 were applied or recorded as accepted loss. 1c2 review (M6): include the next-step "Recetas" heading (~103) and chips (~56, ~94, ~178) updated in T023. 1d2 review: also the heading levels in Batch note 1d2's re-check list (section titles `<h4>`, block titles `<h3>`).
  - 1c2 review (M6): the assistant-noscope.spec.ts `MESSAGES` test is vacuous (it compares the plain call with the legacy-field call, so any answer passes). Give each message an expected kind or lead text, or record it as a pure "fields ignored" check with that limit stated; check it in T076 run 1 triage too.
  - No `ScopeKey`/`scope` remains in chat code: `grep -rEnw "ScopeKey|SCOPE_LABEL|scope" src/lib/assistant.ts src/lib/domain src/app/api/rag/chat src/components/app src/components/shared` returns nothing (src only; tests excluded, they hold the negative assertions per Global rules).
- [ ] T064 [setup] Synthetic smoke and NFR (tests/e2e/assistant-helpers.ts, tests/e2e/assistant-api.spec.ts)
  - Harness `seedVolume()`: 32 recipes, 69 meals, 365 daily_logs rows, goals, name, add-ons, on the chat user.
  - One question per topic: no 500 (no Proxy misses). A 500 here (e.g. a collection missing from `needs.chat`) triggers a `src/` fix after Batch E, and therefore the full rerun in T065. After a warm-up request, each answer under 5 s; timings logged per topic.
  - Nothing committed depends on the real dataset or machine speed.
- [ ] T065 [setup] `npx tsc --noEmit`, `npm run test:unit`, and one run of the spec files changed in this batch (assistant-api); a full `npm run test:e2e` only if this batch changed `src/` (e.g. a T064 500 fixed in `queries.ts` `needs.chat`). Report to the orchestrator for the spec Progress and the chat-polish REQ-23 status.
  - Merge precondition 3: the user runs the manual ≤1 s check on the real data (one question per topic on :3000) before merge; the result is recorded in the batch report. The agent does not run it.

## Coverage

Unit = fail-first proof for logic (run every batch). e2e = written with the task, run in Batch E; e2e-only rows get their red proof in T077. Never `resolved` alone.

| Requirement | Unit | e2e | Code |
|---|---|---|---|
| chat-polish REQ-23 | T005 (hook guard: the outside-test-environment criterion, shared with REQ-13, is unit-only in tests/unit/test-hooks.test.ts because the e2e server always runs with `E2E_HOOKS=1`) | T005 (route, log, panel), T013 (503 for the generic copy) | T006, T007 |
| REQ-1 | T070, T021, T028, T042, T053 | T070 | T018–T020, T022 |
| REQ-2 | T017, T070, T080 (optional) | T070 | T018–T020, T080 (optional) |
| REQ-3 | T026, T031, T034, T048 | T026, T034, T048 | T024, T078, T027, T079, T033 |
| REQ-4 | T072 (schema, no scope) | T072, T012 | T010, T011, T014–T016, T069 |
| REQ-5 | T072, T020 (expected-topic sweep), T021, T026, T028, T031, T034, T046, T048, T050, T063 (sweeps) | T072, T012, T063 (final) | T010, T014 |
| REQ-6 | T021, T026, T028, T042, T053 | T021, T026, T028 | T022, T023, T079 |
| REQ-7, REQ-8 | T028 | T028 | T029, T030 |
| REQ-9, REQ-10 | T031 | T031 | T032, T033 |
| REQ-11 | T026 (slot ref not a dish name), T028, T031, T034 | T028 | T029, T030, T032, T036 |
| REQ-12 | T034 | T034 | T035, T036 |
| REQ-13 | T005 (guard), T072 (clock), T042 (future-day log) | T039 (pin header), T042 (pin changes "hoy") | T006, T011, T041 |
| REQ-14 | T039, T067, T042, T044 | T042 | T040, T041, T068 |
| REQ-15 | T042, T044 | T042 | T043, T045 |
| REQ-16 | T075 (progress.ts numbers; the fixture self-checks `waterGlasses*0.25*7 === weekWaterGoalLiters` and `PARITY_SLOTS.length*7 === weekMealsGoal` are fixture arithmetic, not coverage) | T066 (dashboard), T042, T044, T046 (parity; e2e only) | T037, T038, T043, T045, T047 |
| REQ-17, REQ-18 | T042 | T042 | T043 |
| REQ-19, REQ-20 | T044 | T044 | T045 |
| REQ-21, REQ-22 | T046 | T046 | T047 |
| REQ-23, REQ-26, REQ-28, REQ-29 | T048, T026 (REQ-29 and REQ-26 candidate rows on the matcher) | T048 | T049, T027 (`rankDish`, `matchDish`) |
| REQ-24, REQ-25 | T050 | T050 | T051, T052, T079 (empty dish phrase → step 7) |
| REQ-27 | T042, T044, T046, T050, T053 | T044, T050 | T043, T045, T047, T052, T054 |
| REQ-30, REQ-31 | T053 | T053 | T054 |
| REQ-32, REQ-34 | — (UI only) | T055, T061 | T056, T062 |
| REQ-33 | — (UI only) | T059 | T058, T060 |
| REQ-35 | — (UI only) | T055, T061 | T056, T062 |
| NFR performance | — | T064 (synthetic, 5 s, timings); manual ≤1 s by the user (T065) | — |

Snapshots (not code): one refresh, T057 (end of Batch E), after the user's yes. T071 removed.
