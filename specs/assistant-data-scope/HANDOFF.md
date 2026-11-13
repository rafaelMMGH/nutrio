# Handoff: assistant-data-scope (rewritten 2026-11-13 after Batch 4b1 passed review round 2; no batch running)

A fresh orchestrator session can continue from here without the earlier conversation. Read this file first, then `plan.md` (Batches), then `tasks.md` (Global rules at the top, then the **Batch notes**, which hold every decision and open item per batch). User-facing language is Spanish (Mexico); specs and this file are English.

## 1. State now

- Branch `feature/assistant-data-scope` (local, never pushed). Code tip **26c7303** (4b1 fix round 1 pin rows); the orchestrator adds one docs commit on top (this file, tasks.md, plan.md), so `git log -1` shows that docs commit with 26c7303 just below it (then 9660828, 0b5bd82 (docs), 6d321ce, f7b9d23, e8d9a01, 384ac50).
- Gates at 26c7303: `npx tsc --noEmit` clean, `npm run test:unit` **762/762**, no dependency change (vs main, package.json differs only by the `test:unit` script line), no `specs/` in code commits.
- Spec `spec.md` **v1.7, status `planned`** (Gate 2 approved 2026-10-29); plan **revision 10**. `assistant-chat-polish` is `partial` (its REQ-23, HTTP 500, is delivered here, in F1b).
- **61 of 78 active tasks ticked** (80 ids: T071 removed, T025 dropped by spec v1.7). US1, US2, US3 code-complete. US4: T048, T049, T051 ticked; T050 part 1 passed review but T050 stays unticked until part 2 (4b2); T052 open.
- **Batches done (all reviewer PASS or orchestrator-verified):** F1a, U0, F1b, 1a1, 1a2, 1b1a, 1b1b, 1b2a, 1b2b, 1c1, 3a1, 1c2, 3a2, 1d1, 1d2, 1e1, 1e2, 2a1, 2a2, 2b1, 2b2, 2c1, 2c2, 2c3 (cleanup), 3b1, 3b2, 3b3 (cleanup), 3c1, 3c2, 3d1, 3d2, 3e, 4a1, 4a2, **4b1**.
- **Batch 4b1 (multi-topic; T050 part 1, T051): Done, review round 2 PASS** (no HIGH, no MEDIUM). Round 1 failed on MEDIUM-1 (duplicate buttons); fix round 1 = 9660828 (offers filtered against the first block's own button messages) and 26c7303 (M34/M24/M27 pins, dish-builder comment that settles 4b1 LOW-1). The round-2 sweep (46,520 answers over 10 plan configs) found 0 duplicate or self-repeating buttons and 0 buttons resolving to clarify/did-you-mean/no-match/multi-topic; 10 mutants, all killed. Detail: Batch note 4b1 in tasks.md.
- Placeholders still in chat.ts: `pending("mealsDone")` (no plan / zero slots) and `pending("ambiguous")` ("¿Cuánto llevo?"), both T052. T063 requires none left. **Do not demo those two paths.** 2-block answers are fixed and demo-able (no-plan slot blocks stay untitled until T052, 4b1 MEDIUM-2).
- The only e2e run since F1a is the targeted 3a2 run (`assistant-parity.spec.ts -g "dashboard"`, PASS). Every other e2e row is written and type-checked only; 4b1 wrote none (its four rows are listed in T050 part 2).
- Working tree: only `docs/PRD de Gestión Nutricional.md` and `specs/bugs/e2e-run-guard.md` are untracked; neither belongs to this feature: never commit them.

## 2. Next steps, in this order

1. **Sanity check before any agent runs:** `git status --short` (only the two untracked files above), `git log -1` (the docs commit on top of 26c7303), `npx tsc --noEmit` (clean) and `npm run test:unit` once (expect **762/762**). If anything differs, stop and investigate before launching agents.
2. **Ask the user** for the ruling on the reply for an active plan with **zero meal slots** (section 6a, Meals done) and record the answer (tasks.md T052 and this file). T052 needs it; 4b2 does not start without it. Other section-6 rulings are non-blocking.
3. **Batch 4b2 (~290): T050 part 2 (tests, red first), then T052** (chat-meals.ts, chat-metrics.ts, chat.ts, tests). T050 part 2 holds: clarify rows ("¿Cuánto llevo?" → 3 buttons), REQ-27 missing-data rows, the sweep over clarify/did-you-mean/overflow buttons, the e2e rows written (incl. the four 4b1 rows listed in T050); the 3e cleanup rows MEDIUM-1, MEDIUM-2, LOW-1; the 4a2 test cleanups LOW-1, LOW-2 (optional LOW-4); the 4b1 MEDIUM-3 survivors M26, M33, N08, N12; NOT the dish-clarify rows (landed in 4b1) and NOT M24/M27/M34 (pinned in 26c7303). T052 holds: 4b1 MEDIUM-2 (no-plan slot blocks: copy "Aún no tienes un plan activo." plus "Subir mi plan", a block title, de-dup of identical no-plan blocks; replace the old copy in slotOptions, mealTimes, planSummary); the ambiguous builder setting `kind: "clarify"`; the `mealsDoneAnswer` returns-`undefined` contract and deleting the redundant `?? pending("mealsDone")`; the zero-slots plan reply (per the user's ruling); `objective?.trim()`; the optional shared weight-record helper; the 1c2 M6 and 2a1 L2 old-copy rewrites; the pre-existing slot follow-up gaps; optional 4a1 LOW-3 test naming. The 4b1 LOW-1 did-you-mean guard question is already settled (26c7303 comment; nothing to do). Optional cosmetic: 4b1 round-2 LOW-2 (name the `offered` list at chat.ts:243). US4 checkpoint after this batch; T050 is ticked then.
4. **Batch 5** (T053, T054): identity builders, the identity topic title "Nombre / Plan" (4b1 LOW-2), the plan-summary lead (also updates the stale assistant-api.spec.ts lead/`sources` assertions).
5. **Batches 6a1/6a2** (T055 e2e written; T056 button component), **6b1/6b2** (T058 response-stream adaptation, no install; T059, T060 typing), **6c** (T061, T062).
6. **Batch E:** T076 first full `npm run test:e2e` plus up to 3 fix rounds (check every Batch-note e2e assumption, listed in T076), T077 red-by-breaking demo for UI-only behavior (nothing committed), **T057 the ONE snapshot refresh, only after the user's explicit yes**.
7. **Final:** T063–T065 (coverage audit incl. the unused `ReplyKind` "options", synthetic-volume check, **the user's manual ≤1 s check on real data before merge**), then section 6b's push/PR items.

Remember: **no e2e per batch** until Batch E.

## 3. Batch list (sizes are ADDED lines incl. tests; details in plan.md Batches)

- **Done:** see section 1 (through 4b1; 33 of 42 batches).
- **Next:** 4b2 (T050 pt 2, T052, ~290; waits for the zero-slots ruling) · 5 (T053–T054, ~240) · 6a1/6a2 (T055 / T056, ~250 / ~260) · 6b1/6b2 (T058 / T059, T060, ~110 / ~370) · 6c (T061–T062, ~350) · **E** (T076, T077, T057) · Final (T063–T065, ~200).
- Open items per batch live in the batch notes and on the owning task in `tasks.md`.

## 4. Rules (recorded in tasks.md/plan.md Global rules) and process lessons

- **No e2e per batch.** Each batch gate = `npx tsc --noEmit` + `npm run test:unit` (`node:test` through `tsx`, flat `tests/unit/*.test.ts`). e2e specs are WRITTEN with each task and first run in Batch E. Never two e2e runs at once (shared cloned DB, port 3200), never in the background. Never `next build` in place.
- **Tests first**: red tests committed just before the code of each task; tsc must pass at each task's final commit and every batch tip (a red tests-only commit is exempt but never the tip).
- **Batch size**: cap ~450 ADDED lines (deleted lines tracked separately); a whole-file deletion/rewrite is its own batch; stop at a task boundary and report when the running count passes the estimate by > ~50.
- **Parallel rule (2026-10-29)**: the next code phase may start in parallel with a review of code it will not modify or use; planner/spec edits always run in parallel with code work. Remaining batches all share chat.ts/chat-meals.ts/chat-metrics.ts, so in practice they run sequentially.
- **Model/effort**: each agent takes them from `.claude/agents/<name>.md`; do NOT pass `model`/`effort` when launching agents.
- **Product rules**: closed-answer buttons for every clarification; stateless chat; no scopes; "today" from the server in America/Mexico_City; no new dependency (in-house dish matcher, spec v1.7); Copy verbatim from the spec (es-MX).
- **Commits**: path-limited (`git add <paths>`, never `-A`), per task, messages cite US/T/REQ ids; no `specs/` in agent commits (the orchestrator commits docs separately). Use the trailer lines from the current session's own reminder.
- **Always ask the user before**: push/PR, deleting branches or worktrees, adding dependencies (none planned), `--update-snapshots` (T057), touching env/CI files, migrations.
- **Process lessons (2026-11-12):**
  - A rate limit cut a code-writer mid-batch (3c1: the red commit was saved, the partial code was uncommitted). Recovery: save the uncommitted diff as a patch in the scratchpad, inspect it, then launch a fresh agent (or keep it after checking). Ask agents to commit as they go so a cut loses little.
  - The user resumed an already-finished agent from the transcript view (3b2, during 3b3). Afterwards the orchestrator checked `git log`, `git status`, tsc and unit (no stray commits or edits). **Finished agents must not be resumed**; start fresh ones, and re-check the tree if it happens.
  - Reviewer mutation testing must run the **FULL** unit suite (`npm run test:unit`), not one file: rows for one behavior live across several test files, so a single-file run reports false survivors.

## 5. Practices that worked (reuse them)

- Loop per batch: code-writer (tests first, commits as it goes) → reviewer (read-only, re-runs tsc/unit, probes independently, mutants on the full suite) → planner docs pass (ticks tasks, writes the Batch note, assigns every finding an owner) → orchestrator commits docs path-limited.
- Give each subagent a self-contained prompt: goal, files, task ids, carry-forwards it owns, hard rules, stop line, report format.
- Record any deviation from a batch header (e.g. 4a2 widened `Built.kind` in chat-meals.ts although the header said "chat.ts only") in the Batch note rather than reworking accepted code.

## 6. Open items that need the user (non-blocking except the zero-slots ruling, which blocks 4b2)

### 6a. Spec-change list (answers feed ONE spec-change; nothing changes before it)

**Period phrases, REQ-14 (Batch notes 3b2, 3b3):** session decisions already implemented but not yet in spec.md v1.7: trailing date-like tokens give `"unrecognized"` (da80a5e), the narrowed "desde" rule and the "del"/"año" year guard (3b3), the clamp wording "any N above 366 clamps" (N capped at 3660). Still open:
- LOW-1 wording: cross-year short-range labels (month on both ends, year on the foreign date) are the code-writer's choice; cross-month short ranges inside a year stay ambiguous ("lun 26 – dom 1").
- LOW-2: unruled silent shapes ("ayer y hoy", "el pasado lunes", "desde … hasta …", "este mes pasado"; full list in Batch note 3b2).
- LOW-3: guard false positives ("el lunes, pasada la comida"; "desde el 5 de noviembre, 1500 kcal" gives `"unrecognized"`): accept or fix.

**Copy additions to record (reviewer-accepted, no decision needed beyond "record"):**
- Exercise G = 1 wording (3c2 LOW-1): "0 de 1 día", "hiciste ejercicio 1 de 1 día", "meta de 1 día".
- Weight (3d1 choices 1-8): "sin cambio" when a change rounds to 0.0 (also in the range line); "(sin cambio; mínimo X kg, máximo Y kg)"; empty named period "<Periodo>: no registraste tu peso." vs "Aún no registras tu peso."; named periods show no goal/week/age lines and no buttons; "Registrar mi peso"/"Fijar mi meta" link to `/`; dates "26 oct" plus year when it differs; goal reached at ratio >= 1 incl. start === goal.
- Meals done (3d2 ruling 6): "esta semana" counts slots × 7; other ranges count slots × days elapsed up to today.
- The detail lead is picked from the dish, not the question (2c2 M2; REQ-28 says "from the normalized question").
- Not-found replies use kind `answer` (4a2 ruling 1; the contract lists only `did_you_mean` and `no_match`). Recommendation: keep; a dedicated not-found kind would be a contract change.

**Rulings by topic:**
- Weight (3d1): if the first weight equals the goal and later weights drift, the chat says "¡Ya alcanzaste tu meta…!" (gauge also full): accept, or change both? LOW-1 "Te faltan 0 kg…" under 0.05 kg: (a) leave (pinned by 9fdc847) or (b) treat as reached.
- Meals done (3d2): `Math.round` (1463 of 1464 shows 100%) or `Math.floor`; **the reply for an active plan with zero slots (BLOCKS Batch 4b2 / T052; 4b1 is done, so ask now, section 2 step 2)**; "¿Cuántas comidas hoy?" without llevo/hice stays meal times unless the user wants meals done; backlog candidate: weight links opening the WeightTile popover.
- Goals/weekly (3e): choice 4 "No has fijado meta de peso." + "Fijar mi meta" for a narrowed goal with none set; choice 5 a blank objective omits the item; optional choice 2 (no-plan line last in Metas plus "Subir mi plan" → `/plans`) and choice 6 (no `sources`); "avance de la semana pasada"/"de ayer" silently show this week: keep or add a fallback line. Note only: the chat shows the plan's own liters while the water tile uses glasses × 0.25 × 7.
- Greeting/thanks (4a1): (1) widen the vocabulary beyond the literal forms ("muchas gracias", "ok gracias", "buenas" alone, "Buenas, ¿qué tal?", "buenas dias", "buenos tardes" now fall to no_match); (2) accept per-position gender strictness and "holas" as a greeting (reviewer recommends accepting).
- Dish answers (4a2): **MEDIUM-1** a dish cue swallows the rest of the question as the phrase ("¿Qué lleva la pizza y cuánta agua llevo?" → not-found for 'pizza y cuánta agua llevo', water lost; "¿Qué lleva el pollo? mi peso" → did-you-mean for 'pollo mi peso'; "¿Qué lleva el pollo asado de mi plan?" → did-you-mean because "plan" is unmatched): keep as written in REQ-3/REQ-6 step 4, or trim trailing topic clauses. LOW-6: a did-you-mean reply's plain `answer` is only "¿Quisiste decir…?" (no candidate names for plain-text clients; slot options behave the same): does the contract's "lists option labels one per line" mean to cover did-you-mean?
- Multi-topic merge, REQ-24 (4b1; Batch note 4b1, none blocks): choice 1 a block with its own buttons counts as "holding option buttons" (the spec says "option buttons" and gives only the both-list-options case; reviewer: reasonable interpretation, recommend accepting). Choice 2 the dropped block's offer exists only for one concrete slot (a duplicated or almuerzo slot would give a clarify, which REQ-5 forbids; for a slot the plan lacks the spec is silent and "¿Cuál es mi cena?" would answer the honest "Tu plan no tiene cena."): accept? Choice 5 the no-plan "meta y avance" answer still repeats the section title under the same block title and the no-plan line in both blocks (REQ-21/REQ-22 require the line in each answer; spec silent on de-duplication; optional). Choice 7 the kind of a 2-block answer (the standalone block's kind, else `detail` if a kept block is a detail, else `answer`; spec silent): accept and record. Spec-change note: REQ-24's at-most-one-block-holds-option-buttons rule is implemented for slot topics only (only they carry option buttons; metrics use link block buttons; dish clarify and did-you-mean are standalone asks).
- Matcher (1e1, 1e2, 2a1, 2b2, 2c2): `isNotDishName` fuzzy date cues ("sasado" ~ "sábado"): exact-only or accept, add a test either way; `isPlural` tie rule ("comidaa" means all meal times): accept and record, or count a tie as plural only with an "s"; MEDIUM-3 "colación opción 2" on a duplicated slot drops the option: known limit, accept, or carry the option in the clarify buttons; L5 keep the all-meal-times section title "Comidas"?; L2 accepted-current `selectionAt` readings ("comí 2 de la cena", "cena 2.5", "cena opción -1", …; Batch note 2c2): accept and pin, or tighten; optional note: `Intent` gained `outcome` and `phrase` (test-only).
- Resolver (tasks.md "Open questions 1c2" items 1-6 and "Open questions 1d1" Q-a..Q-d): ask; the same spec-change records the 1d1 reviewer-accepted decisions and the 1d2 intended behavior changes and L6 candidate (Batch notes 1d1, 1d2).

### 6b. Repository and process items (need the user's yes or a one-time answer)

- **Worktree/branch cleanup:** six agent worktrees remain (`worktree-agent-a3363d28…`, `…a4fb1720…`, `…a959e211…`, `…a961a303…`, `…aa6dc7e5…`, `…ab226b2a…`), all merged or superseded. Their paths point at the project's old location (`/Users/rafael/Desktop/Nutritional Manager/.claude/worktrees/`), so `git worktree list` marks them prunable; cleanup = `git worktree prune` plus deleting the six branches, only after the user's yes.
- Push `feature/assistant-data-scope` and open the PR (the user opens it; draft the description: summary, spec link, per-requirement status, known issues, the unproven-until-Batch-E list).
- Wrong T ids in three 1c1 commit messages (`07b3cab` says T018, is T019; `3e441c1`, `488d61f` say T019, are T018): rewrite or leave (Batch note 1c1). 1b66c96 is tsc-red (two-commit red window in 1d2): note only.
- **Constitution reminder (explicit request):** when the feature finishes, remind the user that CONSTITUTION principle 1 says tests are "a Playwright e2e test" while this feature uses unit tests as the fail-first proof for logic (spec v1.6). The user decided not to amend it; ask once whether to leave it or propose a one-line amendment (team PR).
- Other BACKLOG items (E2E run guard stash, `src/server.js`, …) are unrelated; see `specs/BACKLOG.md`.

## 7. Traps

- `git stash@{0}` belongs to branch `fix/e2e-run-guard` (the user's WIP); never pop/drop it. `specs/bugs/e2e-run-guard.md` and `docs/PRD de Gestión Nutricional.md` are untracked and not this feature's: never commit them.
- The user's dev server may be running on :3000 against real data; do not touch it.
- Do not touch `nutrition.ts`/`food.ts` normalizers (persisted recipe fingerprints). `normalizeText` splits decimals ("1,5 L" → "1 5 l"): number parsing reads the raw message.
- Everything e2e is unproven until Batch E. Expect a wave of fixes there (up to 3 fix rounds, then escalate to the user). Batch E must check every e2e assumption listed in T076 (incl. 3c2-3e and 4a1/4a2).
- Never wait with `pgrep -f "playwright test"` loops (they match themselves); check `lsof -i :3200` and `psql -l` instead.

## 8. Where everything is

- Spec/plan/tasks/contract/UX checklist: `specs/assistant-data-scope/` (`spec.md`, `plan.md`, `tasks.md`, `contracts/chat-api.md`, `checklists/ux.md`). Older spec amended to v1.9: `specs/assistant-chat-polish/`.
- Code: `src/lib/domain/chat.ts`, `chat-intent.ts`, `chat-match.ts`, `chat-topics.ts`, `chat-dish.ts`, `chat-meals.ts`, `chat-metrics.ts`, `chat-dates.ts`; `src/lib/progress.ts`, `src/lib/recipe-steps.ts`, `src/lib/assistant.ts`, `src/lib/server/test-hooks.ts`, `src/lib/client/assistant-thread.ts`, `src/components/shared/Assistant*.tsx`.
- Tests: `tests/unit/*.test.ts` (chat-edges.test.ts holds the US4 rows), `tests/shared/*` (assistant-copy.ts: variant helpers), `tests/e2e/assistant-*.spec.ts`.
- The session-1 scratchpads (T024 fuse spike, probe scripts, baseline e2e logs) were under the project's old path and no longer exist; the spike result is recorded in spec.md's v1.7 change-log entry.
