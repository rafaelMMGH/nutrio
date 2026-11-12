import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS, type Button, type ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { type Built, chooseSlot, planSlots, slotOptions, type SlotOptionsView } from "@/lib/domain/chat-meals";
import type { AppDb } from "@/lib/types";
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

// REQ-9, REQ-10, REQ-11 (T031 part 1): the options builder. With the default plan Cena has 5 options (4 generic and
// "Sándwich de atún"), Comida 7 (5 generic, "Pollo asado", "Ensalada de pollo") and Colación 5 (generic).
const options = (slot: string, { ordinal, ...view }: SlotOptionsView & { ordinal?: number } = {}, config?: MemDbOptions, tweak?: (db: AppDb) => void) => {
  const { db, user } = memDb(config);
  tweak?.(db);
  return slotOptions(db, user.id, { topic: "slotOptions", slot, ordinal }, `¿Qué lleva la ${slot}?`, view);
};
const labels = (built: Built) => builtQuestions(built).map((button) => button.label);
const builtQuestions = (built: { buttons?: Button[] }) => (built.buttons ?? []).flatMap((button) => (button.type === "question" ? [button] : []));
const optionButtons = (built: Built) => builtQuestions(built).filter((button) => button.layout === "option");
const leadText = (built: Built) => built.lead.map((span) => span.text).join("");
/** Gives a recipe exactly `count` of the plan's ingredients, taking them from the first three the fixture seeds. */
const withIngredientCount = (recipeName: string, count: number) => (db: AppDb) => {
  const recipe = db.recipes.find((item) => item.name === recipeName)!;
  const own = db.ingredientUsages.filter((usage) => usage.source_id === recipe.id);
  db.ingredientUsages = db.ingredientUsages.filter((usage) => !own.includes(usage));
  const names = ["Pollo", "Arroz", "Brócoli", "Calabaza"];
  names.slice(0, count).forEach((name, index) => {
    const id = `ing-${name}`;
    if (!db.ingredients.some((item) => item.id === id)) db.ingredients.push({ ...db.ingredients[0], id, canonical_name: name });
    db.ingredientUsages.push({ ...own[0], id: `${recipe.id}-x${index}`, ingredient_id: id });
  });
};

test("REQ-9 5 options: page 1 is 3 option buttons and 'Ver más opciones', in plan order", () => {
  const built = options("cena");
  assert.deepEqual(labels(built), ["Opción 1: Huevo, Aguacate", "Opción 2: Avena, Canela", "Opción 3: Frijoles, Sal", "Ver más opciones"]);
  assert.deepEqual(optionButtons(built).map((button) => button.message), ["Cena, opción 1", "Cena, opción 2", "Cena, opción 3"]);
  assert.equal(builtQuestions(built)[3].message, "Cena, más opciones (página 2)");
  assert.equal(builtQuestions(built)[3].layout, undefined);
  assert.deepEqual(built.sources, [`Plan activo: ${PLAN_NAME}`]);
});

test("REQ-9 page 2 of 5 shows options 4 and 5 with 'Opciones anteriores' only", () => {
  const built = options("cena", { page: 2 });
  assert.deepEqual(labels(built), ["Opción 4: Huevo, Aguacate", "Sándwich de atún", "Opciones anteriores"]);
  assert.deepEqual(optionButtons(built).map((button) => button.message), ["Cena, opción 4", "Cena, opción 5"]);
  assert.equal(builtQuestions(built)[2].message, "Cena, más opciones (página 1)");
});

test("REQ-9 a middle page has both paging buttons; 7 options: page 3 is option 7 with 'Opciones anteriores' only", () => {
  assert.deepEqual(labels(options("comida", { page: 2 })).slice(3), ["Ver más opciones", "Opciones anteriores"]);
  const last = options("comida", { page: 3 });
  assert.deepEqual(labels(last), ["Ensalada de pollo", "Opciones anteriores"]);
  assert.equal(optionButtons(last)[0].message, "Comida, opción 7");
  assert.equal(builtQuestions(last)[1].message, "Comida, más opciones (página 2)");
});

test("REQ-9 a page past the last shows the last page; page 1 equals the plain answer", () => {
  assert.deepEqual(labels(options("cena", { page: 9 })), labels(options("cena", { page: 2 })));
  assert.deepEqual(options("cena", { page: 1 }), options("cena"));
});

test("REQ-9 labels: the recipe name, or 'Opción <n>: <first 3 ingredients>' with '…' only above 3, or 'Opción <n>'", () => {
  const label = (count: number) => labels(options("cena", {}, undefined, withIngredientCount("Cena opcion 2", count)))[1];
  assert.equal(label(4), "Opción 2: Pollo, Arroz, Brócoli…");
  assert.equal(label(3), "Opción 2: Pollo, Arroz, Brócoli");
  assert.equal(label(0), "Opción 2");
  assert.equal(labels(options("cena", { page: 2 }))[1], "Sándwich de atún");
});

test("REQ-9 the lead is one of the three variants, the same for the same question", () => {
  const lead = leadText(options("cena"));
  assert.ok(["Estas son tus opciones de cena:", "Para tu cena puedes elegir:", "Tus opciones de cena son:"].includes(lead), lead);
  assert.equal(leadText(options("cena")), lead);
});

/** The cena slot's options, in the fixture's insertion order. */
const cenaOptions = (db: AppDb) => {
  const cena = db.mealTypes.find((meal) => meal.name === "Cena")!;
  return db.mealOptions.filter((option) => option.meal_type_id === cena.id);
};

test("REQ-9 plan order comes from option_number, not from the order the rows are stored in", () => {
  const plain = labels(options("cena"));
  assert.deepEqual(labels(options("cena", {}, undefined, (db) => db.mealOptions.reverse())), plain);
});

test("REQ-9 a soft-deleted option or recipe is skipped, and the labels count the options that are listed", () => {
  const second = cenaOptions(memDb().db)[1];
  const skipped = (tweak: (db: AppDb) => void) => labels(options("cena", {}, undefined, tweak));
  const withoutSecond = ["Opción 1: Huevo, Aguacate", "Opción 2: Frijoles, Sal", "Opción 3: Huevo, Aguacate", "Ver más opciones"];
  assert.deepEqual(skipped((db) => { cenaOptions(db)[1].deleted_at = "2026-02-01T00:00:00.000Z"; }), withoutSecond);
  assert.deepEqual(skipped((db) => { db.recipes.find((recipe) => recipe.id === second.recipe_id)!.deleted_at = "2026-02-01T00:00:00.000Z"; }), withoutSecond);
});

test("REQ-9 exactly one page: 3 options have no paging buttons, and 1 option is listed alone (the detail is T034)", () => {
  const keep = (count: number) => (db: AppDb) => { const own = cenaOptions(db); db.mealOptions = db.mealOptions.filter((option) => !own.includes(option) || own.indexOf(option) < count); };
  assert.deepEqual(labels(options("cena", {}, undefined, keep(3))), ["Opción 1: Huevo, Aguacate", "Opción 2: Avena, Canela", "Opción 3: Frijoles, Sal"]);
  assert.deepEqual(labels(options("cena", {}, undefined, keep(1))), ["Opción 1: Huevo, Aguacate"]);
});

test("REQ-28 the lead variants are all in use: different questions reach each of the three", () => {
  const seen = new Set(["¿Cuál es mi cena?", "¿Qué hay de cena?", "¿Qué puedo cenar?", "cena", "¿Qué lleva la cena?", "mi cena", "ingredientes de la cena", "¿Qué cenaré hoy?"].map((question) => {
    const { db, user } = memDb();
    return leadText(slotOptions(db, user.id, { topic: "slotOptions", slot: "cena" }, question));
  }));
  assert.equal(seen.size, 3, [...seen].join(" | "));
});

test("REQ-10 a number beyond the slot's options says how many it has, then the first page", () => {
  const built = options("cena", { asked: 7 });
  assert.equal(leadText(built), "Tu cena tiene 5 opciones.");
  assert.deepEqual(labels(built), labels(options("cena")));
  assert.equal(leadText(options("cena", { asked: 7 }, { meals: ["Cena"] }, (db) => { db.mealOptions = db.mealOptions.slice(0, 1); })), "Tu cena tiene 1 opción.");
});

test("REQ-11 'Segunda colación' lists the second slot's options, buttons sending its ref", () => {
  const built = options("colacion", { ordinal: 2 }, { meals: DUPLICATED });
  assert.match(leadText(built), /segunda colación/);
  assert.ok(optionButtons(built).length > 0);
  assert.deepEqual(optionButtons(built).map((button) => button.message), optionButtons(built).map((_, index) => `Segunda colación, opción ${index + 1}`));
  const second = options("colacion", { ordinal: 2, page: 2 }, { meals: DUPLICATED });
  assert.equal(builtQuestions(second).at(-1)?.message, "Segunda colación, más opciones (página 1)");
});

test("REQ-11 duplicated slots without an ordinal still ask which one, with the options question on each button", () => {
  const built = options("colacion", {}, { meals: DUPLICATED });
  assert.equal(built.kind, "clarify");
  assert.deepEqual(builtQuestions(built).map((button) => button.message), ["¿Cuál es mi primera colación?", "¿Cuál es mi segunda colación?"]);
});

test("REQ-27 a slot without options says so; without a plan or slot the other replies hold", () => {
  assert.equal(leadText(options("cena", {}, { fixture: false })), "Tu plan no tiene opciones para tu cena.");
  assert.equal(leadText(options("almuerzo", {}, { meals: ["Cena"] })), "Tu plan no tiene almuerzo.");
});

test("REQ-9 through ragAnswer: '¿Qué puedo cenar?' answers with the first page of cena options", () => {
  const reply = ask("¿Qué puedo cenar?");
  assert.equal(reply.kind, "answer");
  assert.deepEqual(builtQuestions(reply).map((button) => button.label), ["Opción 1: Huevo, Aguacate", "Opción 2: Avena, Canela", "Opción 3: Frijoles, Sal", "Ver más opciones"]);
});
