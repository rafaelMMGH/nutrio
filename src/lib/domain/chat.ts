import type { AppDb, AppUser } from "@/lib/types";
import { type Block, type Button, type ChatAnswer, type Intent, type ReplyKind, type Rich, type Section, normalizeText, STARTERS, words } from "@/lib/assistant";
import { consolidateCart } from "@/lib/domain/cart";
import { isGeneric } from "@/lib/domain/chat-dish";
import { type Built, chooseSlot, planSlots, recipeDetail, slotOptions, slotTimeLead } from "@/lib/domain/chat-meals";
import { exerciseAnswer, goalsAnswer, mealsDoneAnswer, waterAnswer, weeklyAnswer, weightAnswer } from "@/lib/domain/chat-metrics";
import { resolve } from "@/lib/domain/chat-intent";
import { greetingOf, TOPICS, type TopicId } from "@/lib/domain/chat-topics";
import { activePlan } from "@/lib/domain/plans";
import { formatQty } from "@/lib/domain/nutrition";

const plain = (rich: Rich) => rich.map((span) => span.text).join("");

/** The plain `answer` of the contract: each block's title, lead, then each section's title line and one line per item. */
const answerText = (blocks: Block[]) =>
  blocks.flatMap((block) => [...(block.title ? [block.title] : []), plain(block.lead), ...block.sections.flatMap((section) => [section.title, ...section.items.map(plain)])]).join("\n");

const questionButton = (message: string): Button => ({ type: "question", label: message, message });

/** The response: blocks and buttons, and the plain `answer`. */
function reply(kind: ReplyKind, blocks: Block[], buttons: Button[], sources: string[], resolved: Intent[] | undefined): ChatAnswer {
  return {
    answer: answerText(blocks),
    context_used: "Todo el sistema",
    sources,
    kind,
    blocks,
    buttons,
    ...(resolved ? { resolved } : {})
  };
}

const standalone = (lead: string): Block[] => [{ title: null, lead: [{ text: lead }], sections: [], buttons: [] }];

const textLead = (text: string): Rich => [{ text }];
const NO_PLAN_LEAD = "No tienes un plan activo.";
const MAX_ITEMS = 8;

/** A section of plain items, capped at 8 with a last item "y <n> más" (REQ-1). With no items there is no section: the list is empty. */
function section(title: string, items: Rich[]): Section[] {
  if (!items.length) return [];
  if (items.length <= MAX_ITEMS) return [{ title, items }];
  return [{ title, items: [...items.slice(0, MAX_ITEMS), [{ text: `y ${items.length - MAX_ITEMS} más` }]] }];
}

/** One plain item per non-empty line of `text`. */
const lineItems = (text: string): Rich[] => text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => [{ text: line }]);

/** "<name> · " followed by the highlighted value. */
const withValue = (name: string, value: string): Rich => [{ text: `${name} · ` }, { text: value, highlight: true }];
const quantity = (item: { quantity: number; unit: string }) => `${formatQty(item.quantity)} ${item.unit}`.trim();

/** Slot times (REQ-8): the slot the intent names, or every slot when it names none. */
function mealTimes(db: AppDb, userId: string, intent: Intent): Built {
  const plan = planSlots(db, userId);
  if (!plan) return { lead: textLead(NO_PLAN_LEAD) };
  const sources = [`Plan activo: ${plan.planName}`];
  if (intent.slot) {
    const chosen = chooseSlot(plan, intent.slot, "times", intent.ordinal);
    return "built" in chosen ? chosen.built : { lead: slotTimeLead(chosen.slot), sources };
  }
  const lead = plan.slots.some((slot) => slot.time) ? "Estos son los horarios de tus comidas." : "Tu plan no tiene horarios para tus comidas.";
  const items = plan.slots.map((slot): Rich => (slot.time ? withValue(slot.ref, slot.time) : [{ text: slot.ref }]));
  return { lead: textLead(lead), sections: section("Comidas", items), sources };
}

function planSummary(db: AppDb, userId: string, q: string): Built {
  const plan = activePlan(db, userId);
  if (!plan?.current_version) return { lead: textLead(NO_PLAN_LEAD) };
  const data = plan.current_version.structured_data;
  const sections = section("Comidas", data.meals.map((meal) => [{ text: meal.name }]));
  if (q.includes("suplement")) {
    const names = (data.supplements || []).map((item): Rich => [{ text: item.name }]);
    sections.push(...section("Suplementos", names.length ? names : [[{ text: "Sin suplementos registrados" }]]));
  }
  if (q.includes("recomend")) sections.push(...section("Recomendaciones", lineItems(data.recommendations || "")));
  return { lead: textLead(`Tu objetivo: ${data.objective}`), sections, sources: [`Plan activo: ${plan.name}`] };
}

function cartSummary(db: AppDb, userId: string): Built {
  const cart = consolidateCart(db, userId);
  if (!cart.ingredients.length) return { lead: textLead("Tu carrito está vacío.") };
  return {
    lead: textLead("Esto es lo que tienes en tu carrito."),
    sections: section("Ingredientes", cart.ingredients.map((item) => withValue(item.name, quantity(item)))),
    sources: ["Carrito actual"]
  };
}

// Question words that never narrow the recipe list: the frozen filter words of the spec Terms (not the vocabulary: that grows with the Topics table).
const DROPPED_WORDS = new Set([
  ...["que", "hay", "en", "mi", "mis", "de", "del", "el", "la", "los", "las", "con", "para", "por", "tengo", "cual", "cuales", "como", "cuanto", "es", "un", "una"],
  ...["hora", "horas", "horario", "horarios", "cuando", "desayuno", "desayunos", "comida", "comidas", "cena", "cenas", "colacion", "colaciones", "carrito", "carritos", "plan", "planes", "objetivo", "objetivos"]
]);
const DROPPED_PREFIXES = ["compr", "receta", "ingrediente", "prepar", "suplement", "recomend"];

export function recipeList(db: AppDb, userId: string, question: string): Built {
  const recipes = db.recipes.filter((item) => item.user_id === userId && !item.deleted_at);
  if (!recipes.length) return { lead: textLead("Aún no tienes recetas.") };
  const filter = words(question).filter((word) => word.length >= 3 && !DROPPED_WORDS.has(word) && !DROPPED_PREFIXES.some((prefix) => word.startsWith(prefix)));
  const matching = recipes.filter((recipe) => words(recipe.name).some((word) => filter.includes(word)));
  const filtered = matching.length > 0;
  return {
    lead: textLead(filtered ? "Estas recetas coinciden con tu pregunta." : "Estas son tus recetas."),
    sections: section("Recetas", (filtered ? matching : recipes).map((item) => [{ text: item.name }])),
    sources: ["Recetario"]
  };
}

const BUILDERS: Partial<Record<TopicId, (db: AppDb, userId: string, question: string, intent: Intent, today: string) => Built>> = {
  mealTimes: (db, userId, _question, intent) => mealTimes(db, userId, intent),
  slotOptions: (db, userId, question, intent) => slotOptions(db, userId, intent, question),
  // A dish found by name opens its detail; did-you-mean and not-found keep the interim answer until T048.
  dish: (db, userId, _question, intent) => {
    const recipe = intent.outcome === "found" ? db.recipes.find((item) => item.id === intent.recipeIds?.[0] && item.user_id === userId && !item.deleted_at) : undefined;
    return recipe ? recipeDetail(db, userId, recipe) : pending("dish");
  },
  water: (db, userId, question, intent, today) => waterAnswer(db, userId, question, intent, today),
  exercise: (db, userId, question, intent, today) => exerciseAnswer(db, userId, question, intent, today),
  weight: (db, userId, question, intent, today) => weightAnswer(db, userId, question, intent, today),
  // No active plan keeps the interim answer until T052.
  mealsDone: (db, userId, question, intent, today) => mealsDoneAnswer(db, userId, question, intent, today) ?? pending("mealsDone"),
  goals: (db, userId, _question, intent) => goalsAnswer(db, userId, intent),
  weekly: (db, userId, _question, _intent, today) => weeklyAnswer(db, userId, today),
  cart: (db, userId) => cartSummary(db, userId),
  recipes: recipeList,
  plan: (db, userId, question) => planSummary(db, userId, normalizeText(question))
};

/** The interim answer of a topic whose builder has not landed (plan D3). Never asserted by a test; T063 requires none left. */
const pending = (topic: TopicId): Built => ({ lead: textLead(`Pronto podré responder sobre ${TOPICS[topic].title ?? "esta pregunta"}.`) });

/**
 * The answer to one message: depends only on the message, the user's data and `today` (REQ-5). `trace` adds the
 * resolved intents for the e2e suite (plan D2). `today` dates the metric questions
 * (REQ-14); their builders read it from US3 on. The topics
 * are the resolver's (REQ-6): at most two are answered, the rest are offered as buttons.
 */
export function ragAnswer(db: AppDb, user: AppUser, message: string, today: string, { trace = false }: { trace?: boolean } = {}): ChatAnswer {
  const starters = STARTERS.map(questionButton);
  const greeting = greetingOf(message);
  if (greeting) {
    const lead = greeting === "thanks" ? "¡Con gusto!" : "¡Hola! ¿En qué te ayudo?";
    return reply("greeting", standalone(lead), starters, [], trace ? [{ topic: "greeting" }] : undefined);
  }

  // REQ-3: only the user's own, live, non-generic recipes can be named; the array is already in seq order.
  const recipes = db.recipes.filter((recipe) => recipe.user_id === user.id && !recipe.deleted_at && !isGeneric(recipe.name));
  const { intents, overflow: further } = resolve(message, recipes, today);
  if (!intents.length) return reply("no_match", standalone("No entendí tu pregunta. Puedo ayudarte con:"), starters, [], trace ? [] : undefined);

  // The resolver only returns topics of the table.
  const answered = intents.map((intent) => intent.topic as TopicId);
  // A topic without a button (identity, slots, ...) is left out silently.
  const overflow = further.flatMap((intent) => TOPICS[intent.topic as TopicId].button ?? []);
  const asked = normalizeText(message);
  const builts = answered.map((topic, index) => BUILDERS[topic]?.(db, user.id, message, intents[index], today) ?? pending(topic));
  const blocks = builts.map((built, index): Block => ({ title: answered.length > 1 ? TOPICS[answered[index]].title : null, lead: built.lead, sections: built.sections ?? [], buttons: built.blockButtons ?? [] }));
  // Repeat rule (chat-polish REQ-5): a follow-up that repeats the question just asked is not offered. Follow-ups only.
  // A button is offered once: an overflow topic can also be one of the follow-ups (REQ-24).
  const followUps = [...new Set([...TOPICS[answered[answered.length - 1]].followUps.filter((text) => normalizeText(text) !== asked), ...overflow])];
  // A builder that asks something (REQ-7, REQ-11, REQ-27) brings its own buttons in place of the follow-ups.
  const choice = builts.find((built) => built.buttons);
  const kind = choice?.kind ?? builts.find((built) => built.kind === "detail")?.kind ?? "answer";
  return reply(kind, blocks, choice?.buttons ?? followUps.map(questionButton), [...new Set(builts.flatMap((built) => built.sources ?? []))], trace ? intents : undefined);
}
