import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// REQ-19: the stepper maps every colour to a project token in `.stepper-root` (--stepper-*). Those aliases are resolved
// through globals.css for the light and the dark theme. Text needs 4.5:1; marker, connector and focus ring 3:1.
const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const stepperCss = readFileSync(new URL("../../src/components/ui/stepper.css", import.meta.url), "utf8");

const light = declarations(globals, ":root {");
const dark = { ...light, ...declarations(globals, "html.dark:not(:has([data-theme-lock])) {") };
const lightAliases = declarations(stepperCss, ".stepper-root {");
const darkAliases = { ...lightAliases, ...declarations(stepperCss, "html.dark:not(:has([data-theme-lock])) .stepper-root {") };

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
