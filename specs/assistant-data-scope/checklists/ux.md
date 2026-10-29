# Checklist: UX and accessibility for assistant-data-scope

Requirement-quality checks ("unit tests for English"). Each item checks whether the **spec** is complete, clear, and measurable, not whether the code works. Unchecked items block spec approval.

Checked against spec v1.3 (REQ-1 to REQ-35) and contracts/chat-api.md. Accessibility, touch-target, contrast, focus and wrap rules that this spec inherits are in assistant-chat-polish v1.9 (REQ-17, REQ-21, REQ-22, Interaction details); an item is a GAP when the new element is not covered by those lists.

- Round 1 (spec v1.0, REQ-1 to REQ-34): 19 PASS, 18 GAP (0 HIGH, 10 MEDIUM, 8 LOW).
- Round 2 (spec v1.1): 17 GAPs resolved and ticked below with the REQ that now covers them; REQ-35 (keyboard and focus) added.
- Round 3 (spec v1.2): 5 new items, all PASS (marked "v1.2"); 1 GAP left (MEDIUM: copy confirmation by the user).
- Round 4 (spec v1.3): copy GAP resolved (user confirmed copy and all defaults 2026-10-28). Totals: 42 items: 24 PASS, 18 RESOLVED, 0 GAP.

## Option lists, paging and buttons

- [x] PASS: Are the option list (vertical full-width button per option, 3 per page, plan order) and "Ver más opciones" (absent on the last page) specified with a Given/When/Then? [REQ-9]
- [x] PASS: Are the messages that paging buttons send defined for page 2 and page 3+? [REQ-9]
- [x] RESOLVED (v1.1, REQ-9): After "Ver más opciones", question buttons exist only under the latest answer, so options 1-3 stop being tappable. Is it defined whether page 2 offers a way back (previous page or option 1-3)? → pages ≥2 show "Opciones anteriores" (confirmed 2026-10-28). [REQ-9, REQ-34]
- [x] RESOLVED (v1.1, REQ-9): Is behavior defined for a typed paging request past the last page (e.g. "cena, más opciones (página 9)")? → the last page shows. [REQ-9, REQ-10]
- [x] PASS: Are question buttons and navigation buttons told apart by an arrow icon, and navigation buttons defined as links? [Terms, REQ-34]
- [x] RESOLVED (v1.1, REQ-34, Terms): Is the arrow icon's accessibility defined (decorative and hidden from assistive tech, links announced as links, accessible name equals the visible label, which icon and where)? → real links, lucide `ArrowUpRight` after the label, hidden from assistive tech. [REQ-34]
- [x] PASS: Does every point where the chat must ask use closed-answer buttons that resolve to a definite answer, never to another question or no-match? [REQ-5, REQ-7, REQ-25, REQ-26]
- [x] PASS: Is it defined that a button label may differ from the message it sends, and that the message shows as the user turn? [Terms, REQ-9, REQ-25]

## Keyboard, focus and screen readers

- [x] RESOLVED (v1.1, REQ-35): Are the new elements (vertical option buttons, navigation links, assistant bubble, avatar) named in the inherited touch-target (44x44 px), focus-ring and contrast (both themes) lists, with keyboard operation (Tab order, Enter/Space) stated? [NFR, REQ-32, REQ-34]
- [x] RESOLVED (v1.1, REQ-35, REQ-34): Is focus placement defined after activating an option button, "Ver más opciones", a clarification button, and a navigation link (including "Ver receta completa", which closes the sheet at <=640 px)? → chip rule for buttons; navigation leaves focus to the destination page; same-page close focuses the FAB. [REQ-9, REQ-12, REQ-34]
- [x] RESOLVED (v1.1, REQ-34): While buttons are "disabled while pending", is it stated that focus is not lost (aria-disabled vs disabled) and that the state is exposed to assistive tech? → `aria-disabled`, still focusable. [REQ-34]
- [x] PASS: Does the live region announce the full answer exactly once, with a testable Given/Then, despite the typing effect? [REQ-33]
- [x] RESOLVED (v1.1, REQ-33): For option lists the content is buttons, so "the full answer" in the live region may be only the lead. Is it defined what is announced (e.g. the count of options) so screen-reader users know choices exist? → count and labels ("3 opciones: …"). [REQ-9, REQ-33]
- [x] RESOLVED (v1.1, REQ-33): "Tapping the answer completes it" is pointer-only. Is the keyboard or no-pointer case stated, and what happens when the tap lands on a button or link inside the answer? → keyboard needs nothing; buttons appear only after typing completes (confirmed 2026-10-28). [REQ-33]
- [x] PASS: Is reduced motion specified (everything appears at once, nothing animated, full answer present immediately)? [REQ-33, NFR Motion]
- [x] PASS: Are motion bounds numeric (typing finishes <=1 s, fades <=200 ms)? [REQ-33, NFR Motion]
- [x] PASS (v1.2): Is focus defined after a navigation link on desktop (panel stays open, focus to the destination page's main heading or content), with a Given/Then? [REQ-35]
- [x] PASS (v1.2): Is it stated that buttons stay outside the live region while option labels and count are announced as text, and is chat-polish REQ-17 marked amended accordingly? [REQ-33, chat-polish Superseded list]

## Bubble and avatar layout

- [x] PASS: Are user (right, dark, <=80% width, no avatar) and assistant (left, light, avatar) turns specified, with a Given/Then on opposite sides and avatar only on assistant? [REQ-32]
- [x] RESOLVED (v1.1, REQ-32): Avatar details: size, every assistant turn or per run, lucide `Bot`? → 32 px, lucide `Bot`, every assistant turn including errors. [REQ-32]
- [x] RESOLVED (v1.1, REQ-32): "Dark bubble" and "light bubble" are theme-relative. Are the roles defined in both themes beyond "meets WCAG AA"? → user = primary (inverted) surface, assistant = muted surface; text 4.5:1, bubble boundary 3:1, both themes. [REQ-32]
- [x] RESOLVED (v1.1, REQ-32): Is the assistant bubble's width defined at 360 px (max width with the avatar, buttons stretching to the bubble or the log)? → bubble spans the width beside the avatar, option buttons stretch to it, no horizontal overflow at 360 px. [REQ-32, REQ-9]

## Empty states and navigation

- [x] PASS: Are empty states honest and paired with a navigation button for no weight, no weight goal and no plan, and does an empty range state its period? [REQ-27]
- [x] PASS: Does the empty chat show the 4 starter buttons on every page? [REQ-4, Topics]
- [x] PASS (v1.2): Do the starters give definite answers with no fallback line ("Mi avance de la semana" has no "No entendí la fecha")? [REQ-14, Topics]
- [x] PASS (v1.2): With no active plan, are Goals and Weekly progress honest (plan-dependent lines omitted, "Aún no tienes un plan activo." + "Subir mi plan")? [REQ-21, REQ-22, REQ-27]
- [x] RESOLVED (v1.1, REQ-34): Is the mobile behavior defined for "Registrar mi peso", "Fijar mi meta" and "Subir mi plan", including when the user is already on `/`? → every navigation button closes the sheet at ≤640 px; on the destination it only closes the sheet. [REQ-12, REQ-27, contract]
- [x] PASS: Does "Ver receta completa" open the recipe page, close the sheet at <=640 px, and keep working on older answers? [REQ-12, REQ-34]

## Scope removal

- [x] PASS: Are the panel switcher, search-bar menu, scope label, "Alcance" control and "Preguntar en Todo" removed, with assertable Given/Then? [REQ-4]
- [x] PASS: Does a dashboard search-bar question open the panel with the answer, with no scope step? [REQ-4]
- [x] RESOLVED (v1.1, REQ-4): Orphans: narrow header row 2, search-bar placeholder or aria text, stored scope preference? → row 2 removed and "Nueva conversación" sits in row 1; fixed placeholder, unchanged accessible name; no stored preference exists or is added. [REQ-4]

## Error and copy

- [x] PASS: Are the 500 copy, Reintentar, and the kept network and timeout copy defined and distinguished? [Edge cases, Assumptions]
- [x] RESOLVED (v1.3, Decisions): Copy variants and new leads are unconfirmed by the user (Open questions), so the copy is not yet approvable. → user confirmed 2026-10-28; open question removed. [Decisions, Copy]
- [x] PASS: Is the copy consistently Spanish (Mexico), informal tú, with accents (colación, opción) and a canonical first variant? [Copy]
- [x] RESOLVED (v1.1, Copy "Numbers", REQ-18): Pluralization for "Tu <slot> tiene <n> opciones", "Te faltan <r> días", "Tienes <n> <slots>" and "<d> de <n> comidas"? [Copy Numbers, REQ-10, REQ-18]
- [x] PASS: Are units explicit in every metric (kg, litros, vasos, días, %, ingredient "<qty> <unit>") with the decimal format fixed? [Copy, REQ-17 to REQ-20]
- [x] RESOLVED (v1.1, REQ-12): Ingredient lines with no unit or no quantity (e.g. "al gusto")? → "<name> · <qty>", "<name>" alone; "al gusto" only when stored. [REQ-12, Copy]
- [x] PASS: Are number format rules (<=1 decimal, "." separator, no trailing ".0", "hoy") stated? [Copy Numbers]
- [x] PASS (v1.2): Is single-day exercise copy natural (never "0 días") and the search-bar placeholder aligned with what the chat now covers? [REQ-18, REQ-4, Copy]

## Long content

- [x] RESOLVED (v1.1, REQ-34): Is behavior defined for a very long recipe name or a long "Opción <n>: a, b, c…" label in a full-width button? → wraps, no truncation, height grows, ≥44 px at ≤640 px. [REQ-9]
- [x] PASS: Is the many-ingredients case defined (all items shown, no 8-item cap; list cap applies elsewhere with "y <n> más")? [REQ-12, contract]
- [x] RESOLVED (v1.1, REQ-32): Is wrapping with no horizontal overflow stated for a 500-character user message and for the assistant bubble at 360 px? [REQ-32, NFR]

VERDICT (round 4): PASS (0 unchecked items)
