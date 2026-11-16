import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { HOLD_SLOP, classifyClick, clampProgress, distanceOutside, holdDescription, remainingMs } from "./hold-to-confirm-logic";
import "./hold-to-confirm.css";

// How long the short-tap hint replaces the label, and how long the fill takes to rewind or the width to spring.
const HINT_MS = 1500;
const SPRING_MS = 450;
const HINT = "Mantén presionado";
// A click that follows a press arrives within a few ms of its release; a press with no click behind it (released outside) is forgotten after this.
const PRESS_GRACE_MS = 400;

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "onClick" | "aria-pressed"> & {
  label: string;
  confirmedLabel: string;
  /** Milliseconds the button must be held. */
  duration: number;
  /** Drawn before the label. When the hold completes its strokes draw themselves in (tuned for a check mark). */
  icon: ReactNode;
  /** Controlled: the caller owns the confirmed state, so a failed save can take it back. */
  confirmed: boolean;
  /** The hold completed, or the button was activated by assistive technology. Fires once per confirmation. */
  onConfirm: () => void;
  /** A plain click on the confirmed button. */
  onUndo: () => void;
};

// A button that is confirmed by holding it: an ink fill grows left to right (the label and icon are drawn twice and flip colour at the fill edge).
// The fill is the registered property --nt-hold animated with the Web Animations API, so the current fill can be read back to resume or rewind from it.
export function HoldToConfirm({ label, confirmedLabel, duration, icon, confirmed, onConfirm, onUndo, className, ...rest }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const fill = useRef<Animation | null>(null);
  const widthSpring = useRef<Animation | null>(null);
  const lastWidth = useRef<number | null>(null);
  // The press (pointer or key) on the button that has not produced its click yet. A click with none behind it is a bare, assistive-technology click.
  const press = useRef(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const hintTimer = useRef<number | undefined>(undefined);
  const holding = useRef(false);
  const [isHolding, setIsHolding] = useState(false);
  const [hint, setHint] = useState(false);
  // True from the moment a hold or activation confirms until the button is unconfirmed: only then the check draws itself (not on page load).
  const [celebrate, setCelebrate] = useState(false);
  const describedBy = useId();

  useEffect(() => () => {
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(hintTimer.current);
  }, []);

  const progress = () => clampProgress(parseFloat(getComputedStyle(button.current!).getPropertyValue("--nt-hold")));

  // Rewinds with the app spring from wherever the fill is.
  function rewind() {
    const from = progress();
    fill.current?.cancel();
    fill.current = null;
    if (from === 0) return;
    const spring = getComputedStyle(button.current!).getPropertyValue("--nt-spring").trim();
    fill.current = button.current!.animate({ "--nt-hold": [String(from), "0"] }, { duration: SPRING_MS, easing: spring || "ease-out" });
  }

  function confirm() {
    // Short buzz on touch devices that have it.
    if (typeof navigator.vibrate === "function") navigator.vibrate(15);
    setCelebrate(true);
    onConfirm();
  }

  function start() {
    if (holding.current) return;
    holding.current = true;
    setIsHolding(true);
    window.clearTimeout(hintTimer.current);
    setHint(false);
    const from = progress();
    fill.current?.cancel();
    // forwards: the fill stays full until the confirmed state paints (see the layout effect), instead of flashing empty.
    const hold = button.current!.animate({ "--nt-hold": [String(from), "1"] }, { duration: remainingMs(from, duration), easing: "linear", fill: "forwards" });
    fill.current = hold;
    hold.onfinish = () => {
      holding.current = false;
      setIsHolding(false);
      confirm();
    };
  }

  function cancel(showHint: boolean) {
    if (!holding.current) return;
    holding.current = false;
    setIsHolding(false);
    rewind();
    if (!showHint) return;
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), HINT_MS);
  }

  function beginPress() {
    window.clearTimeout(pressTimer.current);
    press.current = true;
  }
  function endPress() {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => (press.current = false), PRESS_GRACE_MS);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary || confirmed) return;
    beginPress();
    event.currentTarget.setPointerCapture(event.pointerId);
    start();
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!holding.current) return;
    // With the pointer captured the events keep coming from outside the button.
    if (distanceOutside(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY) > HOLD_SLOP) cancel(false);
  }
  function onPointerUp() {
    endPress();
    cancel(true);
  }
  function onPointerCancel() {
    endPress();
    cancel(false);
  }

  const isHoldKey = (event: KeyboardEvent) => event.key === " " || event.key === "Enter";
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Confirmed: the keys keep their native meaning, a click that unmarks.
    if (!isHoldKey(event) || confirmed) return;
    event.preventDefault();
    if (event.repeat) return;
    beginPress();
    start();
  }
  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isHoldKey(event)) return;
    endPress();
    // Confirmed (by this very hold, or before it): the native click is the one that counts or the one to ignore, see onClick.
    if (confirmed) return;
    // Space clicks on key up: stop that native click, the press already handled it.
    event.preventDefault();
    cancel(true);
  }

  function onClick() {
    const afterPress = press.current;
    press.current = false;
    const action = classifyClick(afterPress, confirmed);
    if (action === "confirm") confirm();
    else if (action === "undo") onUndo();
  }

  // The confirmed state paints as a full fill by CSS, so the forwards-filled hold animation can go.
  // Unconfirmed (undo, or a failed save rolled back): rewind with the spring.
  useLayoutEffect(() => {
    if (confirmed) {
      fill.current?.cancel();
      fill.current = null;
    } else {
      setCelebrate(false);
      if (!holding.current) rewind();
    }
  }, [confirmed]);

  // The width springs when the label changes between its two lengths: FLIP with the Web Animations API, instant where it is missing.
  useLayoutEffect(() => {
    const node = button.current!;
    const previous = lastWidth.current;
    // A spring still running shows the width the user currently sees: start from that.
    const from = widthSpring.current ? node.offsetWidth : previous;
    widthSpring.current?.cancel();
    widthSpring.current = null;
    const to = node.offsetWidth;
    lastWidth.current = to;
    if (from === null || from === to || typeof node.animate !== "function") return;
    const spring = getComputedStyle(node).getPropertyValue("--nt-spring").trim() || "ease-out";
    const run = node.animate({ width: [`${from}px`, `${to}px`] }, { duration: SPRING_MS, easing: spring });
    widthSpring.current = run;
    run.onfinish = () => {
      if (widthSpring.current === run) widthSpring.current = null;
    };
  }, [confirmed]);

  const visible = confirmed ? confirmedLabel : hint ? HINT : label;
  // The unconfirmed button reserves the width of its longest text, so the hint does not resize it.
  const face = (
    <>
      <span className="nt-hold-icon">{icon}</span>
      <span className="nt-hold-text">
        {[confirmedLabel, ...(confirmed ? [] : [label, HINT])].map((text) => (
          <span key={text} className={text === visible ? undefined : "is-hidden"}>
            {text}
          </span>
        ))}
      </span>
    </>
  );

  return (
    <>
      <button
        {...rest}
        ref={button}
        type="button"
        className={`nt-hold${confirmed ? " is-confirmed" : ""}${isHolding ? " is-holding" : ""}${celebrate ? " is-celebrating" : ""}${className ? ` ${className}` : ""}`}
        aria-pressed={confirmed}
        aria-describedby={describedBy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => cancel(false)}
        onContextMenu={(event) => holding.current && event.preventDefault()}
        onClick={onClick}
      >
        <span className="nt-hold-face">{face}</span>
        <span className="nt-hold-fill" aria-hidden />
        <span className="nt-hold-face is-inverse" aria-hidden>
          {face}
        </span>
      </button>
      <span id={describedBy} className="sr-only">
        {holdDescription(duration)}
      </span>
    </>
  );
}
