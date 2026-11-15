"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DayLog } from "@/components/dashboard/food";

export const EMPTY_LOG: DayLog = { meals_done: [], water_glasses: 0 };
export type ServerLog = { date: string } & DayLog;

export async function send(path: string, method: string, body: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

// The day logs, changed optimistically: a save shows at once and rolls back if the request fails.
export function useDailyLogs(serverLogs: ServerLog[], refresh: () => void) {
  const toMap = () => Object.fromEntries((serverLogs || []).map(({ date, ...log }) => [date, { ...log, weight_kg: log.weight_kg ?? null }]));
  const [logs, setLogs] = useState<Record<string, DayLog>>(toMap);
  const pending = useRef(0);
  useEffect(() => {
    if (!pending.current) setLogs(toMap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverLogs]);

  async function save(date: string, patch: Partial<DayLog>) {
    const previous = logs[date];
    setLogs((current) => ({ ...current, [date]: { ...EMPTY_LOG, ...current[date], ...patch } }));
    pending.current += 1;
    try {
      await send(`/api/daily-logs/${date}`, "PUT", patch);
    } catch {
      setLogs((current) => ({ ...current, [date]: previous ?? EMPTY_LOG }));
      toast.error("No se pudo guardar tu registro del día");
    } finally {
      pending.current -= 1;
      if (!pending.current) refresh();
    }
  }

  return { get: (date: string) => logs[date] ?? EMPTY_LOG, list: () => Object.entries(logs).map(([date, log]) => ({ date, ...log })), save };
}
