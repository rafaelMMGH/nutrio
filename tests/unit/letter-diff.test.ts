import assert from "node:assert/strict";
import { test } from "node:test";
import { changedLetters } from "@/components/arc/action-button/letter-diff";

const IDLE = "Marcar cumplida";
const PENDING = "Guardando";
const SUCCESS = "Cumplida";
const flags = (changed: boolean[]) => changed.map((c) => (c ? "1" : "0")).join("");

// REQ-7: only the letters that differ from the previous label rise; the rest stay still.
test("idle to pending: every letter changes", () => {
  assert.equal(flags(changedLetters(IDLE, PENDING)), "1".repeat(PENDING.length));
});

test("pending to idle: every letter changes", () => {
  assert.equal(flags(changedLetters(PENDING, IDLE)), "1".repeat(IDLE.length));
});

test("pending to success: every letter changes", () => {
  assert.equal(flags(changedLetters(PENDING, SUCCESS)), "1".repeat(SUCCESS.length));
});

test("success to idle: the shared ending 'umplida' stays, the rest rises", () => {
  // "Cumplida" -> "Marcar cumplida": only "Marcar c" is new.
  assert.equal(flags(changedLetters(SUCCESS, IDLE)), "11111111" + "0".repeat(7));
});

test("idle to success: only the capital C changes (the ending 'umplida' stays)", () => {
  assert.equal(flags(changedLetters(IDLE, SUCCESS)), "1" + "0".repeat(7));
});

test("the same label changes nothing, and an empty previous label changes everything", () => {
  assert.equal(flags(changedLetters(IDLE, IDLE)), "0".repeat(IDLE.length));
  assert.equal(flags(changedLetters("", SUCCESS)), "1".repeat(SUCCESS.length));
});
