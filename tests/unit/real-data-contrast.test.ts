import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// specs/dashboard-real-data, plan §Tokens: the "Comidas de hoy" and "Cumplimiento del plan" cards sit on --nt-yellow and
// --nt-sky, which keep their light colours in both themes while --nt-ink flips. So their content uses card-scoped tokens.
// Text needs 4.5:1; graphics (focus ring, selected marker, check icon, dividers, arc fill) 3:1. Checked in both themes
// so a future dark override cannot regress unnoticed.
const css = readFileSync(new URL("../../src/components/nutrio/tokens.css", import.meta.url), "utf8");
const light = declarations(css, ".nt {");
const dark = { ...light, ...declarations(css, "html.dark:not(:has([data-theme-lock])) .nt {") };

const TEXT = 4.5;
const GRAPHIC = 3;

for (const [theme, set] of [["light", light], ["dark", dark]] as const) {
  const ratio = (fg: string, bg: string) => {
    assert.ok(set[fg], `${fg} is not defined`);
    assert.ok(set[bg], `${bg} is not defined`);
    return contrast(resolve(set[fg], set), resolve(set[bg], set));
  };
  const atLeast = (min: number, fg: string, bg: string) => assert.ok(ratio(fg, bg) >= min, `${fg} on ${bg}: ${ratio(fg, bg).toFixed(2)}, needs ${min}`);

  test(`${theme}: text on yellow, hover and press reaches 4.5:1`, () => {
    for (const bg of ["--nt-yellow", "--nt-yellow-hover", "--nt-yellow-press"]) {
      atLeast(TEXT, "--nt-on-accent", bg);
      atLeast(TEXT, "--nt-on-accent-sub", bg);
    }
  });

  test(`${theme}: focus ring, selected marker, check icon and divider reach 3:1 on yellow`, () => {
    atLeast(GRAPHIC, "--nt-on-accent", "--nt-yellow");
    atLeast(GRAPHIC, "--nt-on-accent-line", "--nt-yellow");
  });

  test(`${theme}: text on sky reaches 4.5:1 and the arc fill 3:1`, () => {
    atLeast(TEXT, "--nt-on-accent", "--nt-sky");
    atLeast(TEXT, "--nt-on-accent-sub", "--nt-sky");
    atLeast(GRAPHIC, "--nt-sky-deep", "--nt-sky");
  });
}
