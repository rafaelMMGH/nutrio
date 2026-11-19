import type { DayLog } from "@/components/dashboard/food";

export type MealResult = "saved" | "failed" | "stale";

type Deps = {
  /** Sends one PUT for the date; rejects on failure. */
  send: (date: string, body: Partial<DayLog>) => Promise<unknown>;
  /** The current optimistic log for the date. */
  read: (date: string) => DayLog;
  write: (date: string, log: DayLog) => void;
  /** Called once per failed action that is still the latest (the toast). */
  onError: () => void;
};

// The rules for saving a day log (specs/dashboard-polish REQ-4, REQ-9, REQ-25):
// - changes show at once and roll back only what the failed action touched;
// - requests for one date run one at a time, each body built at send time from the current optimistic log,
//   so a rolled-back mark can never reach the server through a later request;
// - per (date, meal) the last accepted action wins: an older request's late result changes nothing.
export function createDaySaves({ send, read, write, onError }: Deps) {
  const tails = new Map<string, Promise<void>>();
  const mealSeq = new Map<string, number>();

  // Tasks never reject, so the chain never breaks.
  function enqueue<T>(date: string, task: () => Promise<T>): Promise<T> {
    const run = (tails.get(date) ?? Promise.resolve()).then(task);
    tails.set(date, run.then(() => undefined));
    return run;
  }

  async function request(date: string, body: () => Partial<DayLog>): Promise<boolean> {
    try {
      await send(date, body());
      return true;
    } catch {
      return false;
    }
  }

  function save(date: string, patch: Partial<DayLog>): Promise<boolean> {
    const keys = Object.keys(patch) as (keyof DayLog)[];
    const before = read(date);
    const previous = Object.fromEntries(keys.map((key) => [key, before[key]]));
    write(date, { ...before, ...patch });
    return enqueue(date, async () => {
      const ok = await request(date, () => patch);
      if (!ok) {
        write(date, { ...read(date), ...previous });
        onError();
      }
      return ok;
    });
  }

  function setMeal(date: string, mealId: string, done: boolean): Promise<MealResult> {
    const key = `${date}/${mealId}`;
    const seq = (mealSeq.get(key) ?? 0) + 1;
    mealSeq.set(key, seq);
    const withMeal = (log: DayLog, present: boolean): DayLog => {
      const rest = log.meals_done.filter((id) => id !== mealId);
      return { ...log, meals_done: present ? [...rest, mealId] : rest };
    };
    const wasDone = read(date).meals_done.includes(mealId);
    write(date, withMeal(read(date), done));
    return enqueue(date, async () => {
      const ok = await request(date, () => ({ meals_done: read(date).meals_done }));
      if (mealSeq.get(key) !== seq) return "stale";
      if (ok) return "saved";
      write(date, withMeal(read(date), wasDone));
      onError();
      return "failed";
    });
  }

  return { save, setMeal };
}
