import assert from "node:assert/strict";
import { test } from "node:test";
import { commandFrom, speechFor } from "@/components/cooking/voice-commands";

test("REQ-22: the three commands and their synonyms", () => {
  assert.equal(commandFrom("siguiente"), "next");
  assert.equal(commandFrom("atrás"), "back");
  assert.equal(commandFrom("anterior"), "back");
  assert.equal(commandFrom("regresa"), "back");
  assert.equal(commandFrom("repetir"), "repeat");
  assert.equal(commandFrom("repite"), "repeat");
  assert.equal(commandFrom("otra vez"), "repeat");
});

test("REQ-22: accents and case are ignored and a command inside a phrase counts", () => {
  assert.equal(commandFrom("ATRAS"), "back");
  assert.equal(commandFrom("Ok, Siguiente."), "next");
  assert.equal(commandFrom("¿me lo repites otra vez?"), "repeat");
});

test("REQ-22 and edge cases: the last command in a phrase wins, a repeated word acts once, other speech does nothing", () => {
  assert.equal(commandFrom("atrás no, siguiente"), "next");
  assert.equal(commandFrom("siguiente siguiente"), "next");
  assert.equal(commandFrom("le pongo sal"), null);
  assert.equal(commandFrom("consiguientemente"), null);
  assert.equal(commandFrom(""), null);
});

const recipe = {
  name: "Huevos revueltos",
  ingredients: [
    { name: "Huevo", quantity: 2, unit: "pieza", category: "" },
    { name: "Sal", quantity: 0, unit: "", category: "" },
    { name: "x1", quantity: 0.5, unit: "taza", category: "" }
  ],
  steps: ["Batir los huevos.", "Cocinar 5 minutos."]
};

test("REQ-23: each screen has a text to read aloud", () => {
  assert.equal(speechFor("before", recipe), "Antes de empezar. Ten a la mano: 2 pieza de Huevo, Sal, ½ taza de un ingrediente por revisar.");
  assert.equal(speechFor("step-1", recipe), "Paso 2 de 2. Cocinar 5 minutos.");
  assert.equal(speechFor("no-steps", recipe), "Tu plan no incluye pasos para esta receta.");
  assert.equal(speechFor("done", recipe), "¡Listo! Huevos revueltos.");
});
