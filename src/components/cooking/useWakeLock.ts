"use client";

import { useEffect, useState } from "react";

type Sentinel = { release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

export type WakeLockState = "pending" | "on" | "unavailable";

// Keeps the screen awake while Modo Cocina is open (REQ-3): taken again when the tab is visible, released on exit.
// A refusal is shown to the user (the note), not logged as an error.
export function useWakeLock(active: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>("pending");

  useEffect(() => {
    if (!active) return;
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) {
      setState("unavailable");
      return;
    }
    let sentinel: Sentinel | null = null;
    let disposed = false;

    async function acquire() {
      if (disposed || document.visibilityState !== "visible" || sentinel) return;
      try {
        const lock = await api!.request("screen");
        if (disposed) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener?.("release", () => {
          if (sentinel === lock) sentinel = null;
        });
        setState("on");
      } catch {
        setState("unavailable");
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);

  return state;
}
