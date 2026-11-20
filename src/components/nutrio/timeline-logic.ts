import { mealLabel, type Meal } from "@/components/dashboard/food";

export type RowState = "done" | "next" | "pending";
export type TimelineRow = { id: string; time: string | null; name: string; state: RowState };

const STATE_WORD: Record<RowState, string> = { done: "Cumplida", next: "Siguiente", pending: "Pendiente" };

// Plan order is kept as is (REQ-3); "next" is the first unchecked meal (REQ-2).
export function timelineRows(meals: Meal[], doneIds: string[]) {
  const done = new Set(doneIds);
  let nextFound = false;
  const rows = meals.map((meal): TimelineRow => {
    let state: RowState = "done";
    if (!done.has(meal.id)) {
      state = nextFound ? "pending" : "next";
      nextFound = true;
    }
    return { id: meal.id, time: meal.time_window || null, name: mealLabel(meal.name), state };
  });
  return { rows, hasTimes: rows.some((row) => row.time !== null) };
}

// The full name is always in the accessible name; selection is not part of it (REQ-4, REQ-5).
export function rowLabel(row: TimelineRow) {
  return [row.time, row.name, STATE_WORD[row.state]].filter(Boolean).join(", ");
}

// top/bottom are the row's offsets inside the scrolled content; pad keeps the row clear of the edge fade.
export function listScrollTop({ top, bottom, scrollTop, height, scrollHeight, pad }: { top: number; bottom: number; scrollTop: number; height: number; scrollHeight: number; pad: number }) {
  let next = scrollTop;
  if (top - pad < scrollTop) next = top - pad;
  else if (bottom + pad > scrollTop + height) next = bottom + pad - height;
  return Math.min(Math.max(next, 0), Math.max(scrollHeight - height, 0));
}
