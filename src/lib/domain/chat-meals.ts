import { type Button, type Intent, type Rich, type Section, STARTERS, normalizeText } from "@/lib/assistant";
import { isGeneric } from "@/lib/domain/chat-dish";
import type { AppDb, Recipe } from "@/lib/types";
import { formatQty } from "@/lib/domain/nutrition";
import { activeSchedule, recipeDetails } from "@/lib/domain/plans";
import { recipeSteps } from "@/lib/recipe-steps";

// Slots of the active plan for the assistant (spec assistant-data-scope REQ-7, REQ-8, REQ-11, REQ-12): the slot list
// with its refs, the word-to-slot mapping, the choice replies (several slots, almuerzo, slot not in the plan), the time
// lead and the dish detail.

/**
 * What a builder returns; `ragAnswer` adds the kind and the follow-ups. `buttons` (a choice) replace the follow-ups;
 * `blockButtons` (navigation) stay on the answer's block. `title` is the block title when the Topics table has none
 * for the topic (a slot ref); `followUps` (messages) replace the topic's own (an option's detail offers its slot's time).
 */
export type Built = { lead: Rich; sections?: Section[]; sources?: string[]; buttons?: Button[]; blockButtons?: Button[]; kind?: "clarify" | "detail" | "did_you_mean"; title?: string; followUps?: string[] };

export const NO_PLAN_LINE = "Aún no tienes un plan activo.";
export const PLAN_LINK: Button = { type: "link", label: "Subir mi plan", href: "/plans" };

/**
 * REQ-27: the reply to a plan, slot or meals-done question without an active plan (or with a plan without slots): the line
 * and "Subir mi plan". It has no follow-ups (empty, so the topic's own do not apply): the link is its only button (user
 * ruling 2026-11-13); every follow-up would answer this same line. `title` is the block title of a slot question.
 */
export const noActivePlan = (title?: string): Built => ({ lead: [{ text: NO_PLAN_LINE }], blockButtons: [PLAN_LINK], title, followUps: [] });

/** A meal type of the active plan. `ref` is its name, or with duplicate names its ordinal form ("Segunda colación"). */
export type Slot = { id: string; name: string; time: string; ref: string };
export type SlotPlan = { planName: string; slots: Slot[] };

const FEMININE = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];
const MASCULINE = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"];
const MASCULINE_SLOTS = ["desayuno", "almuerzo", "snack"];

/** Beyond the tenth duplicate the ref is "<Slot> <n>" ("Colación 11"). */
function ordinalRef(name: string, key: string, position: number): string {
  if (position > FEMININE.length) return `${name} ${position}`;
  return `${(MASCULINE_SLOTS.includes(key) ? MASCULINE : FEMININE)[position - 1]} ${name.toLowerCase()}`;
}

/** The plan's slots in plan order, or null without an active plan or with a plan that has no slots (user ruling 2026-11-13: both are "no plan"). */
export function planSlots(db: AppDb, userId: string): SlotPlan | null {
  const schedule = activeSchedule(db, userId);
  if (!schedule?.meals.length) return null;
  const keys = schedule.meals.map((meal) => normalizeText(meal.name));
  const seen = new Map<string, number>();
  const slots = schedule.meals.map((meal, index): Slot => {
    const key = keys[index];
    const position = (seen.get(key) ?? 0) + 1;
    seen.set(key, position);
    const duplicated = keys.filter((other) => other === key).length > 1;
    return { id: meal.id, name: meal.name, time: meal.time_window || "", ref: duplicated ? ordinalRef(meal.name, key, position) : meal.name };
  });
  return { planName: schedule.plan_name, slots };
}

/** The plan's slots a slot word names; "merienda" and "snack" fall back to colación (REQ-7). */
function slotsNamed(slots: Slot[], word: string): Slot[] {
  const named = (key: string) => slots.filter((slot) => normalizeText(slot.name) === key);
  const exact = named(word);
  return exact.length || (word !== "merienda" && word !== "snack") ? exact : named("colacion");
}

const ASKS = { times: "¿A qué hora es mi", options: "¿Cuál es mi" } as const;
export type SlotAsk = keyof typeof ASKS;

/** The message that asks `ask` of a slot (the Topics table's Button column). */
export const slotMessage = (ask: SlotAsk, text: string) => `${ASKS[ask]} ${text.toLowerCase()}?`;
const slotButton = (slot: Slot, ask: SlotAsk, label = slot.ref, text = slot.ref): Button => ({ type: "question", label, message: slotMessage(ask, text) });
/** One button per slot, or the starters when the plan has none (REQ-27). */
export const slotChoices = (slots: Slot[], ask: SlotAsk): Button[] =>
  slots.length ? slots.map((slot) => slotButton(slot, ask)) : STARTERS.map((message): Button => ({ type: "question", label: message, message }));
/** "colación" → "colaciones" (the accent goes), "desayuno" → "desayunos", "snack" → "snacks", "luz" → "luces". */
function plural(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("ón")) return `${lower.slice(0, -2)}ones`;
  if (lower.endsWith("z")) return `${lower.slice(0, -1)}ces`;
  return /[aeiouk]$/.test(lower) ? `${lower}s` : `${lower}es`;
}
const withAccent = (word: string) => (word === "colacion" ? "colación" : word);
/** The block title of a slot word the plan cannot answer (REQ-24): "Cena", "Colación". */
const wordTitle = (word: string) => withAccent(word).replace(/^./, (letter) => letter.toUpperCase());

/**
 * The slot a slot word names, or the reply that asks for it: several slots with that name (REQ-11), "almuerzo" with
 * no such slot (REQ-7), or a slot the plan lacks (REQ-27). `ask` says which question the choice buttons send.
 * `ordinal` (REQ-11) picks one of the same-named slots; out of range it asks again.
 */
export function chooseSlot(plan: SlotPlan, word: string, ask: SlotAsk, ordinal?: number): { slot: Slot } | { built: Built } {
  const sources = [`Plan activo: ${plan.planName}`];
  const found = slotsNamed(plan.slots, word);
  if (found.length === 1) return { slot: found[0] };
  if (ordinal && ordinal <= found.length) return { slot: found[ordinal - 1] };
  if (found.length > 1) {
    const buttons = found.map((slot) => slotButton(slot, ask, slot.time ? `${slot.ref} (${slot.time})` : slot.ref));
    return { built: { lead: [{ text: `Tienes ${found.length} ${plural(found[0].name)}. ¿Cuál?` }], buttons, kind: "clarify", sources } };
  }
  if (word === "almuerzo") {
    const meals = ["desayuno", "comida"].flatMap((key) => plan.slots.find((slot) => normalizeText(slot.name) === key) ?? []);
    if (meals.length) {
      const buttons = meals.map((slot) => slotButton(slot, ask, slot.name, slot.name));
      return { built: { lead: [{ text: "¿Te refieres al desayuno o a la comida?" }], buttons, kind: "clarify", sources } };
    }
  }
  return { built: { lead: [{ text: `Tu plan no tiene ${withAccent(word)}.` }], buttons: slotChoices(plan.slots, ask), sources } };
}

const SLOT_TIME_LEADS: ((ref: string) => string)[] = [(ref) => `Tu horario de ${ref}: `, (ref) => `Tu ${ref} es: `];

/** REQ-8, REQ-28: one slot's time highlighted, in the variant the question picks, or that it has none. */
export function slotTimeLead(slot: Slot, question: string): Rich {
  const ref = slot.ref.toLowerCase();
  return slot.time ? [{ text: pickVariant(SLOT_TIME_LEADS, question)(ref) }, { text: slot.time, highlight: true }, { text: "." }] : [{ text: `Tu plan no tiene horario para tu ${ref}.` }];
}

const PAGE_SIZE = 3;
const LEADS: ((slot: string) => string)[] = [
  (slot) => `Estas son tus opciones de ${slot}:`,
  (slot) => `Para tu ${slot} puedes elegir:`,
  (slot) => `Tus opciones de ${slot} son:`
];

/** REQ-28: the same question always picks the same variant. */
export function pickVariant<T>(variants: T[], question: string): T {
  let hash = 0;
  for (const char of normalizeText(question)) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return variants[hash % variants.length];
}

const countOptions = (count: number) => `${count} ${count === 1 ? "opción" : "opciones"}`;

/** REQ-9: the recipe name, or for a generic name "Opción <n>: <first 3 ingredients>" ("…" only above 3). */
function optionLabel(db: AppDb, recipe: Recipe, position: number, slotNames: readonly string[]): string {
  if (!isGeneric(recipe.name, slotNames)) return recipe.name;
  const names = recipeDetails(db, recipe).ingredients.map((item) => item.name);
  if (!names.length) return `Opción ${position}`;
  return `Opción ${position}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`;
}

const DETAIL_LEADS: ((name: string) => Rich)[] = [
  (name) => [{ text: name, highlight: true }, { text: " lleva:" }],
  (name) => [{ text: "Esto lleva " }, { text: name, highlight: true }, { text: ":" }]
];
const NO_STEPS = "Esta receta no tiene preparación registrada.";
const STEPS_SHOWN = 2;

/** "<name> · **<amount>**", or the bare name when nothing is stored. A stored unit such as "al gusto" shows without a quantity. */
function withAmount(name: string, quantity: number, unit: string): Rich {
  const amount = [quantity > 0 ? formatQty(quantity) : "", unit].filter(Boolean).join(" ");
  return amount ? [{ text: `${name} · ` }, { text: amount, highlight: true }] : [{ text: name }];
}

/** The slot's complements, one item per `add_on` usage (an add-on without usages is listed by its name). */
function complements(db: AppDb, slotId: string): Rich[] {
  return db.sharedAddOns.filter((addOn) => addOn.meal_type_id === slotId && !addOn.deleted_at).flatMap((addOn): Rich[] => {
    const usages = db.ingredientUsages.filter((usage) => usage.source_type === "add_on" && usage.source_id === addOn.id && !usage.deleted_at);
    if (!usages.length) return [[{ text: String(addOn.name) }]];
    return usages.map((usage) => withAmount(db.ingredients.find((item) => item.id === usage.ingredient_id)?.canonical_name || usage.name_snapshot || "Complemento", usage.quantity, usage.unit));
  });
}

/**
 * REQ-12: the detail of a recipe. `spot` says which option of which slot opened it (its complements, and the lead of a
 * generic name); a dish asked by name has none and shows complements only when the recipe is an option in one slot.
 * The lead variant comes from the dish, so every way of asking gives the same answer (REQ-10).
 */
export function recipeDetail(db: AppDb, userId: string, recipe: Recipe, spot?: { slot: Slot; position: number }): Built {
  const planned = planSlots(db, userId)?.slots ?? [];
  const name = isGeneric(recipe.name, planned.map((slot) => slot.name)) && spot ? `${spot.slot.ref}, opción ${spot.position}` : recipe.name;
  const ingredients = recipeDetails(db, recipe).ingredients.map((item) => withAmount(item.name, item.quantity, item.unit));
  const steps = recipeSteps(recipe.description);
  const holding = spot ? [spot.slot] : planned.filter((slot) => db.mealOptions.some((option) => option.meal_type_id === slot.id && option.recipe_id === recipe.id && !option.deleted_at));
  const accompaniment = holding.length === 1 ? complements(db, holding[0].id) : [];
  const sections: Section[] = [
    ...(ingredients.length ? [{ title: "Ingredientes", items: ingredients }] : []),
    { title: "Preparación", items: steps.length ? steps.slice(0, STEPS_SHOWN).map((step): Rich => [{ text: step }]) : [[{ text: NO_STEPS }]] },
    ...(accompaniment.length ? [{ title: "Acompaña con", items: accompaniment }] : [])
  ];
  const blockButtons: Button[] = steps.length > STEPS_SHOWN ? [{ type: "link", label: "Ver receta completa", href: `/recipes/${recipe.id}` }] : [];
  return { lead: pickVariant(DETAIL_LEADS, name)(name), sections, sources: [`Receta: ${recipe.name}`], blockButtons, kind: "detail" };
}

/** What the intent leaves out, the caller can set: tests pass these directly. */
export type SlotOptionsView = {
  /** 1-based page; below 1 reads as 1 and past the last as the last (REQ-9). Default: the intent's page, else 1. */
  page?: number;
  /** An option number the user asked for: in range it opens that option's detail, anything else (0, a decimal, past the last) says how many there are (REQ-10). Default: the intent's option. */
  asked?: number;
};

/**
 * The options of the slot an intent names (REQ-9, REQ-10, REQ-11, REQ-27): a lead and one full-width button per option
 * of the page, then the paging buttons. A slot with one option, or an option in range, goes to the detail (REQ-12);
 * option 0, a decimal and a number past the last option say how many there are, then the first page.
 */
export function slotOptions(db: AppDb, userId: string, intent: Intent, question: string, view: SlotOptionsView = {}): Built {
  const plan = planSlots(db, userId);
  // The resolver always names the slot of a slotOptions intent.
  const word = intent.slot ?? "";
  if (!plan) return noActivePlan(wordTitle(word));
  const chosen = chooseSlot(plan, word, "options", intent.ordinal);
  // The block title of a 2-block answer (REQ-24): the slot ref, or the slot word when the plan lacks it.
  if ("built" in chosen) return { ...chosen.built, title: wordTitle(word) };
  const { slot } = chosen;
  // A bare number ("cena 2") is option n unless the slot is duplicated, where it was the slot's ordinal (REQ-11).
  const bareOption = intent.numbered && slotsNamed(plan.slots, intent.slot ?? "").length === 1 ? intent.ordinal : undefined;
  const asked = view.asked ?? intent.option ?? bareOption;
  const page = view.page ?? intent.page ?? 1;
  const sources = [`Plan activo: ${plan.planName}`];
  const name = slot.ref.toLowerCase();
  const recipes = db.mealOptions
    .filter((option) => option.meal_type_id === slot.id && !option.deleted_at)
    .sort((a, b) => a.option_number - b.option_number)
    .flatMap((option) => db.recipes.find((recipe) => recipe.id === option.recipe_id && !recipe.deleted_at) ?? []);
  if (!recipes.length) return { lead: [{ text: `Tu plan no tiene opciones para tu ${name}.` }], sources, title: slot.ref, followUps: [slotMessage("times", slot.ref)] };

  const outOfRange = asked !== undefined && !(Number.isInteger(asked) && asked >= 1 && asked <= recipes.length);
  if (!outOfRange && (asked !== undefined || recipes.length === 1)) {
    const position = asked ?? 1;
    return { ...recipeDetail(db, userId, recipes[position - 1], { slot, position }), title: slot.ref, followUps: [slotMessage("times", slot.ref)] };
  }
  const pages = Math.ceil(recipes.length / PAGE_SIZE);
  const current = outOfRange ? 1 : Math.min(Math.max(page, 1), pages);
  const first = (current - 1) * PAGE_SIZE;
  const buttons: Button[] = recipes.slice(first, first + PAGE_SIZE).map((recipe, index) => ({
    type: "question",
    label: optionLabel(db, recipe, first + index + 1, plan.slots.map((item) => item.name)),
    message: `${slot.ref}, opción ${first + index + 1}`,
    layout: "option"
  }));
  const pageButton = (label: string, target: number): Button => ({ type: "question", label, message: `${slot.ref}, más opciones (página ${target})` });
  if (current < pages) buttons.push(pageButton("Ver más opciones", current + 1));
  if (current > 1) buttons.push(pageButton("Opciones anteriores", current - 1));
  const lead = outOfRange ? `Tu ${name} tiene ${countOptions(recipes.length)}.` : pickVariant(LEADS, question)(name);
  return { lead: [{ text: lead }], buttons, sources, title: slot.ref };
}
