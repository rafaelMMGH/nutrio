// Pure rules for the "Marcar cumplida" button and the carousel (specs/dashboard-polish REQ-6, REQ-25).

/** After an accepted tap the same meal ignores further taps for this long. */
export const TAP_LOCK_MS = 400;
/** After a mark is saved the carousel waits this long, so "Cumplida" shows first. */
export const ADVANCE_DELAY = 900;

export function acceptTap({ pending, lockedUntil, now }: { pending: boolean; lockedUntil: number; now: number }) {
  return !pending && now >= lockedUntil;
}

/** Index of the next meal after `from` that is not done, wrapping around; null when none is pending. */
export function nextPending(meals: { id: string }[], doneIds: string[], from: number): number | null {
  for (let step = 1; step < meals.length; step += 1) {
    const position = (from + step) % meals.length;
    if (!doneIds.includes(meals[position].id)) return position;
  }
  return null;
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const browserTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

// One pending advance at a time. The target is computed when the timer fires, from the latest done ids;
// cancel() is called on a manual switch, an unmark or a rollback.
export function createAdvance(timers: Timers = browserTimers) {
  let handle: unknown;
  let active = false;
  function cancel() {
    if (active) timers.clear(handle);
    active = false;
  }
  function start(from: number, meals: { id: string }[], readDoneIds: () => string[], go: (next: number) => void) {
    cancel();
    active = true;
    handle = timers.set(() => {
      active = false;
      const next = nextPending(meals, readDoneIds(), from);
      if (next !== null) go(next);
    }, ADVANCE_DELAY);
  }
  return { start, cancel };
}
