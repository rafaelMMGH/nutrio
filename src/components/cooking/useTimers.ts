"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pauseTimer, remainingMs, resumeTimer, startTimer, type Timer } from "./durations";

export type FinishedTimer = { step: number; endedAt: number };

// One short tone through Web Audio; silent when the browser blocks audio.
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1500);
  } catch {
    // Audio is a nicety: the on-screen alert still shows (REQ-19).
  }
}

/** Step timers (REQ-19): kept as end times so a hidden tab or a reload stays exact; an alert per finished timer. */
export function useTimers(initial: Timer[]) {
  const [timers, setTimers] = useState<Timer[]>(initial);
  const [finished, setFinished] = useState<FinishedTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const timersRef = useRef(timers);
  timersRef.current = timers;

  const running = timers.some((timer) => timer.endsAt !== null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      const done = timersRef.current.filter((timer) => timer.endsAt !== null && remainingMs(timer, at) === 0);
      if (!done.length) return;
      setTimers((current) => current.filter((timer) => !done.includes(timer)));
      setFinished((current) => [...current, ...done.map((timer) => ({ step: timer.step, endedAt: timer.endsAt! }))]);
      if (document.visibilityState === "visible") {
        chime();
        navigator.vibrate?.([300, 150, 300]);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running]);

  const start = useCallback((step: number, seconds: number) => {
    const at = Date.now();
    setNow(at);
    setTimers((current) => [...current.filter((timer) => timer.step !== step), startTimer(step, seconds * 1000, at)]);
  }, []);
  const pause = useCallback((step: number) => setTimers((current) => current.map((timer) => (timer.step === step ? pauseTimer(timer, Date.now()) : timer))), []);
  const resume = useCallback((step: number) => {
    const at = Date.now();
    setNow(at);
    setTimers((current) => current.map((timer) => (timer.step === step ? resumeTimer(timer, at) : timer)));
  }, []);
  const cancel = useCallback((step: number) => setTimers((current) => current.filter((timer) => timer.step !== step)), []);
  const dismiss = useCallback((step: number) => setFinished((current) => current.filter((item) => item.step !== step)), []);
  const restore = useCallback((saved: Timer[]) => {
    setNow(Date.now());
    setTimers(saved);
  }, []);
  const clear = useCallback(() => {
    setTimers([]);
    setFinished([]);
  }, []);

  return { timers, finished, now, start, pause, resume, cancel, dismiss, restore, clear };
}
