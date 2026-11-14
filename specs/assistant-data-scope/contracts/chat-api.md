# Contract note: `POST /api/rag/chat` (assistant-data-scope)

**Spec:** [../spec.md](../spec.md) (v1.9) · **Base contract:** [assistant-chat-polish/contracts/chat-api.md](../../assistant-chat-polish/contracts/chat-api.md) (v1.9)

This note describes the change at the behavior level only. Exact field names and types belong to plan.md. "chat-polish REQ-n" means assistant-chat-polish's REQ-n; a bare "REQ-n" is this spec's.

## Request

- `message` is unchanged: trimmed, 1–500 UTF-16 code units, and anything else, or an unparsable body, gets HTTP 400 (chat-polish REQ-10, chat-polish REQ-23).
- `scope` and `recipe_id` no longer affect the answer (REQ-4). Old clients that still send them get the same answer as without them.
- The request carries no date and no history. The answer depends only on `message`, the signed-in user's data and the server's today in America/Mexico_City (REQ-5, REQ-13).
- Test only: the e2e suite can pin today and inject a builder failure; both are ignored outside the test environment (REQ-13, chat-polish REQ-23). The mechanism belongs to the plan.

## Response

- `answer` (plain text), `sources` and `context_used` stay, so old clients reading only `answer` keep working. `context_used` always reports the general context.
- An answer is **1 or 2 blocks** (REQ-24). Each block has a title (Topics "Title"; a single-topic answer has one untitled block), a lead, and sections with the existing title, items and highlights. `answer` concatenates the blocks in order (title, lead, sections): the UI renders the blocks, and the plain `answer` text carries leads and sections only. Option labels are in the buttons, not in `answer` (for an option list `answer` is only the lead, e.g. "Tus opciones de cena son:"; for did-you-mean only its lead). At most one block holds option buttons.
- **Buttons replace scoped follow-ups.** The server sends every button; the client derives none from the kind or from page suggestions. Each button is one of:
  - question: a label plus the message it sends (the label may differ, e.g. "Opción 2: Pollo, Arroz, Brócoli…" sending "Cena, opción 2"; with duplicate slots, "Segunda colación, opción 2");
  - navigation: a label plus an in-app destination (`/`, `/plans`, `/recipes/<id>`), rendered as a link.

  A button may say it uses the vertical full-width option layout (REQ-9). Paging buttons send "<Slot ref>, más opciones (página <n>)" for both "Ver más opciones" and "Opciones anteriores". Slot refs use the spec's ordinals (Primera … Décima, masculine Primer … Décimo) and "<Slot> <n>" beyond 10 (e.g. "Colación 11, opción 2"). Every question button's message, sent alone, resolves to exactly its intended single topic (spec Topics, REQ-5, REQ-6). The chat-polish repeat rule applies to follow-up buttons only (REQ-5). A 2-block answer carries the second block's follow-ups, then the overflow topic buttons (REQ-24).
- Partial answers stay kind answer: with no active plan (none, or a plan with zero meal slots), Goals and Weekly progress omit the plan-dependent lines and add the "Aún no tienes un plan activo." line with the "Subir mi plan" navigation button and keep their topic follow-ups (REQ-21, REQ-22). Every other no-plan reply (slot options, option detail, slot times, all times, plan summary, supplements, meals done, identity-plan) is kind answer with only the "Subir mi plan" navigation button (`/plans`), no follow-ups and no sources (REQ-27).
- The reply kind tells the client what it received: `answer`, `detail`, `clarify`, `did_you_mean`, `greeting` or `no_match`. `options` and `empty` are never emitted and are removed from the list; the kinds `out_of_scope`, `missing_recipe` and `overview` are removed too. Mapping: the dish not-found reply (REQ-26) has kind `answer` (there is no not-found kind) with sources `[]`; did-you-mean replies have sources `[]`; an option list is `answer`; the "slot not in the plan" replies ("Tu plan no tiene <slot>." and "Tu <slot> tiene <n> opciones.") and the two further REQ-27 slot replies ("Tu plan no tiene opciones para tu <slot>." and "Tu plan no tiene horario para tu <slot>.") are `answer`. The kind of a 2-block answer is the standalone block's kind, else `detail` if a kept block is a detail, else `answer`.
- The section cap (8 items plus a final "y <n> más", 9 entries) applies to lists. A detail's "Ingredientes" section is uncapped (REQ-12).
- Test only: the response may carry an internal `resolved` field only while the test hook is on, with the trace header (REQ-13 guard): an array of the intent objects the resolver found (their fields belong to plan.md; for the did-you-mean step 8 trace it is `[]`). It is never present in production responses, and clients ignore it. No REQ counts as covered by `resolved` alone; every test also asserts the visible answer text or buttons (spec NFR).

## Errors (chat-polish REQ-23, delivered on this branch)

- HTTP 400: invalid or unparsable request only (zod or unparsable body: an empty message, one over 500 characters, or a body that is not valid JSON). The body keeps the standard bad-request shape with the validation issues. A server failure never returns 400.
- Client status handling (the client's ApiError carries the HTTP status): 500 → "Algo salió mal al responder. Intenta de nuevo." with Reintentar; 400, any other non-500 non-2xx status, a network failure and the 15 s timeout → "No pude responder en este momento." with Reintentar (chat-polish REQ-8).
- HTTP 500: any server failure. The 500 body is generic and contains no internal message. The details are logged on the server with context (Constitution 6); e2e asserts the entry by capturing the test server's log.
