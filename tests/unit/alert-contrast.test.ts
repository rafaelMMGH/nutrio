import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// REQ-19, REQ-22, REQ-25 (Q23): the shared Alert maps its colours to project tokens on `.alert-live` (--alert-*), per tone.
// Only the tones the wizard uses are tested: danger (rejection) and warning (delete and confirm failures). Title and body
// text need 4.5:1; the icon and the edge 3:1, all on the tone background, in the light and the dark theme.
const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const alertCss = readFileSync(new URL("../../src/components/ui/alert.css", import.meta.url), "utf8");

const light = declarations(globals, ":root {");
const dark = { ...light, ...declarations(globals, "html.dark:not(:has([data-theme-lock])) {") };

const darkPrefix = "html.dark:not(:has([data-theme-lock])) ";
const tones = [["danger", "danger"], ["warning", "warning"]] as const;
const text = ["--alert-title", "--alert-body"];
const graphics = ["--alert-icon", "--alert-edge", "--alert-focus"];

for (const [themeName, theme] of [["light", light], ["dark", dark]] as const) {
  for (const [label, tone] of tones) {
    const selector = `.alert-live[data-tone="${tone}"] {`;
    const base = { ...declarations(alertCss, ".alert-live {"), ...declarations(alertCss, selector) };
    const aliases = themeName === "dark" && alertCss.includes(darkPrefix + selector) ? { ...base, ...declarations(alertCss, darkPrefix + selector) } : base;
    const color = (alias: string) => {
      assert.ok(aliases[alias], `${alias} is not defined for ${label}`);
      return resolve(aliases[alias], theme);
    };
    const ratio = (fg: string) => contrast(color(fg), color("--alert-bg"));
    test(`${themeName}: ${label} alert text reaches 4.5:1`, () => {
      for (const fg of text) assert.ok(ratio(fg) >= 4.5, `${fg} on --alert-bg: ${ratio(fg).toFixed(2)}`);
    });
    test(`${themeName}: ${label} alert icon, edge and focus ring reach 3:1`, () => {
      for (const fg of graphics) assert.ok(ratio(fg) >= 3, `${fg} on --alert-bg: ${ratio(fg).toFixed(2)}`);
    });
  }
}
