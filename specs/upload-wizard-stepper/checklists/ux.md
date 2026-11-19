# Checklist: UX (accessibility, responsive) for upload-wizard-stepper

Requirement-quality checks. Each item checks whether the **spec** is complete, clear, and measurable, not whether the code works. Unchecked items block spec approval.

Round 7, evaluated against spec v1.3.2 (approved). Result: 61/61 passed (the identical-rejection item was ticked by the orchestrator after the Q24 sentence was added to REQ-22). The 54 earlier items still pass against v1.3.2; 7 items added for the shared inline Alert.

## Completeness

- [x] Are the step list, labels, descriptions and order defined? [REQ-1]
- [x] Are layouts defined for both desktop and compact widths? [REQ-2]
- [x] Is navigation between steps (pointer, keyboard, Anterior/Siguiente) defined? [REQ-3, REQ-5]
- [x] Are empty states defined (no meals, meal without options, no supplements or recommendations)? [REQ-8, REQ-10, REQ-12]
- [x] Is the error state of the stepper defined, with singular and plural captions? [REQ-10]
- [x] Are screen-reader roles, status text, live announcements and keyboard keys defined? [REQ-6]
- [x] Is reduced-motion behavior defined for the stepper? [REQ-7]
- [x] Is a loading/progress state defined for the upload ("Subiendo", "Procesando PDF"), the draft deletion and "Confirmar plan"? [REQ-14, REQ-23]
- [x] Is the failure state of "Confirmar plan" defined (message, where the user lands, edits kept)? [REQ-15]
- [x] Is focus management on step change defined? [REQ-16]
- [x] Is the accessible pattern for collapsible meal cards defined? [REQ-20]
- [x] Is behavior defined for closing the wizard, or for the row ✕ on a processed file, with unsaved edits on Datos? [REQ-4, REQ-17, Edge cases]

## Clarity

- [x] Is "completed" defined, including which steps stay selectable after jumping back? [REQ-3]
- [x] Are legibility and visible focus measurable in light and dark themes? [REQ-19: 4.5:1 text, 3:1 non-text and focus ring]
- [x] Is "visually highlighted" defined with a cue that does not rely on color alone? [REQ-9: "Requiere revisión" label]
- [x] Are touch target sizes for compact markers, card headers and footer buttons specified? [REQ-19: 44px]
- [x] Is the compact threshold defined with a number? [REQ-2: 937px]
- [x] Is the rail width defined? [REQ-2: 200px]

## Consistency

- [x] Do REQ-3 (locked upcoming steps) and REQ-6 (focus among reachable steps) agree? [REQ-3, REQ-6]
- [x] Do REQ-4 and the edge cases agree on the back-on-Subir behavior? [REQ-4, Edge cases]
- [x] Do REQ-10 (error does not block) and REQ-5 (Confirmar always available) agree? [REQ-5, REQ-10]
- [x] Is the post-confirm behavior defined, with "Todos los pasos completos" dropped? [Decisions, REQ-15]
- [x] Do REQ-17 ("X closes immediately") and the disabled X while busy agree? [REQ-14, REQ-17]
- [x] Do REQ-14 (only the row ✕ is enabled during "Subiendo") and REQ-23 (✕ cancels, no ✕ while processing) agree? [REQ-14, REQ-23]
- [x] Do REQ-16 and REQ-23/24 agree on focus after cancel, failed upload and removal (dropzone, "Reintentar")? [REQ-16, REQ-23, REQ-24]
- [x] Is the server-413 presentation settled (rejection alert, row removed, focus on the dropzone), with no open question left? [REQ-26, Decisions, Open questions]
- [x] Does the REQ-14 per-phase table agree with REQ-16, 23, 24 and 26 for every phase (controls, focus, ✕ present or absent)? [REQ-14, REQ-16, REQ-23, REQ-24, REQ-26]
- [x] Does REQ-22 "the current file and its state are unchanged" agree with a server 413, which removes the row? [REQ-22, REQ-26, Decisions] (REQ-22 now limits "unchanged" to browser-side rejections and states that a 413 removes the row)

## Edge cases

- [x] Behavior when upload or processing fails, or no PDF is added? [REQ-24, Edge cases]
- [x] Behavior when a meal has no options, or no meals are detected? [REQ-8, REQ-10]
- [x] Is behavior defined for an empty name on Datos? [REQ-11, REQ-5]
- [x] Is overflow behavior defined for long content (scroll region, 390px, no horizontal scroll)? [REQ-18]
- [x] Does stepper state (error marker, counts) reset or recompute after the row ✕ removes a processed file? [REQ-4]
- [x] Is a busy/in-progress state defined for the draft deletion by the ✕? [REQ-14 second scenario]
- [x] Is focus placement defined after the ✕ on a processed file and after a failed confirm or failed deletion? [REQ-4, REQ-16]

## Dropzone (v1.3)

- [x] Is the drag-over state defined (prompt text "Suelta el PDF para subirlo", return to normal on leave), and covered by contrast and reduced motion? [REQ-21, REQ-19, REQ-25]
- [x] Is keyboard use defined (Enter or Space opens the picker, picker cancelled does nothing, whole target is one button) and paste (⌘V/Ctrl+V with pointer or focus on the target, text-only clipboard ignored)? [REQ-21]
- [x] Is use without drag defined for touch (picker through the single-button target, 44px target in compact)? [REQ-21, REQ-19]
- [x] Are progress and status announcements defined (progress bar with value, polite region for addition, completion and failure)? [REQ-23, REQ-25]
- [x] Are rejection alerts defined (four messages, check order including the empty file, role alert, one at a time, lifetime)? [REQ-22, REQ-25]
- [x] Is focus defined after cancel (✕ during "Subiendo"), after a failure ("Reintentar"), after removing a failed or processed row (dropzone) and after a failed deletion (✕)? [REQ-16, REQ-23, REQ-24, REQ-4]
- [x] Is focus defined when the cancel ✕ disappears at 100% (dropzone, only if it had focus) and after "Reintentar" is selected (dropzone)? [REQ-16, REQ-24]
- [x] Is focus defined after a server 413 removes the row and shows the alert (dropzone)? [REQ-16, REQ-26]
- [x] Is the display of long file names defined (one line, ellipsis, full name in accessible name and tooltip, size and ✕ visible, no horizontal scroll at 390px)? [REQ-23]
- [x] Are ✕ and "Reintentar" at least 44px by 44px in the compact layout, and do they show a focus ring? [REQ-19]
- [x] Is reduced motion defined for the indeterminate bar and drag-over transitions, with text still conveying the state? [REQ-25]
- [x] Is contrast defined for the dashed dropzone outline and the progress bar (3:1 non-text), and for the dropzone text and failure message (4.5:1), in light and dark? [REQ-19]
- [x] Do the dropzone, the row and the failure state work in both themes? [REQ-19, REQ-25]
- [x] Is the cancel guarantee defined (no draft and no stored copy before 100%, accepted same-instant edge case, late completion does nothing)? [REQ-23, Decisions]
- [x] Is the 0-byte file rejection defined, with its message and its place in the check order? [REQ-22]
- [x] Do the failure message and "Reintentar" fit at 390px without horizontal scroll? [REQ-18 (general no-horizontal-scroll rule), REQ-23]
- [x] Is a connection error with no HTTP status (proxy closes the connection mid-upload, network drop) defined as a failed row? [REQ-24 (no-response failures and the early-413 caveat)]
- [x] Is the accessible name of the row ✕ defined in the uploading, failed and processed phases? [REQ-4, REQ-23, REQ-24]
- [x] Is focus defined while the control that triggered a request is busy (✕ during deletion, "Confirmar plan" while confirming)? [REQ-14, REQ-16] (REQ-16: the control shows busy, and when the request ends focus goes to the named target, never the page body)

## Inline alerts (v1.3.2)

- [x] Is the role of each inline message defined (rejections interrupt; delete and confirm failures are polite; upload failure is the row, not an alert)? [REQ-25, Decisions]
- [x] Is "announced once" defined for the delete failure and the confirm failure, with a repeated confirm failure announced again? [REQ-4, REQ-15, REQ-25]
- [x] Is the placement of each alert defined (under the dropzone, under the row, above the footer)? [REQ-4, REQ-15, REQ-22]
- [x] Is the alert lifetime defined with no dismiss button (next file, ✕, "Reintentar", next attempt, next press, step change, wizard closes)? [REQ-4, REQ-15, REQ-22]
- [x] Is alert contrast defined (text 4.5:1; icon and edge 3:1; light and dark)? [REQ-19]
- [x] Is reduced motion defined for the alert appearing and disappearing? [REQ-25]
- [x] Is it defined whether an identical rejection arriving while the same one is open is announced again? [REQ-22: yes, the alert closes briefly and reopens and the message is announced again (Q24, spec v1.3.2)]
