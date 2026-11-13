"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, MessageSquarePlus, Mic, Square, X } from "lucide-react";
import { AssistantTurn, ButtonList, STARTER_BUTTONS, type Turn } from "./AssistantTurn";
import { useMediaQuery } from "@/lib/client/useMediaQuery";
import { PromptInput } from "./PromptInput";
import { ScrollButton } from "./ScrollButton";
import { useChatScroll } from "./useChatScroll";
import { useDictation } from "./useDictation";
import { questionButtonsTurnId } from "@/lib/client/assistant-thread";
import "./assistant-chat.css";

// Same breakpoint as the sheet rules in assistant-chat.css.
export const SHEET_QUERY = "(max-width: 640px)";

type Props = {
  title?: string;
  subtitle: string;
  turns: Turn[];
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever something outside the panel (the dashboard search bar) asks, so the input takes focus even if the panel is already open. */
  focusRequest: number;
  onSend: (message: string) => void;
  /** A question button: sends its message as a user turn. */
  onSuggest: (message: string) => void;
  onRetry: (turn: Turn) => void;
  /** Nueva conversación: empties the thread and drops any pending answer. */
  onClear: () => void;
};

// Floating chat over the RAG endpoint: a FAB in the bottom-right corner opens the panel (kept mounted so the
// conversation survives closing it). The 4 starters when empty, one article per turn, pill composer with dictation.
export function AssistantChat({ title = "Asistente", subtitle, turns, busy, open, onOpenChange, focusRequest, onSend, onSuggest, onRetry, onClear }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dictation = useDictation(setDraft);
  const sheet = useMediaQuery(SHEET_QUERY);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, focusRequest]);

  // Escape closes the panel; a popup inside it takes Escape first by calling preventDefault.
  // In the modal sheet Tab wraps, because inert on the page alone lets focus escape to the browser's own controls.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") close();
      else if (event.key === "Tab" && sheet) wrapTab(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sheet]);

  // The FAB is `display: none` while the sheet is open, so it can take focus only after the closing render.
  const returnFocus = useRef(false);
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    fabRef.current?.focus();
  }, [open]);

  // The sheet follows the visual viewport, so the on-screen keyboard shrinks it instead of covering the composer.
  // The vars only matter at ≤640 px (the CSS falls back to the full viewport without them).
  useEffect(() => {
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    if (!open || !panel || !viewport) return;
    const follow = () => {
      panel.style.setProperty("--vv-height", `${viewport.height}px`);
      panel.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
    };
    follow();
    viewport.addEventListener("resize", follow);
    viewport.addEventListener("scroll", follow);
    return () => {
      viewport.removeEventListener("resize", follow);
      viewport.removeEventListener("scroll", follow);
      panel.style.removeProperty("--vv-height");
      panel.style.removeProperty("--vv-top");
    };
  }, [open]);

  function close() {
    dictation.stop();
    returnFocus.current = true;
    onOpenChange(false);
  }

  // A navigation link (REQ-34, REQ-35). The thread lives in the shell, so it survives the navigation. A link to the page
  // already open only closes the sheet and focuses the FAB; one that navigates closes the sheet at ≤640 px and, once the
  // path has changed, hands focus to the destination's main heading, as a normal navigation would.
  const pathname = usePathname();
  const navigatingFrom = useRef<string | null>(null);
  function onLogClick(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-variant="link"]');
    // A modified click opens a new tab or window: this page and the sheet stay as they are.
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(link.href);
    if (destination.pathname + destination.search === location.pathname + location.search) {
      if (sheet) close();
      return;
    }
    navigatingFrom.current = pathname;
    if (sheet) {
      dictation.stop();
      onOpenChange(false);
    }
  }
  useEffect(() => {
    if (navigatingFrom.current === null || navigatingFrom.current === pathname) return;
    navigatingFrom.current = null;
    // While the destination's loading state shows there may be no heading yet; the main region is the fallback.
    const target = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("main");
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus();
  }, [pathname]);

  function wrapTab(event: KeyboardEvent) {
    const panel = panelRef.current;
    if (!panel) return;
    // Only what Tab can really land on: not display:none, not roving tabindex="-1" options, not disabled or hidden.
    const stops = [...panel.querySelectorAll<HTMLElement>("button, textarea, input, a[href], [tabindex]")].filter(
      (node) =>
        node.tabIndex >= 0 &&
        !node.matches(":disabled") &&
        !node.closest("[inert]") &&
        node.getClientRects().length > 0 &&
        getComputedStyle(node).visibility !== "hidden"
    );
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first?.focus();
    }
  }

  const { logRef, atBottom, scrollToBottom } = useChatScroll(turns);

  function jumpToLast() {
    scrollToBottom();
    inputRef.current?.focus();
  }

  function startOver() {
    dictation.stop();
    followTurn.current = false;
    onClear();
    inputRef.current?.focus();
  }

  // Question buttons sit under the latest finished answer only; a pending new question keeps them on screen, disabled.
  const lastAssistant = turns.findLast((turn) => turn.role === "assistant");
  const buttonsTurnId = questionButtonsTurnId(turns);

  // A button or Reintentar disappears or turns disabled once the request is sent, which would drop focus on <body>. Desktop
  // goes to the input. The sheet keeps the on-screen keyboard down: focus waits on the log, then moves to the new turn
  // (REQ-22), unless the user has moved it somewhere else meanwhile.
  const followTurn = useRef(false);
  function keepFocus() {
    if (sheet) {
      followTurn.current = true;
      logRef.current?.focus({ preventScroll: true });
    } else {
      inputRef.current?.focus();
    }
  }
  useEffect(() => {
    if (!followTurn.current) return;
    const last = turns.findLast((turn) => turn.role === "assistant");
    if (last?.role === "assistant" && last.status === "pending") return;
    followTurn.current = false;
    const log = logRef.current;
    if (last && log && document.activeElement === log && log.lastElementChild instanceof HTMLElement) log.lastElementChild.focus({ preventScroll: true });
  }, [turns]);

  const askButton = (message: string) => {
    dictation.stop();
    onSuggest(message);
    keepFocus();
  };
  const retry = (turn: Turn) => {
    onRetry(turn);
    keepFocus();
  };

  function ask(text: string) {
    dictation.stop();
    setDraft("");
    onSend(text.trim());
  }

  const placeholder = dictation.listening
    ? "Escuchando… toca ■ para terminar"
    : dictation.transcribing
      ? dictation.download != null ? `Descargando modelo de voz… ${dictation.download}%` : "Transcribiendo…"
      : "Escribe tu pregunta";

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={open ? "assistant-fab open" : "assistant-fab"}
        onClick={() => (open ? close() : onOpenChange(true))}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        aria-expanded={open}
        aria-controls="assistant-chat-panel"
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>
      {open && sheet && <div className="assistant-chat-backdrop" aria-hidden="true" />}
      <aside ref={panelRef} id="assistant-chat-panel" className={open ? "assistant-chat open" : "assistant-chat"} aria-label={title} aria-hidden={!open} inert={!open}>
        <header>
          <span className="assistant-chat-icon"><Bot size={20} /></span>
          <div className="assistant-chat-heading">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {turns.length > 0 && (
            <button type="button" className="assistant-chat-new" onClick={startOver} aria-label="Nueva conversación" title="Nueva conversación">
              <MessageSquarePlus size={16} aria-hidden="true" /> <span>Nueva conversación</span>
            </button>
          )}
          <button type="button" className="assistant-chat-close" onClick={close} aria-label="Cerrar asistente"><X size={18} /></button>
        </header>
        <div className="assistant-chat-body">
          <div className="assistant-chat-log" ref={logRef} tabIndex={-1} onClick={onLogClick}>
            {turns.length === 0 && (
              <div className="assistant-chat-empty">
                <p>Pregúntame lo que quieras saber. Respondo con la información de tus planes.</p>
                <ButtonList buttons={STARTER_BUTTONS} action={{ disabled: busy, onAsk: askButton }} />
              </div>
            )}
            {turns.map((turn) => <AssistantTurn key={turn.id} turn={turn} buttonsAction={turn.id === buttonsTurnId ? { disabled: busy, onAsk: askButton } : undefined} onRetry={turn.id === lastAssistant?.id ? retry : undefined} />)}
          </div>
          <ScrollButton visible={!atBottom} onClick={jumpToLast} />
        </div>
        {dictation.error && <p className="assistant-chat-error" role="alert">{dictation.error}</p>}
        <PromptInput value={draft} onValueChange={setDraft} onSubmit={ask} busy={busy} placeholder={placeholder} readOnly={dictation.transcribing} inputRef={inputRef}>
          {dictation.supported && (
            <button
              type="button"
              className={dictation.listening ? "assistant-mic listening" : "assistant-mic"}
              disabled={dictation.transcribing}
              onClick={() => (dictation.listening ? dictation.stop() : dictation.start(draft))}
              aria-label={dictation.listening ? "Detener dictado" : "Dictar pregunta"}
              aria-pressed={dictation.listening}
              title={dictation.listening ? "Detener dictado" : "Dictar pregunta"}
            >
              {dictation.transcribing ? <Loader2 size={18} className="spin" /> : dictation.listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
            </button>
          )}
        </PromptInput>
      </aside>
    </>
  );
}
