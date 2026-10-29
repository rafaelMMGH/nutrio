"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import type { AssistantRequest, Turn } from "@/components/shared/AssistantTurn";
import { api, ApiError } from "@/lib/client/api";
import type { ChatAnswer } from "@/lib/assistant";

/** What the current page tells the floating assistant: its subtitle, a label only that never reaches the request (REQ-4). */
export type AssistantPageContext = { subtitle: string };

/** A request still pending after this long is given up on (REQ-8). */
const REQUEST_TIMEOUT_MS = 15_000;

/** The request is the message alone: no scope, recipe, history or date (REQ-4, REQ-5). */
const askRag = ({ message }: AssistantRequest) => api("/api/rag/chat", { method: "POST", body: JSON.stringify({ message }) }) as Promise<ChatAnswer>;

const DEFAULT_CONTEXT: AssistantPageContext = { subtitle: "Sobre tus planes, recetas y compras" };

const PageContextSetter = createContext<((context: AssistantPageContext | null) => void) | null>(null);
export const AssistantPageProvider = PageContextSetter.Provider;

// Lets a page swap the assistant's subtitle while it is mounted. The context is plain data.
export function useAssistantContext(context: AssistantPageContext) {
  const setContext = useContext(PageContextSetter);
  const key = JSON.stringify(context);
  useLayoutEffect(() => {
    setContext?.(JSON.parse(key));
  }, [setContext, key]);
  // Only leaving the page clears the context.
  useLayoutEffect(() => () => setContext?.(null), [setContext]);
}

// State behind the single floating assistant the shell renders on every page.
export function useAssistantState() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [page, setPage] = useState<AssistantPageContext | null>(null);
  const context = page ?? DEFAULT_CONTEXT;
  const busyRef = useRef(false);
  const nextId = useRef(0);
  const generation = useRef(0);

  /**
   * Asks `sent` for the turn `id` and settles that turn with the answer or the error. Requests are never aborted: each
   * attempt takes a generation, and only the attempt holding the current one may settle the turn or free the guard. A
   * timeout bumps it, so a late answer finds itself discarded (REQ-8); Nueva conversación (REQ-9) does the same.
   */
  const attempt = useCallback(async (id: string, sent: AssistantRequest) => {
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    const settle = (turn: Turn) => setTurns((current) => current.map((entry) => (entry.id === id ? turn : entry)));
    const fail = (reason: string, error?: unknown) => {
      console.warn("Assistant request failed", { reason, error });
      settle({ id, role: "assistant", request: sent, status: "error", server: error instanceof ApiError && error.status === 500 });
    };
    const timer = setTimeout(() => {
      if (generation.current !== mine) return;
      generation.current++;
      busyRef.current = false;
      setBusy(false);
      fail(`no answer after ${REQUEST_TIMEOUT_MS / 1000} s`);
    }, REQUEST_TIMEOUT_MS);
    try {
      const answer = await askRag(sent);
      if (generation.current !== mine) return;
      settle({ id, role: "assistant", request: sent, status: "answer", answer });
    } catch (error) {
      if (generation.current !== mine) return;
      fail("request rejected", error);
    } finally {
      clearTimeout(timer);
      if (generation.current === mine) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, []);

  /** Sends one question. The pending turn and its result share an id (REQ-17). */
  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busyRef.current) return;
    busyRef.current = true;
    const id = `turn-${nextId.current++}`;
    const sent = { message };
    setTurns((current) => [...current, { id: `${id}-user`, role: "user", text: message }, { id, role: "assistant", request: sent, status: "pending" }]);
    await attempt(id, sent);
  }, [attempt]);

  /** Reintentar: the same turn goes back to pending and asks the same question (REQ-8). */
  const retry = useCallback(async (turn: Turn) => {
    if (turn.role !== "assistant" || turn.status !== "error" || busyRef.current) return;
    busyRef.current = true;
    setTurns((current) => current.map((entry) => (entry.id === turn.id ? { ...turn, status: "pending", retrying: true } : entry)));
    await attempt(turn.id, turn.request);
  }, [attempt]);

  /** Nueva conversación: empties the thread and discards whatever is pending, so its late answer lands nowhere (REQ-9). */
  const clear = useCallback(() => {
    generation.current++;
    busyRef.current = false;
    setBusy(false);
    setTurns([]);
  }, []);

  /** Opens the assistant and asks (used by the dashboard search bar). */
  const askInScope = useCallback(async (message: string) => {
    setOpen(true);
    setFocusRequest((count) => count + 1);
    await send(message);
  }, [send]);

  return { turns, busy, open, setOpen, focusRequest, context, setPage, send, retry, clear, askInScope };
}
