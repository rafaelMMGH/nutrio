import type { AppDb, AppUser } from "@/lib/types";
import { type Block, type Button, type ChatAnswer, type Intent, type ReplyKind, type Rich, type Section, normalizeText, STARTERS, words } from "@/lib/assistant";
import { consolidateCart } from "@/lib/domain/cart";
import { isGeneric, rankDish } from "@/lib/domain/chat-dish";
import { type Built, chooseSlot, noActivePlan, pickVariant, planSlots, recipeDetail, slotChoices, slotMessage, slotOptions, slotTimeLead, slotWordMessage } from "@/lib/domain/chat-meals";
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
function mealTimes(db: AppDb, userId: string, question: string, intent: Intent): Built {
  const plan = planSlots(db, userId);
  if (!plan) return noActivePlan(undefined, intent.slot ? [slotWordMessage("options", intent.slot)] : undefined);
  const sources = [`Plan activo: ${plan.planName}`];
  if (intent.slot) {
    const chosen = chooseSlot(plan, intent.slot, "times", intent.ordinal);
    return "built" in chosen ? chosen.built : { lead: slotTimeLead(chosen.slot, question), sources, followUps: [slotMessage("options", chosen.slot.ref)] };
  }
  const lead = plan.slots.some((slot) => slot.time) ? "Estos son los horarios de tus comidas." : "Tu plan no tiene horarios para tus comidas.";
  const items = plan.slots.map((slot): Rich => (slot.time ? withValue(slot.ref, slot.time) : [{ text: slot.ref }]));
  return { lead: textLead(lead), sections: section("Comidas", items), sources };
}

function planSummary(db: AppDb, userId: string, q: string): Built {
  const plan = activePlan(db, userId);
  if (!plan?.current_version || !planSlots(db, userId)) return noActivePlan();
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
  mealTimes: (db, userId, question, intent) => mealTimes(db, userId, question, intent),
  slotOptions: (db, userId, question, intent) => slotOptions(db, userId, intent, question),
  // REQ-26: a dish found by name opens its detail; otherwise the candidates are offered, or the phrase is not found.
  // The resolver (given the recipes) always names live recipes of this user, so found has one (it throws otherwise);
  // didYouMean without any would be a reply with no buttons, and an empty phrase is the clarify outcome (REQ-25).
  dish: (db, userId, _question, intent) => {
    const recipes = (intent.recipeIds ?? []).flatMap((id) => db.recipes.find((item) => item.id === id && item.user_id === userId && !item.deleted_at) ?? []);
    if (intent.outcome === "found") return recipeDetail(db, userId, recipes[0]);
    if (intent.outcome === "didYouMean") return { lead: textLead(`No encontré exactamente '${intent.phrase}'. ${DID_YOU_MEAN}`), kind: "did_you_mean", buttons: dishButtons(recipes) };
    if (intent.outcome === "notFound") return { lead: textLead(`No encontré '${intent.phrase}' en tu plan ni en tus recetas.`) };
    return dishClarify(db, userId);
  },
  water: (db, userId, question, intent, today) => waterAnswer(db, userId, question, intent, today),
  exercise: (db, userId, question, intent, today) => exerciseAnswer(db, userId, question, intent, today),
  weight: (db, userId, question, intent, today) => weightAnswer(db, userId, question, intent, today),
  mealsDone: (db, userId, question, intent, today) => mealsDoneAnswer(db, userId, question, intent, today),
  ambiguous: metricChoice,
  goals: (db, userId, _question, intent) => goalsAnswer(db, userId, intent),
  weekly: (db, userId, _question, _intent, today) => weeklyAnswer(db, userId, today),
  cart: (db, userId) => cartSummary(db, userId),
  recipes: recipeList,
  plan: (db, userId, question) => planSummary(db, userId, normalizeText(question))
};

/** The interim answer of a topic whose builder has not landed (plan D3). Never asserted by a test; T063 requires none left. */
const pending = (topic: TopicId): Built => ({ lead: textLead(`Pronto podré responder sobre ${TOPICS[topic].title ?? "esta pregunta"}.`) });

/** REQ-3: only the user's own, live, non-generic recipes can be named; the array is already in seq order. */
const namedRecipes = (db: AppDb, userId: string) => db.recipes.filter((recipe) => recipe.user_id === userId && !recipe.deleted_at && !isGeneric(recipe.name));

const DISH_CHOICES = 3;

/** REQ-25: a dish cue with no dish asks which one, offering the first recipes, or the plan's slots when there are none. */
function dishClarify(db: AppDb, userId: string): Built {
  const recipes = namedRecipes(db, userId).slice(0, DISH_CHOICES);
  const buttons = recipes.length ? dishButtons(recipes) : slotChoices(planSlots(db, userId)?.slots ?? [], "options");
  return { lead: textLead("¿De qué platillo?"), kind: "clarify", buttons };
}

/** REQ-25: ambiguous progress asks which metric, each button being that metric's own topic button. */
function metricChoice(): Built {
  const buttons = (["water", "exercise", "mealsDone"] as const).map((topic): Button => ({ type: "question", label: TOPICS[topic].title!, message: TOPICS[topic].button! }));
  return { lead: textLead("¿Te refieres a agua, ejercicio o comidas?"), kind: "clarify", buttons };
}

/** The message that offers an intent's topic as a button (Topics, Button column). A slot topic is offered only for one concrete slot of the plan: no button is better than one that asks again. */
function offerOf(db: AppDb, userId: string, intent: Intent): string | undefined {
  const topic = intent.topic as TopicId;
  const ask = topic === "mealTimes" ? "times" : topic === "slotOptions" ? "options" : undefined;
  if (!ask || !intent.slot) return TOPICS[topic].button ?? undefined;
  const plan = planSlots(db, userId);
  const chosen = plan && chooseSlot(plan, intent.slot, ask, intent.ordinal);
  return chosen && "slot" in chosen ? slotMessage(ask, chosen.slot.ref) : undefined;
}

/** A block that asks something (REQ-7, REQ-11, REQ-25, REQ-26) stands alone in its answer (REQ-24). */
const asks = (built: Built) => built.kind === "clarify" || built.kind === "did_you_mean";

/** A navigation button that an earlier block already has (the same label and destination) is dropped from the later one. */
function withoutRepeatedLinks(buttons: Button[], seen: Set<string>): Button[] {
  return buttons.filter((button) => {
    if (button.type !== "link") return true;
    const key = `${button.label} ${button.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const DID_YOU_MEAN = "¿Quisiste decir…?";

/** One button per candidate recipe, sending the exact name so that REQ-3 rule 1 opens it. */
const dishButtons = (recipes: { name: string }[]): Button[] => recipes.map(({ name }) => ({ type: "question", label: name, message: `¿Qué lleva ${name}?` }));

// REQ-28: the lead of a greeting, of thanks and of the no-match reply, one per variant of the spec Copy, in its order.
const GREETINGS = ["¡Hola! ¿En qué te ayudo?", "¡Hola! ¿Qué quieres saber?", "¡Hola! Pregúntame por tu plan, tu avance o tu carrito."];
const THANKS = ["¡Con gusto!", "¡De nada!", "Para eso estoy."];
const NO_MATCH_LEADS = ["No entendí tu pregunta. Puedo ayudarte con:", "Perdón, no entendí. Puedo ayudarte con:"];

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
    const lead = pickVariant(greeting === "thanks" ? THANKS : GREETINGS, message);
    return reply("greeting", standalone(lead), starters, [], trace ? [{ topic: "greeting" }] : undefined);
  }

  const recipes = namedRecipes(db, user.id);
  const { intents, overflow: further } = resolve(message, recipes, today);
  if (!intents.length) {
    // REQ-29 (step 8): recipe words in a question with nothing else resolved are offered, never opened.
    const candidates = rankDish(message, recipes);
    if (candidates.length) return reply("did_you_mean", standalone(DID_YOU_MEAN), dishButtons(candidates), [], trace ? [] : undefined);
    return reply("no_match", standalone(pickVariant(NO_MATCH_LEADS, message)), starters, [], trace ? [] : undefined);
  }

  // The resolver only returns topics of the table.
  const parts = intents.map((intent) => {
    const topic = intent.topic as TopicId;
    return { topic, intent, built: BUILDERS[topic]?.(db, user.id, message, intent, today) ?? pending(topic) };
  });

  // REQ-24: a clarification stands alone (a later one is omitted), and only one block holds buttons: a second block that
  // would hold them too is offered as its topic button instead.
  const [first, second] = parts;
  let kept = parts;
  const offers: (string | undefined)[] = [];
  if (asks(first.built) || (second && asks(second.built))) kept = [first];
  else if (second && first.built.buttons && second.built.buttons) {
    kept = [first];
    offers.push(offerOf(db, user.id, second.intent));
  }
  // A topic without a button (identity, a slot the plan lacks, ...) is left out silently.
  offers.push(...further.map((intent) => offerOf(db, user.id, intent)));

  const seenLinks = new Set<string>();
  const blocks = kept.map(({ topic, built }): Block => ({
    title: kept.length > 1 ? (built.title ?? TOPICS[topic].title) : null,
    lead: built.lead,
    sections: built.sections ?? [],
    buttons: withoutRepeatedLinks(built.blockButtons ?? [], seenLinks)
  }));

  // A block that asks something (REQ-7, REQ-11, REQ-27) brings its own buttons in place of the follow-ups; the last
  // block's follow-ups, then the overflow, follow them (REQ-24). A clarification brings nothing else.
  const own = kept.find((part) => part.built.buttons)?.built.buttons ?? [];
  const last = kept[kept.length - 1];
  const asked = normalizeText(message);
  // Repeat rule (chat-polish REQ-5): a follow-up that repeats the question just asked is not offered. Follow-ups only.
  const followUps = last.built.buttons ? [] : (last.built.followUps ?? TOPICS[last.topic].followUps).filter((text) => normalizeText(text) !== asked);
  // A button is offered once: an overflow topic can also be one of the follow-ups, or one of the block's own slot buttons (REQ-24).
  const ownMessages = new Set(own.flatMap((button) => (button.type === "question" ? [button.message] : [])));
  const more = asks(first.built) ? [] : [...new Set([...followUps, ...offers.flatMap((offer) => offer ?? [])])].filter((text) => !ownMessages.has(text)).map(questionButton);
  const kind = asks(first.built) ? first.built.kind! : kept.some((part) => part.built.kind === "detail") ? "detail" : "answer";
  return reply(kind, blocks, [...own, ...more], [...new Set(kept.flatMap((part) => part.built.sources ?? []))], trace ? intents : undefined);
}
