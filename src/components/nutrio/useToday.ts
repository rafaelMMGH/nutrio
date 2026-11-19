"use client";

import { useEffect, useState } from "react";
import { dateKey } from "@/components/dashboard/food";

// Returns `current` itself on the same local day so React skips the re-render.
export function nextToday(current: string, now: Date) {
  const key = dateKey(now);
  return key === current ? current : key;
}

// The browser-local date, refreshed when the tab regains focus or becomes visible, so a page left open past midnight
// recomputes "today" and Racha (REQ-28).
export function useToday() {
  const [today, setToday] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday((current) => nextToday(current, new Date()));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
