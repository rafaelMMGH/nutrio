import { daysBetween } from "@/lib/progress";

// Cumplimiento del plan (REQ-12 to REQ-14). Pure; dates are YYYY-MM-DD keys and `today` is the viewer's local day.
// Invariant: planned = done + unmarked + pending, no figure negative.

type ComplianceLog = { date: string; meals_done: string[] };

export function compliance({ logs, slotIds, start, today }: { logs: ComplianceLog[]; slotIds: string[]; start: string; today: string }) {
  const slots = new Set(slotIds);
  if (slots.size === 0) return { planned: 0, done: 0, unmarked: 0, pending: 0 };

  // A plan created after today counts as starting today.
  const days = daysBetween(start > today ? today : start, today);
  const doneIn = new Map<string, Set<string>>();
  for (const { date, meals_done } of logs) {
    const done = doneIn.get(date) ?? new Set<string>();
    for (const id of meals_done) if (slots.has(id)) done.add(id);
    doneIn.set(date, done);
  }

  const planned = slots.size * days.length;
  const done = days.reduce((sum, day) => sum + (doneIn.get(day)?.size ?? 0), 0);
  // Today is never overdue, so its unchecked meals are pending, and only past days' are unmarked.
  const pending = slots.size - (doneIn.get(today)?.size ?? 0);
  return { planned, done, unmarked: planned - done - pending, pending };
}
