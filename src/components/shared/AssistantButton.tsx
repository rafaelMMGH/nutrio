"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { variantOf, type Button } from "@/lib/assistant";

/**
 * The assistant's one button component (spec REQ-34), in three variants chosen by `data-variant`: `option` (a vertical
 * block choice), `chip` (any other question) and `link` (a real anchor with a trailing arrow).
 * A question button is `aria-disabled` while a request is pending, never natively disabled, so it keeps its focus
 * stop; the handler ignores the activation instead.
 */
export function AssistantButton({ button, disabled, onAsk }: { button: Button; disabled?: boolean; onAsk?: (message: string) => void }) {
  const variant = variantOf(button);
  if (button.type === "link") {
    return (
      <Link href={button.href} className="assistant-button" data-variant={variant}>
        {button.label}
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="assistant-button"
      data-variant={variant}
      aria-disabled={disabled ? true : undefined}
      onClick={() => {
        if (!disabled) onAsk?.(button.message);
      }}
    >
      {button.label}
    </button>
  );
}
