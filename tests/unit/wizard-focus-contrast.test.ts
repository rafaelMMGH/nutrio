import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve } from "./contrast";

// REQ-19: `.nt :is(a, button, [tabindex]):focus-visible` (0,3,0) in nutrio/primitives.css clears the outline of every
// control inside the signed-in shell, so the wizard needs its own ring rule that outranks it. The ring colour must
// also reach 3:1 on every surface those controls sit on.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const globals = read("src/app/globals.css");
const wizardCss = read("src/components/app/upload-wizard/upload-wizard.css");
const shellRule = [...read("src/components/nutrio/primitives.css").matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) => m[1].includes(":focus-visible") && m[1].includes(".nt"));

/** Specificity [ids, classes, types] of a selector; :is()/:where() count as their most specific argument / zero. */
function specificity(selector: string): number[] {
  const total = [0, 0, 0];
  const add = (s: number[]) => s.forEach((v, i) => (total[i] += v));
  const rest = selector.replace(/:(is|not)\(([^)]*)\)/g, (_m, _name, args: string) => {
    const best = args.split(",").map((a) => specificity(a.trim())).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    add(best);
    return "";
  });
  add([(rest.match(/#[\w-]+/g) ?? []).length, (rest.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length, (rest.match(/(?:^|[\s>+~])[a-z][\w-]*/gi) ?? []).length]);
  return total;
}
const beats = (a: number[], b: number[]) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) > 0;

const rules = [...wizardCss.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
const ring = rules.find((r) => r.selector.includes(":focus-visible") && r.selector.includes(".nt ") && r.selector.includes(".upload-wizard-modal"));

test("wizard focus ring rule exists and outranks the shell's rule", () => {
  assert.ok(shellRule, "shell focus rule not found in primitives.css");
  assert.ok(ring, "no .nt .upload-wizard-modal ...:focus-visible rule in upload-wizard.css");
  const shell = specificity(shellRule[1].trim());
  assert.deepEqual(shell, [0, 3, 0]);
  assert.ok(beats(specificity(ring.selector), shell), `${ring.selector} is ${specificity(ring.selector)}, shell is ${shell}`);
});

test("wizard focus ring draws an outline and removes the shell's box-shadow ring", () => {
  assert.ok(ring);
  assert.match(ring.body, /outline:\s*\d+px solid /);
  assert.doesNotMatch(ring.body, /outline(-style)?:\s*none/);
  assert.match(ring.body, /box-shadow:\s*none/);
});

test("wizard focus ring covers the interactive elements of the wizard", () => {
  assert.ok(ring);
  for (const el of ["a", "button", "[tabindex]", "input", "summary"]) assert.ok(ring.selector.includes(el), `${el} missing from ${ring.selector}`);
});

const light = declarations(globals, ":root {");
const dark = { ...light, ...declarations(globals, "html.dark:not(:has([data-theme-lock])) {") };
const surfaces = ["--surface", "--surface-raised", "--brand-50", "--warn-soft", "--danger-soft"];
for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
  test(`${name}: wizard focus ring colour reaches 3:1 on every surface`, () => {
    assert.ok(ring);
    const color = /outline:\s*\d+px solid (var\(--[\w-]+\))/.exec(ring.body)?.[1];
    assert.ok(color, "ring colour is not a token");
    const fg = resolve(color, theme);
    for (const s of surfaces) {
      const ratio = contrast(fg, resolve(theme[s], theme));
      console.log(`${name} ${color} on ${s}: ${ratio.toFixed(2)}`);
      assert.ok(ratio >= 3, `${color} on ${s}: ${ratio.toFixed(2)}`);
    }
  });
}

// The dialog section is a tabindex=-1 element, so the shell rule also gives it the box-shadow halo; its own rule must clear both.
test("wizard dialog section shows no outline and no shell box-shadow halo, and outranks the shell rule", () => {
  assert.ok(shellRule);
  const section = rules.find((r) => r.selector.endsWith(".upload-wizard-modal:focus-visible"));
  assert.ok(section, "no .upload-wizard-modal:focus-visible rule in upload-wizard.css");
  assert.match(section.body, /outline:\s*none/);
  assert.match(section.body, /box-shadow:\s*none/);
  assert.ok(beats(specificity(section.selector), specificity(shellRule[1].trim())), `${section.selector} does not beat the shell rule`);
});
