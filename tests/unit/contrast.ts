import assert from "node:assert/strict";

// Colour helpers shared by the contrast tests: read declarations from a CSS block, resolve var() chains and measure WCAG contrast.
// Values are #rrggbb or oklch(L C H), the only forms the project tokens use.

export function declarations(css: string, selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s*\/\*.*?\*\/$/, "")]));
}

export function resolve(value: string, theme: Record<string, string>, depth = 0): string {
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (!ref) return value;
  assert.ok(depth < 8 && theme[ref[1]], `cannot resolve ${ref[1]}`);
  return resolve(theme[ref[1]], theme, depth + 1);
}

/** sRGB channels in 0..1 from a #rrggbb or oklch(L C H) value. */
export function rgb(value: string): number[] {
  if (value.startsWith("#")) return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const parts = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(value);
  assert.ok(parts, `unsupported colour ${value}`);
  const [l, c, h] = [Number(parts[1]), Number(parts[2]), (Number(parts[3]) * Math.PI) / 180];
  const [a, b] = [c * Math.cos(h), c * Math.sin(h)];
  const [lp, mp, sp] = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3);
  const linear = [4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp, -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp, -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp];
  return linear.map((v) => Math.min(1, Math.max(0, v)) ** (1 / 2.4) * 1.055 - 0.055);
}
export function luminance(value: string) {
  const [r, g, b] = rgb(value).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
