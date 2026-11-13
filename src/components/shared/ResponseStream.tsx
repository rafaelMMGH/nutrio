// Adapted from prompt-kit's response-stream (https://github.com/ibelick/prompt-kit), MIT License
// Copyright (c) 2025 Julien Thibeaut
// Changes: typewriter only (no fade mode, no async streams, no injected <style>), a time-based reveal so a long text
// finishes within a fixed budget (in useTypedLength), prefers-reduced-motion and an `instant` switch (tap to complete)
// show the full text, and the reveal is by grapheme.
"use client";

import { useMemo } from "react";
import { graphemes } from "@/lib/client/text-stream";
import { useTypedLength } from "./useTypedLength";

type ResponseStreamProps = {
  text: string;
  /** Show the whole text now (tap to complete); fires `onComplete` once. */
  instant?: boolean;
  onComplete?: () => void;
  className?: string;
};

/** Types plain `text` out once. Reduced motion, an empty text and `instant` complete without animating. */
export function ResponseStream({ text, instant, onComplete, className }: ResponseStreamProps) {
  const parts = useMemo(() => graphemes(text), [text]);
  const typed = useTypedLength(parts.length, { instant, onComplete, identity: text });
  return <p className={className}>{parts.slice(0, typed).join("")}</p>;
}
