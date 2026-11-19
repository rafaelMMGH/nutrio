"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DayLog } from "@/components/dashboard/food";
import { createDaySaves } from "./day-log-saves";

export const EMPTY_LOG: DayLog = { meals_done: [], water_glasses: 0 };
export type ServerLog = { date: string } & DayLog;

export async function send(path: string, method: string, body: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

// The day logs, changed optimistically: a save shows at once and rolls back if the request fails.
// The rules live in day-log-saves.ts; the toast is shown here, once per failure.
export function useDailyLogs(serverLogs: ServerLog[], refresh: () => void) {
  const toMap = () => Object.fromEntries((serverLogs || []).map(({ date, ...log }) => [date, { ...log, weight_kg: log.weight_kg ?? null }]));
  const [logs, setLogs] = useState<Record<string, DayLog>>(toMap);
  // Mirrors `logs` synchronously so request bodies and rollbacks read the latest optimistic state.
  const latest = useRef(logs);
  const pending = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!pending.current) {
      latest.current = toMap();
      setLogs(latest.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverLogs]);

  const [saves] = useState(() =>
    createDaySaves({
      send: (date, body) => send(`/api/daily-logs/${date}`, "PUT", body),
      read: (date) => latest.current[date] ?? EMPTY_LOG,
      write: (date, log) => {
        latest.current = { ...latest.current, [date]: log };
        setLogs(latest.current);
      },
      onError: () => toast.error("No se pudo guardar tu registro del día"),
    }),
  );

  // Refreshes from the server once every save in flight has settled.
  async function tracked<T>(run: () => Promise<T>) {
    pending.current += 1;
    try {
      return await run();
    } finally {
      pending.current -= 1;
      if (!pending.current) refreshRef.current();
    }
  }

  const save = (date: string, patch: Partial<DayLog>) => tracked(() => saves.save(date, patch));
  const setMeal = (date: string, mealId: string, done: boolean) => tracked(() => saves.setMeal(date, mealId, done));

  return { get: (date: string) => logs[date] ?? EMPTY_LOG, list: () => Object.entries(logs).map(([date, log]) => ({ date, ...log })), save, setMeal };
}
