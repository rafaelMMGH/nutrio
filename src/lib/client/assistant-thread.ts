// Pure on purpose (no React, no next/*), so the unit tests can load it.

/** The part of a conversation turn the button rule reads. */
export type ThreadTurn = { id: string; role: "user" | "assistant"; status?: "pending" | "answer" | "error"; retrying?: boolean };

/**
 * The turn whose question buttons are shown (REQ-5): the latest finished assistant turn, if it is an answer. An error as
 * the latest finished turn hides them, and so does a pending retry (it stands in for its error turn); a pending new
 * question keeps them on the previous answer.
 */
export function questionButtonsTurnId(turns: readonly ThreadTurn[]): string | null {
  const latest = turns.findLast((turn) => turn.role === "assistant" && turn.status !== "pending");
  const last = turns.findLast((turn) => turn.role === "assistant");
  const retrying = last?.status === "pending" && last.retrying;
  return !retrying && latest?.status === "answer" ? latest.id : null;
}
