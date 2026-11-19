# Checklist: data for metric-dials

Re-checked against spec v1.2 on 2026-11-15 (second pass; first pass on v1.1 had 16 PASS, 19 FAIL). Requirement-quality checks ("unit tests for English"): each item checks whether the **spec** is complete, clear, and measurable, not whether the code works. `[x]` = PASS or N/A; `[ ]` = FAIL. A gap closed by a user decision in the brief (D20) counts as PASS. Names of routes, tables and request shapes belong to the plan; items settled only there are marked "N/A for the spec: for the plan".

Result: 35 PASS, 0 FAIL, 2 N/A for the plan (N-01, N-02).

## Ownership and uniqueness

- [x] D-01 PASS Every history row belongs to the session user; no user id in requests; reads and writes never touch another user's data. [REQ-47]
- [x] D-02 PASS One row per user and month; replace overwrites, still one row. [REQ-12, D14, REQ-47]
- [x] D-03 PASS After "Quitar meta" the row stays; a later save the same month overwrites it, no second row. [REQ-15 example]
- [x] D-04 PASS A month is a calendar year and month, not a timestamp; the latest row is the greatest (year, month), not the last inserted; at most one row per user and month. [REQ-47] The `seq` column, ordered reads and UTC session are project invariants (CLAUDE.md): for the plan.

## Atomicity and write path

- [x] D-05 PASS Goal and history row written together or not at all; failure changes nothing and keeps typed values. [REQ-12, REQ-37]
- [x] D-06 PASS Removal touches only the active goal; failure changes nothing. [REQ-15, REQ-38]
- [x] D-07 PASS A goal is accepted only with a direction and month; a goal without direction is rejected; removal is the same action with an empty goal and writes no row. [REQ-48, REQ-15]
- [x] D-08 PASS Latest row's direction is used only when its goal equals the active goal, else inferred; two overlapping saves leave one row and a matching active goal. [REQ-17, REQ-41]

## Migration

- [x] D-09 PASS Creates the table; seeds Nov 2026 for users with a goal, direction by G against the latest weight (equal or none gives Aumentar); no row without a goal. [REQ-16]
- [x] D-10 PASS "Latest logged weight" is the weight on the most recent date that has one, same W as REQ-20; example with an empty-weight day. [REQ-16]
- [x] D-11 PASS Seed copies the goal unchanged even outside 30-150 or with two decimals; saving applies REQ-13. [Edge cases]
- [x] D-12 PASS Re-running never overwrites or duplicates a row. [Edge cases]
- [x] D-13 PASS The migration only adds, so undoing it loses no existing data; `weight_goal_kg` stays. [Edge cases, REQ-16]
- [x] D-14 PASS Nothing dropped; runs only with the user's yes; lands with the US2 code. [REQ-16, Delivery notes, Always ask]

## Validation

- [x] D-15 PASS Goal 30-150, step 0.1, direction against the latest weight, more than one decimal rejected, in form and server, exact messages. [REQ-13]
- [x] D-16 PASS Server accepts new weights only in 30-150 in 0.1 steps; stored records untouched; 30.0 and 150.0 accepted. [REQ-32]
- [x] D-17 PASS Deshacer is its own operation: only today, only back to what today's record held (a number or no weight), within 20-400 (D20f); a plain save never gets the exemptions; examples cover 28.0, no weight, other day, 500, 19.9. [REQ-32, D20f] For the plan: how the server knows the prior value (see N-02).
- [x] D-18 PASS After Deshacer on a day with no record, every readout (Adherencia, Calorías, Proteína, "—") is as before the save. [REQ-29]
- [x] D-19 PASS Weights rounded to tenths, half up, before the reached rule and distance, in card and assistant; also validation, seed, inference and limits. [D20a, REQ-35, REQ-42, Precision, Assumptions]
- [x] D-20 PASS A stored weight outside 30-150 is shown as is, needle at the nearest end. [REQ-24, D11]

## Dates and time zones

- [x] D-21 PASS The request carries the browser's year and month, stored as sent; the server does not substitute its own; same for the day. [REQ-12, REQ-28, REQ-48]
- [x] D-22 PASS Wrong device clock: no rule, the browser's date is trusted, by the user's decision. [D20e, REQ-12, REQ-28]
- [x] D-23 PASS First of a month creates no row; the note names the month, with the year when not current. [REQ-14, D18t]
- [x] D-24 PASS The assistant's reached rule uses the latest weight and direction, no day or zone. [REQ-42]

## Concurrency

- [x] D-25 PASS Save in flight: latest value wins, one record per day; two tabs: last write wins, no error; same for the goal. [REQ-40, REQ-41]

## Derived values

- [x] D-26 PASS Direction with no row is inferred; with no goal there is none; an inherited goal stays valid until edited. [REQ-14, REQ-15, REQ-17]
- [x] D-27 PASS The flip for a goal with no history row is accepted and recorded with an example (goal 70 at 69 kg reads Aumentar). [D20c, REQ-17]
- [x] D-28 PASS Reached rule identical in card and assistant; distance in tenths without float artifacts. [REQ-35, REQ-42, Precision]

## Consumers

- [x] D-29 PASS Dashboard, Configuración and the assistant read the goal from `users.weight_goal_kg`. [REQ-17, D15]
- [x] D-30 PASS Every other reader of the goal keeps its old value and meaning; the plan lists them. [Edge cases, REQ-17] For the plan: list `src/lib/metrics.ts`, `DataColumn.tsx`, `src/lib/storage/db.ts`, legacy `memdb`.
- [x] D-31 PASS Tests cover helpers that set the goal directly, the row-differs case and the no-goal-row path. [Test expectations: REQ-16/17 unit tests, e2e "no-goal-row path"]

## Privacy

- [x] D-32 PASS Failure logs carry the operation and the error, never a weight or goal; nothing is sent outside the app. [Privacy NFR, REQ-30, 37, 38, 39]

## Deletion and history

- [x] D-33 PASS The app never deletes history rows; they are not in the Papelera. [REQ-47] For the plan: state whether the migration seeds soft-deleted users (recommend yes, same rule), and that rows follow their user.

## Backwards compatibility

- [x] D-34 PASS Out-of-date pages get the failure toast and nothing changes; goal limits from US2, weight limits from US3, with the interim example. [REQ-48]
- [x] D-35 PASS After US2 the modal holds only "Peso de hoy (kg)"; the goal is edited only in Configuración. [REQ-17, Delivery notes]

## New in v1.2

- [x] N-01 N/A for the spec: for the plan. Is a malformed or implausible year and month in the goal request handled (month 13, year 1900)? The spec says "stored as sent" (REQ-12) and trusts the clock (D20e) but not whether the server checks that the pair is a real calendar month. The plan must record: the server rejects a non-calendar month (month outside 1-12, non-integer) as an invalid request (REQ-48 toast), and does not otherwise range-check it.
- [x] N-02 N/A for the spec: for the plan. REQ-32 limits a restore to "what today's record held before the save it undoes", which the server can only check if the client sends that prior value or the server keeps it. The plan must record the restore operation's shape and how "only back to the prior value" is enforced (or that the 20-400 and today-only checks are the enforced part).
