# Spec: Assistant data scope

**Status:** planned
**Version:** 1.5 · **Branch:** feature/assistant-data-scope · **Owner:** Rafael Martinez · **Date:** 2026-10-28
**Related:** [assistant-chat-polish](../assistant-chat-polish/spec.md) v1.9 (parts superseded by this spec) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md)

> Over the ~150-line budget on purpose (accepted by the user 2026-10-28): six stories, two matcher tables and confirmed copy. The *what* and *why* only. "chat-polish REQ-n" always means assistant-chat-polish's REQ-n; a bare "REQ-n" is this spec's.

## Overview

The assistant is rule-based keyword matching (no AI). It knows four topics (meal times, cart, recipes, plan), matches words only exactly or by stem, splits answers by scope, and never reads the daily logs. So "¿cuánto peso?", "¿qué puedo cenar?" and "¿cuánta agua tomé esta semana?" fail, and one typo gets the unknown reply. The data for all of these already exists: daily logs, goals, plan meals, options, complements, and the user and plan names. This feature makes matching tolerant and removes scopes, so every question searches everything. It adds meal detail, plus date-based weight, exercise, water and meal answers that use the dashboard's numbers. It handles small talk and ambiguity the way a chat should, and it redesigns the conversation layout. There is no schema change and no migration.

## Scope and dependencies

- **Also delivers chat-polish REQ-23** (server failures → HTTP 500 with a generic body and a logged error; 400 only for invalid input) as a task of this branch. chat-polish stays `partial` until it ships. Its test-only failure injection is guarded like the date pin (REQ-13).
- Only new dependency: fuse.js, pinned at exactly 7.5.0 (user-approved). prompt-kit's `response-stream` is copied code, not a package.

## Goals / Non-goals

- Goal: questions are understood despite accents, plurals, synonyms and small typos, and every answer covers all of the user's data (US1).
- Goal: "¿Qué puedo cenar?" leads, through buttons, to the full detail of a dish (US2). Weight, exercise, water and meal questions get correct, dated answers that match the dashboard (US3).
- Goal: the chat never dead-ends; whenever it is unsure, it asks back with closed-answer buttons (US4).
- Non-goal: conversation memory, MCP, external AI or LLM calls, writing data from the chat, and changing what the dashboard displays.

## Decisions

- **New spec plus a small amendment to assistant-chat-polish:** the old spec is large and already implemented.
- **No MCP and no real AI:** MCP adds nothing substantial now, and the project makes no external AI calls.
- **Stateless answers (no history in the request):** memory ("¿y la cena?") is a future feature; every button sends a self-contained message.
- **Story order US1 → US6:** US1 is already the largest phase, so the UI redesign goes last.
- **Typo allowance from the vocabulary word's length (≤4: exact; 5–7: 1 edit; ≥8: 2 edits; a transposition counts as 1 edit):** keeps "ahora" ≠ "hora", "pero" ≠ "peso" and "carritito" unknown, so existing tests stay valid. Computed in-house.
- **fuse.js pinned at exactly 7.5.0 for dish names and "¿Quisiste decir…?":** explicit user yes (Constitution 4); zero dependencies, typed, Node ≥10. A one-off spike in a scratch copy (outside the repo) fixes the threshold against the user's real recipe set; the REQ-3 table, run on a deterministic seeded fixture, is the acceptance criterion, so the test does not change when the user adds recipes (user decision 2026-10-28).
- **Performance split: automated check on a synthetic dataset with a 5 s bound and logged timings; the ≤1 s bound on the real data is checked manually by the user before merge:** machine and data variance make a hard automated 1 s bound flaky (user decision 2026-10-28).
- **Bubbles and avatar are not focusable; only buttons and links are:** they are not interactive (user decision 2026-10-28).
- **Assistant-panel and dashboard-search-bar snapshots refreshed twice, each with the user's explicit yes (after the scope removal and at the end):** the scope removal changes both mid-feature (user decision 2026-10-28).
- **One normalizer for the assistant and the shared recipe-step splitter:** two exist today and they disagree. The normalizers that build persisted recipe fingerprints and ingredient keys (nutrition) and the dashboard's own stay as they are: changing them would change stored hashes and duplicate recipes on PDF re-upload (user decision 2026-10-28).
- **The panel's per-page subtitle is a label only:** it never changes an answer, a button or resolution, so it is not the removed page context (user decision 2026-10-28).
- **Internal `resolved` diagnostic only under the test hook:** lets e2e see the intents found without exposing them; it is never in production responses, clients ignore it, and it never replaces an assertion on the visible answer (user decision 2026-10-28).
- **Scopes removed entirely (panel switcher, search-bar menu, out-of-scope reply, page and recipe context):** asking "¿Cómo se prepara?" on a page that already shows the recipe has no real value.
- **Options as buttons, 3 per page, plan order:** short lists of tappable choices; generic names are replaced by their first ingredients.
- **Preparation capped at 2 steps, with "Ver receta completa":** the chat stays short; steps use the recipe page's sentence split, so the two never disagree.
- **Complements only in the detail:** they belong to a meal slot, not to a list of options.
- **Today on the server, in America/Mexico_City fixed in code (not env):** the client cannot change the date, and answers stay right on a UTC server.
- **Weekly math shared with the dashboard:** the two must never show different numbers; the dashboard display does not change.
- **In-house date-phrase parser:** the phrase set is small and fixed.
- **Default periods (weight: latest; exercise: week; water and meals: today plus a week line):** each matches how its goal is measured.
- **"meta" and "objetivo" are synonyms:** users say both.
- **At most 2 topics per answer:** longer answers are hard to scan and to hear.
- **Deterministic phrasing variants:** less robotic, stable tests.
- **Closed-answer buttons whenever the chat must ask:** each tap gives a definite result.
- **Avatar and bubble built in-project on prompt-kit's `message` pattern, without its markdown dependencies:** answers are structured, not markdown; avoids 6 dependencies. `response-stream` is copied for the typing effect; `useChatScroll`/`ScrollButton` stay.
- **One button component (PromptSuggestion), with a vertical full-width variant for option lists; navigation buttons marked by an arrow icon:** one look for every button.
- **Only the lead types out (<1 s):** a sense of life without slowing reading.
- **Copy variants and leads as listed in Copy:** user confirmed at Gate 1.
- **US2 is a single P1 story (almuerzo clarification, page 3+, duplicate slots included):** user confirmed at Gate 1.
- **Typo rule details (first letter must match; never-fuzzy words exact only, including cuánto/cuánta/cuántos/cuántas; multi-word entries compare each word with its own allowance):** user confirmed at Gate 1.
- **Pages ≥2 show "Opciones anteriores"; a page past the last shows the last page:** user confirmed at Gate 1.
- **2-topic answers hold at most one option-button block; a second option topic becomes a button:** user confirmed at Gate 1.
- **Unrecognized date phrase → default period with "No entendí la fecha; te muestro <periodo>.":** user confirmed at Gate 1.
- **Period nouns are date cues only inside a time-range construction ("en el mes" = this month; "la semana" alone is not); Weekly progress is always this week:** user confirmed at Gate 1.
- **Weight week line "sin cambio" for 0, only with a record this week; Weekly progress omits weight otherwise:** user confirmed at Gate 1.
- **Water liters shown = the plan's minimum liters, unclamped (glasses clamped 4–12):** user confirmed at Gate 1.
- **Buttons appear only after typing completes:** user confirmed at Gate 1.
- **Search-bar placeholder "Pregunta por tu plan, tu avance o tus compras":** user confirmed at Gate 1.
- **"plan" next to another topic's trigger is a possessor; Plan topic only when alone; an exact non-generic recipe name beats a slot reading:** user confirmed at Gate 1.
- **Ordinals: masculine forms for desayuno, almuerzo, snack; beyond 10 "<Slot> <n>"; with a non-duplicated slot, "<slot> <n>" means option n:** user confirmed at Gate 1.
- **No active plan: Goals omit the objective, Weekly progress omits meals, water uses 2 L, both add "Aún no tienes un plan activo." + "Subir mi plan"; a narrowed goal has no plan line:** user confirmed at Gate 1.
- **Single-day exercise copy for other days: "<Periodo>: sí hiciste ejercicio." / "<Periodo>: no registraste ejercicio.":** user confirmed at Gate 1.
- **Spec length over ~150 lines accepted:** user confirmed at Gate 1.

## Terms

- **Normalized text:** lowercase, accents removed (ñ compares as n), every non-letter, non-digit character treated as a space. A **word** is a run of letters and digits in it.
- **Edit:** one insertion, deletion or substitution of a letter, or a swap of two adjacent letters.
- **Never-fuzzy words:** ahora, ahorita, pasar, paso, pero, objeto, cuánto, cuánta, cuántos, cuántas. They match only exactly (so "cuánto" never matches "cuándo").
- **Slot:** a meal type of the active plan (name, time window, plan order). **Slot words:** desayuno, comida, cena, colación, almuerzo, merienda, snack, desayunar, comer, cenar. **Slot ref:** the slot name, or with duplicate names its ordinal form: Primera, Segunda, Tercera, Cuarta, Quinta, Sexta, Séptima, Octava, Novena, Décima + slot ("Segunda colación"); masculine slots (desayuno, almuerzo, snack) use Primer, Segundo, Tercer, Cuarto, Quinto, Sexto, Séptimo, Octavo, Noveno, Décimo. Beyond 10: "<Slot> <n>" ("Colación 11").
- **Slot button:** label "<Slot ref>" (plus " (<time>)" for duplicates that have a time); it sends "¿A qué hora es mi <slot ref>?" when the question was about times, otherwise "¿Cuál es mi <slot ref>?".
- **Generic name:** a recipe name that, normalized, is only a slot word or slot name followed by "opcion" and a number (e.g. "Comida opcion 1").
- **Preparation:** the recipe description, unless empty or starting with "Extraído de". **Steps:** the preparation split into sentences exactly as the recipe page splits it.
- **Complements:** the slot's shared add-ons with their amounts (e.g. "Agua natural · 1 vaso").
- **Today:** the server's date in America/Mexico_City. **Week:** Monday to Sunday containing today.
- **Water goal:** glasses = the active plan's minimum water liters (default 2 L, also with no plan) ÷ 0.25, clamped to 4–12; the liters shown are the plan's liters, unclamped. **Exercise goal:** the user's goal, default 4 days a week; it always exists.
- **Date cues:** hoy, ayer, antier, anteayer, weekday names, month names, desde, hace, pasado/pasada, últimos/últimas are always cues. **Period nouns** (día(s), semana(s), mes(es), año(s)) are cues only inside a time-range construction: with hace, últimos/últimas, desde, pasado/pasada, esta/este, anterior, "en el" (only "en el mes", which means this month, REQ-14), or a number, weekday or month. Otherwise they are ignored as date cues ("Mi avance de la semana", "¿Cuántos días hice ejercicio?", "a la semana", "en la semana"). Words consumed by a phrase ("buenos días") are never cues.
- **Question button:** sends its message as a visible user turn; its label may differ. **Navigation button:** a link, label followed by the lucide `ArrowUpRight` icon.
- **Recipe-list filter words (frozen from chat-polish v1.9 REQ-1):** stop words que, hay, en, mi, mis, de, del, el, la, los, las, con, para, por, tengo, cual, cuales, como, cuanto, es, un, una; also dropped: hora(s), horario(s), cuando, desayuno(s), comida(s), cena(s), colacion(es), carrito(s), plan(es), objetivo(s) and words starting with compr, receta, ingrediente, prepar, suplement, recomend.

## Topics

Triggers are matched under REQ-1 and REQ-2. "Button" is the message other answers use to offer this topic; "Title" is its block title in 2-block answers (REQ-24).

| Topic | Triggers (synonyms) | Answer | Button | Title | Follow-ups |
|---|---|---|---|---|---|
| Greeting | hola, buenos días, buenas tardes/noches, qué tal; gracias | REQ-23 | – | – | the 4 starters |
| Slot times | hora, horario, cuándo + slot | REQ-8 | "¿A qué hora es mi <slot>?" | Horarios | "¿Cuál es mi <slot>?" |
| All meal times | hora, horario or cuándo with no slot and no other topic; "comidas" with no other cue | every slot with its time | "¿Cuál es mi horario?" | Horarios | "Mi cena de hoy", "Mi carrito" |
| Slot options | cuál es mi, qué hay de, qué lleva, qué puedo, ingredientes + slot; bare slot word | REQ-9 | "¿Cuál es mi <slot>?" | <Slot ref> | "¿A qué hora es mi <slot>?" |
| Dish detail | qué lleva, cómo se prepara/hace, ingredientes de, receta de + dish | REQ-12 | "¿Qué lleva <receta>?" | <receta> | "Mi carrito", "Mi cena de hoy" |
| Weight | peso, pesar, pesé, pesaje, báscula, kilos | REQ-19 | "Mi peso" | Peso | "¿Cuál es mi meta?", "¿Cuánto ejercicio llevo?" |
| Exercise | ejercicio, entrenar, entrené, entrenamiento, actividad, gym, gimnasio | REQ-18 | "¿Cuánto ejercicio llevo?" | Ejercicio | "¿Cuánta agua llevo?", "Mi peso" |
| Water | agua, hidratación, hidratar, vasos | REQ-17 | "¿Cuánta agua llevo?" | Agua | "¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?" |
| Meals done | comidas + llevo, hice, cumplido, cumplí | REQ-20 | "¿Cuántas comidas llevo?" | Comidas | "¿Cuánta agua llevo?", "Mi cena de hoy" |
| Goals | meta, objetivo (+ de peso / ejercicio / agua) | REQ-21 | "¿Cuál es mi meta?" | Metas | "Mi avance de la semana", "Mi peso" |
| Weekly progress | avance, progreso, resumen (no metric) | REQ-22 | "Mi avance de la semana" | Avance | "Mi peso", "¿Cuál es mi meta?" |
| Ambiguous progress | llevo, voy, cuánto llevo (no metric) | REQ-25 | – | – | – |
| Cart | carrito, compr*, súper | cart answer (unchanged) | "Mi carrito" | Carrito | "¿Qué recetas hay en mi plan?", "Mi cena de hoy" |
| Recipes | receta, ingrediente, prepar* (no slot, dish or cart cue) | recipe list and filter (unchanged; filter words in Terms) | "¿Qué recetas hay en mi plan?" | Recetas | "Mi carrito", "Mi cena de hoy" |
| Plan | plan, suplemento, recomendación, "objetivo del plan" (meta/objetivo + plan, no metric), only when no other topic's trigger is present (REQ-6); a goal word next to "plan" with no metric counts as Plan (REQ-6) | REQ-31 | "¿Cuál es mi plan?" | Plan | "¿Cuál es mi meta?", "¿Qué suplementos tomo?", "¿Qué recetas hay en mi plan?" |
| Identity | cómo me llamo, mi nombre; cómo se llama mi plan, nombre de mi plan | REQ-30, REQ-31 | – | Nombre / Plan | "¿Cuál es mi plan?", "Mi avance de la semana" |

Starter buttons: "Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito" (empty state, greeting, no-match).

Every Button, Follow-up and starter message above resolves under REQ-6 to exactly its intended single topic (checked in v1.2; adjusted: "¿Qué recetas hay en mi plan?" by the possessor rule, "Mi avance de la semana" by the period-noun rule, "¿Cuánto ejercicio llevo?" by never-fuzzy "cuánto", "¿Qué lleva <receta>?" by the exact-name rule in REQ-6 step 4).

## User stories

### US1 (P1): Understand me, about everything
As the user, I want the assistant to understand how I actually type and to search all my data, so that I don't have to guess the right words or the right scope.

- **REQ-1:** Matching uses normalized text. Singular and plural forms match (s, es, z→ces). Each synonym group in Topics resolves to its topic.
  - Given "¿CUÁNTO PESÉ?", "báscula", "bascula", "¿Cuánto entrené?", "gym" or "¿Ya tomé agua?", then each resolves to weight, weight, weight, exercise, exercise, water.
- **REQ-2:** A word matches an entry exactly, by stem (* entries: exact prefix only), or fuzzily. Fuzzy: within the entry-length allowance (Decisions), counted against the entry's singular and plural forms, **and** the first letter matches. A word that exactly equals any entry, or is a never-fuzzy word, never fuzzy-matches. Multi-word entries ("buenos días", "cómo me llamo") match as whole phrases: consecutive words, each compared under these rules with its own length's allowance.
  - Matcher table (e2e): carito→carrito ✓; carrtio→carrito ✓ (swap); recta→receta ✓; desayno→desayuno ✓; ejersisio→ejercicio ✓ (2 edits, 9 letters); horarios→horario ✓; ahora, ahorita→hora ✗; pero→peso ✗; carritito→carrito ✗ (2 edits, 7 letters); pasar→pesar ✗ (never-fuzzy); lleva→llevo ✗ (both entries); garrito→carrito ✗ (first letter); vasto→vaso ✗ (4 letters); objeto→objetivo ✗ (never-fuzzy); cuanto→cuando ✗ (never-fuzzy).
  - Given "¿Qué hago ahora?", then no topic matches and the no-match reply shows (REQ-29).
- **REQ-3:** A dish phrase (the words after a dish cue, minus the cue, articles and stop words) is matched against the user's non-deleted recipe names; generic names are never fuzzy candidates. One clear match (an exact normalized match, or a single candidate within the threshold) → the detail. Several → REQ-26 "¿Quisiste decir…?". None → REQ-26 not-found. The threshold is fixed by a one-off spike on the user's real recipe set (outside the repo); this table is the acceptance criterion, run on a deterministic seeded fixture with 19 generic names, the recipes "Pollo asado", "Ensalada de pollo", "Sándwich de atún" and distractor recipes, so the test does not change when the user adds recipes:

  | Phrase ("¿Qué lleva …?") | Result |
  |---|---|
  | "el pollo asao" | detail of Pollo asado |
  | "el pollo asdao" (transposition) | detail of Pollo asado |
  | "el sandwich de atun" (no accents) | detail of Sándwich de atún |
  | "el pollo" | did-you-mean: Pollo asado, Ensalada de pollo |
  | "la pizza" | not found; no recipe offered |
  | "la opcion 1" (no slot) | not found; no generic recipe opened or offered |
  | "la comida opcion 1" | option selection: comida option 1 (REQ-10); never an unrelated dish |

- **REQ-4:** There are no scopes. The panel has no switcher, the search bar no scope menu or filter button, answers no scope label; no reply is out of scope, and the page or recipe being viewed never changes an answer. The empty state shows the 4 starters on every page. Orphans: at ≤640 px the header's row 2 is removed and row 1 holds "Asistente", "Nueva conversación" (44×44 icon button, when the thread is non-empty) and ×; the search bar's placeholder is always "Pregunta por tu plan, tu avance o tus compras" and its accessible name stays "Preguntar al asistente". No scope preference is stored today, and none is added.
  - The panel's per-page subtitle stays as a label only: it never changes an answer, a button or resolution (it is not the removed page context). Given the same question on two pages with different subtitles, then the answer text and buttons are identical.
  - Given a recipe page, when I ask "¿Qué hay en mi carrito?", then the cart answer shows. Given the search bar, when I ask "¿Cuál es mi peso?", then the panel opens with the weight answer.
  - Given any page, then no "Alcance" control, no scope menu and no "Preguntar en Todo" exist. Given 360 px and a non-empty thread, then row 1 shows the title, "Nueva conversación" and ×, each ≥44×44 px, with no overlap or clipping.
- **REQ-5:** An answer depends only on the message, the user's data and today; the client sends no history and no date. Whenever the assistant must ask, it asks with question buttons whose messages resolve to a definite answer, never to another question or the no-match reply. The chat-polish repeat rule applies to follow-ups only, never to clarify, slot, option, paging or did-you-mean buttons.
  - Given any button in any answer of this spec, when its message is sent as the first message of a new conversation, then it gives the same answer as when tapped.
- **REQ-6:** Resolution order: 1. greeting only; 2. option selection and paging (REQ-9, REQ-10); 3. identity; 4. dish cue plus dish phrase (an exact normalized match with a non-generic recipe name opens that recipe; otherwise a slot-word phrase resolves as that slot); 5. topics, in order of first appearance; 6. ambiguous progress; 7. "¿Quisiste decir…?"; 8. no-match.
  - Consumption: a matched phrase (identity, dish cue, meals done, multi-word synonym) consumes its words, which trigger nothing else; when phrases overlap, the one with more words wins.
  - Combinations: time word + slot = slot times. Goal word + metric = that goal only. Possessor: "plan" (also "mi plan", "del plan", "en mi plan") next to another topic's trigger (recetas, ingredientes, cart, metric topics, slots, goal word + metric) triggers nothing; the Plan topic applies only when no other topic is present (plan, suplementos, recomendaciones, goal word + "plan" with no metric = plan summary). Identity phrases (step 3) keep their own rule. "ingredientes" + cart word = cart only. A time word with another topic and no slot is ignored. A date cue (Terms) applies to every metric topic.
  - Given "¿Qué ingredientes lleva el desayuno?", then desayuno options show. Given "¿Cuándo compro?" or "¿A qué hora compro el súper?", then the cart shows. Given "¿Qué ingredientes necesito comprar?", then the cart shows in one block. Given "¿Cuál es mi meta de peso?", then only the weight goal shows. Given "¿Qué recetas hay en mi plan?", then one "Recetas" block (all recipes) shows and no plan block; when the follow-up button "¿Qué recetas hay en mi plan?" (Cart, Plan) is tapped, or sent as the first message of a new conversation, then the same single block shows.
  - Given "¿Cómo se llama mi plan?", then only the plan name shows (REQ-31), not the plan summary. Given "¿Cuántas comidas llevo?", then only meals done shows, not meal times or a clarification. Given "¿Qué lleva la cena?", then cena options show; given "¿Cuánto llevo?", then the REQ-25 clarification shows.

### US2 (P1): Meal detail
As the user, I want to ask what I can eat at a meal and see a dish's ingredients and preparation, so that I can cook without leaving the chat.

- **REQ-7:** Slot words map to active-plan slots by name; "almuerzo", "merienda" and "snack" map to a slot with that name when one exists. Otherwise "merienda" and "snack" map to colación, and "almuerzo" asks "¿Te refieres al desayuno o a la comida?" with slot buttons for whichever of desayuno and comida exist (one button if only one exists; the REQ-27 not-in-plan reply if neither).
  - Given a plan without "Almuerzo", when I ask "¿Qué hay de almuerzo?", then the question shows, and "Comida" sends "¿Cuál es mi comida?", which lists the comida options.
- **REQ-8:** Slot times answer only the named slot, its stored time highlighted. With no slot named, every slot is listed.
  - Given cena "Entre 7 a 8 pm", when I ask "¿A qué hora es la cena?", then only cena and its time show. Given "¿Cuándo desayuno?" and a desayuno with no time, then "Tu plan no tiene horario para tu desayuno." shows.
- **REQ-9:** The options list is a lead plus one vertical full-width button per option, at most 3 per page, in plan order. Labels: the recipe name; for a generic name "Opción <n>: <first 3 ingredients>" ("…" only when more than 3), or "Opción <n>" with no ingredients. Paging: a page n that is not the last adds "Ver más opciones" → "<Slot ref>, más opciones (página <n+1>)"; a page n ≥ 2 adds "Opciones anteriores" → "<Slot ref>, más opciones (página <n−1>)". Typed "<slot>, más opciones" with no number means page 2; page 1 equals the options answer; a page past the last shows the last page.
  - Given a cena with 5 options, when I ask "¿Qué puedo cenar?", then 3 buttons and "Ver más opciones" show. When I tap it, then options 4–5 and "Opciones anteriores" show, without "Ver más opciones". When I tap "Opciones anteriores", then options 1–3 show.
  - Given generic "Cena opcion 2" with pollo, arroz, brócoli and calabaza, then its label is "Opción 2: Pollo, Arroz, Brócoli…". Given "cena, más opciones (página 9)", then options 4–5 show.
- **REQ-10:** An option button sends "<Slot ref>, opción <n>" (e.g. "Segunda colación, opción 2"). Typing "cena opción 2", "cena opcion 2" or "la 2 de la cena" gives the same answer. A number beyond the slot's options gives "Tu <slot> tiene <n> opciones." plus the first page of option buttons.
  - Given a cena with 4 options, when I type "la 2 de la cena", then option 2's detail shows. When I type "cena opción 7", then "Tu cena tiene 4 opciones." and the first 3 buttons with "Ver más opciones" show.
- **REQ-11:** A slot with a single option, or a dish asked by name, goes straight to the detail. Duplicate slot names: "Tienes <n> <slots>. ¿Cuál?" with one slot button per slot ("Primera colación (<time>)", or "Primera colación" with no time). Typing any slot-ref ordinal (Terms, with or without accents) or "<slot> <n>" ("colación 2") picks that slot; with a non-duplicated slot, "<slot> <n>" means option n (REQ-10).
  - Given a desayuno with 1 option, when I ask "¿Qué hay de desayuno?", then its detail shows. Given two "Colación" slots, when I ask "¿Cuál es mi colación?", then 2 buttons show, and "Segunda colación" lists the second slot's options with buttons sending "Segunda colación, opción <n>". When I type "colación 2" or "segunda colacion", then the same list shows. Given 11 "Colación" slots, then the 11th button reads "Colación 11".
- **REQ-12:** The detail has a lead naming the dish (the recipe name, or "<Slot ref>, opción <n>" for a generic name) and sections:
  - "Ingredientes": every ingredient (no 8-item cap): "<name> · **<qty> <unit>**"; "<name> · **<qty>**" with no unit; "<name>" alone with neither. Stored text such as "al gusto" shows only when stored.
  - "Preparación": at most the first 2 steps; with more, the navigation button "Ver receta completa" (recipe page). With no preparation, the only item is "Esta receta no tiene preparación registrada."
  - "Acompaña con": the slot's complements with amounts, omitted when none. Reached by dish name, it shows only if the recipe is an option in exactly one slot.
  - Given a recipe with 12 ingredients and 4 steps, then 12 items, steps 1–2 (equal to the recipe page's) and "Ver receta completa" show. Given description "Extraído de plan.pdf", then "Preparación" shows only the no-preparation item. Given complement "Agua natural · 1 vaso", then "Acompaña con" shows it; given none, the heading is absent.

### US3 (P2): Weekly goals and date-based data
As the user, I want to ask about my weight, exercise, water and meals for a day or a period, so that I can track my progress from the chat.

- **REQ-13:** Today is computed on the server in America/Mexico_City; requests carry no date. The e2e suite can pin the server's today and inject the chat-polish REQ-23 failure; both are ignored outside the test environment.
  - Given a server clock of 2026-10-29 03:00 UTC, then today is 2026-10-28. Given a pin or injection attempt outside the test environment, then the real date is used and the question is answered normally.
- **REQ-14:** Phrases and period labels (today = Wed 2026-10-28):

  | Phrase | Period | Label |
  |---|---|---|
  | hoy; últimos 0 or 1 días; el <weekday> that is today | today | "Hoy" |
  | ayer; antier/anteayer | that day | "Ayer (mar 27 oct)"; "Antier (lun 26 oct)" |
  | el <weekday> | latest such day ≤ today | "El lunes (lun 26 oct)" |
  | esta semana; la semana pasada | Mon–today; previous Mon–Sun | "Esta semana (lun 26 – hoy)"; "La semana pasada (lun 19 – dom 25)" |
  | este mes / en el mes; el mes pasado | 1st–today; calendar month | "Este mes (1 oct – hoy)"; "El mes pasado (1 sep – 30 sep)" |
  | últimos N días (N ≥ 2) | N days incl. today | "Últimos 7 días (jue 22 – hoy)" |
  | desde el D de <mes> | latest such date ≤ today → today | "Desde el 5 de noviembre (5 nov 2025 – hoy)" |

  Dates read "<wd> <d>" in ranges of ≤7 days, otherwise "<d> <mon>"; a date outside today's year adds its year. Future days are never counted. Over 366 days is clamped to the last 366 with the clamp line. A date cue (Terms) that forms no recognized phrase (e.g. "hace dos semanas", "desde el 31 de febrero", "el mes anterior") uses the default period with the lead line "No entendí la fecha; te muestro <periodo>." (<periodo>: "tu último registro", "esta semana" or "hoy"). A period noun outside a time-range construction is not a cue: no fallback line, default period. Weekly progress is always this week ("la semana" alone means it).
  - Given each row's phrase, then its label shows. Given "últimos 400 días", then 366 days and the clamp line. Given "¿Cuánta agua tomé hace dos semanas?", then today's water with the "No entendí la fecha" line.
  - Given the starter "Mi avance de la semana", then this week's progress shows with no "No entendí la fecha" line. Given "¿Cuántos días hice ejercicio?" or "¿Cuántas veces entreno a la semana?", then this week's exercise shows with no fallback line.
  - Given "¿Cuántos días hice ejercicio en el mes?", then "Este mes (1 oct – hoy)" shows with no fallback line. Given "¿Cuánta agua tomé en la semana?", then today's water plus the week line show with no fallback line.
- **REQ-15:** Defaults with no date cue: weight → the latest record ≤ today, labeled by its date; exercise → this week; water and meals → today plus a week-total line. An explicit cue wins; explicit "hoy" gives today only, with no week line.
  - Given "¿Cuánta agua llevo?", then today's glasses plus "Esta semana (lun 26 – hoy): …" show. Given "¿Cuánta agua tomé hoy?", then no week line. Given "¿Cuánta agua tomé ayer?", then only "Ayer (mar 27 oct)" shows.
- **REQ-16:** Weekly numbers (exercise days; water liters = Σ min(glasses, goal) × 0.25; meals done against slots × 7; weight change = latest this week minus the last weight before Monday) come from one domain computation used by the chat and the dashboard. The dashboard display is unchanged.
  - Given seeded logs, then the chat's week numbers equal the dashboard tiles' (parity e2e).
- **REQ-17:** Water. Today: glasses and liters against the goal, uncapped (as logged), plus the week line. A range: total liters, the daily average over every day in the range, and the days the goal was met. Week and range totals count each day at most the goal, as the dashboard's weekly total does, so the two never disagree (REQ-16).
  - Given 6 glasses today, goal 8 and 4.5 L this week, then "Hoy llevas 6 vasos de agua (1.5 litros) de tu meta de 8 vasos." and "Esta semana (lun 26 – hoy): 4.5 litros." show. Given 10 glasses today and goal 8, then "10 vasos" and "2.5 litros" show, and the week line counts today as 2 litros.
- **REQ-18:** Exercise. Week: days done, the goal, and remaining = max(0, goal − done), or the "met" line when done ≥ goal. Today: "Hoy sí hiciste ejercicio." or "Hoy no has registrado ejercicio."; another single day: "<Periodo>: sí hiciste ejercicio." or "<Periodo>: no registraste ejercicio." Other ranges: days exercised, compared with the goal only for a full Mon–Sun week.
  - Given goal 4 and 2 days done, then "… llevas 2 de 4 días de ejercicio. Te faltan 2 días." Given 3 done, then "Te falta 1 día." Given "¿Hice ejercicio hoy?" and no exercise today, then "Hoy no has registrado ejercicio." shows (never "0 días").
- **REQ-19:** Weight. The latest weight and its date; then the distance to the goal, or "meta alcanzada" once progress from the first weight reaches 100% (as the dashboard gauge); with no goal, "No has fijado meta de peso." and "Fijar mi meta". Then the week line, only when a record exists this week and one before Monday: bajaste/subiste, or "sin cambio" for 0. A last record over 7 days old adds "Tu último registro fue hace <n> días." and "Registrar mi peso". A range: first and last weights, the change, minimum and maximum.
  - Given 66.2 kg on 26 oct, goal 63 and 66.6 kg before Monday, then "Tu último peso es 66.2 kg (26 oct). Te faltan 3.2 kg para tu meta de 63 kg. Esta semana bajaste 0.4 kg." Given no record this week, then no week line.
- **REQ-20:** Meals done. Today: done against the slot count. This week: dashboard parity (× 7). Other ranges: done against slots × days, with a whole-number %.
  - Given 5 slots and 3 marked today, then "Hoy llevas 3 de 5 comidas." shows.
- **REQ-21:** A bare goal question lists the plan objective, weight, exercise and water goals; "de peso", "de ejercicio" or "de agua" narrows to that goal.
  - Given "¿Cuál es mi objetivo de agua?" and 2 L, then only "Tu meta de agua es 8 vasos (2 litros) al día." shows.
  - No active plan: the bare goal answer omits the plan objective, uses the 2 L default water goal (8 vasos), and adds the line "Aún no tienes un plan activo." with "Subir mi plan". A narrowed goal has no plan line. Given no active plan and "¿Cuál es mi meta?", then weight, exercise and "Agua: 8 vasos (2 litros) al día", the no-plan line and "Subir mi plan" show.
- **REQ-22:** Weekly progress: one block with this week's exercise, water, meals and weight change; the weight item is omitted when no change is computable (REQ-19), and reads "sin cambio" for 0. With no active plan, the meals item ("D de N") is omitted, water uses the 2 L default goal, and the line "Aún no tienes un plan activo." with "Subir mi plan" is added.
  - Given "Mi avance de la semana" with weights on both sides of Monday, then 4 items show, each matching the dashboard; with no weight this week, then 3. Given no active plan, then no "Comidas" item, the no-plan line and "Subir mi plan" show.

### US4 (P2): Chat-like edge cases
As the user, I want the assistant to behave sensibly with small talk, compound or vague questions and missing data.

- **REQ-23:** A message made only of greeting or thanks words gets a short reply plus the starters. A greeting before a question is ignored.
  - Given "hola", then a greeting and 4 buttons show. Given "Hola, ¿cuánto peso?", then the weight answer shows.
- **REQ-24:** Up to 2 topics are answered, one titled block each (Topics "Title"), in question order. Further topics become their topic buttons; a further topic with no button is omitted silently. A 2-block answer carries the second block's follow-ups, then the overflow buttons. At most one block holds option buttons: if both topics would list options, the first is answered and the second offered as its button. Greeting, clarification, did-you-mean and no-match answers stand alone; a later topic needing a clarification is omitted.
  - Given "agua, ejercicio y peso", then the "Agua" and "Ejercicio" blocks show, plus "Mi peso". Given "¿Qué puedo desayunar y cenar?", then desayuno options and a "¿Cuál es mi cena?" button show.
- **REQ-25:** Ambiguous progress asks "¿Te refieres a agua, ejercicio o comidas?" with Agua → "¿Cuánta agua llevo?", Ejercicio → "¿Cuánto ejercicio llevo?", Comidas → "¿Cuántas comidas llevo?". A dish cue with no dish asks "¿De qué platillo?" with up to 3 non-generic recipe buttons ("¿Qué lleva <receta>?"), or slot buttons when there are no non-generic recipes.
  - Given "¿Cuánto llevo?", then the question and 3 buttons show.
- **REQ-26:** Dish not resolved (REQ-3). Several candidates: "No encontré exactamente '<frase>'. ¿Quisiste decir…?" with up to 3 buttons, each sending "¿Qué lleva <receta>?". None: "No encontré '<frase>' en tu plan ni en tus recetas." with the Recipes follow-ups. '<frase>' is the dish phrase as typed, without the cue and leading article.
  - Given "¿Qué lleva la pizza?", then the not-found lead quotes "pizza". Given "¿Qué lleva el pollo?", then the did-you-mean lead and 2 buttons.
- **REQ-27:** Missing data gets an honest reply:
  - No weight logs: "Aún no registras tu peso." + "Registrar mi peso" (/). No weight goal: REQ-19.
  - No active plan, for plan, slot, meals-done or identity-plan questions: "Aún no tienes un plan activo." + "Subir mi plan" (/plans). Goals and weekly progress answer without the plan-dependent lines (REQ-21, REQ-22). Water and exercise goals always exist (Terms).
  - Slot word not in the plan: "Tu plan no tiene <slot>." + a slot button per plan slot (the starters if the plan has none). Slot with no options: "Tu plan no tiene opciones para tu <slot>."
  - An empty range states its period ("<Periodo>: no registraste tu peso."; other metrics show 0 with the label).
  - Given no weight logs, when I ask "Mi peso", then the empty state and its button show. Given a plan without cena, when I ask "¿Qué puedo cenar?", then "Tu plan no tiene cena." and one button per slot.
- **REQ-28:** Answers with listed variants pick one deterministically from the normalized question; numbers and units are identical across variants.
  - Given the same question twice, then the same variant shows both times.
- **REQ-29:** No match: when similar recipe names exist (REQ-3 threshold, whole question minus stop words), "¿Quisiste decir…?" with up to 3 buttons; otherwise "No entendí tu pregunta. Puedo ayudarte con:" with the starters.
  - Given "¿Cuál es la capital de Francia?", then the no-match lead and 4 buttons show.

### US5 (P3): Identity
- **REQ-30:** "¿Cómo me llamo?" → "Te llamas **<nombre>**."; a blank name → "Aún no tengo tu nombre registrado."
  - Given user "Rafael", then "Te llamas Rafael." shows with "Rafael" highlighted.
- **REQ-31:** "¿Cómo se llama mi plan?" → "Tu plan activo se llama **<plan>**." with a trailing ".pdf" removed in any case. "¿Cuál es mi plan?" → the existing plan summary with the plan name in the lead. No active plan → REQ-27.
  - Given "Plan octubre.PDF", then "Tu plan activo se llama Plan octubre." shows.

### US6 (P3): Conversation UI
- **REQ-32:** User turns: right-aligned bubbles on the primary (inverted) surface, ≤80% of the log width, no avatar. Assistant turns, including errors: left-aligned bubbles on the muted surface, each with a 32 px circular avatar showing the lucide `Bot` icon, hidden from assistive tech; the bubble spans the rest of the width and option buttons stretch to it. In both themes, bubble text meets 4.5:1 and each bubble's boundary 3:1 against the log. A 500-character message and an unbroken 80-character token wrap in both bubbles at 360 px with no horizontal overflow.
  - Given a question and its answer, then they sit on opposite sides and only the answer has an avatar. Given 360 px, then no element overflows horizontally. Given each theme, then the contrast check reports zero violations.
- **REQ-33:** Only the first lead of a newly arrived answer types out, within 1 s; then sections and buttons fade in within 200 ms (buttons appear only once typing completes). Tapping the answer completes it at once; keyboard users need nothing, as the live region holds the full text. Typing never replays on reopen, navigation or re-render. Scroll decisions (chat-polish REQ-11) use the answer's final height. Under reduced motion everything appears at once. The live region announces the full answer exactly once; buttons stay outside it (chat-polish REQ-17), and for options it includes the count and labels as text ("3 opciones: …").
  - Given a long lead, then it is fully shown ≤1 s after arrival. Given reduced motion, then the full answer is present immediately. Given an options answer, then the live region text includes "3 opciones" and the 3 labels and changes once. Given I close and reopen the panel, then no lead types again.
- **REQ-34:** Every button uses one component; option lists use its vertical full-width variant. Labels wrap without truncation and grow in height (≥44 px at ≤640 px). Question buttons appear under the latest answer only and, while a request is pending, are `aria-disabled` (still focusable; activation sends nothing). Navigation buttons are real links, stay on their answer, and show `ArrowUpRight` after the label, hidden from assistive tech, so the accessible name equals the label. Every navigation button ("Ver receta completa", "Registrar mi peso", "Fijar mi meta", "Subir mi plan") closes the sheet at ≤640 px; when already on the destination it only closes the sheet (focus to the FAB).
  - Given two answers, then only the last has question buttons, and "Ver receta completa" on the first still works. Given 360 px on `/`, when I activate "Registrar mi peso", then the sheet closes and the FAB is focusable.
- **REQ-35:** Keyboard and focus. The new buttons and links are in the chat-polish touch-target (≥44×44 px at ≤640 px) and focus-ring lists; bubbles, avatar and the arrow icon join its contrast list. Bubbles and the avatar are not interactive and not keyboard-focusable; the focus ring applies only to buttons and links. Tab order follows visual order; Enter activates buttons and links, Space activates buttons. After an option, paging, slot, clarification or did-you-mean button, focus follows the chat-polish chip rule. A navigation link that navigates leaves focus to the destination page: at ≤640 px the sheet closes (FAB available); on desktop the panel stays open and focus moves to the destination page's main heading or content, as in normal navigation.
  - Given 360 px, when I activate an option button, then focus is on the log while pending, then on the new turn. Given desktop, then focus is on the input.
  - Given desktop, when I activate "Ver receta completa", then the recipe page shows, the panel stays open, and focus is in the page's main heading or content.

## Edge cases and errors

- Errors (chat-polish REQ-23): HTTP 500 → "Algo salió mal al responder. Intenta de nuevo." with Reintentar; invalid input → 400.
- "Mi cena de hoy": slot answers ignore date cues, so this shows the cena options (REQ-6).

## Copy (Spanish, Mexico)

Variants separated by "|"; the first is canonical. **Bold** = highlighted.

- Greeting: "¡Hola! ¿En qué te ayudo?" | "¡Hola! ¿Qué quieres saber?" | "¡Hola! Pregúntame por tu plan, tu avance o tu carrito." Thanks: "¡Con gusto!" | "¡De nada!" | "Para eso estoy."
- No match: "No entendí tu pregunta. Puedo ayudarte con:" | "Perdón, no entendí. Puedo ayudarte con:" · "¿Quisiste decir…?" · "No encontré exactamente '<frase>'. ¿Quisiste decir…?" · "No encontré '<frase>' en tu plan ni en tus recetas."
- Clarify: "¿Te refieres a agua, ejercicio o comidas?" · "¿Te refieres al desayuno o a la comida?" · "Tienes <n> <slots>. ¿Cuál?" · "¿De qué platillo?"
- Slots: "Estas son tus opciones de <slot>:" | "Para tu <slot> puedes elegir:" | "Tus opciones de <slot> son:" · "Ver más opciones" · "Opciones anteriores" · "Opción <n>: <a>, <b>, <c>…" · "Tu <slot> tiene <n> opciones." · "Tu plan no tiene <slot>." · "Tu plan no tiene opciones para tu <slot>." · "Tu horario de <slot>: **<time>**." | "Tu <slot> es: **<time>**." · "Tu plan no tiene horario para tu <slot>."
- Detail: "**<receta>** lleva:" | "Esto lleva **<receta>**:" · sections "Ingredientes", "Preparación", "Acompaña con" · "Esta receta no tiene preparación registrada." · "Ver receta completa"
- Water: "Hoy llevas **<g> vasos** de agua (**<l> litros**) de tu meta de <G> vasos." | "Hoy has tomado **<g> vasos** de agua (**<l> litros**) de tu meta de <G> vasos." · "Esta semana (<…>): **<L> litros**." · "<Periodo>: **<L> litros** en total, **<a> litros** por día en promedio. Cumpliste tu meta **<d> de <n> días**."
- Exercise: "Esta semana (<…>) llevas **<d> de <G> días** de ejercicio. Te faltan **<r> días**." | "Esta semana (<…>) has hecho ejercicio **<d> de <G> días**. Te faltan **<r> días**." · "¡Ya cumpliste tu meta de <G> días de ejercicio esta semana!" · "<Periodo>: hiciste ejercicio **<d> días**." (full week: "**<d> de <G> días**") · single day: "Hoy sí hiciste ejercicio." · "Hoy no has registrado ejercicio." · "<Periodo>: sí hiciste ejercicio." · "<Periodo>: no registraste ejercicio."
- Weight: "Tu último peso es **<w> kg** (<fecha>)." | "Tu registro más reciente es **<w> kg** (<fecha>)." · "Te faltan **<x> kg** para tu meta de <m> kg." · "¡Ya alcanzaste tu meta de <m> kg!" · "Esta semana bajaste|subiste **<c> kg**." · "Esta semana: **sin cambio**." · "Tu último registro fue hace <n> días." · "<Periodo>: empezaste en **<a> kg** y terminaste en **<b> kg** (bajaste|subiste <c> kg; mínimo <min> kg, máximo <max> kg)." · "<Periodo>: registraste **<w> kg** (<fecha>)." · "<Periodo>: no registraste tu peso."
- Meals: "Hoy llevas **<d> de <n> comidas**." | "Hoy has hecho **<d> de <n> comidas**." · "Esta semana (<…>): **<D> de <N> comidas** (<p>%)." · "<Periodo>: **<D> de <N> comidas** (<p>%)."
- Goals: "Estas son tus metas:" with section "Metas": "Objetivo del plan: <objetivo>", "Peso: **<m> kg**" or "Peso: sin meta", "Ejercicio: **<G> días** por semana", "Agua: **<G> vasos** (<l> litros) al día" · "Tu meta de peso es **<m> kg**." · "Tu meta de ejercicio es **<G> días** por semana." · "Tu meta de agua es **<G> vasos** (<l> litros) al día."
- Weekly progress: "Tu avance de esta semana (<…>):" with section "Avance": "Ejercicio: **<d> de <G> días**", "Agua: **<L> litros**", "Comidas: **<D> de <N>**", "Peso: bajaste|subiste **<c> kg**" or "Peso: sin cambio"
- Identity and plan: "Te llamas **<nombre>**." · "Aún no tengo tu nombre registrado." · "Tu plan activo se llama **<plan>**." · plan lead "Tu plan activo es **<plan>**. Tu objetivo: <objetivo>"
- Empty and dates: "Aún no registras tu peso." · "No has fijado meta de peso." · "Aún no tienes un plan activo." · "Registrar mi peso", "Fijar mi meta", "Subir mi plan" · "Solo puedo revisar hasta 366 días; te muestro los últimos 366." · "No entendí la fecha; te muestro <periodo>."
- Numbers: at most 1 decimal with "." and no trailing ".0"; percentages whole. Singular at exactly 1: "1 vaso", "1 litro", "1 día", "Te falta 1 día", "1 opción" ("Tu cena tiene 1 opción."), "<d> de 1 comida"; "<n> opciones" announced likewise. "Tienes <n> <slots>" always has n ≥ 2 (colaciones, cenas, comidas, desayunos). "hace <n> días" only for n > 7. kg is invariant.

## Non-functional requirements

- Dependencies: only fuse.js 7.5.0 (see Scope). No schema change and no migration.
- Performance: each answer within 1 s server time on the real dataset (32 recipes, 69 meals, 1 year of logs) on the dev machine. Split, because machine and data variance make a hard automated 1 s bound flaky: the automated check runs on a synthetic dataset of that volume, asserts ≤5 s per answer and logs the timings; the ≤1 s bound on the real data is verified manually by the user before the branch merges and noted in the batch report.
- Motion: typing ≤1 s (exempt from chat-polish's 200 ms cap), fades ≤200 ms, nothing animated under `prefers-reduced-motion`. chat-polish AA contrast and 44×44 px touch minimums apply, extended by REQ-32 and REQ-35.
- Testability (Constitution 1): every REQ has an e2e test that fails before and passes after. Required: the REQ-2 and REQ-3 tables, chat/dashboard parity, the REQ-14 table with a pinned date, empty states, multi-topic, paging, reduced motion, and chat-polish REQ-23. The scope tests are removed or rewritten. No REQ counts as covered by the test-only `resolved` field alone (contract); every REQ's test asserts the visible answer text or buttons. The REQ-3 table runs on its seeded fixture, never on the user's recipes.
- Snapshots: the assistant-panel and dashboard-search-bar visual snapshots are refreshed twice, each time only with the user's explicit yes: after the scope removal (mid-feature) and at the end of the feature.

## Out of scope

MCP; external AI; conversation memory; logging data from the chat; persisted history; server streaming; dashboard display changes; `src/server.js` (legacy dev only); the nutrition normalizers behind persisted recipe fingerprints and ingredient keys, and the dashboard's own normalizer (changing them would change stored hashes and duplicate recipes on PDF re-upload); moving the dashboard to the server date.

## Assumptions

- Water ranges cap each day at the current goal, and "days met" uses the current goal; averages divide by every day in the range. Today's count is shown uncapped (REQ-17).
- A network failure, the 15 s timeout, a 400 and any other non-500 non-2xx keep "No pude responder en este momento."; only HTTP 500 uses the new copy (chat-polish REQ-8, REQ-23).
- Short replies like "ok", "sí" or "adiós" get the no-match reply; acceptable.
- The dashboard uses the browser's local date and the chat the server date in America/Mexico_City; they agree while the browser is in that time zone. The dashboard is not moved to the server date (Out of scope).
- The dashboard cannot log days that have not arrived, so the shared weekly computation (REQ-16) takes an end day: the dashboard passes Sunday, the chat passes today. Since no future day has data, the results are identical and REQ-16 parity is unaffected.

## Open questions

None. Copy variants, leads and all former defaults were confirmed by the user on 2026-10-28 (see Decisions).

## Progress

- [ ] US1 (P1): REQ-1 to REQ-6
- [ ] US2 (P1): REQ-7 to REQ-12
- [ ] US3 (P2): REQ-13 to REQ-22
- [ ] US4 (P2): REQ-23 to REQ-29
- [ ] US5 (P3): REQ-30, REQ-31
- [ ] US6 (P3): REQ-32 to REQ-35
- [ ] chat-polish REQ-23 (500 versus 400), delivered on this branch

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-28 | Initial spec from grilling; supersedes parts of assistant-chat-polish (see its v1.9) |
| 1.1 | 2026-10-28 | Verify round 1: Scope section delivers chat-polish REQ-23; general typo rule with first-letter and never-fuzzy words, more negatives (REQ-2); dish matcher table and found/several/none outcomes (REQ-3, REQ-26, REQ-29); ordinal slot refs, symmetric paging with "Opciones anteriores", out-of-range cases (REQ-9 to REQ-11); identity, meals-done and phrase consumption in resolution order (REQ-6); block titles and 2-block button rules (REQ-24, Topics); date label table, N=0/1, years, unrecognized dates (REQ-14, REQ-15); missing-data cases (REQ-7, REQ-19, REQ-22, REQ-25, REQ-27); test-env guard Given (REQ-13); bubble roles and contrast, avatar, wrap (REQ-32); typing replay and scroll height (REQ-33); repeat rule scope (REQ-5); frozen filter words, ingredient format, pluralization; scope orphans (REQ-4); nav links, aria-disabled, sheet close (REQ-34); new REQ-35 keyboard and focus; US2 single P1; Assumptions and Edge cases deduplicated; defaults to confirm listed |
| 1.2 | 2026-10-28 | Verify round 2: period nouns are date cues only in a time-range construction, no fallback for "Mi avance de la semana" and similar (Terms, REQ-14); "plan" as possessor, Plan topic only alone, every button message re-checked against REQ-6 (Topics, REQ-6); never-fuzzy "cuánto" forms (Terms, REQ-2); exact recipe name beats slot reading (REQ-6); no-active-plan Goals and Weekly progress (REQ-21, REQ-22, REQ-27); placeholder "Pregunta por tu plan, tu avance o tus compras" (REQ-4); ordinals to Décima and "<Slot> <n>", typed ordinals and "colación 2" (Terms, REQ-11); today's water uncapped vs capped totals, single-day exercise copy (REQ-17, REQ-18, Copy); desktop focus after navigation (REQ-35); defaults list updated |
| 1.3 | 2026-10-28 | Verify round 3 + user confirmation: "en el mes" is a time-range construction (= this month), "en la semana" is not, matching the REQ-14 row (Terms, REQ-14 Given); goal word + "plan" with no metric counts as Plan (Topics); copy and all defaults confirmed by the user and moved into Decisions; Open questions empty |
| 1.4 | 2026-10-28 | Spec-change (user decision): normalizer narrowed to the assistant and the shared recipe-step splitter; nutrition fingerprint/ingredient-key and dashboard normalizers out of scope (Decisions, Out of scope); per-page subtitle is a label only (REQ-4, Decisions); test-only `resolved` diagnostic, never in production, never sufficient coverage alone (Decisions, NFR, contract); assumptions on browser vs server date and the end-day parameter of the shared weekly computation (Assumptions, Out of scope); contract header v1.4, client status handling, 400 for invalid or unparsable bodies |
| 1.5 | 2026-10-28 | Spec-change (user decision): REQ-3 table runs on a deterministic seeded fixture (19 generic names, table recipes, distractors); the real recipe set is used only in the one-off threshold spike outside the repo (REQ-3, Decisions, NFR Testability); performance split into an automated synthetic-data check (≤5 s, timings logged) and a manual ≤1 s check on real data by the user before merge (NFR, Decisions); bubbles and avatar not focusable, focus ring only on buttons and links (REQ-35, Decisions); panel and search-bar snapshots refreshed twice with the user's yes (NFR Testability, Decisions); contract header v1.5 |
