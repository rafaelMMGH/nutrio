import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// REQ-26: the action button maps its colours to --nt-* tokens in action-button.css (--arc-ab-*). They are resolved
// through tokens.css for the light and the dark theme. Text needs 4.5:1; arrow, check, spinner and focus ring 3:1.
const tokens = readFileSync(new URL("../../src/components/nutrio/tokens.css", import.meta.url), "utf8");
const buttonCss = readFileSync(new URL("../../src/components/arc/action-button/action-button.css", import.meta.url), "utf8");

const light = declarations(tokens, ".nt {");
const dark = { ...light, ...declarations(tokens, "html.dark:not(:has([data-theme-lock])) .nt {") };
const idle = declarations(buttonCss, ".arc-ab {");
const done = { ...idle, ...declarations(buttonCss, '.arc-ab[data-state="success"] {') };

for (const [theme, base] of [["light", light], ["dark", dark]] as const) {
  const colour = (aliases: Record<string, string>, name: string) => {
    assert.ok(aliases[name] || base[name], `${name} is not defined`);
    return resolve(`var(${name})`, { ...base, ...aliases });
  };
  const ratio = (aliases: Record<string, string>, a: string, b: string) => contrast(colour(aliases, a), colour(aliases, b));

  test(`${theme}: idle and pending, label 4.5:1 and arrow and spinner 3:1 on the surface`, () => {
    assert.ok(ratio(idle, "--arc-ab-fg", "--arc-ab-bg") >= 4.5, `label ${ratio(idle, "--arc-ab-fg", "--arc-ab-bg").toFixed(2)}`);
    assert.ok(ratio(idle, "--arc-ab-icon", "--arc-ab-bg") >= 3, "arrow");
    assert.ok(ratio(idle, "--arc-ab-spinner", "--arc-ab-bg") >= 3, "spinner");
    assert.equal(colour(idle, "--arc-ab-bg"), colour(idle, "--nt-surface"));
  });

  test(`${theme}: done, label 4.5:1 and check 3:1 on the ink fill`, () => {
    assert.ok(ratio(done, "--arc-ab-fg", "--arc-ab-bg") >= 4.5, `label ${ratio(done, "--arc-ab-fg", "--arc-ab-bg").toFixed(2)}`);
    assert.ok(ratio(done, "--arc-ab-icon", "--arc-ab-bg") >= 3, "check");
    assert.equal(colour(done, "--arc-ab-bg"), colour(done, "--nt-ink"));
  });

  test(`${theme}: the two-tone focus ring reaches 3:1 on the hero background, between its tones and on the done fill`, () => {
    const ring = (a: string, b: string, aliases: Record<string, string> = idle) => ratio(aliases, a, b);
    assert.ok(ring("--arc-ab-ring-outer", "--nt-bg") >= 3, "outer vs hero background");
    assert.ok(ring("--arc-ab-ring-outer", "--arc-ab-ring-inner") >= 3, "outer vs inner");
    assert.ok(ring("--arc-ab-ring-inner", "--arc-ab-bg", done) >= 3, "inner vs done fill");
  });
}
