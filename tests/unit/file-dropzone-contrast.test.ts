import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// REQ-19, REQ-25: the dropzone maps its colours to project tokens on `.fdz-root` (--fdz-*). Text needs 4.5:1 and the
// dashed edge, progress bar, done check and focus ring 3:1, in the light and the dark theme. Rejection and row-error
// messages belong to the shared Alert (alert-contrast.test.ts) and are not covered here.
const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const dropzoneCss = readFileSync(new URL("../../src/components/ui/file-dropzone.css", import.meta.url), "utf8");

const light = declarations(globals, ":root {");
const dark = { ...light, ...declarations(globals, "html.dark:not(:has([data-theme-lock])) {") };

const darkSelector = "html.dark:not(:has([data-theme-lock])) .fdz-root {";
const lightAliases = declarations(dropzoneCss, ".fdz-root {");
const darkAliases = { ...lightAliases, ...(dropzoneCss.includes(darkSelector) ? declarations(dropzoneCss, darkSelector) : {}) };

// [alias, background alias]: the prompt and the drag-over prompt sit on the zone, the row text on the row.
const text: [string, string][] = [
  ["--fdz-prompt", "--fdz-surface"],
  ["--fdz-prompt", "--fdz-drag-bg"],
  ["--fdz-secondary", "--fdz-surface"],
  ["--fdz-secondary", "--fdz-drag-bg"],
  ["--fdz-note", "--fdz-surface"],
  ["--fdz-note", "--fdz-drag-bg"],
  ["--fdz-name", "--fdz-row-bg"],
  ["--fdz-meta", "--fdz-row-bg"],
  ["--fdz-status", "--fdz-row-bg"],
  ["--fdz-failed", "--fdz-row-bg"],
  ["--fdz-retry", "--fdz-row-bg"],
  // Hover tints the zone and, on the row buttons, the Reintentar and ✕ background.
  ["--fdz-prompt", "--fdz-hover-bg"],
  ["--fdz-secondary", "--fdz-hover-bg"],
  ["--fdz-note", "--fdz-hover-bg"],
  ["--fdz-retry", "--fdz-hover-bg"],
];
const graphics: [string, string][] = [
  ["--fdz-edge", "--fdz-surface"],
  ["--fdz-edge-active", "--fdz-drag-bg"],
  ["--fdz-fill", "--fdz-surface"],
  ["--fdz-done", "--fdz-row-bg"],
  ["--fdz-focus", "--fdz-surface"],
  ["--fdz-focus", "--fdz-row-bg"],
  ["--fdz-focus", "--fdz-drag-bg"],
  ["--fdz-focus", "--fdz-hover-bg"],
  ["--fdz-secondary", "--fdz-row-bg"],
  ["--fdz-secondary", "--fdz-hover-bg"],
  ["--fdz-edge", "--fdz-row-bg"],
  ["--fdz-edge", "--fdz-hover-bg"],
];

for (const [name, theme, aliases] of [["light", light, lightAliases], ["dark", dark, darkAliases]] as const) {
  const color = (alias: string) => {
    assert.ok(aliases[alias], `${alias} is not defined`);
    return resolve(aliases[alias], theme);
  };
  const ratio = (fg: string, bg: string) => contrast(color(fg), color(bg));
  test(`${name}: dropzone text reaches 4.5:1`, () => {
    for (const [fg, bg] of text) assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg}: ${ratio(fg, bg).toFixed(2)}`);
  });
  test(`${name}: dropzone edge, progress, check and focus ring reach 3:1`, () => {
    for (const [fg, bg] of graphics) assert.ok(ratio(fg, bg) >= 3, `${fg} on ${bg}: ${ratio(fg, bg).toFixed(2)}`);
  });
  test(`${name}: the progress fill reads against its track`, () => {
    assert.ok(ratio("--fdz-fill", "--fdz-track") >= 3, `--fdz-fill on --fdz-track: ${ratio("--fdz-fill", "--fdz-track").toFixed(2)}`);
  });
}
