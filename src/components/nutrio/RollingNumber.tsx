import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./rolling-number.css";

const GLYPHS = Array.from({ length: 10 }, (_, digit) => digit);

type Props = {
  value: number;
  /** Zero-pads the number to at least this many digits. */
  minDigits?: number;
  /** Milliseconds a column present on the page's first view waits before its first roll from zero. Columns that mount later start at once. */
  delay?: number;
  /** Shows a single dash instead of the digits when the value is 0. Screen readers still hear "0". */
  dashForZero?: boolean;
};

// A number whose digits roll like an odometer. The first view and every later change are CSS (see rolling-number.css), so the server HTML already holds the final digits.
// The columns are aria-hidden and draw their glyphs with CSS, so the text content is just the padded value (or "0" behind the dash).
export function RollingNumber({ value, minDigits = 1, delay = 0, dashForZero = false }: Props) {
  const rounded = Math.max(0, Math.round(value));
  // True until the first effect: server render, hydration and the first client render. Anything that mounts after that is a later change.
  const firstView = useRef(true);
  useEffect(() => {
    firstView.current = false;
  }, []);
  if (dashForZero && rounded === 0) {
    return (
      <span className="nt-roll">
        <span className="sr-only">0</span>
        <span className="nt-roll-digits" aria-hidden>
          <span className="nt-roll-dash" data-glyph="—" />
        </span>
      </span>
    );
  }
  const text = String(rounded).padStart(minDigits, "0");
  return (
    <span className="nt-roll">
      <span className="sr-only">{text}</span>
      <span className="nt-roll-digits" aria-hidden>
        {[...text].map((digit, index) => (
          // Keyed from the right, so a column keeps its place when the number grows (99 -> 100 adds a column on the left).
          <RollingDigit key={text.length - index} digit={digit} delay={firstView.current ? delay : 0} />
        ))}
      </span>
    </span>
  );
}

// The delay is fixed when the column mounts: changing it while the entrance animation waits would restart that wait.
function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [mountDelay] = useState(delay);
  return (
    <span className="nt-roll-digit" style={{ "--nt-roll-d": digit, "--nt-roll-delay": `${mountDelay}ms` } as CSSProperties}>
      <span className="nt-roll-strip">
        {GLYPHS.map((glyph) => (
          <i key={glyph} data-glyph={glyph} />
        ))}
      </span>
    </span>
  );
}
