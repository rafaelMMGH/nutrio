"use client";

/**
 * Our copy of the Kokonut UI detent dial (specs/metric-dials plan "Our copy of the dial"): dashboard tokens instead
 * of the stock Tailwind colours, a read-only meter mode, an external readout and label, size from CSS, and
 * programmatic value changes that glide without emitting change events.
 *
 * Original header:
 * @author: @dorianbaffier
 * @description: Detent Dial
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import "./detent-dial.css";

// The dial sweeps 270°, from 7:30 to 4:30 on a clock face.
const SWEEP = 270;
const START_ANGLE = -135;
// How far (deg) the knob can be wound past either end. The pull flattens
// out as it approaches this, so it slows down instead of hitting a wall.
const MAX_OVERSHOOT = 16;
// While dragging, the knob is pulled this much toward the nearest notch,
// which is what makes it feel like it clicks from one step to the next.
const DETENT_PULL = 0.65;
const MAX_TICKS = 56;
// The swell that follows the indicator round the ring: extra length (px)
// at its peak, and how many degrees it spreads either side.
const WAVE_HEIGHT = 9;
const WAVE_WIDTH = 12;
// Pointer movement this close to the centre gives wild angle jumps.
const DEAD_ZONE = 14;
// Below this speed (fraction of the range per second) a release just
// settles into the nearest notch instead of coasting.
const FLICK_THRESHOLD = 0.4;
const VELOCITY_WINDOW_MS = 80;
// Seconds of travel a flick is worth: release speed × COAST = distance coasted.
const COAST = 0.3;
const SETTLE_SPRING = { type: "spring", duration: 0.35, bounce: 0.2 } as const;
// Programmatic moves (tab change, rescale, undo) glide with the same spring.
const GLIDE_SPRING = SETTLE_SPRING;
// Geometry is drawn in a fixed 240 viewBox and scaled by CSS (--nt-dial-size).
const VIEW = 240;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function damp(distance: number, max: number) {
  return max * (1 - Math.exp(-distance / max));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number, min: number, step: number) {
  return Number((Math.round((value - min) / step) * step + min).toFixed(10));
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  // Rounded so the server and the browser, whose trig can differ in the
  // last digits, render identical markup.
  return {
    x: Math.round((cx + radius * Math.sin(rad)) * 100) / 100,
    y: Math.round((cy - radius * Math.cos(rad)) * 100) / 100,
  };
}

function pointerAngle(event: PointerEvent, rect: DOMRect) {
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  return {
    angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
    distance: Math.hypot(dx, dy),
  };
}

// navigator.vibrate is a no-op where unsupported (iOS, desktop). On
// Android it gives each notch a faint tick under the finger.
function hapticTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(1);
  }
}

export interface DetentDialProps {
  /** id of the element that names the dial (the tile renders the name). */
  labelledBy: string;
  min: number;
  max: number;
  step: number;
  /** Controlled value. */
  value: number;
  /** The number shown with the dial ("78%", "≈ 1,445", "—"). */
  readout: string;
  /** aria-valuetext (REQ-43). */
  valueText: string;
  /** A read-only meter: no pointer, key or wheel input, not a keyboard stop (REQ-2). */
  readOnly?: boolean;
  /** Inside the knob, or above the dial when the row's numbers are too long for the knob (dial-logic). */
  readoutPlacement?: "inside" | "above";
  /** Show the numbers at both ends of the ring (dial-logic `showEndLabels`). */
  endLabels?: boolean;
  /** Formats the end labels. */
  formatEnd?: (value: number) => string;
  /** Slider mode only: called each time the dial crosses into a new notch by user input. */
  onValueChange?: (value: number) => void;
  className?: string;
}

const pct = (n: number) => `${(n / VIEW) * 100}%`;

export default function DetentDial({
  labelledBy,
  min,
  max,
  step,
  value: valueProp,
  readout,
  valueText,
  readOnly = false,
  readoutPlacement = "inside",
  endLabels = false,
  formatEnd = (v) => String(v),
  onValueChange,
  className,
}: DetentDialProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(SVGLineElement | null)[]>([]);
  // The length last written to each tick, so a frame only touches the few
  // ticks the swell is actually passing over.
  const tickLengths = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();
  const range = max - min;
  // The transform below reads the limits through a ref, so a rescale applies to the next frame.
  const limits = useRef({ min, max });

  const initial = clamp(valueProp, min, max);
  const [value, setValue] = useState(initial);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [grabbing, setGrabbing] = useState(false);
  const committed = useRef(initial);
  const pointerType = useRef("mouse");
  // True while a programmatic glide runs: notches crossed then are not user changes.
  const programmatic = useRef(false);

  // The raw, unsnapped position in value units. It can run past min/max
  // while winding; everything visual is derived from it.
  const raw = useMotionValue(initial);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{
    id: number;
    // Measured once on grab: reading layout on every move forces the
    // browser to recalculate it after each frame's writes.
    rect: DOMRect;
    lastAngle: number;
    samples: { t: number; v: number }[];
  } | null>(null);

  const rotation = useTransform(raw, (r) => {
    const { min: lo, max: hi } = limits.current;
    const span = hi - lo;
    const degPerUnit = span === 0 ? 0 : SWEEP / span;
    if (r < lo) {
      return START_ANGLE - damp((lo - r) * degPerUnit, MAX_OVERSHOOT);
    }
    if (r > hi) {
      return START_ANGLE + SWEEP + damp((r - hi) * degPerUnit, MAX_OVERSHOOT);
    }
    const notch = snap(r, lo, step);
    const pulled = notch + (r - notch) * (1 - DETENT_PULL);
    return START_ANGLE + (pulled - lo) * degPerUnit;
  });

  // Only re-render when the dial crosses into a new notch, not per frame.
  useMotionValueEvent(raw, "change", (r) => {
    const { min: lo, max: hi } = limits.current;
    const next = clamp(snap(r, lo, step), lo, hi);
    if (next === committed.current) {
      return;
    }
    setDirection(next > committed.current ? 1 : -1);
    committed.current = next;
    setValue(next);
    if (programmatic.current) {
      return;
    }
    onValueChange?.(next);
    if (pointerType.current === "touch") {
      hapticTick();
    }
  });

  // Follow the controlled value and limits. A rescale first keeps the needle's angle in the new scale, then the
  // needle glides to the value (instant under reduced motion). The first render already sits at the value.
  useEffect(() => {
    if (drag.current) {
      return;
    }
    const previous = limits.current;
    if (previous.min !== min || previous.max !== max) {
      const oldSpan = previous.max - previous.min;
      const fraction = oldSpan === 0 ? 0 : (raw.get() - previous.min) / oldSpan;
      limits.current = { min, max };
      raw.jump(min + fraction * (max - min));
    }
    const next = clamp(valueProp, min, max);
    if (next === committed.current && raw.get() === next) {
      return;
    }
    animation.current?.stop();
    programmatic.current = true;
    committed.current = next;
    setValue(next);
    if (reduceMotion) {
      raw.jump(next);
      programmatic.current = false;
      return;
    }
    animation.current = animate(raw, next, {
      ...GLIDE_SPRING,
      onComplete: () => {
        programmatic.current = false;
      },
    });
  }, [valueProp, min, max, raw, reduceMotion]);

  useEffect(() => () => animation.current?.stop(), []);

  const settleTo = (target: number) => {
    animation.current?.stop();
    programmatic.current = false;
    animation.current = animate(
      raw,
      target,
      reduceMotion ? { duration: 0 } : SETTLE_SPRING
    );
  };

  // Keyboard and wheel steps jump straight to the value. They repeat fast,
  // and an animation on each would trail behind the input.
  const stepBy = (delta: number) => {
    animation.current?.stop();
    programmatic.current = false;
    const target = clamp(snap(committed.current + delta, min, step), min, max);
    pointerType.current = "keyboard";
    raw.jump(target);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const { angle } = pointerAngle(event, rect);
    animation.current?.stop();
    programmatic.current = false;
    pointerType.current = event.pointerType;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      rect,
      lastAngle: angle,
      samples: [{ t: event.timeStamp, v: raw.get() }],
    };
    setGrabbing(true);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const { angle, distance } = pointerAngle(event, current.rect);
    if (distance < DEAD_ZONE) {
      current.lastAngle = angle;
      return;
    }
    // Unwrap so crossing 6 o'clock doesn't read as a 360° jump.
    let delta = angle - current.lastAngle;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }
    current.lastAngle = angle;
    const next = raw.get() + (delta / SWEEP) * range;
    raw.set(next);
    current.samples.push({ t: event.timeStamp, v: next });
    while (
      current.samples.length > 2 &&
      event.timeStamp - current.samples[0].t > VELOCITY_WINDOW_MS
    ) {
      current.samples.shift();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    setGrabbing(false);

    const first = current.samples[0];
    const last = current.samples.at(-1) ?? first;
    const elapsed = (last.t - first.t) / 1000;
    // Holding still before letting go is a placement, not a flick.
    const paused = event.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const velocity = elapsed > 0 && !paused ? (last.v - first.v) / elapsed : 0;
    const position = raw.get();
    const inBounds = position >= min && position <= max;

    if (
      reduceMotion ||
      !inBounds ||
      Math.abs(velocity) < range * FLICK_THRESHOLD
    ) {
      settleTo(clamp(snap(position, min, step), min, max));
      return;
    }
    // A flick coasts, slows down, and lands on a notch. If it runs out of
    // room it bounces off the end instead of stopping dead.
    animation.current?.stop();
    // Project where the flick would coast to, land that on a notch, then
    // spring there carrying the release velocity. If the projection runs
    // past an end, the spring overshoots it a little and settles back.
    const target = clamp(
      snap(position + velocity * COAST, min, step),
      min,
      max
    );
    animation.current = animate(raw, target, {
      type: "spring",
      velocity,
      stiffness: 140,
      damping: 24,
      restDelta: 0.005,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = Math.max(step, snap(range / 10, 0, step));
    const keySteps: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: big,
      PageDown: -big,
      Home: min - committed.current,
      End: max - committed.current,
    };
    if (!(event.key in keySteps)) {
      return;
    }
    event.preventDefault();
    stepBy(keySteps[event.key]);
  };

  // The wheel only turns the dial once it has focus, so scrolling the page
  // past it never changes the value by accident. The listener is attached
  // once and reads the latest props through a ref.
  const wheelStep = useRef({ readOnly, step, stepBy });
  wheelStep.current = { readOnly, step, stepBy };
  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) {
      return;
    }
    let accumulated = 0;
    const onWheel = (event: WheelEvent) => {
      const latest = wheelStep.current;
      if (latest.readOnly || document.activeElement !== knob) {
        return;
      }
      event.preventDefault();
      accumulated += event.deltaY;
      // Trackpads send many tiny deltas; one notch per ~40px of scroll.
      while (Math.abs(accumulated) >= 40) {
        const sign = Math.sign(accumulated);
        accumulated -= sign * 40;
        latest.stepBy(-sign * latest.step);
      }
    };
    knob.addEventListener("wheel", onWheel, { passive: false });
    return () => knob.removeEventListener("wheel", onWheel);
  }, []);

  const center = VIEW / 2;
  const tickCount = Math.max(1, Math.min(Math.round(range / step), MAX_TICKS));
  const valueFraction = range === 0 ? 0 : (value - min) / range;
  const activeTick = Math.round(valueFraction * tickCount);
  const outer = VIEW / 2 - 6;
  // Ticks swell as the indicator passes them, following its exact angle
  // (not the snapped value), so a wave travels round the ring as you turn.
  function tickLength(i: number, indicatorAngle: number) {
    const angle = START_ANGLE + (i / tickCount) * SWEEP;
    // Min, mid and max read as the scale's anchors, like a ruler's inch marks.
    const anchor = i === 0 || i === tickCount || i * 2 === tickCount;
    const major = i % 5 === 0;
    let base = 6;
    if (anchor) {
      base = 14;
    } else if (major) {
      base = 10;
    }
    const distance = (angle - indicatorAngle) / WAVE_WIDTH;
    // Rounded to a tenth of a pixel: finer changes aren't visible, and
    // skipping them leaves most ticks untouched on any given frame.
    return (
      Math.round((base + WAVE_HEIGHT * Math.exp(-distance * distance)) * 10) /
      10
    );
  }

  function tickGeometry(i: number, length: number) {
    const angle = START_ANGLE + (i / tickCount) * SWEEP;
    return {
      a: polar(center, center, outer - length, angle),
      b: polar(center, center, outer, angle),
    };
  }

  // Written straight to the lines each frame; no re-render while turning.
  useMotionValueEvent(rotation, "change", (indicatorAngle) => {
    for (let i = 0; i <= tickCount; i++) {
      const line = tickRefs.current[i];
      const length = tickLength(i, indicatorAngle);
      if (!line || tickLengths.current[i] === length) {
        continue;
      }
      tickLengths.current[i] = length;
      const { a } = tickGeometry(i, length);
      line.setAttribute("x1", String(a.x));
      line.setAttribute("y1", String(a.y));
    }
  });
  const minLabel = polar(center, center, outer + 2, START_ANGLE - 12);
  const maxLabel = polar(center, center, outer + 2, START_ANGLE + SWEEP + 12);

  const readoutNode = (
    <RollingValue
      direction={direction}
      reduceMotion={Boolean(reduceMotion)}
      text={readout}
    />
  );

  const interaction = readOnly
    ? {}
    : {
        onKeyDown: handleKeyDown,
        onLostPointerCapture: handlePointerUp,
        onPointerCancel: handlePointerUp,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        tabIndex: 0,
      };

  return (
    <div className={["nt-dial", readOnly ? "is-readonly" : "is-slider", className].filter(Boolean).join(" ")}>
      {readoutPlacement === "above" ? <div className="nt-dial-readout nt-dial-readout-above">{readoutNode}</div> : null}
      <div className="nt-dial-box">
        <svg
          aria-hidden="true"
          className="nt-dial-ring"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
        >
          {Array.from({ length: tickCount + 1 }, (_, i) => {
            const lit = i <= activeTick;
            const length = tickLength(i, rotation.get());
            tickLengths.current[i] = length;
            const { a, b } = tickGeometry(i, length);
            return (
              <line
                className={lit ? "nt-dial-tick is-lit" : "nt-dial-tick"}
                // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional.
                key={i}
                ref={(node) => {
                  tickRefs.current[i] = node;
                }}
                strokeLinecap="round"
                strokeWidth={i === activeTick ? 2 : 1.5}
                vectorEffect="non-scaling-stroke"
                x1={a.x}
                x2={b.x}
                y1={a.y}
                y2={b.y}
              />
            );
          })}
        </svg>

        {endLabels ? (
          <>
            <span aria-hidden="true" className="nt-dial-end" style={{ left: pct(minLabel.x), top: pct(minLabel.y) }}>
              {formatEnd(min)}
            </span>
            <span aria-hidden="true" className="nt-dial-end" style={{ left: pct(maxLabel.x), top: pct(maxLabel.y) }}>
              {formatEnd(max)}
            </span>
          </>
        ) : null}

        <div
          aria-labelledby={labelledBy}
          aria-valuemax={max}
          aria-valuemin={min}
          // A meter reports the value it was given, at once and unsnapped; the slider reports the notch it sits on.
          aria-valuenow={readOnly ? clamp(valueProp, min, max) : value}
          aria-valuetext={valueText}
          className={grabbing ? "nt-dial-knob is-grabbing" : "nt-dial-knob"}
          ref={knobRef}
          role={readOnly ? "meter" : "slider"}
          {...interaction}
        >
          {/* Only the indicator turns; the readout stays upright. */}
          <motion.div aria-hidden="true" className="nt-dial-turn" style={{ rotate: rotation }}>
            <span className="nt-dial-indicator" />
          </motion.div>
          {readoutPlacement === "inside" ? <div className="nt-dial-readout nt-dial-readout-inside">{readoutNode}</div> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Each character rolls on its own, so going from 21.5 to 22.0 only moves
 * the digits that changed. A touch of blur hides the overlap between the
 * outgoing and incoming glyph.
 */
// `custom` is the signed offset of the latest change. AnimatePresence hands
// the current value to the leaving glyph too, so it always exits opposite to
// the one coming in.
const rollVariants: Variants = {
  // A full transform string rather than `y`, so Motion can hand the roll to
  // the compositor instead of stepping it on the main thread.
  enter: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
  center: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
  exit: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${-offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
};

function RollingValue({
  text,
  direction,
  reduceMotion,
}: {
  text: string;
  direction: 1 | -1;
  reduceMotion: boolean;
}) {
  const offset = reduceMotion ? 0 : direction * 10;
  return (
    <span aria-hidden="true" className="nt-dial-digits">
      {text.split("").map((char, index) => (
        <span
          className="nt-dial-char"
          // Position is the identity: the same slot keeps its node.
          // biome-ignore lint/suspicious/noArrayIndexKey: characters are positional.
          key={index}
        >
          <AnimatePresence custom={offset} initial={false} mode="popLayout">
            <motion.span
              animate="center"
              custom={offset}
              exit="exit"
              initial="enter"
              key={char}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              variants={rollVariants}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
