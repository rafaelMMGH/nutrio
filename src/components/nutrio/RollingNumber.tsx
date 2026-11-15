import type { CSSProperties } from "react";
import "./rolling-number.css";

const GLYPHS = Array.from({ length: 10 }, (_, digit) => digit);

type Props = {
  value: number;
  /** Zero-pads the number to at least this many digits. */
  minDigits?: number;
  /** Milliseconds to wait before the first roll from zero. */
  delay?: number;
};

// A number whose digits roll like an odometer. The first view and every later change are CSS (see rolling-number.css), so the server HTML already holds the final digits.
// The columns are aria-hidden and draw their glyphs with CSS, so the text content is just the padded value.
export function RollingNumber({ value, minDigits = 1, delay = 0 }: Props) {
  const text = String(Math.max(0, Math.round(value))).padStart(minDigits, "0");
  return (
    <span className="nt-roll" style={{ "--nt-roll-delay": `${delay}ms` } as CSSProperties}>
      <span className="sr-only">{text}</span>
      <span className="nt-roll-digits" aria-hidden>
        {[...text].map((digit, index) => (
          // Keyed from the right, so a column keeps its place when the number grows (99 -> 100 adds a column on the left).
          <span key={text.length - index} className="nt-roll-digit" style={{ "--nt-roll-d": digit } as CSSProperties}>
            <span className="nt-roll-strip">
              {GLYPHS.map((glyph) => (
                <i key={glyph} data-glyph={glyph} />
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
