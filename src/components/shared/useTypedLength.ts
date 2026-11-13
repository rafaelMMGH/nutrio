// Adapted from prompt-kit (https://github.com/ibelick/prompt-kit), MIT License
// Copyright (c) 2025 Julien Thibeaut
// Changes: the response-stream typewriter reduced to a hook over grapheme counts, once-per-identity completion.
"use client";

import { useEffect, useRef, useState } from "react";
import { typingDuration, visibleCharacters } from "@/lib/client/text-stream";
import { useMediaQuery } from "@/lib/client/useMediaQuery";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Differs from every identity, including `undefined`, so the first completion always fires. */
const NOT_YET = Symbol("not completed yet");

type Options = {
  /** Show everything now (tap to complete, or an answer that already typed); still fires `onComplete` once. */
  instant?: boolean;
  onComplete?: () => void;
  /** What the text is: `onComplete` fires once per identity. Defaults to the length. */
  identity?: unknown;
};

/**
 * How many of `length` units (graphemes, see text-stream.ts) are revealed, typing them out once over
 * `typingDuration(length)`. Reduced motion, an empty text and `instant` show all of it from the first render, so
 * there is no frame at 0. `onComplete` fires once per identity (the length unless given): React strict mode re-runs the effect and an `instant`
 * switch after completion re-runs it too, and neither may fire it again.
 */
export function useTypedLength(length: number, { instant = false, onComplete, identity = length }: Options = {}): number {
  const reduced = useMediaQuery(REDUCED_MOTION);
  const skip = instant || reduced || length === 0;
  const [typed, setTyped] = useState(() => (skip ? length : 0));
  const onCompleteRef = useRef(onComplete);
  const completedIdentity = useRef<unknown>(NOT_YET);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Remembered across effect re-runs (strict mode, `instant` flipping); a different identity starts afresh.
    const finish = () => {
      if (completedIdentity.current === identity) return;
      completedIdentity.current = identity;
      onCompleteRef.current?.();
    };
    if (skip) {
      finish();
      return;
    }
    setTyped(0);
    const duration = typingDuration(length);
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const elapsed = now - start;
      setTyped(visibleCharacters(length, elapsed));
      if (elapsed >= duration) finish();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [length, skip, identity]);

  return skip ? length : Math.min(typed, length);
}
