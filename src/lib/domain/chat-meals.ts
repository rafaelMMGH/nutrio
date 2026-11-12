import { type Button, type Rich, type Section, STARTERS, normalizeText } from "@/lib/assistant";
import type { AppDb } from "@/lib/types";
import { activeSchedule } from "@/lib/domain/plans";

// Slots of the active plan for the assistant (spec assistant-data-scope REQ-7, REQ-8, REQ-11): the slot list with its
// refs, the word-to-slot mapping, the choice replies (several slots, almuerzo, slot not in the plan) and the time lead.

/** What a builder returns; `ragAnswer` adds the kind and the follow-ups. `buttons` (a choice) replace the follow-ups. */
export type Built = { lead: Rich; sections?: Section[]; sources?: string[]; buttons?: Button[]; kind?: "clarify" };

/** A meal type of the active plan. `ref` is its name, or with duplicate names its ordinal form ("Segunda colación"). */
export type Slot = { name: string; time: string; ref: string };
export type SlotPlan = { planName: string; slots: Slot[] };

const FEMININE = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];
const MASCULINE = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"];
const MASCULINE_SLOTS = ["desayuno", "almuerzo", "snack"];

/** Beyond the tenth duplicate the ref is "<Slot> <n>" ("Colación 11"). */
function ordinalRef(name: string, key: string, position: number): string {
  if (position > FEMININE.length) return `${name} ${position}`;
  return `${(MASCULINE_SLOTS.includes(key) ? MASCULINE : FEMININE)[position - 1]} ${name.toLowerCase()}`;
}

/** The plan's slots in plan order, or null without an active plan. */
export function planSlots(db: AppDb, userId: string): SlotPlan | null {
  const schedule = activeSchedule(db, userId);
  if (!schedule) return null;
  const keys = schedule.meals.map((meal) => normalizeText(meal.name));
  const seen = new Map<string, number>();
  const slots = schedule.meals.map((meal, index): Slot => {
    const key = keys[index];
    const position = (seen.get(key) ?? 0) + 1;
    seen.set(key, position);
    const duplicated = keys.filter((other) => other === key).length > 1;
    return { name: meal.name, time: meal.time_window || "", ref: duplicated ? ordinalRef(meal.name, key, position) : meal.name };
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

const slotButton = (slot: Slot, ask: SlotAsk, label = slot.ref, text = slot.ref): Button => ({ type: "question", label, message: `${ASKS[ask]} ${text.toLowerCase()}?` });
/** "colación" → "colaciones" (the accent goes), "desayuno" → "desayunos", "snack" → "snacks", "luz" → "luces". */
function plural(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("ón")) return `${lower.slice(0, -2)}ones`;
  if (lower.endsWith("z")) return `${lower.slice(0, -1)}ces`;
  return /[aeiouk]$/.test(lower) ? `${lower}s` : `${lower}es`;
}
const withAccent = (word: string) => (word === "colacion" ? "colación" : word);

/**
 * The slot a slot word names, or the reply that asks for it: several slots with that name (REQ-11), "almuerzo" with
 * no such slot (REQ-7), or a slot the plan lacks (REQ-27). `ask` says which question the choice buttons send.
 */
export function chooseSlot(plan: SlotPlan, word: string, ask: SlotAsk): { slot: Slot } | { built: Built } {
  const sources = [`Plan activo: ${plan.planName}`];
  const found = slotsNamed(plan.slots, word);
  if (found.length === 1) return { slot: found[0] };
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
  const buttons = plan.slots.length ? plan.slots.map((slot) => slotButton(slot, ask)) : STARTERS.map((message): Button => ({ type: "question", label: message, message }));
  return { built: { lead: [{ text: `Tu plan no tiene ${withAccent(word)}.` }], buttons, sources } };
}

/** REQ-8: one slot's time highlighted, or that it has none. */
export function slotTimeLead(slot: Slot): Rich {
  const ref = slot.ref.toLowerCase();
  return slot.time ? [{ text: `Tu horario de ${ref}: ` }, { text: slot.time, highlight: true }, { text: "." }] : [{ text: `Tu plan no tiene horario para tu ${ref}.` }];
}
