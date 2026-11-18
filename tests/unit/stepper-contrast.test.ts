import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// REQ-19: the stepper maps every colour to a project token in `.stepper-root` (--stepper-*). Those aliases are resolved
// through globals.css for the light and the dark theme. Text needs 4.5:1; marker, connector and focus ring 3:1.
const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const stepperCss = readFileSync(new URL("../../src/components/ui/stepper.css", import.meta.url), "utf8");

function declarations(css: string, selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s*\/\*.*?\*\/$/, "")]));
}

const light = declarations(globals, ":root {");
const dark = { ...light, ...declarations(globals, "html.dark:not(:has([data-theme-lock])) {") };
const lightAliases = declarations(stepperCss, ".stepper-root {");
const darkAliases = { ...lightAliases, ...declarations(stepperCss, "html.dark:not(:has([data-theme-lock])) .stepper-root {") };

function resolve(value: string, theme: Record<string, string>, depth = 0): string {
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (!ref) return value;
  assert.ok(depth < 8 && theme[ref[1]], `cannot resolve ${ref[1]}`);
  return resolve(theme[ref[1]], theme, depth + 1);
}

/** sRGB channels in 0..1 from a #rrggbb or oklch(L C H) value. */
function rgb(value: string): number[] {
  if (value.startsWith("#")) return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const parts = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(value);
  assert.ok(parts, `unsupported colour ${value}`);
  const [l, c, h] = [Number(parts[1]), Number(parts[2]), (Number(parts[3]) * Math.PI) / 180];
  const [a, b] = [c * Math.cos(h), c * Math.sin(h)];
  const [lp, mp, sp] = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3);
  const linear = [4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp, -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp, -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp];
  return linear.map((v) => Math.min(1, Math.max(0, v)) ** (1 / 2.4) * 1.055 - 0.055);
}
function luminance(value: string) {
  const [r, g, b] = rgb(value).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [foreground alias, background alias]; the stepper sits on the modal surface, the filled disc on its own fill.
const text: [string, string][] = [
  ["--stepper-label-current", "--stepper-surface"],
  ["--stepper-label", "--stepper-surface"],
  ["--stepper-description", "--stepper-surface"],
  ["--stepper-error-text", "--stepper-surface"],
  ["--stepper-on-fill", "--stepper-fill"]
];
const graphics: [string, string][] = [
  ["--stepper-marker-line", "--stepper-surface"],
  ["--stepper-fill", "--stepper-surface"],
  ["--stepper-line-fill", "--stepper-surface"],
  ["--stepper-connector", "--stepper-surface"],
  ["--stepper-error-line", "--stepper-surface"],
  ["--stepper-focus", "--stepper-surface"]
];

for (const [name, theme, aliases] of [["light", light, lightAliases], ["dark", dark, darkAliases]] as const) {
  const color = (alias: string) => {
    assert.ok(aliases[alias], `${alias} is not defined in .stepper-root`);
    return resolve(aliases[alias], theme);
  };
  test(`${name}: stepper text reaches 4.5:1`, () => {
    for (const [fg, bg] of text) assert.ok(contrast(color(fg), color(bg)) >= 4.5, `${fg} on ${bg}: ${contrast(color(fg), color(bg)).toFixed(2)}`);
  });
  test(`${name}: stepper marker, connector and focus ring reach 3:1`, () => {
    for (const [fg, bg] of graphics) assert.ok(contrast(color(fg), color(bg)) >= 3, `${fg} on ${bg}: ${contrast(color(fg), color(bg)).toFixed(2)}`);
  });
  // In dark mode the track must not read as brighter than the fill, or filled and unfilled swap meaning.
  test(`${name}: connector fill is told apart from the track`, () => {
    assert.notEqual(color("--stepper-line-fill"), color("--stepper-connector"));
    const [fill, track, surface] = [color("--stepper-line-fill"), color("--stepper-connector"), color("--stepper-surface")];
    assert.ok(contrast(fill, surface) >= contrast(track, surface), `fill ${contrast(fill, surface).toFixed(2)} vs track ${contrast(track, surface).toFixed(2)} on the surface`);
  });
}
