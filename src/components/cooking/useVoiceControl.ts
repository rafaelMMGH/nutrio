"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recognitionCtor } from "@/components/shared/useDictation";
import { commandFrom, type VoiceCommand } from "./voice-commands";

export type VoiceState = "unsupported" | "off" | "listening" | "denied" | "failed";

const DENIED = new Set(["not-allowed", "service-not-allowed"]);
/** Errors after which listening simply restarts (REQ-24). Anything else turns voice control off with a message. */
const TRANSIENT = new Set(["no-speech", "aborted"]);

// Brave ships webkitSpeechRecognition with no service behind it (see useDictation), so it counts as unsupported.
function supported() {
  const isBrave = typeof (navigator as unknown as { brave?: { isBrave?: unknown } }).brave?.isBrave === "function";
  return Boolean(recognitionCtor()) && !isBrave;
}

/**
 * Continuous listening for "siguiente", "atrás" and "repetir" (REQ-21 to REQ-25). Restarts after silence while on,
 * stops while the tab is hidden or while the app is speaking (`paused`), and turns off when the microphone is refused.
 */
export function useVoiceControl(onCommand: (command: VoiceCommand) => void, paused: boolean) {
  const [state, setState] = useState<VoiceState>("off");
  const [enabled, setEnabled] = useState(false);
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  useEffect(() => {
    if (!supported()) setState("unsupported");
  }, []);

  useEffect(() => {
    if (!enabled || paused) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    let stopped = false;
    let recognition: InstanceType<typeof Ctor> | null = null;

    const start = () => {
      if (stopped || document.visibilityState !== "visible" || recognition) return;
      const rec = new Ctor();
      rec.lang = "es-MX";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result.isFinal) continue;
          const command = commandFrom(result[0].transcript);
          if (command) commandRef.current(command);
        }
      };
      rec.onerror = (event) => {
        if (TRANSIENT.has(event.error)) return;
        stopped = true;
        setEnabled(false);
        setState(DENIED.has(event.error) ? "denied" : "failed");
      };
      rec.onend = () => {
        if (recognition === rec) recognition = null;
        start();
      };
      recognition = rec;
      try {
        rec.start();
        setState("listening");
      } catch {
        recognition = null;
        stopped = true;
        setEnabled(false);
        setState("failed");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else recognition?.abort();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const rec = recognition;
      recognition = null;
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.abort();
      }
    };
  }, [enabled, paused]);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      setState(on ? "off" : "listening");
      return !on;
    });
  }, []);

  return { state, enabled, toggle };
}
