import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { chooseSlot, planSlots } from "@/lib/domain/chat-meals";
import { PLAN_NAME } from "../shared/assistant-fixture";
import { memDb, type MemDbOptions } from "./memdb";

// Spec assistant-data-scope REQ-7 (slot words), REQ-8 (slot times) and the REQ-11 labels, over the in-memory plan.
// Typed ordinals and "<slot> <n>" belong to the resolver (T030); the options builder to T032.

const TODAY = "2026-10-28";
const DUPLICATED = ["Desayuno", "Colación", "Comida", "Colación", "Cena"];
const ask = (message: string, options?: MemDbOptions) => {
  const { db, user } = memDb(options);
  return ragAnswer(db, user, message, TODAY, { trace: true });
};
const questions = (reply: ChatAnswer) => reply.buttons.flatMap((button) => (button.type === "question" ? [button] : []));
const highlighted = (reply: ChatAnswer) => reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text);
const refsOf = (meals: string[]) => {
  const { db, user } = memDb({ meals });
  return planSlots(db, user.id)!.slots.map((slot) => slot.ref);
};

test("REQ-8 a slot's time answers only that slot, the time highlighted", () => {
  const reply = ask("¿A qué hora es la cena?");
  assert.equal(reply.kind, "answer");
  assert.equal(reply.answer, "Tu horario de cena: Entre 8 a 9 pm.");
  assert.deepEqual(highlighted(reply), ["Entre 8 a 9 pm"]);
  assert.deepEqual(reply.blocks[0].sections, []);
  assert.deepEqual(reply.sources, [`Plan activo: ${PLAN_NAME}`]);
  assert.deepEqual(reply.resolved, [{ topic: "mealTimes", slot: "cena" }]);
});

test("REQ-8 a slot without a time says so, with nothing highlighted", () => {
  const reply = ask("¿Cuándo desayuno?", { times: "none" });
  assert.equal(reply.answer, "Tu plan no tiene horario para tu desayuno.");
  assert.deepEqual(highlighted(reply), []);
});

test("REQ-8 with no slot named every slot is listed with its time highlighted", () => {
  const reply = ask("¿Cuál es mi horario?", { times: "some" });
  assert.deepEqual(
    reply.blocks[0].sections[0].items.map((item) => item.map((span) => span.text).join("")),
    ["Desayuno · Entre 7 a 8 am", "Colación", "Comida · Entre 2 a 3 pm", "Cena"]
  );
});

test("REQ-8 without an active plan the reply says so", () => {
  const { db, user } = memDb();
  db.plans = [];
  assert.equal(ragAnswer(db, user, "¿A qué hora es la cena?", TODAY).answer, "No tienes un plan activo.");
});

test("REQ-7 merienda and snack map to colación when the plan has no slot with that name", () => {
  for (const word of ["merienda", "snack"]) assert.equal(ask(`¿A qué hora es mi ${word}?`).answer, "Tu horario de colación: Entre 10 a 11 am.", word);
});

test("REQ-7 a slot with the asked name wins", () => {
  assert.equal(ask("¿A qué hora es mi merienda?", { meals: ["Desayuno", "Merienda", "Cena"] }).answer, "Tu horario de merienda: Entre 10 a 11 am.");
  assert.equal(ask("¿A qué hora es mi almuerzo?", { meals: ["Desayuno", "Almuerzo", "Cena"] }).answer, "Tu horario de almuerzo: Entre 10 a 11 am.");
});

test("REQ-7 almuerzo without such a slot asks desayuno or comida, one button per slot that exists", () => {
  const both = ask("¿A qué hora es mi almuerzo?");
  assert.equal(both.kind, "clarify");
  assert.equal(both.answer, "¿Te refieres al desayuno o a la comida?");
  assert.deepEqual(questions(both).map((button) => [button.label, button.message]), [
    ["Desayuno", "¿A qué hora es mi desayuno?"],
    ["Comida", "¿A qué hora es mi comida?"]
  ]);
  assert.deepEqual(questions(ask("¿A qué hora es mi almuerzo?", { meals: ["Comida", "Cena"] })).map((button) => button.label), ["Comida"]);
});

test("REQ-7 an options question about almuerzo offers the slots' options (Given: Comida sends '¿Cuál es mi comida?')", () => {
  const { db, user } = memDb();
  const chosen = chooseSlot(planSlots(db, user.id)!, "almuerzo", "options");
  assert.ok("built" in chosen);
  assert.deepEqual(chosen.built.buttons?.map((button) => button.type === "question" && button.message), ["¿Cuál es mi desayuno?", "¿Cuál es mi comida?"]);
});

test("REQ-7 a slot word the plan lacks gets the not-in-plan reply with one button per plan slot", () => {
  const reply = ask("¿A qué hora es mi almuerzo?", { meals: ["Colación", "Cena"] });
  assert.equal(reply.kind, "answer");
  assert.equal(reply.answer, "Tu plan no tiene almuerzo.");
  assert.deepEqual(questions(reply).map((button) => button.label), ["Colación", "Cena"]);
  assert.equal(ask("¿A qué hora es mi colación?", { meals: ["Cena"] }).answer, "Tu plan no tiene colación.");
});

test("REQ-11 duplicate slot names ask which one, with the time in each label when there is one", () => {
  const reply = ask("¿A qué hora es mi colación?", { meals: DUPLICATED });
  assert.equal(reply.kind, "clarify");
  assert.equal(reply.answer, "Tienes 2 colaciones. ¿Cuál?");
  assert.deepEqual(questions(reply).map((button) => [button.label, button.message]), [
    ["Primera colación (Entre 10 a 11 am)", "¿A qué hora es mi primera colación?"],
    ["Segunda colación (Entre 8 a 9 pm)", "¿A qué hora es mi segunda colación?"]
  ]);
  assert.deepEqual(questions(ask("¿A qué hora es mi colación?", { meals: DUPLICATED, times: "none" })).map((button) => button.label), ["Primera colación", "Segunda colación"]);
});

test("REQ-11 the options version of the duplicate choice sends '¿Cuál es mi <ref>?'", () => {
  const { db, user } = memDb({ meals: DUPLICATED });
  const chosen = chooseSlot(planSlots(db, user.id)!, "colacion", "options");
  assert.ok("built" in chosen);
  assert.deepEqual(chosen.built.buttons?.map((button) => button.type === "question" && button.message), ["¿Cuál es mi primera colación?", "¿Cuál es mi segunda colación?"]);
});

test("REQ-11 refs: feminine and masculine ordinals up to 10, then '<Slot> <n>'", () => {
  const FEMININE = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];
  const MASCULINE = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"];
  assert.deepEqual(refsOf(Array(11).fill("Colación")), [...FEMININE.map((ordinal) => `${ordinal} colación`), "Colación 11"]);
  for (const slot of ["Desayuno", "Almuerzo", "Snack"]) {
    assert.deepEqual(refsOf(Array(10).fill(slot)), MASCULINE.map((ordinal) => `${ordinal} ${slot.toLowerCase()}`), slot);
  }
  assert.deepEqual(refsOf(DUPLICATED), ["Desayuno", "Primera colación", "Comida", "Segunda colación", "Cena"]);
});

test("REQ-11 eleven colaciones: the tenth and eleventh buttons read 'Décima colación' and 'Colación 11'", () => {
  const reply = ask("¿A qué hora es mi colación?", { meals: Array(11).fill("Colación") });
  assert.equal(reply.answer, "Tienes 11 colaciones. ¿Cuál?");
  const labels = questions(reply).map((button) => button.label);
  assert.equal(labels.length, 11);
  assert.deepEqual(labels.slice(9), ["Décima colación (Entre 10 a 11 am)", "Colación 11 (Entre 2 a 3 pm)"]);
});

test("REQ-11 two snacks read '2 snacks' (the loanword takes only an s)", () => {
  assert.equal(ask("¿A qué hora es mi snack?", { meals: ["Desayuno", "Snack", "Snack"] }).answer, "Tienes 2 snacks. ¿Cuál?");
});
