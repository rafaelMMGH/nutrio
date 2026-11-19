import { daysBetween } from "@/lib/progress";

// Racha: consecutive days with every planned meal marked done (REQ-11 to REQ-13). Pure; dates are YYYY-MM-DD keys and
// `today` is the viewer's local day. Plans are not versioned, so every past day is judged against the current schedule.

type StreakLog = { date: string; meals_done: string[] };

export function streaks({ logs, slotIds, today }: { logs: StreakLog[]; slotIds: string[]; today: string }) {
  // With no planned meals every day is free (skipped), so there is nothing to count.
  if (slotIds.length === 0) return { current: 0, best: 0 };

  const doneByDate = new Map(logs.map((log) => [log.date, new Set(log.meals_done)]));
  // Walks start at the earliest logged day; earlier days are neither counted nor breaks.
  const earliest = [...doneByDate.keys()].sort()[0];
  if (!earliest || earliest > today) return { current: 0, best: 0 };

  // Ids of meals no longer in the schedule are ignored by checking each planned id.
  const complete = (day: string) => slotIds.every((id) => doneByDate.get(day)?.has(id));

  // An incomplete today is not over yet: it is neither counted nor a break.
  const days = daysBetween(earliest, today).filter((day) => day !== today || complete(day));
  let run = 0;
  let best = 0;
  for (const day of days) {
    run = complete(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // `run` at the end is the current streak, since the walk finishes on yesterday or on a complete today.
  return { current: run, best };
}
