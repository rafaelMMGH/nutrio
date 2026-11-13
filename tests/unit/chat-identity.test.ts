import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { PLAN_NAME } from "../shared/assistant-fixture";
import { memDb, sweep, type MemDbOptions } from "./memdb";

// Spec assistant-data-scope US5: the user's name (REQ-30), the plan's name and the plan summary lead (REQ-31), and the
// REQ-27 no-plan reply for the plan name. Today is Wed 2026-10-28.

const TODAY = "2026-10-28";
const OBJECTIVE = "Mejorar mi energía";
const SUBIR = { type: "link", label: "Subir mi plan", href: "/plans" };
const FOLLOW_UPS = ["¿Cuál es mi plan?", "Mi avance de la semana"];

/** Asks `message` of a user with `options`; `planName` renames the active plan (a raw name as an upload would leave it). */
function ask(message: string, options: MemDbOptions & { planName?: string; noPlan?: boolean } = {}): ChatAnswer {
  const { planName, noPlan, ...rest } = options;
  const { db, user } = memDb(rest);
  if (planName !== undefined) db.plans[0].name = planName;
  if (noPlan) db.plans = [];
  return ragAnswer(db, user, message, TODAY, { trace: true });
}
const questions = (reply: ChatAnswer) => reply.buttons.flatMap((button) => (button.type === "question" ? [button.message] : []));
const highlights = (reply: ChatAnswer) => reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text);

test('REQ-30 "¿Cómo me llamo?" says "Te llamas Rafael." with only the name highlighted, no sources and the identity follow-ups', () => {
  const reply = ask("¿Cómo me llamo?", { name: "Rafael" });
  assert.equal(reply.kind, "answer");
  assert.equal(reply.answer, "Te llamas Rafael.");
  assert.deepEqual(reply.blocks[0].lead, [{ text: "Te llamas " }, { text: "Rafael", highlight: true }, { text: "." }]);
  assert.deepEqual(reply.blocks[0].sections, []);
  assert.deepEqual(reply.sources, []);
  assert.deepEqual(questions(reply), FOLLOW_UPS);
  assert.deepEqual(reply.resolved, [{ topic: "identity", of: "name" }]);
});

test("REQ-30 'mi nombre' asks the same, and a padded name is trimmed", () => {
  assert.equal(ask("¿Cuál es mi nombre?", { name: "  Rafael Martínez " }).answer, "Te llamas Rafael Martínez.");
});

test('REQ-30 a blank name says "Aún no tengo tu nombre registrado." with nothing highlighted', () => {
  for (const name of ["", "   "]) {
    const reply = ask("¿Cómo me llamo?", { name });
    assert.equal(reply.answer, "Aún no tengo tu nombre registrado.", JSON.stringify(name));
    assert.deepEqual(highlights(reply), []);
    assert.deepEqual(questions(reply), FOLLOW_UPS);
  }
});

test("REQ-30 the name is answered with or without a plan", () => {
  assert.equal(ask("¿Cómo me llamo?", { name: "Rafael", noPlan: true }).answer, "Te llamas Rafael.");
  assert.equal(ask("¿Cómo me llamo?", { name: "Rafael", meals: [] }).answer, "Te llamas Rafael.");
});

test('REQ-31 "¿Cómo se llama mi plan?" gives only the plan name, highlighted, not the plan summary', () => {
  const reply = ask("¿Cómo se llama mi plan?");
  assert.equal(reply.answer, `Tu plan activo se llama ${PLAN_NAME}.`);
  assert.deepEqual(reply.blocks[0].lead, [{ text: "Tu plan activo se llama " }, { text: PLAN_NAME, highlight: true }, { text: "." }]);
  assert.deepEqual(reply.blocks[0].sections, []);
  assert.deepEqual(reply.sources, [`Plan activo: ${PLAN_NAME}`]);
  assert.deepEqual(questions(reply), FOLLOW_UPS);
  assert.deepEqual(reply.resolved, [{ topic: "identity", of: "plan" }]);
});

test('REQ-31 a trailing ".pdf" is removed in any case, and only a trailing one', () => {
  for (const [raw, shown] of [["Plan octubre.PDF", "Plan octubre"], ["Plan octubre.pdf", "Plan octubre"], ["Plan octubre.Pdf ", "Plan octubre"], ["Plan.pdf octubre", "Plan.pdf octubre"], ["Plan octubre", "Plan octubre"]]) {
    const reply = ask("nombre de mi plan", { planName: raw });
    assert.equal(reply.answer, `Tu plan activo se llama ${shown}.`, raw);
    assert.deepEqual(highlights(reply), [shown], raw);
  }
});

test("REQ-31 the plan summary lead has the plan name highlighted, then the objective, and keeps its sections", () => {
  const reply = ask("¿Cuál es mi plan?", { planName: "Plan octubre.PDF" });
  assert.deepEqual(reply.blocks[0].lead, [{ text: "Tu plan activo es " }, { text: "Plan octubre", highlight: true }, { text: `. Tu objetivo: ${OBJECTIVE}` }]);
  assert.deepEqual(reply.blocks[0].sections.map((section) => section.title), ["Comidas"]);
  assert.deepEqual(reply.sources, ["Plan activo: Plan octubre.PDF"]);
  assert.equal(ask("¿Qué suplementos tomo?").blocks[0].lead[0].text, "Tu plan activo es ");
});

test("REQ-31 a blank objective leaves the objective sentence out of the plan lead", () => {
  const reply = ask("¿Cuál es mi plan?", { objective: "  " });
  assert.deepEqual(reply.blocks[0].lead, [{ text: "Tu plan activo es " }, { text: PLAN_NAME, highlight: true }, { text: "." }]);
});

test('REQ-27 no plan, a deleted plan, an inactive plan or a plan with zero slots: the plan name is "Aún no tienes un plan activo." with "Subir mi plan" only', () => {
  const states: [string, MemDbOptions & { noPlan?: boolean }][] = [
    ["no plan", { noPlan: true }],
    ["zero slots", { meals: [] }]
  ];
  for (const [label, options] of states) {
    const reply = ask("¿Cómo se llama mi plan?", options);
    assert.equal(reply.answer, "Aún no tienes un plan activo.", label);
    assert.deepEqual(reply.blocks[0].buttons, [SUBIR], label);
    assert.deepEqual(reply.buttons, [], label);
    assert.deepEqual(reply.sources, [], label);
    assert.equal(reply.kind, "answer", label);
  }
  for (const mutate of [(plan: { deleted_at: string | null }) => (plan.deleted_at = "2026-01-02T00:00:00.000Z"), (plan: { status: string }) => (plan.status = "archived")]) {
    const { db, user } = memDb();
    mutate(db.plans[0] as never);
    const reply = ragAnswer(db, user, "nombre de mi plan", TODAY);
    assert.equal(reply.answer, "Aún no tienes un plan activo.");
    assert.deepEqual(reply.blocks[0].buttons, [SUBIR]);
  }
});

test("REQ-24 an identity block in a 2-block answer is titled 'Nombre / Plan'", () => {
  const withWeight = ask("cómo me llamo y mi peso", { name: "Rafael" });
  assert.deepEqual(withWeight.blocks.map((block) => block.title), ["Nombre / Plan", "Peso"]);
  assert.equal(withWeight.blocks[0].lead.map((span) => span.text).join(""), "Te llamas Rafael.");
  const before = ask("mi peso y cómo se llama mi plan");
  assert.deepEqual(before.blocks.map((block) => block.title), ["Peso", "Nombre / Plan"]);
  const both = ask("cómo me llamo y cómo se llama mi plan", { name: "Rafael" });
  assert.deepEqual(both.blocks.map((block) => block.title), ["Nombre / Plan", "Nombre / Plan"]);
  assert.deepEqual(both.blocks.map((block) => block.lead.map((span) => span.text).join("")), ["Te llamas Rafael.", `Tu plan activo se llama ${PLAN_NAME}.`]);
  assert.equal(both.answer, `Nombre / Plan\nTe llamas Rafael.\nNombre / Plan\nTu plan activo se llama ${PLAN_NAME}.`);
});

test("REQ-5 every question button of an identity answer resolves to its own definite answer, and none repeats the question asked", () => {
  const answers = [ask("¿Cómo me llamo?", { name: "Rafael" }), ask("¿Cómo se llama mi plan?"), ask("¿Cómo me llamo?", { name: "" }), ask("cómo me llamo y mi peso")];
  const { db, user } = memDb();
  sweep(db, user, answers, TODAY);
  for (const reply of answers) assert.ok(!questions(reply).includes("¿Cómo me llamo?"));
});
