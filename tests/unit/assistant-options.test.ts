import assert from "node:assert/strict";
import { test } from "node:test";
import { optionAnnouncement } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { memDb } from "./memdb";

// REQ-33: the live region announces "N opciones: A; B; C". The server sends option buttons answer-level (`buttons`,
// layout "option"), never in a block, so the announcement is computed from a real ragAnswer over the fixture.

const TODAY = "2026-10-28";
const labelsOf = (buttons: { type: string; label: string; layout?: string }[]) => buttons.filter((button) => button.layout === "option").map((button) => button.label);

test("REQ-33 a real options answer announces its count and labels in its only block", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "¿Qué puedo cenar?", TODAY);
  const labels = labelsOf(reply.buttons);
  assert.ok(labels.length >= 2, "the fixture dinner offers several options");
  assert.deepEqual(reply.blocks.map((block) => block.buttons.filter((button) => button.type === "question")), [[]], "the server puts no option in a block");
  assert.equal(optionAnnouncement(reply, 0), `${labels.length} opciones: ${labels.join("; ")}`);
});

test("REQ-33 one option is announced as '1 opción'", () => {
  const announcement = optionAnnouncement(
    { blocks: [{ title: null, lead: [], sections: [], buttons: [] }], buttons: [{ type: "question", label: "Pollo", message: "Cena, opción 1", layout: "option" }] },
    0
  );
  assert.equal(announcement, "1 opción: Pollo");
});

test("REQ-33 an answer without option buttons announces nothing", () => {
  const { db, user } = memDb({ cart: 3 });
  const reply = ragAnswer(db, user, "¿Qué hay en mi carrito?", TODAY);
  assert.equal(optionAnnouncement(reply, 0), null);
});

test("REQ-33 in a 2-block answer only the block that holds the options gets the count", () => {
  const { db, user } = memDb({ cart: 3 });
  for (const [message, holder] of [["¿Qué puedo cenar y qué hay en mi carrito?", 0], ["¿Qué hay en mi carrito y qué puedo cenar?", 1]] as const) {
    const reply = ragAnswer(db, user, message, TODAY);
    assert.equal(reply.blocks.length, 2, message);
    const labels = labelsOf(reply.buttons);
    assert.ok(labels.length > 0, message);
    reply.blocks.forEach((_, index) => assert.equal(optionAnnouncement(reply, index), index === holder ? `${labels.length} opciones: ${labels.join("; ")}` : null, `${message} block ${index}`));
  }
});

const DUPLICATED = ["Desayuno", "Colación", "Comida", "Colación", "Cena"];
const block = (title: string | null) => ({ title, lead: [], sections: [], buttons: [] });
const option = (label: string, message: string) => ({ type: "question" as const, label, message, layout: "option" as const });
const announcements = (answer: Parameters<typeof optionAnnouncement>[0]) => answer.blocks.map((_, index) => optionAnnouncement(answer, index));

test("REQ-33 a duplicated slot's title ('Segunda colación') gets the count in both block orders", () => {
  const { db, user } = memDb({ meals: DUPLICATED });
  for (const [message, titles] of [
    ["¿Cuál es mi segunda colación y cuál es mi peso?", ["Segunda colación", "Peso"]],
    ["¿Cuál es mi peso y qué opciones tengo en mi segunda colación?", ["Peso", "Segunda colación"]]
  ] as const) {
    const reply = ragAnswer(db, user, message, TODAY);
    assert.deepEqual(reply.blocks.map((entry) => entry.title), titles, message);
    const labels = labelsOf(reply.buttons);
    assert.ok(labels.length > 0 && reply.buttons.every((button) => button.type !== "question" || !button.layout || button.message.startsWith("Segunda colación,")), message);
    const holder = titles.indexOf("Segunda colación");
    assert.deepEqual(announcements(reply), titles.map((_, index) => (index === holder ? `${labels.length} opciones: ${labels.join("; ")}` : null)), message);
  }
});

// No real producer: a plan holds either "Colación" (not in plan) or "Colación 11", never a block of each, so the answer is built by hand.
test("REQ-33 the title must be followed by a comma: 'Colación' does not match 'Colación 11, opción 2'", () => {
  const buttons = [option("Opción 1: Avena", "Colación 11, opción 1"), option("Pollo asado", "Colación 11, opción 2")];
  const expected = "2 opciones: Opción 1: Avena; Pollo asado";
  assert.deepEqual(announcements({ blocks: [block("Colación"), block("Colación 11")], buttons }), [null, expected]);
  assert.deepEqual(announcements({ blocks: [block("Colación 11"), block("Colación")], buttons }), [expected, null]);
});

// No real producer: two slot asks in one question collapse to one block, so a not-in-plan slot block plus an options block is built by hand.
test("REQ-33 a not-in-plan slot as the first block (no buttons) leaves the count to the block whose title matches", () => {
  const answer = { blocks: [block("Colación"), block("Cena")], buttons: [option("Opción 1: Avena", "Cena, opción 1"), option("Opción 2: Huevo", "Cena, opción 2")] };
  assert.deepEqual(announcements(answer), [null, "2 opciones: Opción 1: Avena; Opción 2: Huevo"]);
});

// No real producer for a 2-block answer whose options match no title (the server always titles the holder), so it is built by hand.
test("REQ-33 with no matching title the first block holds the count", () => {
  const answer = { blocks: [block("Peso"), block("Carrito")], buttons: [option("Pollo", "Cena, opción 1"), option("Atún", "Cena, opción 2")] };
  assert.deepEqual(announcements(answer), ["2 opciones: Pollo; Atún", null]);
});
