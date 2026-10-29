// Shared by the assistant UI and the chat API (spec assistant-chat-polish). Pure on purpose: no db or Node imports,
// so both the client bundle and the server can load it.

/** Longest message, in UTF-16 code units, counted on the trimmed text (REQ-10). */
export const MAX_MESSAGE = 500;
/** Length from which the composer shows the "n/500" counter. */
export const COUNTER_FROM = 450;

/** The starter questions of the empty state, the greeting and the no-match reply (spec Copy, REQ-4). */
export const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"];

/**
 * Lowercase, accent-free text without the leading and trailing ¿ ? ¡ ! . characters (spec Terms).
 * Whitespace is trimmed first and after the strip, so "  ¿Hola?  " and "hola" compare equal.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^[¿?¡!.\s]+|[¿?¡!.\s]+$/g, "");
}

/** The words of a text: maximal runs of letters and digits of its normalized form. */
export function words(value: string): string[] {
  return normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Length that every limit uses: the trimmed text's `.length`. */
export function messageLength(value: string): number {
  return value.trim().length;
}

// Response of POST /api/rag/chat (contracts/chat-api.md). `answer`, `context_used` and `sources` are the original fields.
export type Span = { text: string; highlight?: true };
export type Rich = Span[];
export type ReplyKind = "answer" | "options" | "detail" | "clarify" | "did_you_mean" | "greeting" | "no_match" | "empty";
export type Section = { title: string; items: Rich[] };

/** A button the server sends (the client derives none): a question that is sent as a user turn, or an in-app link ("/", "/plans", "/recipes/<id>"). */
export type Button =
  | { type: "question"; label: string; message: string; layout?: "option" }
  | { type: "link"; label: string; href: string };

/** One titled part of an answer: options, paging and navigation buttons belong to the block. */
export type Block = { title: string | null; lead: Rich; sections: Section[]; buttons: Button[] };

/** What the resolver found in a question; only the test trace (`resolved`) exposes it. Fields are filled as the resolver learns them. */
export type Intent = { topic: string; slot?: string; recipeIds?: string[]; option?: number; page?: number; period?: string };

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
