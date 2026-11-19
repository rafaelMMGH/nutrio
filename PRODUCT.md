# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People following a meal plan from their nutritionist, delivered as a PDF. Today the only user is the owner, signed in through a local demo login. NUTRIO is meant to become a public product for other patients with a nutritionist's plan. Multi-user support and real authentication are on the roadmap but not built yet.

Their job: follow the plan day to day without reopening the PDF. That means knowing what to eat next and when, cooking the plan's options, buying the right ingredients, and logging water, weight and exercise.

## Product Purpose

NUTRIO reads a nutritionist's PDF plan once and turns it into a daily meal schedule with check-offs, a recipe book built from every meal option, and a shopping list that adds up ingredients across the days being planned. Water, weight and exercise tracking sit alongside.

Success means the user follows the plan from NUTRIO and never goes back to the PDF.

## Positioning

The nutritionist's plan is the authority. Every meal, option, amount, equivalent and macro comes from the uploaded PDF. There is no generic food database and no calorie counting. NUTRIO turns a professional's prescription into something you can act on; it does not replace the professional.

The user's plan, logs and PDFs live in storage they control (their own Postgres and disk), not in a third-party service.

## Operating Context

- Used mostly on desktop: planning the week, building shopping lists, reviewing the plan. It still works on tablets and phones, where the layout stacks below 938px.
- Input: a two-column PDF from one nutritionist. It has meals with time windows ("Entre 7 a 8 am"), "OPCION n" dishes with ingredient lines, "Acompañar tus X con…" add-ons, a "MIS EQUIVALENTES" food-group table, and kcal, macros and water targets. Every upload goes through a review wizard before anything is saved.
- Daily routine: check meals off, log water glasses, weight and exercise days, then see the weekly report and streak.
- Grocery routine: plan a period, combine ingredients into a cart, generate lists, and save frequent lists as templates.
- Cooking: a dedicated cooking mode route.

## Capabilities and Constraints

- Next.js 15 + PostgreSQL (Prisma 7), self-hosted. Node 20 pins the versions of Playwright, unpdf and Prisma.
- Features: multiple plans with versions (one is active), recipe book with search and meal-type filters, cart, lists and templates, a rule-based assistant over the user's own plan, recipes and cart, a trash with restore (soft delete), a public landing page, login, privacy and terms pages, and a 404 page.
- UI copy is Spanish (Mexico). Specs and docs are in English.
- Undecided: whether the assistant stays rule-based or uses an external AI. It runs fully local today, but that isn't a binding commitment.
- Undecided: how being a "public product" fits with "self-hosted, private data" (hosted multi-tenant, or each user deploys their own).
- Undecided: localization beyond es-MX.
- The PDF parser is tuned to one nutritionist's layout. Support for other layouts is not built yet.
- Uploaded PDFs are saved to local disk (`data/private-pdfs`), which won't persist on serverless hosting.

## Brand Commitments

- Product name: **NUTRIO**. "Nutritional Manager" is only the repo and package name.
- Voice: plain, second-person Spanish (Mexico) with "tú", e.g. "Sigue tu plan de alimentación sin volver a abrir el PDF."
- Assets: `src/app/icon.svg`, food illustrations in `public/food/` (Microsoft Fluent 3D emoji, MIT).

## Evidence on Hand

- README screenshots in `docs/screenshots/` (home, weight popover, recipes, recipe detail, landing, login, mobile home). They use sample data.
- No testimonials, user counts, nutritionist endorsements, press or pricing exist. Future work must not invent them.

## Product Principles

1. **The plan is the authority.** Show and compute what the nutritionist prescribed. Don't add generic nutrition advice or calorie math on top.
2. **Never make the user reopen the PDF.** Any fact in the plan should be reachable in the app, in the right moment (next meal, cooking, shopping).
3. **Review before trusting.** Parsed data goes through user review. Mistakes in the plan must be visible and fixable, never silently saved.
4. **The user's data stays theirs.** Plans, logs and PDFs stay in storage the user controls. Deletion is recoverable through the trash.
5. **Build toward public, honestly.** Single-user shortcuts (demo login, one parser layout) are temporary and must not be presented as finished multi-user features.

## Accessibility & Inclusion

The app already supports `prefers-reduced-motion`, reduced transparency and high contrast. Never pass information through color alone; every indicator carries a label or icon. No formal WCAG level has been chosen yet.
