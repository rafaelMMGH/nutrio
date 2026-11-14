// Shared by the assistant UI and the chat API (spec assistant-chat-polish). Pure on purpose: no db or Node imports,
// so both the client bundle and the server can load it.

import type { Period } from "@/lib/domain/chat-dates";

/** Longest message, in UTF-16 code units, counted on the trimmed text (REQ-10). */
export const MAX_MESSAGE = 500;
/** Length from which the composer shows the "n/500" counter. */
export const COUNTER_FROM = 450;

/** The starter questions of the empty state, the greeting and the no-match reply (spec Copy, REQ-4). */
export const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"] as const;

/**
 * Normalized text (spec Terms): lowercase, accents removed (ñ compares as n), every non-letter, non-digit character
 * a space, runs of spaces collapsed and the ends trimmed. Plurals are not folded here; the matcher does that.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a text: the runs of letters and digits of its normalized form. */
export function words(value: string): string[] {
  const text = normalizeText(value);
  return text ? text.split(" ") : [];
}

/** Length that every limit uses: the trimmed text's `.length`. */
export function messageLength(value: string): number {
  return value.trim().length;
}

// Response of POST /api/rag/chat (contracts/chat-api.md). `answer`, `context_used` and `sources` are the original fields.
export type Span = { text: string; highlight?: true };
export type Rich = Span[];
export type ReplyKind = "answer" | "detail" | "clarify" | "did_you_mean" | "greeting" | "no_match";
export type Section = { title: string; items: Rich[] };

/** A button the server sends (the client derives none): a question that is sent as a user turn, or an in-app link ("/", "/plans", "/recipes/<id>"). */
export type Button =
  | { type: "question"; label: string; message: string; layout?: "option" }
  | { type: "link"; label: string; href: string };

/** How a button looks and behaves (spec REQ-34): `option` is a vertical block choice, `chip` any other question, `link` an in-app anchor. */
export type ButtonVariant = "option" | "chip" | "link";

export function variantOf(button: Button): ButtonVariant {
  if (button.type === "link") return "link";
  return button.layout === "option" ? "option" : "chip";
}

/** The option buttons of an answer: the server sends them answer-level (`buttons`, layout "option"), never inside a block. */
export function optionButtons(answer: Pick<ChatAnswer, "buttons">): Button[] {
  return answer.buttons.filter((button) => variantOf(button) === "option");
}

/**
 * "3 opciones: A; B; C" for the screen reader (REQ-33): the option buttons sit outside the live region, so their count
 * and labels go in as text, in the one block that holds them and in no other. The answer does not say which block that
 * is; in a 2-block answer it is the block titled with the slot the option messages start with ("Cena, opción 2"),
 * and without such a title the first block.
 */
export function optionAnnouncement(answer: Pick<ChatAnswer, "blocks" | "buttons">, blockIndex: number): string | null {
  const options = optionButtons(answer);
  if (options.length === 0) return null;
  const first = options[0];
  const titled = answer.blocks.findIndex((block) => block.title !== null && first.type === "question" && first.message.startsWith(`${block.title},`));
  if (blockIndex !== Math.max(0, titled)) return null;
  return `${options.length} ${options.length === 1 ? "opción" : "opciones"}: ${options.map((button) => button.label).join("; ")}`;
}

/** One titled part of an answer: options, paging and navigation buttons belong to the block. */
export type Block = { title: string | null; lead: Rich; sections: Section[]; buttons: Button[] };

/** What the resolver found in a question; only the test trace (`resolved`) exposes it. Fields are filled as the resolver learns them. */
export type Intent = {
  topic: string;
  slot?: string;
  /** Which of several same-named slots a typed ordinal or "<slot> <n>" names (1-based, REQ-11); the plan decides if it applies. */
  ordinal?: number;
  /** The ordinal was a bare number ("colación 2"): on a slot that is not duplicated it means option n (REQ-11). */
  numbered?: boolean;
  /** Goals narrowed to one metric ("meta de peso"). */
  metric?: "weight" | "exercise" | "water";
  /** What an identity question asks for. */
  of?: "name" | "plan";
  /** Dish questions: the recipe found, the candidates offered or nothing found; "clarify" is a dish cue with an empty phrase. */
  outcome?: "found" | "didYouMean" | "notFound" | "clarify";
  /** Dish questions: the phrase as typed, without the cue and the leading article (REQ-26). */
  phrase?: string;
  recipeIds?: string[];
  option?: number;
  page?: number;
  /** Metric questions: the period the message names (REQ-14); absent means the metric's default. */
  period?: Period;
  /** Metric questions: the message has a date cue that forms no recognized phrase, so the builder says so and shows its default (REQ-14). */
  periodUnrecognized?: true;
};

export type ChatAnswer = {
  answer: string;
  context_used: "Todo el sistema";
  sources: string[];
  kind: ReplyKind;
  blocks: Block[];
  /** Follow-ups then overflow, or the starters or clarify choices. */
  buttons: Button[];
  /** Only with the `x-e2e-trace: 1` test hook (plan D2); never in production. */
  resolved?: Intent[];
};
