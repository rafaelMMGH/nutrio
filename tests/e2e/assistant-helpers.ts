import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import type { Button, ChatAnswer, Rich, Section } from "../../src/lib/assistant";
import { addOnSpecs, DEFAULT_MEALS, PLAN_NAME, planFixture, slug, TIME_WINDOWS, type SeedLog, type SeedRecipe } from "../shared/assistant-fixture";
import { BUTTON_TOPICS } from "../shared/assistant-buttons";
import { currentWorkerIndex, serverLogPath as workerServerLogPath, sql, workerBaseUrl } from "./database";
import { expect, test as base, watch } from "./fixtures";
import { installToolkit } from "./theme-audit";
import { contrast, effectiveBackground, toRgb, type Theme } from "./theme-helpers";

export { expect } from "./fixtures";
export { PLAN_NAME, type SeedLog, type SeedRecipe };

// Shared by the assistant specs (assistant-*.spec.ts). Every spec file runs as its own user (plan D2), so a spec can
// seed recipes, a cart and a plan without touching the main user's data or the other specs.

// ---------------------------------------------------------------------------------------------------------------------
// Chat user

type ChatUser = { id: string; email: string; token: string };
let chatUser: ChatUser | null = null;

const lit = (value: string) => `'${value.replace(/'/g, "''")}'`;
const json = (value: unknown) => `${lit(JSON.stringify(value))}::json`;

function currentUser(): ChatUser {
  if (!chatUser) throw new Error("createChatUser() must run in beforeAll before the assistant helpers are used");
  return chatUser;
}

/** The id of the current chat user (set by `createChatUser`). */
export function chatUserId(): string {
  return currentUser().id;
}

/**
 * Inserts the spec file's user and a session. `name` makes the email unique per file (asistente-e2e-<name>@local), so a
 * run that crashed before `deleteChatUser` cannot collide with the next one: leftovers are removed first.
 * Login picks the lowest `seq`, so this user never replaces the main one.
 */
export function createChatUser(name: string): ChatUser {
  const key = slug(name);
  const user = { id: `chat-e2e-${key}`, email: `asistente-e2e-${key}@local`, token: randomUUID() };
  chatUser = user;
  removeUserRows(user.id);
  sql(
    `insert into users (id, email, name, created_at, updated_at) values (${lit(user.id)}, ${lit(user.email)}, ${lit(`Asistente ${key}`)}, now(), now());` +
      `insert into sessions (token, user_id) values (${lit(user.token)}, ${lit(user.id)});` +
      // The app's first-user seed creates an empty active cart; the chat code expects one to exist.
      `insert into carts (id, user_id, status, created_at, updated_at) values (${lit(`${user.id}-cart`)}, ${lit(user.id)}, 'active', now(), now())`
  );
  return user;
}

/** Deletes the user and everything seeded or created for it. Call it in `afterAll`: a live extra user row can be read as the main one (plan D2). */
export function deleteChatUser() {
  if (!chatUser) return;
  removeUserRows(chatUser.id);
  chatUser = null;
}

// Children before parents. Every statement is scoped to the user through its owning parent.
// Shopping lists point at plan versions and carts, so they go first.
function planRowDeletes(u: string) {
  const plans = `(select id from plans where user_id = ${u})`;
  const versions = `(select id from plan_versions where plan_id in ${plans})`;
  const lists = `(select id from shopping_lists where user_id = ${u})`;
  return [
    `delete from shopping_list_items where shopping_list_id in ${lists}`,
    `delete from shopping_lists where user_id = ${u}`,
    `delete from ingredient_usages where source_type = 'add_on' and source_id in (select id from shared_add_ons where plan_version_id in ${versions})`,
    `delete from shared_add_ons where plan_version_id in ${versions}`,
    `delete from plan_version_recipes where plan_version_id in ${versions}`,
    `delete from meal_options where plan_version_id in ${versions}`,
    `delete from meal_types where plan_version_id in ${versions}`,
    `delete from uploaded_pdfs where plan_id in ${plans}`,
    `delete from plan_versions where plan_id in ${plans}`,
    `delete from plans where user_id = ${u}`
  ];
}

function recipeRowDeletes(u: string) {
  const recipes = `(select id from recipes where user_id = ${u})`;
  const ingredients = `(select id from ingredients where user_id = ${u})`;
  return [
    `delete from ingredient_usages where source_type = 'recipe' and (source_id in ${recipes} or ingredient_id in ${ingredients})`,
    `delete from recipes where user_id = ${u}`,
    `delete from ingredients where user_id = ${u}`
  ];
}

function removeUserRows(userId: string) {
  const u = lit(userId);
  const carts = `(select id from carts where user_id = ${u})`;
  sql(
    [
      ...planRowDeletes(u),
      `delete from shopping_templates where user_id = ${u}`,
      `delete from cart_items where cart_id in ${carts}`,
      `delete from carts where user_id = ${u}`,
      ...recipeRowDeletes(u),
      `delete from daily_logs where user_id = ${u}`,
      `delete from audit_events where user_id = ${u}`,
      `delete from rag_indexes where user_id = ${u}`,
      `delete from sessions where user_id = ${u}`,
      `delete from users where id = ${u}`
    ].join(";")
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Seeders. Each one replaces what it seeded before (seedRecipes: all of the user's recipes, and so the plan, which points at them), so a describe block can reseed between tests.

/** Replaces all of the user's recipes (and so clears the plan, whose options point at them) with these, with their ingredients and usages. Returns each recipe's id by name. */
export function seedRecipes(recipes: SeedRecipe[]): Record<string, string> {
  const userId = currentUser().id;
  const ids: Record<string, string> = {};
  // meal_options and plan_version_recipes reference recipes, so the plan goes first.
  clearPlan();
  // Reseeding starts clean, so a recipe or ingredient (and its category) from an earlier call cannot linger.
  const statements: string[] = recipeRowDeletes(lit(userId));
  for (const recipe of recipes) {
    const recipeId = `${userId}-rec-${slug(recipe.name)}`;
    ids[recipe.name] = recipeId;
    statements.push(
      `insert into recipes (id, user_id, name, description, canonical_hash, created_at, updated_at) values (${lit(recipeId)}, ${lit(userId)}, ${lit(recipe.name)}, ${lit(recipe.description ?? "")}, ${lit(slug(recipe.name))}, now(), now())`
    );
    recipe.ingredients.forEach((ingredient, index) => {
      const ingredientId = `${userId}-ing-${slug(ingredient.name)}`;
      const unit = ingredient.unit ?? "g";
      statements.push(
        `insert into ingredients (id, user_id, canonical_name, category, primary_unit, created_at, updated_at) values (${lit(ingredientId)}, ${lit(userId)}, ${lit(ingredient.name)}, ${lit(ingredient.category ?? "Otros")}, ${lit(unit)}, now(), now()) on conflict (id) do update set category = excluded.category`,
        `insert into ingredient_usages (id, ingredient_id, source_type, source_id, quantity, unit, notes, is_optional, confidence_score, requires_review, created_at) values (${lit(`${recipeId}-use-${index}`)}, ${lit(ingredientId)}, 'recipe', ${lit(recipeId)}, ${ingredient.quantity ?? 100}, ${lit(unit)}, '', false, 1, false, now())`
      );
    });
  }
  sql(statements.join(";"));
  return ids;
}

/** Soft-deletes a recipe, the way the app does (it moves to the Papelera). */
export function softDeleteRecipe(recipeId: string) {
  sql(`update recipes set deleted_at = now() where id = ${lit(recipeId)} and user_id = ${lit(currentUser().id)}`);
}

/** Replaces the active cart with `count` manual items "Ingrediente 01", "Ingrediente 02"… (quantity = position, unit g). Zero leaves an empty cart. */
export function seedCart(count: number) {
  const userId = currentUser().id;
  const cartId = `${userId}-cart`;
  const statements = [
    `delete from cart_items where cart_id = ${lit(cartId)}`,
    `delete from carts where id = ${lit(cartId)}`,
    `insert into carts (id, user_id, status, created_at, updated_at) values (${lit(cartId)}, ${lit(userId)}, 'active', now(), now())`
  ];
  for (let position = 1; position <= count; position++) {
    const name = `Ingrediente ${String(position).padStart(2, "0")}`;
    statements.push(
      `insert into cart_items (id, cart_id, source_type, quantity_multiplier, period_days, training_days, selected_alternatives, include_add_ons, include_supplements, manual_name, manual_quantity, manual_unit, created_at, updated_at) values (${lit(`${cartId}-item-${position}`)}, ${lit(cartId)}, 'manual', 1, 1, 0, '{}'::json, false, false, ${lit(name)}, ${position}, 'g', now(), now())`
    );
  }
  sql(statements.join(";"));
}

export type SeedPlan = {
  /** `all`: every meal has a time window; `some`: only the first and third; `none`: no meal has one. */
  times: "all" | "some" | "none";
  meals?: string[];
  /** The plan's name as stored (default `PLAN_NAME`); an upload leaves ".pdf" on it. */
  planName?: string;
  supplements?: boolean;
  objective?: string;
  recommendations?: string;
  /**
   * Seeds the deterministic recipe fixture (see `planFixture`) and wires it into the plan; it REPLACES all of the user's
   * recipes. Off by default because old specs seed their own recipes before the plan (they would lose them); every new
   * spec passes `fixture: true`.
   */
  fixture?: boolean;
  /** With `fixture`, appends the "With the extra recipes" of the REQ-3 table outside the plan. */
  extras?: boolean;
};

/** A complement on the first slot and a quantity-only one on the last (`addOnSpecs`), each with an `add_on` usage. */
function addOnStatements(versionId: string, meals: string[]): string[] {
  const userId = currentUser().id;
  return addOnSpecs(meals).flatMap(({ name, ingredient, slot, quantity, unit }) => {
    const addOnId = `${versionId}-addon-${slug(name)}`;
    const ingredientId = `${userId}-ing-${slug(ingredient)}`;
    return [
      `insert into shared_add_ons (id, plan_version_id, meal_type_id, name, applies_to_all_options, required, notes, canonical_hash, created_at) values (${lit(addOnId)}, ${lit(versionId)}, ${lit(`${versionId}-meal-${slot}`)}, ${lit(name)}, true, false, '', ${lit(slug(name))}, now())`,
      `insert into ingredients (id, user_id, canonical_name, category, primary_unit, created_at, updated_at) values (${lit(ingredientId)}, ${lit(userId)}, ${lit(ingredient)}, 'Otros', ${lit(unit)}, now(), now()) on conflict (id) do nothing`,
      `insert into ingredient_usages (id, ingredient_id, source_type, source_id, quantity, unit, notes, is_optional, confidence_score, requires_review, created_at) values (${lit(`${addOnId}-use`)}, ${lit(ingredientId)}, 'add_on', ${lit(addOnId)}, ${quantity}, ${lit(unit)}, '', false, 1, false, now())`
    ];
  });
}

/** Replaces the active plan: plan, current version (`structured_data`) and one meal type per meal. */
export function seedPlan({ times, meals = DEFAULT_MEALS, planName = PLAN_NAME, supplements = true, objective = "Mejorar mi energía", recommendations = "Tomar agua durante el día", fixture = false, extras = false }: SeedPlan) {
  clearPlan();
  const userId = currentUser().id;
  const placed = fixture ? planFixture(meals, { extras }) : [];
  // seedRecipes clears the plan again (harmless); the plan row itself is inserted below.
  const recipeIds = fixture ? seedRecipes(placed.map((entry) => entry.recipe)) : {};
  const planId = `${userId}-plan`;
  const versionId = `${planId}-v1`;
  const windows = meals.map((_, index) => (times === "all" || (times === "some" && index % 2 === 0) ? TIME_WINDOWS[index % TIME_WINDOWS.length] : ""));
  const structured = {
    name: planName,
    objective,
    diagnosis: "",
    recommendations,
    supplements: supplements ? [{ name: "Vitamina D", quantity: 1, unit: "cápsula" }] : [],
    nutrition_summary: {},
    meals: meals.map((name, index) => ({ name, time_window: windows[index], options: [] }))
  };
  const statements = [
    `insert into plans (id, user_id, name, objective, status, processing_status, created_at, updated_at) values (${lit(planId)}, ${lit(userId)}, ${lit(planName)}, ${lit(objective)}, 'active', 'ready', now(), now())`,
    `insert into plan_versions (id, plan_id, version_number, structured_data, change_summary, is_current, created_at, updated_at) values (${lit(versionId)}, ${lit(planId)}, 1, ${json(structured)}, '', true, now(), now())`,
    ...meals.map(
      (name, index) =>
        `insert into meal_types (id, plan_version_id, name, display_order, time_window, created_at) values (${lit(`${versionId}-meal-${index}`)}, ${lit(versionId)}, ${lit(name)}, ${index}, ${lit(windows[index])}, now())`
    )
  ];
  for (const { recipe, slot, option } of placed) {
    if (slot === null) continue;
    const mealId = `${versionId}-meal-${slot}`;
    const recipeId = recipeIds[recipe.name];
    statements.push(
      `insert into meal_options (id, plan_version_id, meal_type_id, recipe_id, option_number, is_unique_option, created_at) values (${lit(`${recipeId}-opt`)}, ${lit(versionId)}, ${lit(mealId)}, ${lit(recipeId)}, ${option}, false, now())`,
      `insert into plan_version_recipes (id, plan_version_id, recipe_id, meal_type_id, option_number, created_at) values (${lit(`${recipeId}-pvr`)}, ${lit(versionId)}, ${lit(recipeId)}, ${lit(mealId)}, ${option}, now())`
    );
  }
  if (fixture) statements.push(...addOnStatements(versionId, meals));
  sql(statements.join(";"));
}

const VOLUME_MEALS = ["Desayuno", "Colación", "Comida", "Colación", "Cena"];
const VOLUME_PROTEINS = ["Pollo", "Atún", "Res", "Cerdo", "Pavo", "Huevo", "Tofu", "Salmón"];
const VOLUME_STYLES = ["asado", "guisado", "a la plancha", "en salsa"];
/** The recipe names of `seedVolume`, "Pollo asado" first. */
export const VOLUME_RECIPES = VOLUME_PROTEINS.flatMap((protein) => VOLUME_STYLES.map((style) => `${protein} ${style}`));
/** The day `seedVolume`'s year of logs ends on; ask with it as `today`. */
export const VOLUME_TODAY = "2026-06-21";

/**
 * The size of the real dataset (spec NFR: 32 recipes, 69 meal options, one year of logs) with synthetic content: 32 recipes
 * of 6 ingredients and 3 preparation steps, a plan of 5 slots (two "Colación") holding 69 options cycled over the
 * recipes, add-ons, goals, a name, a 40-item cart and 365 daily logs ending on `VOLUME_TODAY`. Replaces the user's recipes, plan, cart and logs.
 */
export function seedVolume() {
  const recipes: SeedRecipe[] = VOLUME_RECIPES.map((name, index) => ({
    name,
    description: "Preparar los ingredientes.\nCocinar a fuego medio.\nServir caliente.",
    ingredients: Array.from({ length: 6 }, (_, position) => ({ name: `Ingrediente ${index}-${position}`, quantity: 10 + position, unit: position % 2 ? "g" : "pza" }))
  }));
  const recipeIds = seedRecipes(recipes);
  seedPlan({ times: "all", meals: VOLUME_MEALS });
  const userId = currentUser().id;
  const versionId = `${userId}-plan-v1`;
  const perSlot = VOLUME_MEALS.map(() => 0);
  const statements: string[] = [];
  for (let option = 0; option < 69; option++) {
    const slot = option % VOLUME_MEALS.length;
    const recipeId = recipeIds[VOLUME_RECIPES[option % VOLUME_RECIPES.length]];
    const number = ++perSlot[slot];
    statements.push(
      `insert into meal_options (id, plan_version_id, meal_type_id, recipe_id, option_number, is_unique_option, created_at) values (${lit(`${versionId}-opt-${option}`)}, ${lit(versionId)}, ${lit(`${versionId}-meal-${slot}`)}, ${lit(recipeId)}, ${number}, false, now())`,
      `insert into plan_version_recipes (id, plan_version_id, recipe_id, meal_type_id, option_number, created_at) values (${lit(`${versionId}-pvr-${option}`)}, ${lit(versionId)}, ${lit(recipeId)}, ${lit(`${versionId}-meal-${slot}`)}, ${number}, now())`
    );
  }
  statements.push(...addOnStatements(versionId, VOLUME_MEALS));
  sql(statements.join(";"));
  const end = Date.parse(`${VOLUME_TODAY}T00:00:00Z`);
  seedLogs(
    Array.from({ length: 365 }, (_, back) => ({
      date: new Date(end - back * 86_400_000).toISOString().slice(0, 10),
      meals_done: VOLUME_MEALS.slice(0, back % (VOLUME_MEALS.length + 1)),
      water_glasses: back % 9,
      weight_kg: back % 7 === 0 ? 80 - back / 40 : null,
      exercised: back % 3 === 0
    }))
  );
  setGoals({ weight: 72, days: 4 });
  setName("Rafael de prueba");
  seedCart(40);
}

/** Removes the plan and everything hanging off it, for the "no active plan" cases. */
export function clearPlan() {
  sql(planRowDeletes(lit(currentUser().id)).join(";"));
}

/** Replaces all of the user's daily logs. `date` is YYYY-MM-DD; omitted fields default to nothing done (0 glasses, no weight, no exercise). */
export function seedLogs(rows: SeedLog[]) {
  const userId = currentUser().id;
  const statements = [`delete from daily_logs where user_id = ${lit(userId)}`];
  for (const { date, meals_done = [], water_glasses = 0, weight_kg = null, exercised = false } of rows) {
    const mealsDone = meals_done.length ? `array[${meals_done.map(lit).join(",")}]::text[]` : "'{}'::text[]";
    statements.push(
      `insert into daily_logs (id, user_id, date, meals_done, water_glasses, weight_kg, exercised, created_at, updated_at) values (${lit(`${userId}-log-${date}`)}, ${lit(userId)}, ${lit(date)}::date, ${mealsDone}, ${water_glasses}, ${weight_kg ?? "null"}, ${exercised}, now(), now())`
    );
  }
  sql(statements.join(";"));
}

/** Sets the user's weekly goals; a key left out is untouched, `weight: null` clears the target weight. */
export function setGoals({ weight, days }: { weight?: number | null; days?: number }) {
  const sets = [...(weight !== undefined ? [`weight_goal_kg = ${weight ?? "null"}`] : []), ...(days !== undefined ? [`activity_goal_days = ${days}`] : [])];
  if (sets.length) sql(`update users set ${sets.join(", ")} where id = ${lit(currentUser().id)}`);
}

/** Sets the user's name (blank allowed, for "Aún no tengo tu nombre registrado."). */
export function setName(name: string) {
  sql(`update users set name = ${lit(name)} where id = ${lit(currentUser().id)}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// API

export type AskResult = { status: number; body: ChatAnswer };

export type AskOptions = {
  /** YYYY-MM-DD: the server's "today" (header x-e2e-today). */
  today?: string;
  /** Makes the route throw inside the builder call (header x-e2e-fail: chat), for the 500 path. */
  fail?: boolean;
  /** Asks for `resolved` in the body (header x-e2e-trace: 1). */
  trace?: boolean;
};

/**
 * POSTs a question to the chat API as the page's user; `request` is `page.request`. The body is a `ChatAnswer` on 200
 * and the error JSON otherwise. The test hooks are headers, so they work only when the server runs with E2E_HOOKS.
 */
export async function ask(request: APIRequestContext, message: string, { today, fail, trace }: AskOptions = {}): Promise<AskResult> {
  const headers: Record<string, string> = { ...(today ? { "x-e2e-today": today } : {}), ...(fail ? { "x-e2e-fail": "chat" } : {}), ...(trace ? { "x-e2e-trace": "1" } : {}) };
  const response = await request.post("/api/rag/chat", { data: { message }, headers });
  return { status: response.status(), body: (await response.json()) as ChatAnswer };
}

/** Sends x-e2e-today on every chat request the context's pages make, so UI-driven asks see `date` (YYYY-MM-DD) as today. */
export async function pinToday(context: BrowserContext, date: string) {
  await context.route(/\/api\/rag\/chat$/, (route) => route.continue({ headers: { ...route.request().headers(), "x-e2e-today": date } }));
}

// One log per worker's server (see serverLogPath in database.ts).
const serverLogPath = () => workerServerLogPath(currentWorkerIndex());

// Next's dev server colours the log (also when piped to a file), which splits "messageLength: 23" with escapes.
const ANSI = /\x1b\[[0-9;]*m/g;

/** Marks the end of the e2e server's log now: `since()` returns the text appended after that point without colour escapes (a missing file counts as empty). */
export function serverLog() {
  const file = serverLogPath(); // outside the try below: a missing worker index must throw, not read as an empty log
  const read = () => {
    try {
      return readFileSync(file);
    } catch {
      return Buffer.alloc(0);
    }
  };
  const offset = read().length;
  return { offset, since: () => read().subarray(offset).toString("utf8").replace(ANSI, "") };
}

type SweepButton = { type: string; message?: string };
type SweepBlock = { title?: string | null; lead?: Rich; sections?: Section[]; buttons?: SweepButton[] };
type SweepAnswer = { answer: string; kind: string; blocks?: SweepBlock[]; buttons?: SweepButton[] };

const PLACEHOLDER = /Pronto podré responder sobre/;

/** Every visible string of the blocks (titles, leads, section titles and items), for the placeholder check. */
const blockText = (blocks: SweepBlock[] = []) =>
  blocks.flatMap((block) => [block.title ?? "", plain(block.lead ?? []), ...(block.sections ?? []).flatMap((section) => [section.title, ...section.items.map(plain)])]).join("\n");

/**
 * REQ-5: re-sends the message of every question button in `answers` (top-level and per block) as the first message of a
 * new conversation, twice, and expects status 200 both times, a defined kind that is never clarify, did_you_mean or
 * no_match, a non-empty `blocks` array, the same blocks both times and no D3 placeholder ("Pronto podré responder
 * sobre …") in the answer or the block text, and for each button the topic and lead of the Button column map
 * (tests/shared/assistant-buttons.ts), asserted on `resolved`. Fails when there is nothing to send or an input answer is itself a
 * placeholder, so it never passes vacuously. Returns the messages it swept.
 */
export async function resendSweep(request: APIRequestContext, answers: readonly SweepAnswer[]) {
  for (const answer of answers) {
    expect(answer.answer, "placeholder answer in the sweep input").not.toMatch(PLACEHOLDER);
    expect(blockText(answer.blocks), "placeholder block in the sweep input").not.toMatch(PLACEHOLDER);
  }
  const buttons = answers.flatMap((answer) => [...(answer.buttons ?? []), ...(answer.blocks ?? []).flatMap((block) => block.buttons ?? [])]);
  const messages = [...new Set(buttons.flatMap((button) => (button.type === "question" && button.message ? [button.message] : [])))];
  expect(messages.length, "resendSweep found no question buttons to check").toBeGreaterThan(0);
  for (const message of messages) {
    const expected = BUTTON_TOPICS[message];
    expect(expected, `"${message}" is not in the Button column map`).toBeDefined();
    const first = await ask(request, message, { trace: true });
    const again = await ask(request, message);
    const body = first.body as unknown as SweepAnswer;
    expect(first.status, message).toBe(200);
    expect(again.status, message).toBe(200);
    expect(body.kind, message).toBeDefined();
    expect(["clarify", "did_you_mean", "no_match"], message).not.toContain(body.kind);
    expect(Array.isArray(body.blocks) && body.blocks.length > 0, `${message}: blocks`).toBe(true);
    expect(first.body.resolved?.map((intent) => intent.topic), `${message}: one topic`).toEqual([expected.topic]);
    if (expected.lead) expect(plain(body.blocks?.[0]?.lead ?? []), message).toMatch(expected.lead);
    expect(body.answer, message).not.toMatch(PLACEHOLDER);
    expect(blockText(body.blocks), message).not.toMatch(PLACEHOLDER);
    expect((again.body as unknown as SweepAnswer).blocks, message).toEqual(body.blocks);
  }
  return messages;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixture: a page signed in as the chat user

export const test = base.extend<{ chat: Page; chatContext: BrowserContext }>({
  // Same options as the project's pages (viewport, color scheme, reduced motion, time zone) so `test.use` applies unchanged.
  chatContext: async ({ browser, baseURL, viewport, colorScheme, reducedMotion, hasTouch, isMobile, forcedColors, timezoneId, issues }, use) => {
    const user = currentUser();
    const context = await browser.newContext({ baseURL, viewport, colorScheme, reducedMotion, hasTouch, isMobile, forcedColors, timezoneId, locale: "es-MX" });
    // Registered before the first page exists, so every page of the context reports into `issues`.
    context.on("page", (page) => watch(page, issues));
    await context.addCookies([{ name: "nm_session", value: user.token, url: baseURL ?? workerBaseUrl(currentWorkerIndex()), httpOnly: true, sameSite: "Lax" }]);
    await use(context);
    await context.close();
  },
  chat: async ({ chatContext }, use) => use(await chatContext.newPage())
});

/** Locators of the panel, following the plan's DOM contract. */
export function assistantUi(page: Page) {
  const panel = page.locator("#assistant-chat-panel");
  return {
    fab: page.locator(".assistant-fab"),
    panel,
    close: page.locator(".assistant-chat-close"),
    input: panel.getByLabel("Pregunta", { exact: true }),
    send: panel.getByRole("button", { name: "Enviar" }),
    log: page.locator(".assistant-chat-log"),
    userTurns: page.locator(".assistant-turn.user"),
    /**
     * Finished assistant turns (answers and errors) whose first lead has finished typing (REQ-33), not the pending one: a
     * count assertion on it therefore also waits out the typing, so a test never reads or audits a half-revealed answer.
     */
    assistantTurns: page.locator(".assistant-turn.assistant:not(.is-pending):not([data-typing])"),
    /** An answer whose first lead is still typing: its sections and buttons are not shown yet. */
    typing: page.locator(".assistant-turn.assistant[data-typing]"),
    pending: page.locator(".assistant-turn.assistant.is-pending"),
    labels: page.locator(".assistant-turn-label"),
    live: page.locator(".assistant-turn-live"),
    chips: page.locator(".assistant-chips button"),
    /** The one button component's variants (spec REQ-34), by `data-variant`; links are real anchors. */
    options: page.locator('.assistant-turn [data-variant="option"]'),
    navLinks: page.locator('.assistant-turn a[data-variant="link"]'),
    /** The answer-level question button (follow-up), variant `chip`: not one of the vertical options. */
    questionChips: page.locator('.assistant-turn [data-variant="chip"]'),
    /** The bubble of a turn and the assistant's avatar (spec REQ-32). */
    bubbles: page.locator(".assistant-turn .assistant-bubble"),
    avatars: page.locator(".assistant-turn .assistant-avatar"),
    backdrop: page.locator(".assistant-chat-backdrop")
  };
}

/** Opens the panel on the current page. */
export async function openAssistant(page: Page) {
  const ui = assistantUi(page);
  await ui.fab.click();
  await ui.panel.waitFor({ state: "visible" });
  return ui;
}

// ---------------------------------------------------------------------------------------------------------------------
// Mocked responses

const plain = (rich: Rich) => rich.map((span) => span.text).join("");

const question = (message: string): Button => ({ type: "question", label: message, message });

/**
 * A contract-valid answer of one untitled block: `answer` is derived from the lead and sections the way the server builds
 * it. `buttons` are the answer-level buttons (follow-ups, starters); the block itself carries none.
 */
export function buildAnswer(parts: { kind?: ChatAnswer["kind"]; lead: Rich; sections?: Section[]; sources?: string[]; buttons?: Button[] }): ChatAnswer {
  const { kind = "answer", lead, sections = [], sources = [], buttons = [] } = parts;
  const lines = [plain(lead), ...sections.flatMap((section) => [section.title, ...section.items.map(plain)])];
  return { answer: lines.join("\n"), context_used: "Todo el sistema", sources, kind, blocks: [{ title: null, lead, sections, buttons: [] }], buttons };
}

/** The "no match" reply (spec Copy): its lead and the 4 starters as question buttons. */
export const NO_MATCH_LEAD_TEXT = "No entendí tu pregunta. Puedo ayudarte con:";
export const NO_MATCH_ANSWER = buildAnswer({
  kind: "no_match",
  lead: [{ text: NO_MATCH_LEAD_TEXT }],
  buttons: ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"].map(question)
});

/** A cart answer with `count` items, quantities highlighted, capped like the server does (8 items plus "y <n> más"). */
export function cartAnswer(count = 3): ChatAnswer {
  // The Cart row of the spec's Topics table.
  const buttons = ["¿Qué recetas hay en mi plan?", "Mi cena de hoy"].map(question);
  if (count === 0) return buildAnswer({ lead: [{ text: "Tu carrito está vacío." }], buttons });
  const shown = Math.min(count, 8);
  const items: Rich[] = Array.from({ length: shown }, (_, index) => [{ text: `Ingrediente ${String(index + 1).padStart(2, "0")} · ` }, { text: `${index + 1} g`, highlight: true }]);
  if (count > 8) items.push([{ text: `y ${count - 8} más` }]);
  return buildAnswer({
    lead: [{ text: "Esto es lo que tienes en tu carrito." }],
    sections: [{ title: "Ingredientes", items }],
    sources: ["Carrito actual"],
    buttons
  });
}

/** Label long enough to wrap onto several lines in a 360 px bubble, with a lone long token to prove wrapping never truncates. */
export const LONG_OPTION_LABEL = "Opción número tres con una descripción larga que debe partirse en varias líneas sin cortarse";
export const OPTION_LABELS = ["Opción 1", "Opción 2", LONG_OPTION_LABEL];
export const LINK_LABEL = "Ver receta completa";
/** The answer-level question button; it has its own variant, `chip`, apart from the options. */
export const CHIP_LABEL = "Mi cena de hoy";
export const LINK_HREF = "/plans";

/**
 * An answer in the shape the server sends for options (chat.ts): the option buttons are answer-level (`buttons`, layout
 * "option") followed by a chip, and only a navigation link is in the block's own `buttons`.
 */
export function optionsAnswer(): ChatAnswer {
  const options: Button[] = OPTION_LABELS.map((label) => ({ type: "question", label, message: label, layout: "option" }));
  const base = buildAnswer({ kind: "answer", lead: [{ text: "Encontré varias opciones." }], buttons: [...options, question(CHIP_LABEL)] });
  base.blocks[0].buttons = [{ type: "link", label: LINK_LABEL, href: LINK_HREF }];
  return base;
}

/** An options answer whose lead is long enough to hit the typing budget (REQ-33). */
export const LONG_LEAD = "Estas son las opciones que tu plan tiene para ese momento del día, con ingredientes y porciones pensadas para que tu semana sea sencilla y variada. ".repeat(3).trim();

export function longLeadAnswer(): ChatAnswer {
  const answer = optionsAnswer();
  answer.blocks[0].lead = [{ text: LONG_LEAD }];
  answer.blocks[0].sections = [{ title: "Detalle", items: [[{ text: "Una porción de cada uno" }]] }];
  answer.sources = ["Plan activo"];
  return answer;
}

/** What `traceTyping` saw in one animation frame. `shown` counts the characters on screen (the typed layer while typing, the lead after). */
export type TypingFrame = { at: number; typing: boolean; shown: number; overlays: number; actions: string; sectionOpacity: string; height: number };
export type TypingTrace = { arrival: number; end: number; frames: TypingFrame[] };

/**
 * Starts sampling every animation frame in the page, from the frame the finished assistant turn first exists until its
 * `data-typing` is gone; call it before sending the question and read the trace with `waitForTyping`. With `tap`, the
 * bubble is clicked on the first frame that is still typing (tap to complete). Samples are taken in the page because
 * the typing lasts under a second, too short to poll reliably from the test.
 */
export async function traceTyping(page: Page, options: { tap?: boolean } = {}) {
  await page.evaluate((tap) => {
    const trace: TypingTrace = { arrival: -1, end: -1, frames: [] };
    (window as unknown as { __typingTrace: TypingTrace }).__typingTrace = trace;
    let tapped = false;
    const sample = (now: number) => {
      const turn = document.querySelector(".assistant-turn.assistant:not(.is-pending)");
      if (turn) {
        if (trace.arrival < 0) trace.arrival = now;
        const typing = turn.hasAttribute("data-typing");
        const lead = turn.querySelector(".assistant-turn-lead");
        const typed = turn.querySelector(".assistant-lead-typed");
        const log = document.querySelector(".assistant-chat-log") as HTMLElement;
        const section = turn.querySelector(".assistant-turn-section");
        trace.frames.push({
          at: now,
          typing,
          shown: (typing ? typed?.textContent : lead?.textContent)?.length ?? 0,
          overlays: turn.querySelectorAll(".assistant-lead-typed").length,
          actions: getComputedStyle(turn.querySelector(".assistant-actions") ?? turn).visibility,
          sectionOpacity: section ? getComputedStyle(section).opacity : "",
          height: log.scrollHeight
        });
        if (tap && typing && !tapped) {
          tapped = true;
          (turn.querySelector(".assistant-bubble") as HTMLElement).click();
        }
        if (!typing) {
          trace.end = now;
          return;
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, options.tap ?? false);
}

/** The trace of `traceTyping`, once the typing has ended. */
export async function waitForTyping(page: Page): Promise<TypingTrace> {
  await page.waitForFunction(() => (window as unknown as { __typingTrace: TypingTrace }).__typingTrace.end >= 0);
  return page.evaluate(() => (window as unknown as { __typingTrace: TypingTrace }).__typingTrace);
}

export type MockOptions = {
  /** Wait this long before answering. */
  delayMs?: number;
  /** Hold every request until `release()` is called. */
  hold?: boolean;
  /** An HTTP status of 400 or more answers with an error body instead of `answer`. */
  status?: number;
  /** Fail the request at the network level. */
  abort?: boolean;
};

export type ChatMock = {
  /** Bodies of the requests that reached the route, in order. */
  requests: { message: string }[];
  /** Answers every held request. */
  release: () => void;
};

/**
 * Intercepts POST /api/rag/chat. `answer` may be a function of the request body. A mocked failure is still an issue for
 * the zero-undeclared-issues check, so the test must declare it with `expectIssues`.
 */
export async function mockChat(page: Page, answer: ChatAnswer | ((body: { message: string }) => ChatAnswer), options: MockOptions = {}): Promise<ChatMock> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const mock: ChatMock = { requests: [], release };
  await page.route(/\/api\/rag\/chat$/, async (route) => {
    const body = route.request().postDataJSON() as { message: string };
    mock.requests.push(body);
    if (options.hold) await released;
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.abort) return route.abort("failed");
    if (options.status && options.status >= 400) return route.fulfill({ status: options.status, contentType: "application/json", body: JSON.stringify({ error: "Respuesta simulada con error" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(typeof answer === "function" ? answer(body) : answer) });
  });
  return mock;
}

// ---------------------------------------------------------------------------------------------------------------------
// Focus rings

/**
 * Tabs through the panel's controls and reports every one whose focus indicator is below 3:1. The field draws its
 * ring as the pill's border (the field itself has no outline), so it is measured on that border. When `visited` is
 * given, each stop is pushed to it as `<variant or tag>:<text>`, so a test can prove the walk reached specific controls.
 */
export async function focusWalk(page: Page, theme: Theme, visited?: string[]) {
  await page.evaluate(installToolkit);
  await page.keyboard.press("Shift");
  // The first visible control of the header.
  await page.locator("#assistant-chat-panel header button:visible").first().focus();
  const failures: string[] = [];
  let stops = 0;
  for (let presses = 0; presses < 25; presses++) {
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest(".assistant-chat")));
    if (!inside) break;
    stops++;
    visited?.push(await page.evaluate(() => `${document.activeElement?.getAttribute("data-variant") ?? document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`));
    if (await page.evaluate(() => document.activeElement instanceof HTMLTextAreaElement)) {
      const form = page.locator(".assistant-chat-form");
      const border = await toRgb(page, await form.evaluate((node) => getComputedStyle(node).borderTopColor));
      const ratio = contrast(border, await effectiveBackground(page.locator(".assistant-composer")));
      if (ratio < 3) failures.push(`${theme} field ring ${ratio.toFixed(2)}:1`);
    } else {
      const result = await page.evaluate(() => window.__audit.focus());
      if (!result.ok) failures.push(`${theme} ${result.where} ${result.ratio.toFixed(2)}:1`);
    }
    await page.keyboard.press("Tab");
  }
  expect(stops).toBeGreaterThanOrEqual(4);
  return failures;
}
