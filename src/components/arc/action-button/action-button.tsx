"use client";

// A single-tap action button with a per-letter blur rise, a width spring and a drawn check.
// Written in-house with motion and lucide-react; the look and motion follow the action button at
// https://uiarc.dev/components/action-button as a reference only, and no source is copied from it.
import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { changedLetters } from "./letter-diff";
import { pressScale } from "./press-scale";
import "./action-button.css";

export type ActionButtonState = "idle" | "pending" | "success";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "onClick" | "aria-pressed" | "aria-busy" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  label: string;
  pendingLabel: string;
  successLabel: string;
  /** Controlled: the caller decides when a press is saved. */
  state: ActionButtonState;
  onPress: () => void;
  /** When this changes (another meal), the next state paints with no motion. */
  instantKey?: string;
};

const WIDTH_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
// Blur and opacity tween: a spring overshoots, and blur() must never go negative.
const RISE = { default: { type: "spring", stiffness: 380, damping: 30 }, filter: { duration: 0.28, ease: "easeOut" }, opacity: { duration: 0.2, ease: "easeOut" } } as const;

type IconMotion = { reduced: boolean; instant: boolean };
// A function-valued exit reads the current flags from AnimatePresence's `custom`: an exiting child keeps the
// props it last rendered with, so a swap caused by instantKey would otherwise exit with the previous flags.
const iconExit = { exit: ({ reduced, instant }: IconMotion) => ({ opacity: 0, scale: reduced || instant ? 1 : 0.6, transition: { duration: instant ? 0 : 0.12 } }) };

export function ActionButton({ label, pendingLabel, successLabel, state, onPress, instantKey, className, ...rest }: Props) {
  const reduced = useReducedMotion() ?? false;
  const text = state === "pending" ? pendingLabel : state === "success" ? successLabel : label;

  // Derived during render so the first paint of a new label already knows which letters are new.
  const [shown, setShown] = useState({ text, instantKey, changed: Array.from(text, () => false), instant: true });
  if (shown.text !== text || shown.instantKey !== instantKey) {
    const instant = shown.instantKey !== instantKey;
    setShown({ text, instantKey, changed: instant ? Array.from(text, () => false) : changedLetters(shown.text, text), instant });
  }
  const motionless = shown.instant || reduced;

  const textRef = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const springNext = useRef(false);
  useLayoutEffect(() => {
    springNext.current = !motionless && shown.changed.some(Boolean);
  }, [shown, motionless]);
  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width;
      if (!next) return;
      if (springNext.current && width.get() !== "auto") animate(width, next, WIDTH_SPRING);
      else width.jump(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  const pending = state === "pending";
  const firstChanged = shown.changed.indexOf(true);
  return (
    <motion.button
      {...rest}
      type="button"
      className={className ? `arc-ab ${className}` : "arc-ab"}
      data-state={state}
      aria-pressed={state === "success"}
      aria-busy={pending}
      aria-disabled={pending || undefined}
      // aria-disabled, not disabled: the button keeps focus while saving. Presses are ignored here.
      onClick={() => {
        if (!pending) onPress();
      }}
      whileTap={pressScale({ reduced, pending })}
    >
      <motion.span className="arc-ab-slot" style={{ width }} aria-hidden>
        <span ref={textRef} className="arc-ab-text">
          {Array.from(text, (char, i) => {
            const changed = shown.changed[i];
            // Unchanged letters keep a stable key (counted from the end after the changed run) so they never replay.
            const key = changed ? `${text}:${i}` : firstChanged === -1 || i < firstChanged ? `p${i}` : `s${text.length - i}`;
            return (
              <motion.span
                key={key}
                className="arc-ab-letter"
                initial={changed && !shown.instant ? (reduced ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(4px)" }) : false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={reduced ? { duration: 0.12 } : RISE}
              >
                {char}
              </motion.span>
            );
          })}
        </span>
      </motion.span>
      <span className="arc-ab-icon" aria-hidden>
        <AnimatePresence initial={false} custom={{ reduced, instant: shown.instant }}>
          <motion.span
            key={state}
            custom={{ reduced, instant: shown.instant }}
            variants={iconExit}
            className={pending ? "arc-ab-spinner" : undefined}
            initial={shown.instant ? false : { opacity: 0, scale: reduced ? 1 : 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit="exit"
            transition={{ duration: reduced ? 0.12 : 0.2 }}
          >
            {state === "idle" && <ArrowRight size={16} />}
            {pending && (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                <circle cx={12} cy={12} r={9} strokeDasharray="42 100" />
              </svg>
            )}
            {state === "success" && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={motionless ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="arc-ab-name">{label}</span>
    </motion.button>
  );
}
