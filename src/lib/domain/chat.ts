import type { AppDb, AppUser } from "@/lib/types";
import { type Block, type Button, type ChatAnswer, type Intent, type ReplyKind, type Rich, type Section, normalizeText, STARTERS, words } from "@/lib/assistant";
import { consolidateCart } from "@/lib/domain/cart";
import { greetingOf, isTopicWord, matchTopic, TOPICS, type TopicId } from "@/lib/domain/chat-topics";
import { activePlan } from "@/lib/domain/plans";
import { formatQty, normalize } from "@/lib/domain/nutrition";

const plain = (rich: Rich) => rich.map((span) => span.text).join("");

/** The plain `answer` of the contract: each block's title, lead, then each section's title line and one line per item. */
const answerText = (blocks: Block[]) =>
  blocks.flatMap((block) => [...(block.title ? [block.title] : []), plain(block.lead), ...block.sections.flatMap((section) => [section.title, ...section.items.map(plain)])]).join("\n");

const questionButton = (message: string): Button => ({ type: "question", label: message, message });

/** The response: blocks and buttons, the plain `answer`, and the scope-era fields the old client still reads (removed in T016). */
function reply(kind: ReplyKind, blocks: Block[], buttons: Button[], sources: string[], resolved: Intent[] | undefined): ChatAnswer {
  return {
    answer: answerText(blocks),
    context_used: "Todo el sistema",
    sources,
    kind,
    blocks,
    buttons,
    ...(resolved ? { resolved } : {}),
    lead: blocks[0].lead,
    body: null,
    sections: blocks.flatMap((block) => block.sections),
    follow_ups: buttons.flatMap((button) => (button.type === "question" ? [{ text: button.message, scope: "auto" as const }] : []))
  };
}

const standalone = (lead: string): Block[] => [{ title: null, lead: [{ text: lead }], sections: [], buttons: [] }];

const textLead = (text: string): Rich => [{ text }];
const NO_PLAN_LEAD = "No tienes un plan activo.";
const MAX_ITEMS = 8;

/** What a builder returns; `ragAnswer` adds the kind and the follow-ups. */
type Built = { lead: Rich; sections?: Section[]; sources?: string[] };

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

function mealTimes(db: AppDb, userId: string): Built {
  const plan = activePlan(db, userId);
  if (!plan?.current_version) return { lead: textLead(NO_PLAN_LEAD) };
  const meals = plan.current_version.structured_data.meals;
  const lead = meals.some((meal) => meal.time_window) ? "Estos son los horarios de tus comidas." : "Tu plan no tiene horarios para tus comidas.";
  const items = meals.map((meal): Rich => (meal.time_window ? withValue(meal.name, meal.time_window) : [{ text: meal.name }]));
  return { lead: textLead(lead), sections: section("Comidas", items), sources: [`Plan activo: ${plan.name}`] };
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

// Question words that never narrow the recipe list: the stop words of the spec (REQ-1) and, via `isTopicWord`, the Topics vocabulary.
const STOP_WORDS = new Set(["que", "hay", "en", "mi", "mis", "de", "del", "el", "la", "los", "las", "con", "para", "por", "tengo", "cual", "cuales", "como", "cuanto", "es", "un", "una"]);

function recipeList(db: AppDb, userId: string, question: string): Built {
  const recipes = db.recipes.filter((item) => item.user_id === userId && !item.deleted_at);
  if (!recipes.length) return { lead: textLead("Aún no tienes recetas.") };
  const filter = words(question).filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !isTopicWord(word));
  const matching = recipes.filter((recipe) => words(recipe.name).some((word) => filter.includes(word)));
  const filtered = matching.length > 0;
  return {
    lead: textLead(filtered ? "Estas recetas coinciden con tu pregunta." : "Estas son tus recetas."),
    sections: section("Recetas", (filtered ? matching : recipes).map((item) => [{ text: item.name }])),
    sources: ["Recetario"]
  };
}

const BUILDERS: Partial<Record<TopicId, (db: AppDb, userId: string, question: string) => Built>> = {
  mealTimes: (db, userId) => mealTimes(db, userId),
  cart: (db, userId) => cartSummary(db, userId),
  recipes: recipeList,
  plan: (db, userId, question) => planSummary(db, userId, normalize(question))
};

/** The interim answer of a topic whose builder has not landed (plan D3). Never asserted by a test; T063 requires none left. */
const pending = (topic: TopicId): Built => ({ lead: textLead(`Pronto podré responder sobre ${TOPICS[topic].title}.`) });

/**
 * The answer to one message: depends only on the message, the user's data and `today` (REQ-5). `trace` adds the
 * resolved intents for the e2e suite (plan D2). `today` is read once the date-based topics exist (US3).
 */
export function ragAnswer(db: AppDb, user: AppUser, message: string, _today: string, { trace = false }: { trace?: boolean } = {}): ChatAnswer {
  const starters = STARTERS.map(questionButton);
  const greeting = greetingOf(message);
  if (greeting) {
    const lead = greeting === "thanks" ? "¡Con gusto!" : "¡Hola! ¿En qué te ayudo?";
    return reply("greeting", standalone(lead), starters, [], trace ? [{ topic: "greeting" }] : undefined);
  }

  const topic = matchTopic(message);
  if (!topic) return reply("no_match", standalone("No entendí tu pregunta. Puedo ayudarte con:"), starters, [], trace ? [] : undefined);

  const built = BUILDERS[topic]?.(db, user.id, message) ?? pending(topic);
  const asked = normalizeText(message);
  // Repeat rule (chat-polish REQ-5): a follow-up that repeats the question just asked is not offered. Follow-ups only.
  const followUps = TOPICS[topic].followUps.filter((text) => normalizeText(text) !== asked).map(questionButton);
  const block: Block = { title: null, lead: built.lead, sections: built.sections ?? [], buttons: [] };
  return reply("answer", [block], followUps, built.sources ?? [], trace ? [{ topic }] : undefined);
}
