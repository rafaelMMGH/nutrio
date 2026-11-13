// Adapted from prompt-kit's response-stream (https://github.com/ibelick/prompt-kit), MIT License
// Copyright (c) 2025 Julien Thibeaut
// Changes: typewriter only (no fade mode, no async streams, no injected <style>), a time-based reveal so a long text
// finishes within a fixed budget, prefers-reduced-motion and an `instant` switch (tap to complete) show the full text.
"use client";

import { useEffect, useRef, useState } from "react";
import { typingDuration, visibleCharacters } from "@/lib/client/text-stream";

type ResponseStreamProps = {
  text: string;
  /** Show the whole text now (tap to complete); fires `onComplete` once. */
  instant?: boolean;
  onComplete?: () => void;
  className?: string;
};

/** Types `text` out once. Reduced motion, an empty text and `instant` complete without animating. */
export function ResponseStream({ text, instant = false, onComplete, className }: ResponseStreamProps) {
  const [shown, setShown] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    const finish = () => {
      setShown(text.length);
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    };
    if (instant || text.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setShown(0);
    const duration = typingDuration(text.length);
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const elapsed = now - start;
      setShown(visibleCharacters(text.length, elapsed));
      if (elapsed >= duration) finish();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, instant]);

  return <p className={className}>{text.slice(0, shown)}</p>;
}
