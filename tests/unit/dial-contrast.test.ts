import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// REQ-1, REQ-44: the dial colours sit on the Métricas tile (--nt-ink-sub), black in both themes. Text needs 4.5:1,
// graphics (fill, ticks, knob outline, focus) 3:1, checked against the light and the dark tile value.
const css = readFileSync(new URL("../../src/components/nutrio/tokens.css", import.meta.url), "utf8");

function block(selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}
function tokens(text: string) {
  return Object.fromEntries([...text.matchAll(/(--nt-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}
const light = tokens(block(".nt {"));
const dark = { ...light, ...tokens(block("html.dark:not(:has([data-theme-lock])) .nt {")) };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const text = ["--nt-dial-white", "--nt-muted-on-ink"];
const graphics = ["--nt-yellow-accent", "--nt-sky-accent", "--nt-dial-white", "--nt-orange", "--nt-dial-tick", "--nt-dial-line", "--nt-dial-focus"];

for (const [theme, set] of [["light", light], ["dark", dark]] as const) {
  test(`${theme}: dial text reaches 4.5:1 on the tile and on the knob`, () => {
    for (const bg of ["--nt-ink-sub", "--nt-dial-knob"]) {
      for (const name of text) {
        assert.ok(set[name] && set[bg], `${name} or ${bg} not defined as a hex token`);
        assert.ok(contrast(set[name], set[bg]) >= 4.5, `${name} on ${bg}: ${contrast(set[name], set[bg]).toFixed(2)}`);
      }
    }
  });
  test(`${theme}: dial graphics reach 3:1 on the tile`, () => {
    for (const name of graphics) {
      assert.ok(set[name], `${name} not defined as a hex token`);
      assert.ok(contrast(set[name], set["--nt-ink-sub"]) >= 3, `${name}: ${contrast(set[name], set["--nt-ink-sub"]).toFixed(2)}`);
    }
  });
}

test("the dial tokens are theme-independent: defined once, not in the dark block", () => {
  const darkOnly = tokens(block("html.dark:not(:has([data-theme-lock])) .nt {"));
  for (const name of ["--nt-dial-white", "--nt-dial-tick", "--nt-dial-knob", "--nt-dial-line", "--nt-dial-focus"]) assert.equal(darkOnly[name], undefined, name);
  assert.equal(light["--nt-dial-white"], "#ffffff");
  assert.equal(light["--nt-dial-tick"], "#6b6e76");
  assert.equal(light["--nt-dial-knob"], "#232428");
});
