// Pure rules of HoldToConfirm, apart from the component so they can be unit tested.

/** How far (px) the pointer may leave the button before the hold is cancelled. */
export const HOLD_SLOP = 24;

/** The fill as a number from 0 to 1. Anything unreadable counts as empty. */
export function clampProgress(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Milliseconds a hold still needs from the given fill: a quick re-press resumes, it does not start over. */
export function remainingMs(progress: number, duration: number) {
  return (1 - clampProgress(progress)) * duration;
}

type Box = { left: number; top: number; right: number; bottom: number };

/** Distance in px from a point to a box: 0 inside it, otherwise to the nearest edge or corner. */
export function distanceOutside(box: Box, x: number, y: number) {
  return Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
}

/**
 * What a click on the button means. A click that follows a pointer or key press was already handled by that press
 * (hold, short tap or completed hold). A bare click is how VoiceOver and TalkBack activate a button: it acts at once,
 * and on a confirmed button it takes the confirmation back.
 */
export function classifyClick(afterPress: boolean, confirmed: boolean): "ignore" | "confirm" | "undo" {
  if (afterPress) return "ignore";
  return confirmed ? "undo" : "confirm";
}

/** Text read by assistive technology: how to confirm with a pointer or a keyboard. */
export function holdDescription(duration: number) {
  const seconds = duration / 1000;
  return `Mantén presionado ${seconds} ${seconds === 1 ? "segundo" : "segundos"} para confirmar. Con el teclado, mantén Espacio o Enter.`;
}
