import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS, type ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { chooseSlot, planSlots } from "@/lib/domain/chat-meals";
import { PLAN_NAME } from "../shared/assistant-fixture";
import { memDb, sweep, type MemDbOptions } from "./memdb";

// Spec assistant-data-scope REQ-7 (slot words), REQ-8 (slot times) and the REQ-11 labels, over the in-memory plan.
// The resolver picks the slot a typed ordinal or "<slot> <n>" names (T030); the options builder is T032.

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

// T028 part 2: typed ordinals and "<slot> <n>" (REQ-11), the duplicate buttons no longer loop, the sweep.
const SECOND_COLACION = "Tu horario de segunda colación: Entre 8 a 9 pm.";
const trace = (message: string, options?: MemDbOptions) => ask(message, options).resolved;

test("REQ-11 the duplicate-colación buttons answer their slot's time instead of asking again", () => {
  const first = ask("¿A qué hora es mi primera colación?", { meals: DUPLICATED });
  assert.equal(first.kind, "answer");
  assert.equal(first.answer, "Tu horario de primera colación: Entre 10 a 11 am.");
  assert.equal(ask("¿A qué hora es mi segunda colación?", { meals: DUPLICATED }).answer, SECOND_COLACION);
});

test("REQ-11 typed ordinals pick the slot, with or without accents and in either gender", () => {
  for (const typed of ["segunda colación", "segunda colacion", "SEGUNDA COLACIÓN", "colación 2", "colacion 2"]) {
    assert.equal(ask(`¿A qué hora es mi ${typed}?`, { meals: DUPLICATED }).answer, SECOND_COLACION, typed);
  }
  const meals = ["Desayuno", "Desayuno", "Cena"];
  assert.equal(ask("¿A qué hora es mi segundo desayuno?", { meals }).answer, "Tu horario de segundo desayuno: Entre 10 a 11 am.");
  assert.match(ask("¿A qué hora es mi colación 11?", { meals: Array(11).fill("Colación") }).answer, /^Tu horario de colación 11: /);
});

test("REQ-11 an ordinal the plan lacks asks which one; on a single slot it is that slot", () => {
  assert.equal(ask("¿A qué hora es mi tercera colación?", { meals: DUPLICATED }).answer, "Tienes 2 colaciones. ¿Cuál?");
  assert.equal(ask("¿A qué hora es mi primera cena?").answer, "Tu horario de cena: Entre 8 a 9 pm.");
});

test("REQ-11 a typed ordinal reaches the options reading with the slot's position", () => {
  assert.deepEqual(trace("segunda colacion", { meals: DUPLICATED }), [{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
});

test("REQ-11 with REQ-6 step 4: '¿Qué lleva la segunda colación?' is the second colación's options, not a not-found reply", () => {
  const reply = ask("¿Qué lleva la segunda colación?", { meals: DUPLICATED });
  assert.deepEqual(reply.resolved, [{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
  assert.ok(!["did_you_mean", "no_match"].includes(reply.kind), reply.kind);
});

test("REQ-5 every slot button of the duplicate, almuerzo and not-in-plan replies resolves to its slot's time", () => {
  const swept = (message: string, options: MemDbOptions) => {
    const { db, user } = memDb(options);
    return sweep(db, user, [ragAnswer(db, user, message, TODAY)], TODAY);
  };
  assert.deepEqual(swept("¿A qué hora es mi colación?", { meals: DUPLICATED }), ["¿A qué hora es mi primera colación?", "¿A qué hora es mi segunda colación?"]);
  assert.deepEqual(swept("¿A qué hora es mi almuerzo?", {}), ["¿A qué hora es mi desayuno?", "¿A qué hora es mi comida?"]);
  assert.deepEqual(swept("¿A qué hora es mi almuerzo?", { meals: ["Colación", "Cena"] }), ["¿A qué hora es mi colación?", "¿A qué hora es mi cena?"]);
});

test("REQ-7 merienda with neither a merienda nor a colación slot gets the not-in-plan reply", () => {
  assert.equal(ask("¿A qué hora es mi merienda?", { meals: ["Desayuno", "Cena"] }).answer, "Tu plan no tiene merienda.");
});

test("REQ-11 the masculine ordinals also end at ten: the eleventh desayuno is 'Desayuno 11'", () => {
  assert.equal(refsOf(Array(11).fill("Desayuno"))[10], "Desayuno 11");
});

test("REQ-27 a plan with no slots offers the starters instead of slot buttons", () => {
  const reply = ask("¿A qué hora es mi cena?", { meals: [] });
  assert.equal(reply.answer, "Tu plan no tiene cena.");
  assert.deepEqual(questions(reply).map((button) => button.message), STARTERS);
});
