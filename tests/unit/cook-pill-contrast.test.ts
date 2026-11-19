import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrast, declarations, resolve, rgb } from "./contrast";

// REQ-19, REQ-20: the "Modo Cocina" pill is smoked dark glass with white text in both themes. Its --nt-cook-* tokens are
// composited over what can sit behind it (the plate dish's lightest and darkest stops, the page, and pure white for a
// bright ingredient icon), because the glass is translucent. Text needs 4.5:1, the capsule edge and the focus ring 3:1.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../../src/components/nutrio/tokens.css");
const css = read("../../src/components/nutrio/dashboard.css");

const light = declarations(tokens, ".nt {");
const dark = { ...light, ...declarations(tokens, "html.dark:not(:has([data-theme-lock])) .nt {") };

/** The plate dish gradients in dashboard.css (light, dark) and the white of an icon that can sit under the pill. */
const BEHIND = {
  light: ["#ffffff", "#e3e5ea", "#ffffff"],
  dark: ["#3a3c44", "#1f2026", "#ffffff"]
} as const;

const hex = (channels: number[]) => `#${channels.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
/** `top` laid over `bottom` at `alpha`, in sRGB like the browser does for a plain background. */
const over = (top: string, alpha: number, bottom: string) => {
  const [t, b] = [rgb(top), rgb(bottom)];
  return hex(t.map((v, i) => v * alpha + b[i] * (1 - alpha)));
};

for (const [theme, base] of [["light", light], ["dark", dark]] as const) {
  const token = (name: string) => {
    assert.ok(base[name], `${name} is not defined`);
    return resolve(base[name], base);
  };
  const alpha = parseFloat(token("--nt-cook-glass-alpha")) / 100;
  const backdrops = [...BEHIND[theme], resolve("var(--nt-bg)", base)];

  const surfaces = [
    ...backdrops.map((behind) => ({ name: `translucent over ${behind}`, glass: over(token("--nt-cook-glass"), alpha, behind) })),
    { name: "opaque", glass: token("--nt-cook-opaque") }
  ];

  for (const { name, glass } of surfaces) {
    test(`${theme}: ${name}, title and subtitle 4.5:1 and capsule edge 3:1 on the pill's own background`, () => {
      assert.ok(contrast("#ffffff", glass) >= 4.5, `title ${contrast("#ffffff", glass).toFixed(2)}`);
      assert.ok(contrast(token("--nt-cook-sub"), glass) >= 4.5, `subtitle ${contrast(token("--nt-cook-sub"), glass).toFixed(2)}`);
      assert.ok(contrast(token("--nt-cook-edge"), glass) >= 3, `edge ${contrast(token("--nt-cook-edge"), glass).toFixed(2)}`);
    });
  }

  test(`${theme}: the two-tone focus ring reaches 3:1 between its tones and, in one tone, on what is behind the pill`, () => {
    // The ring is the same as the action button's: 2 px --nt-surface inside, 2 px --nt-ink outside.
    const [inner, outer] = [token("--nt-surface"), token("--nt-ink")];
    assert.ok(contrast(outer, inner) >= 3, "outer vs inner");
    // Two tones so that one of them always stands out: whichever backdrop, at least one tone reaches 3:1 against it.
    for (const behind of backdrops) assert.ok(Math.max(contrast(outer, behind), contrast(inner, behind)) >= 3, `ring vs ${behind}`);
  });
}

// The pairs above are measured on the tokens, so the CSS must really draw the pill from them.
test("the pill is drawn from the measured tokens, and the opaque variant uses the opaque token", () => {
  const pill = /\.nt-cook-pill \{[^}]*\}/.exec(css)?.[0] ?? "";
  assert.match(pill, /background:\s*color-mix\(in srgb, var\(--nt-cook-glass\) var\(--nt-cook-glass-alpha\), transparent\)/);
  assert.match(pill, /border:\s*1px solid var\(--nt-cook-edge\)/);
  assert.match(pill, /color:\s*#fff/);
  assert.match(css, /\.nt-cook-sub \{[^}]*color:\s*var\(--nt-cook-sub\)/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\) \{\s*\.nt-cook-pill \{[^}]*background:\s*var\(--nt-cook-opaque\)/);
  assert.match(css, /\.nt-cook-pill:focus-visible \{[^}]*0 0 0 2px var\(--nt-surface\),\s*0 0 0 4px var\(--nt-ink\)/);
});
