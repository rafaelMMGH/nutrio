import assert from "node:assert/strict";
import { test } from "node:test";
import { variantOf, type Button } from "@/lib/assistant";

// Spec assistant-data-scope REQ-34: the one button component has three variants, chosen from the server's button.
test("a link is the link variant", () => {
  assert.equal(variantOf({ type: "link", label: "Ver plan", href: "/plans" }), "link");
});

test("a question with layout option is an option, any other question is a chip", () => {
  const option: Button = { type: "question", label: "Pollo", message: "Pollo", layout: "option" };
  const chip: Button = { type: "question", label: "Mi cena de hoy", message: "Mi cena de hoy" };
  assert.equal(variantOf(option), "option");
  assert.equal(variantOf(chip), "chip");
});
