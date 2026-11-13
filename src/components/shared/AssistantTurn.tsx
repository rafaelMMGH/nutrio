// Adapted from prompt-kit (https://github.com/ibelick/prompt-kit), MIT License
// Copyright (c) 2025 Julien Thibeaut
// (the "Pensando…" Loader text variant)
import { Bot, RotateCcw } from "lucide-react";
import { STARTERS, type Block, type Button, type ChatAnswer, type Rich } from "@/lib/assistant";
import { AssistantButton } from "./AssistantButton";

/** What a turn sent: the message alone, with no scope, page or history (REQ-4, REQ-5). */
export type AssistantRequest = { message: string };

/** One entry of the conversation. The pending and the finished assistant turn of a request share one id, so React keeps the same element. */
export type Turn =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      request: AssistantRequest;
      status: "pending" | "answer" | "error";
      /** On an error turn: the server answered HTTP 500, which has its own copy (chat-polish REQ-23). */
      server?: boolean;
      /** Set while a Reintentar is pending: the buttons of the earlier answer stay hidden until it settles (REQ-5). */
      retrying?: boolean;
      answer?: ChatAnswer;
    };

/** Where question buttons can be asked from; absent on every answer but the latest (REQ-5). Links need no such action. */
export type ButtonsAction = { disabled: boolean; onAsk: (message: string) => void };

/** The starter questions of an empty thread (REQ-4), as the server sends them. */
export const STARTER_BUTTONS: Button[] = STARTERS.map((message) => ({ type: "question", label: message, message }));

/** Question buttons send their message as a user turn; links navigate in-app and stay on every answer. `className` tells the answer-level and starter row from a block's actions. */
export function ButtonList({ buttons, action, className = "assistant-chips" }: { buttons: Button[]; action?: ButtonsAction; className?: string }) {
  const shown = buttons.filter((button) => button.type === "link" || action);
  if (shown.length === 0) return null;
  return (
    <div className={className}>
      {shown.map((button, index) => <AssistantButton key={`${index}:${button.label}`} button={button} disabled={action?.disabled} onAsk={action?.onAsk} />)}
    </div>
  );
}

export const ERROR_TEXT = "No pude responder en este momento.";
export const SERVER_ERROR_TEXT = "Algo salió mal al responder. Intenta de nuevo.";

/** prompt-kit's text loader: the words blink between two theme colors (a static word under reduced motion, in CSS). */
function Loader({ text }: { text: string }) {
  return <span className="assistant-loader">{text}</span>;
}

/** Spans in order; a highlighted span is bold (weight 700, not color-only) so values stand out (REQ-2). */
function RichText({ rich }: { rich: Rich }) {
  return rich.map((span, index) => (span.highlight ? <strong key={index}>{span.text}</strong> : <span key={index}>{span.text}</span>));
}

function BlockContent({ block }: { block: Block }) {
  return (
    <div className="assistant-turn-block">
      {block.title && <h3 className="assistant-turn-block-title">{block.title}</h3>}
      {block.lead.length > 0 && <p className="assistant-turn-lead"><RichText rich={block.lead} /></p>}
      {block.sections.map((section) => (
        <section key={section.title} className="assistant-turn-section">
          <h4>{section.title}</h4>
          <ul>
            {section.items.map((item, index) => <li key={index}><RichText rich={item} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The structured answer's text: its blocks, then the sources line (REQ-2, REQ-3). Never the plain `answer`. Block buttons are not here: they stay outside the live region (REQ-33). */
function AnswerContent({ answer }: { answer: ChatAnswer }) {
  return (
    <>
      {answer.blocks.map((block, index) => <BlockContent key={index} block={block} />)}
      {answer.sources.length > 0 && <p className="assistant-turn-sources">Basado en: {answer.sources.join(", ")}</p>}
    </>
  );
}

// One turn of the conversation. The assistant turn keeps its live region mounted from the moment the request is sent, so
// a screen reader announces the answer when it lands; the article takes script focus only (tabIndex -1); the pending indicator and the answer-level buttons stay outside the region.
export function AssistantTurn({
  turn,
  buttonsAction,
  onRetry
}: {
  turn: Turn;
  buttonsAction?: ButtonsAction;
  /** Only the latest assistant turn gets one; an older error turn offers no Reintentar (REQ-8). */
  onRetry?: (turn: Turn) => void;
}) {
  if (turn.role === "user") {
    return (
      <article className="assistant-turn user" aria-label="Tú">
        <div className="assistant-bubble">
          <p>{turn.text}</p>
        </div>
      </article>
    );
  }
  const pending = turn.status === "pending";
  const answer = turn.status === "answer" ? turn.answer : undefined;
  return (
    <article className={pending ? "assistant-turn assistant is-pending" : "assistant-turn assistant"} aria-label="Asistente" tabIndex={-1}>
      <div className="assistant-avatar" aria-hidden="true">
        <Bot size={18} />
      </div>
      <div className="assistant-bubble">
        <div className="assistant-turn-live" aria-live="polite">
          {answer ? <AnswerContent answer={answer} /> : turn.status === "error" ? <p>{turn.server ? SERVER_ERROR_TEXT : ERROR_TEXT}</p> : null}
        </div>
        {answer && <ButtonList buttons={answer.blocks.flatMap((block) => block.buttons)} action={buttonsAction} className="assistant-actions" />}
        {pending && <div className="assistant-turn-pending"><Loader text="Pensando…" /></div>}
      </div>
      {turn.status === "error" && onRetry && (
        <button type="button" className="assistant-retry" onClick={() => onRetry(turn)}>
          <RotateCcw size={14} aria-hidden="true" /> Reintentar
        </button>
      )}
      {answer && <ButtonList buttons={answer.buttons} action={buttonsAction} />}
    </article>
  );
}
