# Spec: Assistant chat polish

**Status:** implemented (v1.9 REQ-23 was delivered with feature/assistant-data-scope, merged as PR #7 on 2026-11-14; the rest was merged as PR #6 on 2026-10-28)
**Version:** 1.9 · **Branch:** feature/assistant-chat-polish · **Owner:** Rafael Martinez

## Overview

The floating assistant answers with rule-based keyword matching over the user's own plan, recipes and cart. It makes no AI calls and does not stream. It works but feels raw:
- answers are plain text lines joined by newlines
- an unknown question gets a dead-end "No encontré esa información…"
- a failed request leaves a generic error with no retry
- scope can only be chosen from the dashboard search bar **[Superseded: no scopes]**
- there is no way to start over
- auto-scroll and the loader ignore reduced motion

This feature adds structured answers, a meal-times topic, one-topic-per-question matching with strict scopes **[Superseded]**, follow-ups, a helpful unknown reply, in-panel scope switching **[Superseded]**, retry with a timeout, a new-conversation action and a better composer. The API response changes additively. There is no data-model change and no migration.

## Superseded by assistant-data-scope (v1.9)

[assistant-data-scope](../assistant-data-scope/spec.md) v1.2 replaces the rules listed below. Until that spec is implemented, the code still follows this one; once it ships, assistant-data-scope wins (Constitution 2). Affected text is marked **[Superseded]** inline. **Blanket rule:** anything in this spec that refers to a scope, the scope switcher or menu, "Alcance", chips carrying a scope, "Esta receta", or page or recipe context is void, whether or not it is tagged. Everything else stays in force, including the structure, chips under the latest answer only, the repeat rule (for follow-ups), retry, the composer, scroll, motion (as amended below), accessibility and modality.

- **No new npm packages** (Decision "UI building blocks" and the NFR): the only exception is fuse.js, pinned at exactly 7.5.0 (user-approved, Constitution 4). prompt-kit's `response-stream` is copied code, not a package.
- **Chat tests stay green** (NFR and Definition of done): the scope tests may be rewritten or removed as assistant-data-scope specifies.
- **Motion:** amended, not replaced. The typing effect of assistant-data-scope REQ-33 (≤1 s) is exempt from the 200 ms fade cap.

- **Matching:** the exhaustive-vocabulary rule, whole-word and stem-only matching, and the "Normalized text" term. Replaced by normalization, synonyms and typo tolerance (its REQ-1, REQ-2).
- **Tier 3 meal nouns → meal times** (the REQ-18 answer that lists every meal for "¿A qué hora es la cena?"; "desayuno" alone in REQ-19). The times answer now needs "a qué hora", "cuándo" or "horario" plus a slot, and it answers only that slot (its REQ-8). "¿Cuál es mi cena?"-style questions and bare slot words list options (its REQ-9).
- **REQ-19 precedence and tie rules:** replaced by its REQ-6 resolution order, with up to 2 topics per answer (its REQ-24).
- **Scopes:** the Terms "Scope" entry, the Topics "Answers in" and scope columns, the page-suggestions table, REQ-4, the scope parts of REQ-5, the REQ-6 unknown reply, REQ-12, the scope part of REQ-13, REQ-20, REQ-21, the Esta receta content in REQ-1, the "Alcance" control in REQ-15's header, the scope-menu step of Escape in REQ-22, and the Focus rule "After a scope change". Replaced by no scopes and no page or recipe context (its REQ-4) and by the no-match reply (its REQ-29).
- **Plan lead "Tu objetivo" and the plan vocabulary's objetivo(s):** "objetivo" and "meta" now give the goals answer (its REQ-21). "objetivo"/"meta" plus "plan", and plan questions, give the plan summary with the lead "Tu plan activo es <plan>. Tu objetivo: <objetivo>" (its REQ-31). "No tienes un plan activo." becomes "Aún no tienes un plan activo." (its REQ-27).
- **Layout:** assistant answers with no bubble. Replaced by its REQ-32.
- **REQ-17 (live region):** amended, not replaced. Buttons stay outside the live region; for option lists the option count and labels are announced as text ("3 opciones: …"; its REQ-33).
- **Copy "used verbatim":** amended. The plan lead, the no-plan lead and the meal-times answers for slot questions follow its Copy (see [contracts/chat-api.md](contracts/chat-api.md) Copy).

## Goals / Non-goals

- Goal: answers carry server-defined structure (lead, sections, highlights, follow-ups), and the panel renders exactly that structure (REQ-1 to REQ-4, REQ-18, REQ-19).
- Goal: the user always has a next step: follow-ups, the unknown reply, "Preguntar en Todo" **[Superseded]** and retry (REQ-5 to REQ-8, REQ-20).
- Goal: a composer with defined keys and limits, a new-conversation action, predictable scrolling, and scope choice from the panel and the search bar **[Superseded: scope choice]** (REQ-9 to REQ-13, REQ-21).
- Goal: existing chat e2e tests keep working, apart from the intended scope changes (REQ-6, REQ-20) **[Superseded: scope tests may be rewritten or removed]**. Motion, accessibility and touch use are specified and measurable (REQ-14 to REQ-17, REQ-22).
- Non-goal: persisted history, streaming, real AI/LLM calls, copy or feedback buttons on answers, and a dedicated `/asistente` page.

## Decisions

Rationale only; the rules live in the REQs.

- **UI building blocks:** adapted from an existing open-source chat kit; no new packages (Constitution 4). **[Superseded: assistant-data-scope; only exception fuse.js 7.5.0]**
- **Placement:** the FAB and panel stay on all signed-in pages, because the panel already carries page context.
- **History in memory only:** persisting it would need a migration for little gain.
- **Nueva conversación without confirmation, discarding a pending answer:** starting over is one action, and a cleared thread must stay clear.
- **Threaded flow, chips under the latest answer only, fixed counts, no repeated chip:** familiar flow, a next step without clutter; a predictable count is testable; disabled chips prevent double sends; repeating the question just asked wastes a chip.
- **Plain-text `answer` kept beside the structure:** structure without markdown dependencies, and the change stays additive.
- **Meal-times topic:** the unknown-reply copy ("horarios") promises it.
- **Meal times from the plan's stored times only:** the assistant reports what is in the plan.
- **Tiered precedence, whole-word matching:** one predictable answer per question; "hora" never matches "ahora".
- **"cuándo" is weak:** "¿Cuándo compro?" is about shopping, not meal times; time words like "hora" are unambiguous.
- **Winner chosen before the scope check:** filtering topics by scope first would let a weaker topic answer a question about something else.
- **Strict scopes with "Preguntar en Todo":** a scope should mean what it says, and the chip keeps the next step one tap away. A narrowed scope still has useful default content (its overview).
- **Todo returns the unknown reply when nothing matches:** otherwise the unknown reply could never appear in the default scope.
- **Fixed follow-up texts per topic, page suggestions reused:** "related" is not testable, and each text is checked to resolve in its own scope; page suggestions already fit each page.
- **Chips carry their own scope:** under strict scopes a suggestion asked in the page scope would hit the unknown reply; the label shows what was searched.
- **Esta receta chips keep their recipe:** the thread survives navigation, so its chips must still answer about the recipe they came from.
- **Capped lists:** the full turn is announced, so long lists must stay short to hear; the recipe list already caps at 8.
- **Copy in Interaction details accepted as written:** the user approved it.
- **Sources only when present:** context, not required content.
- **Recommendations one item per non-empty line, capped at 8:** uploaded plans store recommendations as several lines, and one run-on bullet is hard to read.
- **Empty sections hidden, lead kept:** a heading over an empty list adds nothing.
- **Scope label from the asked scope, never `context_used`:** the label must reflect what the user chose.
- **"Carrito actual" and "Carrito" both labelled "Carrito":** the same data to the user.
- **Thread kept, scope reset on navigation:** history belongs to the user; scope is page context.
- **Search bar answers once in its scope and is disabled while pending:** a one-off entry point; disabling is simpler than queueing.
- **Answer still lands after close or navigation, no badge:** the thread is the record; a badge adds state for little gain.
- **Retry with a timeout:** the generic error is a dead end, and a hung request would wait forever.
- **Reintentar only on the latest turn:** retrying an older turn would settle its answer mid-thread without chips, and while another request is pending the button would do nothing.
- **Chips hidden during a retry:** the earlier chips reappearing and then vanishing is a flicker with no use.
- **Loader blink exempt from the fade cap:** the cap governs message and control transitions, not a looping progress indicator.
- **Touch Enter behavior:** touch keyboards have no easy Shift+Enter.
- **Enter adds a newline on coarse-pointer devices at any width:** touch keyboards have no easy Shift+Enter, at any width.
- **Focus to the new turn on touch:** the on-screen keyboard would cover the answer if the input were focused.
- **Long answers show their start:** the user reads from the start of the answer.
- **Modal sheet at ≤640 px, non-modal desktop panel:** a sheet covers the page and touch users have no Escape key.
- **Compact scope button on narrow screens:** five options do not fit a 360 px header.
- **Nueva conversación as an icon button at ≤640 px; no subtitle at ≤640 px wide or ≤480 px tall:** at 360 px the full text does not fit beside "Alcance: Plan activo"; the button keeps its accessible name.
- **One input limit and counting rule on client, bar and server:** bounded input keeps answers and layout predictable; one rule avoids disagreement; the client alone can be bypassed.
- **Look:** structured answers need width; the theme-switcher spec requires both themes.
- **Accessibility and motion minimums:** common standards; forced-colors users must still see state; CLAUDE.md requires respecting reduced motion.
- **Server errors return 500 with a generic body; 400 only for invalid input (v1.9):** a raw error message in a 400 hides real failures and leaks internals. Logging with context satisfies Constitution 6.
- **Definition of done:** every REQ has a passing e2e test (Constitution 1); existing chat tests stay green with updated selectors (scope tests may be rewritten or removed per assistant-data-scope); zero console errors or failed API calls except the deliberate failure and timeout in REQ-8, the rejected requests in REQ-10, and the injected 500 and rejected 400 in REQ-23.

## User stories

Terms:
- **Panel:** the floating assistant panel on signed-in pages. **Answer:** an assistant turn. **Scope** **[Superseded]**: Todo, Plan activo, Recetario, Carrito or Esta receta. Any scope other than Todo is narrowed.
- **Normalized text** **[Superseded]**: ignoring case, accents, and leading and trailing ¿ ? ¡ ! . characters. A **word** is a maximal run of letters and digits in the normalized text.
- **Length:** the trimmed text's string length in UTF-16 code units (an emoji may count as 2).

**Topics** **[Superseded: vocabulary rule, Tier 3, "Answers in" and follow-up scopes]**. The vocabulary is exhaustive: a word matches if it equals a listed word or starts with a listed stem (*), after normalization; singular and plural forms both match. Follow-ups are listed in order with the scope each is asked in.

| Topic | Tier | Vocabulary | Answers in | Follow-ups (scope) |
|---|---|---|---|---|
| Meal times | 1 | hora, horas, horario, horarios; cuándo (REQ-19) | Todo, Plan activo | "¿Qué recetas hay en mi plan?" (Recetario), "¿Qué hay en mi carrito?" (Carrito), "¿Cuál es mi objetivo?" (Plan activo) |
| Meal times | 3 | desayuno(s), comida(s), cena(s), colación/colaciones | as above | as above |
| Cart | 2 | carrito(s), compr* | Todo, Carrito | "¿Qué recetas hay en mi plan?" (Recetario), "¿A qué hora es mi comida?" (Plan activo) |
| Recipes: recipe list | 2 | receta*, ingrediente*, prepar* | Todo, Recetario | "¿Qué hay en mi carrito?" (Carrito), "¿A qué hora es mi comida?" (Plan activo) |
| Recipes: this recipe | 2 | same as recipe list | Esta receta | "¿Qué ingredientes lleva?" (Esta receta), "¿Cómo se prepara?" (Esta receta), "¿Qué hay en mi carrito?" (Carrito) |
| Plan | 2 | plan(es), suplement*, recomend*, objetivo(s) | Todo, Plan activo | "¿A qué hora es mi comida?" (Plan activo), "¿Qué suplementos tomo?" (Plan activo), "¿Qué recetas hay en mi plan?" (Recetario) |

**Page suggestions** **[Superseded]** (current strings, in order, each with its scope):

| Page | Default scope | Suggestions (scope) |
|---|---|---|
| Dashboard and every other page | Todo | "¿Qué recetas hay en mi plan?" (Recetario), "¿Qué tengo en mi carrito?" (Carrito), "¿Qué ingredientes necesito comprar?" (Carrito) |
| Groceries | Carrito | "¿Qué tengo en mi carrito?" (Carrito), "¿Qué ingredientes necesito comprar?" (Carrito), "¿Qué recetas hay en mi plan?" (Recetario) |
| Recipe | Esta receta | "¿Qué ingredientes lleva?", "¿Cómo se prepara?", "¿Cuánto <proteína> lleva?" (only if the recipe has a protein), all (Esta receta); "¿Qué tengo en mi carrito?" (Carrito) |

### US1 (P1): Structured answers
As the user, I want answers laid out with a lead, titled lists and highlighted values, so that I can scan them quickly.

- **REQ-1:** The response keeps `answer`, `context_used` and `sources` unchanged in type and meaning, and adds a lead (required), zero or more sections (title plus items), highlighted values inside the lead or items, and follow-ups (each with text and scope: the topic's for a topic answer or overview, otherwise none).
  - `answer` is the plain-text form: the lead, then each section's title line and one line per item, newline-separated. For the unknown reply it is the lead and the capability line.
  - A section list with 8 or fewer items shows them all. A longer list shows its first 8 items plus a final item "y <n> más", where n is the number not shown (9 entries in total). Sources list only the data used for the answer; the unknown reply has none.
  - A section with no items is omitted from both the panel and `answer`; the lead still shows. This covers Esta receta with no ingredients or no steps, plan and meal-times answers when the plan has zero meals, and blank recommendations.
  - Content per answer (lead / sections); lead and section-title copy is in Interaction details "Copy":
    - Plan **[Superseded: lead, see assistant-data-scope REQ-31]**: lead is "Tu objetivo: <objetivo>"; sections are the meal names, plus supplements when the question names suplement* and recommendations when it names recomend* (as today). Recommendations have one item per non-empty line of the plan's recommendations text, as the Preparación steps are split.
    - Recipe list (Todo, Recetario, and the Recetario overview): lead introduces the list; one section of recipe names. Filter (changes today's behavior): drop question words in the Topics vocabulary and the stop words que, hay, en, mi, mis, de, del, el, la, los, las, con, para, por, tengo, cual, cuales, como, cuanto, es, un, una; a recipe matches when a remaining word of 3+ letters equals a word of its normalized name. If no word remains or nothing matches, all recipes are listed.
    - Cart (same in Todo and Carrito): lead introduces the cart; one section with one item per consolidated ingredient, quantity highlighted.
    - Esta receta (also its overview) **[Superseded]**: lead names the recipe; sections are ingredients and preparation, keeping today's narrowing to the ingredients the question names. The "¿Cuánto <proteína> lleva?" chip has no topic word, so this narrowed overview is its intended answer.
  - Given any question in any scope, then the three fields keep their types, the lead is non-empty, and `answer` equals the plain-text form.
  - Given an empty cart and "¿Qué tengo en mi carrito?" in Todo, then the lead is "Tu carrito está vacío." with no sections.
  - Given no active plan and "¿Cuál es el objetivo de mi plan?" in Todo, then the lead is "No tienes un plan activo." with no sections.
  - Given no recipes, Recetario and "hola", then the lead is "Aún no tienes recetas." with no sections.
  - Given a 40-ingredient cart, then the cart section shows 8 items and a last item "y 32 más".
  - Given Recetario with recipes "Quesadillas", "Ensalada" and "Pollo asado", then "¿Qué recetas hay en mi plan?" lists all 3 and "¿Qué recetas hay con pollo?" lists only "Pollo asado".
  - Given Esta receta for a recipe with a pollo ingredient, when I activate "¿Cuánto pollo lleva?", then the lead names the recipe and the ingredients section lists only ingredients whose name includes "pollo".
  - Given an active plan whose recommendations have 3 non-empty lines and 1 blank line, when I ask "¿Qué recomendaciones tengo?" in Todo, then a "Recomendaciones" section shows 3 items.
  - Given Esta receta for a recipe with ingredients but no steps, when I ask "¿Cómo se prepara?", then only the lead and the "Ingredientes" section show, with no "Preparación" heading in the panel or `answer`.
- **REQ-2:** The panel shows exactly the structured content: the lead as a paragraph; each section title as a heading one level below the panel title, followed by a list with one item per section item; each highlight as emphasized text with font-weight ≥600 or an underline. Text only in `answer` is never shown as a heading, item or highlight.
  - Given a non-empty cart and "¿Qué tengo en mi carrito?", then one section lists the cart items and each quantity has font-weight ≥600 or an underline.
- **REQ-3:** Sources appear only when present, as one muted line "Basado en: <source>, <source>".
  - Given an answer with sources, then the line lists every source. Given none, or the unknown reply, then there is no "Basado en" line.
- **REQ-4** **[Superseded: assistant-data-scope REQ-4]**: Each successful answer is labelled with the scope it was asked in (switcher, search bar per REQ-13, or chip per REQ-5), whatever `context_used` says. An error turn has no label.
  - Given I asked in "Recetario", then the label reads "Recetario", and earlier answers keep their labels.
  - Given a search-bar question with "Carrito actual", then the label reads "Carrito".
  - Given a failed request, then the error turn has no label.
- **REQ-18** **[Superseded for slot questions: assistant-data-scope REQ-8; the all-meals list remains for time words with no slot]**: The meal-times answer has a lead (Interaction details "Copy") and one section listing each active-plan meal in plan order, with its time window taken from the plan's stored meal times (default times the dashboard may display are not used) (e.g. "Entre 7 a 8 am") highlighted when the meal has one.
  - **[Superseded: assistant-data-scope REQ-8 answers only cena]** Given an active plan with times and "¿A qué hora es la cena?", then there is one item per meal, each time is highlighted, and the chips are the meal-times follow-ups.
  - Given only some meals have times and "¿Cuál es mi horario?", then every meal is listed and only those with a time have a highlight.
  - **[Superseded: assistant-data-scope REQ-8]** Given no meal times and "¿Cuándo desayuno?", then the lead is "Tu plan no tiene horarios para tus comidas." and the meals are listed without highlights.
  - Given no active plan and "¿Cuál es mi horario?", then the lead is "No tienes un plan activo.", there are no sections, and chips show.
- **REQ-19** **[Superseded: assistant-data-scope REQ-1, REQ-2, REQ-6, REQ-24]**: Each question has at most one winning topic, matched on its words (Terms) against the Topics vocabulary only.
  - The winner is chosen from all topics regardless of scope; the scope check follows (REQ-20).
  - Precedence: Tier 1, then Tier 2, then Tier 3. Within a tier, ties go to cart, then recipes, then plan.
  - "cuándo" counts as Tier 1 only when the question also has a meal noun or has no other topic word; otherwise it is ignored.
  - Given "¿Qué ingredientes lleva el desayuno?", then the topic is recipes. In Carrito, the reply is the out-of-scope unknown reply.
  - Given "¿A qué hora es la cena?" or "desayuno" alone or "¿A qué hora compro el súper?", then the topic is meal times.
  - Given "¿Cuándo compro?", then the topic is cart. Given "¿Cuándo es la cena?" or "¿Cuándo?", then the topic is meal times.
  - Given "¿Qué ingredientes necesito comprar?" (tie) or "¿Qué hay en el carrito, por favor?", then the topic is cart.
  - Given "¿Qué hago ahora?" in Todo, then no topic matches and the unknown reply shows.

### US2 (P1): Always a next step
As the user, I want follow-ups, a helpful reply when the assistant doesn't know, and a retry, so that a conversation never dead-ends.

- **REQ-5** **[Superseded in part: chip scopes, the chip-list cases and Esta receta chips; assistant-data-scope REQ-4, REQ-34. Latest-only, disabled-while-pending and the repeat rule stay]**: Chips appear under the latest successful answer only. Each chip is asked in its own scope (Topics or page-suggestions table), not the switcher's; its answer is labelled with that scope and the switcher does not change.
  - Chip list per case:
    - topic answer: that topic's follow-ups
    - no topic in a narrowed scope (overview): the overview topic's follow-ups
    - unknown reply in Todo: the first 3 page suggestions; REQ-20's missing recipe: the first 3 dashboard (Todo) suggestions
    - out-of-scope unknown reply: "Preguntar en Todo" plus the first 2 page suggestions; "Preguntar en Todo" is the only chip exempt from the repeat rule
    - empty state: all page suggestions
  - Repeat rule: a candidate whose normalized text equals the normalized question just asked is skipped, and the next candidate from the full source list (all page suggestions, or the topic's full follow-ups), not just the first 3 or 2, fills the slot. If the list has none left, fewer chips show; never fewer than 2, since no list can lose more than one candidate.
  - Each follow-up in the Topics table, asked in its own scope, resolves to a topic answered in that scope, never the unknown reply.
  - Chips are disabled while a request is pending. An error turn has no chips, and while it is the latest turn no chips show. While a failed turn is being retried, no chips show, including the previous answer's.
  - Given two answers, then only the last has chips. When I activate one, then its text appears as my message, the new answer brings its own chips, and the old ones are gone.
  - Given a pending request, then every chip is disabled and activating one sends nothing.
  - Given an answer with chips, then a failed question, when I activate Reintentar and the retry is pending, then no chips show anywhere.
  - Given groceries (switcher "Carrito") with an empty thread, when I activate "¿Qué recetas hay en mi plan?", then the answer lists recipes, is labelled "Recetario", and the switcher shows "Carrito".
  - Given a recipe page, when I activate "¿Qué tengo en mi carrito?", then the answer is labelled "Carrito".
  - Given Esta receta and "¿Qué ingredientes lleva?", then the chips are "¿Cómo se prepara?" and "¿Qué hay en mi carrito?".
  - Given an active plan, each recipe and a non-empty cart, when each Topics follow-up is asked in its scope, then none gets the unknown reply.
  - Given an answer on recipe A with an Esta receta chip, when I navigate to the dashboard and activate it, then the answer is about recipe A and labelled "Esta receta"; the same holds for Reintentar on an Esta receta question.
- **REQ-6** **[Superseded: assistant-data-scope REQ-29]**: In Todo, a question with no matching topic gets the unknown reply: the lead "No encontré eso en tu información.", the capability line as body text, and chips (REQ-5). It is not an error and keeps its scope label. Within Todo, the plan summary is returned only for the plan topic (intended change); the Plan activo overview (REQ-20) still returns it.
  - Given Todo and "¿Cuál es la capital de Francia?", then the lead, the capability line and 3 page-suggestion chips show, and "No pude responder" does not.
  - Given Todo with an active plan and an unrecognized question, then no objective or meals appear.
  - Given Todo and a plan-topic question, then the plan summary is returned.
- **REQ-7:** "Pensando…" shows in the answer position while a request is pending and disappears when the answer or error arrives.
  - Given a delayed response, when I send, then "Pensando…" is visible until the response, then gone.
- **REQ-8:** A network failure, a non-2xx response, or a request pending over 15 s keeps my question and shows "No pude responder en este momento." with "Reintentar". (v1.9: only an HTTP 500 shows REQ-23's copy instead, with the same Reintentar behavior; a 400 and every other non-500 non-2xx response keep "No pude responder en este momento.") Reintentar resends the question ~~in the same scope (and recipe, REQ-5)~~ **[Superseded: no scopes; the same message is resent]**. During the retry the error turn is replaced by "Pensando…". On success the answer and its chips appear. A late answer after the timeout is discarded. Reintentar shows only while the error turn is the latest assistant turn; older error turns keep their error text without Reintentar.
  - Given the endpoint fails once, when I send "¿Qué tengo en mi carrito?", then my message stays and the error with Reintentar shows. When I activate Reintentar with the endpoint healthy, then the answer and chips appear, the error is gone, and my question appears once.
  - Given a response delayed beyond 15 s, then the error turn shows at 15 s and the late response adds nothing.
  - Given a retry that fails again, then the error and Reintentar show, with one copy of my question.
  - Given a failed question followed by a later answered question, then the earlier error turn shows no Reintentar.
- **REQ-23 (v1.9):** Server errors versus invalid requests (Constitution 6).
  - Any failure while building an answer returns HTTP 500 with a generic body that contains no internal message. The error is logged on the server with context: the route, the user id, the message length and the error with its stack. The client shows "Algo salió mal al responder. Intenta de nuevo." with Reintentar (REQ-8 rules).
  - HTTP 400 is for invalid or unparsable requests (zod or unparsable body: an empty message, one over 500 characters (REQ-10), or a body that is not valid JSON); its body keeps the standard bad-request shape with the validation issues. A server failure never returns 400, and the 500 body never carries a raw error message.
  - Testability: the e2e suite can force the answer builder to fail through a test-only failure injection, guarded like assistant-data-scope's date pin (REQ-13 there): it is unavailable outside the test environment. The log entry is asserted by capturing the e2e server's log output.
  - `src/server.js` (the legacy `dev` entry only) is out of scope.
  - Given an injected builder failure, when I ask a question, then the response is 500, its body has no internal error text, the captured server log has an entry with the route and the error, and the panel shows "Algo salió mal al responder. Intenta de nuevo." with Reintentar.
  - Given a message of length 501, then the response is 400 with the validation issues, the captured server log has no error entry, and the panel (if sent from it) shows "No pude responder en este momento.".
  - Given the same failure injection outside the test environment, then the question is answered normally.
- **REQ-20** **[Superseded: assistant-data-scope REQ-4]**: Strict scopes. After the winner is chosen (REQ-19):
  - A winner the scope does not answer (Topics table, "Answers in") gets the unknown reply with the out-of-scope chips (REQ-5). "Preguntar en Todo" appends the same question again as my message and answers it in Todo, labelled "Todo"; the switcher is unchanged.
  - No winner: Todo returns the unknown reply (REQ-6); a narrowed scope returns its overview (Recetario: recipe list; Carrito: cart; Plan activo: plan summary; Esta receta: the recipe), as today.
  - In Esta receta, a deleted or missing recipe gets the unknown reply with the missing-recipe chips (REQ-5); this wins over the out-of-scope check.
  - The texts "No encontré esa información en tu plan activo." and "No encontré esa información en el sistema." no longer exist.
  - Given the dashboard in Recetario and "¿Qué tengo en mi carrito?", then the unknown reply shows with "Preguntar en Todo", "¿Qué recetas hay en mi plan?" and "¿Qué ingredientes necesito comprar?". When I activate "Preguntar en Todo", then my question appears a second time, an answer labelled "Todo" lists the cart, and the switcher shows "Recetario".
  - Given that reply, when I activate "¿Qué ingredientes necesito comprar?", then the answer is labelled "Carrito".
  - Given Carrito and "¿A qué hora es la cena?", then the unknown reply shows.
  - Given Plan activo with an active plan and "hola", then the plan summary shows. Given Carrito and "hola", then the cart summary shows.
  - Given Esta receta for a recipe deleted in another tab and "¿Qué ingredientes lleva?" or "¿Qué hay en mi carrito?", then the unknown reply shows with chips "¿Qué recetas hay en mi plan?", "¿Qué tengo en mi carrito?" and "¿Qué ingredientes necesito comprar?", and no "Preguntar en Todo".

### US3 (P1): Composer and conversation control
As the user, I want a comfortable input and a way to start over.

- **REQ-9:** An empty thread shows the empty state chips (REQ-5). "Nueva conversación" appears only when the thread has messages; it clears the thread at once, focuses the input and shows the empty state. A pending request's late answer is discarded, and send and the search bar are enabled at once.
  - Given messages, when I activate it, then no messages remain, the chips show and the input is focused.
  - Given a pending request, when I activate it, then "Enviar" is enabled for non-empty text, the search bar is enabled, and the late response leaves the thread empty.
- **REQ-10:** The input is a multi-line field labelled "Pregunta" that grows to 5 lines, then scrolls. Its action bar holds the dictation mic and "Enviar".
  - Send is disabled when the field is empty or whitespace, while a request is pending, or when the length exceeds 500. The field and mic stay editable while pending; Enter while pending sends nothing.
  - From a length of 450, a counter "<n>/500" shows. It is the field's accessible description and outside any live region. Over 500 it also shows "Máximo 500 caracteres".
  - The server rejects a chat request whose message length is 0 or exceeds 500 with the standard bad-request response and no answer. Only this case and an unparsable body return 400 (REQ-23).
  - At ≤640 px, or on a device whose primary pointer is coarse (touch-first, e.g. a tablet without a keyboard) at any width, Enter adds a newline and only "Enviar" sends. Elsewhere, Enter sends and Shift+Enter adds a newline. Enter never sends during IME composition. Only this Enter rule uses the coarse-pointer condition; the narrow-sheet, modality and focus rules (REQ-15, REQ-22, Interaction details) stay at ≤640 px.
  - Given desktop with a fine primary pointer, when I type a line, press Shift+Enter, type a line and press Enter, then one two-line message is sent and the field clears.
  - Given desktop with a fine primary pointer, when I press Enter twice quickly, then one request is sent and my message appears once.
  - Given 360 px, when I press Enter, then a newline is added and nothing is sent. Given an active composition, when I press Enter, then nothing is sent.
  - Given a 1024 px wide viewport with a coarse primary pointer, when I press Enter in the field, then a newline is added and nothing is sent.
  - Given a length of 449, then no counter shows; at 450, the counter reads "450/500".
  - Given a length of 500 plus surrounding spaces, then "Enviar" is enabled and the message is answered.
  - Given a length of 501, then "Enviar" is disabled, Enter sends nothing, and the counter reads "501/500" with "Máximo 500 caracteres".
  - Given a chat request sent directly with length 501, or with the message "   ", then each gets the standard bad-request response.
  - Given 6 lines of text, then the field is 5 lines tall and scrolls.
- **REQ-11:** Sending scrolls the log to show my question. When an answer arrives and I am within 24 px of the bottom, the log sticks to the bottom if the answer fits, otherwise it shows the answer's first line at the top. If I scrolled up more than 24 px, my position is kept and "Ir al último mensaje" appears; activating it scrolls to the bottom and hides it.
  - Given a scrolled-up log, when an answer arrives, then my position is kept and the button shows. When I activate it, then the log is at the bottom.
  - Given an answer taller than the visible log, then its lead is visible at the top of the log.
  - Given a scrolled-up log, when I send, then the log scrolls so my question is visible.

### US5 (P1): Look, motion and accessibility
As the user, I want the panel to work in both themes, on my phone, with assistive tech and with my motion settings.

- **REQ-14:** In light and dark themes, every element in Interaction details "Contrast" meets WCAG AA (4.5:1 text, 3:1 non-text and large text). Highlights have font-weight ≥600 or an underline; the selected scope has a border or check mark **[Superseded: no scope]**.
  - Given each theme with a structured answer, chips, sources, an error, a pending state, the counter over the limit, the compact menu open **[Superseded: no menu]** and a focused control, then the e2e contrast check reports zero violations.
  - Given forced colors are emulated, then highlights keep font-weight ≥600 or an underline, and the selected scope's border or check mark is visible **[Superseded: no scope]**.
- **REQ-15:** Narrow and short viewports.
  - At 740×360 (short landscape, desktop layout), the panel height is limited to the viewport. Given 740×360, then the input is fully visible.
  - At ≤640 px, the open panel is a full-height modal sheet and the FAB is hidden while it is open.
  - The sheet's computed padding on each edge is ≥ the matching `env(safe-area-inset-*)`.
  - Every target in Interaction details "Touch targets" is ≥44×44 px, with no two overlapping.
  - The input stays inside `window.visualViewport` when it shrinks.
  - Given 360×740, then the sheet fills the viewport height, the FAB is hidden, each target is ≥44×44 px and no target boxes intersect.
  - Given the visual viewport is resized to emulate the keyboard, then the input's box lies inside `visualViewport`.
  - Given 360 px with a long unbroken token, then it wraps and the panel has no horizontal overflow.
  - The header follows Interaction details "Narrow header" (**[Superseded: the "Alcance" control is removed by assistant-data-scope REQ-4]**). Given 360 px and a non-empty thread, then row 2 shows "Alcance: Plan activo" and the "Nueva conversación" button (accessible name "Nueva conversación"), both ≥44 px, with no overlap and no clipping.
- **REQ-16:** Motion follows Interaction details "Motion".
  - Given reduced motion, when an answer arrives, then new messages and the loader compute `animation-name: none` or a 0 duration.
  - Given reduced motion, when the panel or sheet opens and the scroll button and chips appear, then each computes a transition and animation duration of 0.
  - Given reduced motion, when I send or activate "Ir al último mensaje", then the log's scroll position equals the target when read immediately after the action.
  - Given no reduced motion, then a message fade lasts ≤200 ms.
- **REQ-17:** Each assistant turn (answer with its sources, unknown reply, or error text) is rendered inside a polite live region, in full. The user turn, chips, scope label, Reintentar and "Pensando…" are outside any live region; Reintentar is a focusable control after the error text. Each turn is exposed as "Tú" or "Asistente"; the assistant icon is hidden from assistive tech. A turn focused by script (REQ-22) is not in the tab order, and focusing it adds no announcement beyond the live region. Existing names stay: "Abrir asistente"/"Cerrar asistente", the labelled input, "Enviar" and the dictation alert.
  - Given my question and its answer, then my turn is exposed with the speaker "Tú", the answer with "Asistente", and the assistant icon is hidden from assistive tech.
  - Given a pending request, then the live region does not contain "Pensando…". When the answer arrives, then the region contains its lead and every shown item, and does not contain my message, the chips or the scope label.
  - Given a failed request, then the region contains the error text and not "Reintentar", and Reintentar follows it in tab order.
- **REQ-22:** Modality and focus.
  - Opening the panel focuses the input. Desktop is non-modal: no focus trap, the page stays usable.
  - At ≤640 px the sheet is modal: the page behind is inert and does not scroll, Tab stays in the sheet, and a visible "Cerrar asistente" (×) closes it.
  - Escape closes an open scope menu first (**[Superseded]**: no scope menu), then the panel. Closing returns focus to the FAB.
  - Closing the panel or navigating while a request is pending does not cancel it: the answer lands in the thread, with no badge on the FAB.
  - Focus targets follow Interaction details "Focus".
  - Given desktop with the panel open, then a page link is clickable.
  - Given 360 px with the panel open, then Tab never leaves the sheet and the page behind does not scroll.
  - **[Superseded: no scope menu; Escape closes the panel and focuses the FAB]** Given the scope menu is open, when I press Escape, then the menu closes and the panel stays open; pressing Escape again closes the panel and focuses the FAB.
  - Given a pending request, when I close the panel and reopen it after the response, then the answer is in the thread and the FAB showed no badge.
  - Given 360 px, when I activate a chip, then focus is on the new answer turn once it arrives. Given desktop, then focus is on the input.
  - Given 360 px and a chip whose request fails, when I activate it, then focus is on the log while pending, then on the error turn, which is not in the tab order, and Tab moves to Reintentar.

### US4 (P2): Scope in the panel **[Superseded: assistant-data-scope REQ-4]**
REQ-12 and REQ-21 are superseded entirely. In REQ-13 only the scope part is superseded; the search bar still opens the panel, is disabled while pending, and enforces the 500 limit.

As the user, I want to choose what the assistant searches from inside the panel.

- **REQ-12:** The switcher offers Todo, Plan activo, Recetario and Carrito, plus "Esta receta" only on a recipe page. It defaults to the page's scope. A change applies to the next question only (even while pending) and keeps the thread. Navigating keeps the thread and resets the switcher to the new page's default.
  - Given the dashboard with one answer, when I pick "Recetario" and ask, then the new answer is labelled "Recetario" and the earlier one "Todo".
  - Given a pending request in Todo, when I pick "Carrito", then the pending answer is labelled "Todo" and the next one "Carrito".
  - Given "Recetario" on the dashboard, when I navigate to groceries, then the messages remain and the switcher shows "Carrito".
- **REQ-13:** A search-bar question opens the panel, focuses the panel input, and is answered in the bar's scope with that label, for that question only; the switcher is unchanged. The bar is disabled while a request is pending and does not submit a length over 500.
  - Given switcher "Todo" and bar "Recetario", when I ask there, then the panel input is focused, the answer is labelled "Recetario", and the switcher shows "Todo".
  - Given a pending request, then the bar's input and scope control are disabled.
  - Given a bar question of length 501, then nothing is sent.
- **REQ-21:** On desktop, the switcher is a visible single-choice group named "Alcance" exposing its selected option; arrow keys move, Enter or Space selects, and focus stays on it. At ≤640 px, it is a button "Alcance: <scope>" that opens a listbox popup of the same options and exposes its expanded state: opening focuses the selected option, arrows move, Enter or Space selects and closes, and Escape closes; both return focus to the button.
  - Given desktop, when I focus "Todo", press ArrowRight, then Enter, then "Plan activo" is selected and focused.
  - Given 360 px, when I open "Alcance: Todo", then "Todo" is focused. When I press ArrowDown twice and Enter, then the menu closes and the focused button reads "Alcance: Recetario".
  - Given the menu is open, when I press Escape, then it closes and the button is focused.

## Interaction details

- **Copy:**
  - Panel title "Asistente" (existing); "Pregunta"; "Enviar"; "Pensando…"; "Reintentar"; "Ir al último mensaje"; "Nueva conversación" (always the accessible name and tooltip; visible text only above 640 px wide)
  - Leads: meal times "Estos son los horarios de tus comidas."; plan "Tu objetivo: <objetivo>"; full recipe list "Estas son tus recetas."; filtered recipe list "Estas recetas coinciden con tu pregunta."; cart "Esto es lo que tienes en tu carrito."; Esta receta "Sobre <receta>:"
  - Section titles: "Comidas", "Suplementos", "Recomendaciones", "Recetas", "Ingredientes", "Preparación"; empty supplements item "Sin suplementos registrados"
  - Unknown lead: "No encontré eso en tu información."
  - Capability line: "Puedo ayudarte con tu plan de comidas y horarios, tus recetas e ingredientes, y tu lista de compras."
  - Error: "No pude responder en este momento."; HTTP 500 (v1.9, REQ-23): "Algo salió mal al responder. Intenta de nuevo."
  - "Alcance"; "Alcance: <scope>"; "Preguntar en Todo"; "Cerrar asistente" (× and FAB)
  - "Tu carrito está vacío."; "No tienes un plan activo."; "Tu plan no tiene horarios para tus comidas."; "Aún no tienes recetas."
  - "<n>/500"; "Máximo 500 caracteres"; "y <n> más"
- **Focus:**
  - Panel open, "Ir al último mensaje", Nueva conversación: the input.
  - After a chip, Reintentar or "Preguntar en Todo": on desktop, the input. At ≤640 px, the log container while waiting, then the new turn (answer or error, focusable by script only); on an error turn, Reintentar is the next focusable control.
  - **[Superseded]** After a scope change: the switcher (the option, or the compact button). After close: the FAB.
- **Touch targets (≤640 px):** FAB, ×, Nueva conversación, switcher options or the compact button and its menu options, chips, Reintentar, "Ir al último mensaje", mic, send.
- **Narrow header (≤640 px wide)** (**[Superseded: row 2 is removed; see assistant-data-scope REQ-4]**): row 1: "Asistente" and ×; row 2: "Alcance: <scope>" and "Nueva conversación" as a 44×44 icon button (accessible name and tooltip "Nueva conversación"). The panel subtitle is hidden at ≤640 px wide and in short viewports (≤480 px tall); in short viewports wider than 640 px, "Nueva conversación" keeps its visible text.
- **Layout** (**[Superseded: assistant-data-scope REQ-32]**): user bubbles right-aligned, ≤80% of the log width; assistant answers full width with no bubble and a decorative icon; long tokens wrap; no thread cap.
- **Motion** (**[Amended: assistant-data-scope REQ-33's typing effect, ≤1 s, is exempt from the 200 ms cap]**): under reduced motion nothing animates (messages, the loader as static "Pensando…" text, the panel or sheet, the scroll button, chips) and scrolling is instant. Otherwise fades and transitions are ≤200 ms (the "Pensando…" loader's looping text blink is exempt) and smooth scrolling is allowed.
- **Contrast** (both themes): message, lead and item text; scope label, sources, highlights; user bubble; switcher states (default, selected, focus); compact button and menu; chips; send enabled and disabled; placeholder; "Pensando…"; scroll button; error; Reintentar; ×; Nueva conversación; counter and its over-limit state; modal backdrop; focus rings.

## Edge cases and errors

- Rapid double send or chip activation while pending sends one request (REQ-5, REQ-10).
- **[Superseded: no scopes or recipe context]** Esta receta selected and I navigate away: the switcher takes the new page's default; Esta receta chips keep their recipe (REQ-5, REQ-12).
- A dictation error shows as today (role alert); the field and send still work (REQ-10).

## Non-functional requirements

- No new npm packages (Constitution 4). **[Superseded: assistant-data-scope; the only exception is fuse.js 7.5.0; prompt-kit `response-stream` is copied code, not a package]**
- The response change is additive. The chat tests in `dashboard.spec.ts`, `theme-switch.spec.ts` and `theme-palette.spec.ts` stay green, with selectors and any Todo-fallback assertion updated per REQ-6; the scope tests may be rewritten or removed as assistant-data-scope specifies.
- Timeout 15 s; fades ≤200 ms; touch targets ≥44×44 px at ≤640 px; input length ≤500 on client, search bar and server.

## Assumptions

None.

## Open questions

None.

## Progress

- [x] US1 (P1): structured answers, sources, scope label, meal times, topic precedence (REQ-1 to REQ-4, REQ-18, REQ-19)
- [x] US2 (P1): follow-ups, unknown reply, thinking, retry and timeout, strict scopes (REQ-5 to REQ-8, REQ-20)
- [x] US3 (P1): empty state, new conversation, composer, scroll (REQ-9 to REQ-11)
- [x] US5 (P1): themes and contrast, narrow sheet, motion, live region, modality (REQ-14 to REQ-17, REQ-22)
- [x] US4 (P2): scope switcher, search-bar scope, switcher accessibility (REQ-12, REQ-13, REQ-21); superseded in v1.9
- [ ] v1.9 REQ-23: 500 versus 400 error handling (delivered on feature/assistant-data-scope)

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-26 | Initial spec; open questions and assumptions resolved in draft (meal-times topic, search-bar scope, Todo-scope change, accepted copy and values) |
| 1.1 | 2026-10-26 | Verify round 1 and UX checklist G1–G25: topic precedence (REQ-19), strict scopes and "Preguntar en Todo" (REQ-20), switcher accessibility (REQ-21), modality and focus (REQ-22), 15 s timeout, touch Enter, long-answer scroll, live region, contrast and forced colors, 500-character limit, page-suggestion and Topics tables; scope-tagged chips, no repeated chip, server-side limit, v1.1 copy confirmed |
| 1.2 | 2026-10-26 | Verify round 2, UX G13, G18, G26–G31, user decisions: exhaustive tiered Topics vocabulary with fixed follow-ups, "cuándo" rule (REQ-19); chip-count and repeat rules, Esta receta chips keep their recipe (REQ-5); per-answer content, 8-item cap (REQ-1); old fallbacks removed (REQ-20); UTF-16 length limit everywhere (REQ-10, REQ-13); retry, live region, motion, contrast, sheet, listbox and focus details (REQ-8, REQ-14 to REQ-17, REQ-21, REQ-22) |
| 1.3 | 2026-10-26 | Verify round 3 and UX G32: recipe-list filter by words minus topic and stop words, sources only when used, protein chip answer (REQ-1, REQ-3); word tokenization (REQ-19); repeat fill from full lists, missing-recipe chips and precedence (REQ-5, REQ-20); blank messages rejected by server (REQ-10); new G/W/T (REQ-11, REQ-17); touch focus on log, new turn and Reintentar (REQ-22); Decisions deduplicated, stray tags removed, REQ-9 under one Goal |
| 1.4 | 2026-10-26 | Spec-change: confirmed answer copy and wording fixes; no behavior change |
| 1.5 | 2026-10-26 | Spec-change: recommendations one item per line; empty sections hidden |
| 1.6 | 2026-10-27 | Spec-change: Reintentar only on the latest turn; chips hidden during a retry; loader exempt from the fade cap |
| 1.7 | 2026-10-27 | Spec-change: Enter adds a newline on coarse-pointer devices too |
| 1.8 | 2026-10-28 | Spec-change: narrow header shows Nueva conversación as an icon button and hides the subtitle; corrected: icon-only applies at ≤640 px wide only, the ≤480 px-tall condition only hides the subtitle |
| 1.9 | 2026-10-28 | Spec-change: parts superseded by [assistant-data-scope](../assistant-data-scope/spec.md) (vocabulary and matching, Tier 3 meal nouns and REQ-18 slot answers, REQ-19 precedence, scopes: Terms, REQ-4, REQ-5 scope parts, REQ-6, REQ-12, REQ-13 scope part, REQ-20, REQ-21, Esta receta and page context, plan lead "Tu objetivo" versus objetivo/meta, layout); REQ-1 cap wording fixed (8 items plus "y n más" = 9 entries; code and tests were already right); new REQ-23 (server errors → 500 with generic body and logged details, 400 only for invalid requests; `src/server.js` out of scope); plan and contract version headers bumped. Verify round 1: status partial (REQ-23 delivered on feature/assistant-data-scope); "no new packages" and "tests stay green" superseded (fuse.js 7.5.0 only; scope tests rewritten or removed); blanket void rule for scope and page context plus inline tags (Overview, Goals, REQ-8 retry, REQ-14, REQ-18 Givens, REQ-22 Escape, Edge case, narrow header); Motion amended for the typing effect; REQ-23 test-only failure injection, log capture, 500-only generic body (400 keeps validation issues), Definition-of-done exception; REQ-8 non-500 copy kept. Verify round 2: REQ-17 amended (buttons outside the live region; option count and labels announced as text); "used verbatim" copy amended; contract banner and Copy name the superseded rows (plan lead, "No tienes un plan activo." → "Aún no tienes un plan activo.", meal-times slot answers and no-times lead for slot questions). Spec-change (user decision, 2026-10-28): REQ-23, REQ-10 and contract say 400 is for invalid or unparsable requests (zod or unparsable body), not zod only |
