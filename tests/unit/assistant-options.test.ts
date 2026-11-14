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
