import type { BrowserContext } from "@playwright/test";
import type { ChatAnswer } from "../../src/lib/assistant";
import { slotTime } from "../shared/assistant-copy";
import {
  PLAN_NAME,
  ask,
  clearPlan,
  createChatUser,
  deleteChatUser,
  expect,
  seedCart,
  seedPlan,
  seedRecipes,
  softDeleteRecipe,
  test
} from "./assistant-helpers";

// API tests of POST /api/rag/chat against a seeded, isolated user (plan D2). Spec assistant-chat-polish: REQ-1, REQ-3,
// REQ-10 (server), REQ-18 and the REQ-6 plan summary. Tests of the removed question-routing model went with the
// rewrite of the assistant data spec (T008); their successors live in the new specs.

const OBJECTIVE = "Mejorar mi energía";
const MEALS = ["Desayuno", "Colación", "Comida", "Cena"];
const PROTEIN = "Proteínas";
const PREPARATION = "Sazonar el pollo.\nAsar 20 minutos.";

/** The default world: three recipes, a plan with every meal time, and a 3-item cart. Tests that need another state reseed. */
function seedDefault() {
  seedRecipes([
    { name: "Quesadillas", ingredients: [{ name: "Tortilla", quantity: 2, unit: "pza" }, { name: "Queso", quantity: 80 }] },
    { name: "Ensalada", ingredients: [{ name: "Lechuga", quantity: 100 }, { name: "Jitomate", quantity: 150 }] },
    {
      name: "Pollo asado",
      description: PREPARATION,
      ingredients: [
        { name: "Pechuga de pollo", quantity: 200, category: PROTEIN },
        { name: "Limón", quantity: 1, unit: "pza" },
        { name: "Aceite de oliva", quantity: 10, unit: "ml" }
      ]
    }
  ]);
  seedPlan({ times: "all" });
  seedCart(3);
}

test.beforeAll(() => createChatUser("api"));
test.afterAll(() => deleteChatUser());
test.beforeEach(() => seedDefault());

const plainOf = (rich: { text: string }[]) => rich.map((span) => span.text).join("");

/** The text of the first section called `title`, one string per item. */
function items(body: ChatAnswer, title: string) {
  const section = body.blocks[0].sections.find((entry) => entry.title === title);
  expect(section, `section "${title}"`).toBeDefined();
  return section!.items.map(plainOf);
}

/** Asks as the test user; the builder replies of this file are plain answers on a 200 with one block. */
async function answer(chatContext: BrowserContext, message: string) {
  const { status, body } = await ask(chatContext.request, message);
  expect(status, message).toBe(200);
  expect(body.kind, message).toBe("answer");
  return body;
}

test.describe("plan summary", () => {
  test("REQ-6 a plan-topic question returns the plan summary", async ({ chatContext }) => {
    const body = await answer(chatContext, "¿Cuál es mi plan?");
    expect(body.answer).toContain(OBJECTIVE);
  });
});

test.describe("input limits (REQ-10 server)", () => {
  const post = (chatContext: BrowserContext, message: unknown) => chatContext.request.post("/api/rag/chat", { data: { message } });

  test("a message of 501 characters is rejected with the bad-request response and no answer", async ({ chatContext }) => {
    const response = await post(chatContext, "a".repeat(501));
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request");
    expect(body.answer).toBeUndefined();
  });

  test("a message of only spaces or empty is rejected", async ({ chatContext }) => {
    for (const message of ["   ", "", " \n\t "]) expect((await post(chatContext, message)).status(), JSON.stringify(message)).toBe(400);
  });

  test("a message of 500 characters plus surrounding spaces is answered", async ({ chatContext }) => {
    const response = await post(chatContext, `  ${"a".repeat(500)}  `);
    expect(response.status()).toBe(200);
    expect(((await response.json()) as ChatAnswer).blocks[0].lead.length).toBeGreaterThan(0);
  });

  test("the length is the trimmed one: 501 characters after trimming is rejected, 500 is the limit", async ({ chatContext }) => {
    expect((await post(chatContext, ` ${"a".repeat(501)} `)).status()).toBe(400);
    expect((await post(chatContext, "a".repeat(500))).status()).toBe(200);
  });

  test("a non-string message is rejected", async ({ chatContext }) => {
    expect((await post(chatContext, 42)).status()).toBe(400);
  });
});

// The structured answers of the builders that exist today (cart, recipe list, plan, meal times).
test.describe("builders", () => {
  test("REQ-1 an empty cart is a lead with no sections and no sources", async ({ chatContext }) => {
    seedCart(0);
    const body = await answer(chatContext, "¿Qué tengo en mi carrito?");
    expect(plainOf(body.blocks[0].lead)).toBe("Tu carrito está vacío.");
    expect(body.blocks[0].sections).toEqual([]);
    expect(body.sources).toEqual([]);
    expect(body.answer).toBe("Tu carrito está vacío.");
  });

  test("REQ-1 no active plan: the lead says so, with no sections and no sources", async ({ chatContext }) => {
    clearPlan();
    const body = await answer(chatContext, "¿Cuál es el objetivo de mi plan?");
    expect(plainOf(body.blocks[0].lead)).toBe("Aún no tienes un plan activo.");
    expect(body.blocks[0].buttons).toEqual([{ type: "link", label: "Subir mi plan", href: "/plans" }]);
    expect(body.blocks[0].sections).toEqual([]);
    expect(body.sources).toEqual([]);
  });

  test("REQ-1 a 40-ingredient cart shows 8 items and a last item 'y 32 más'", async ({ chatContext }) => {
    seedCart(40);
    const body = await answer(chatContext, "¿Qué tengo en mi carrito?");
    const list = items(body, "Ingredientes");
    expect(list).toHaveLength(9);
    expect(list[8]).toBe("y 32 más");
    expect(list.slice(0, 8).every((item) => item.startsWith("Ingrediente "))).toBe(true);
    expect(body.answer.split("\n")).toHaveLength(1 + 1 + 9);
  });

  test("REQ-1 the cart lists one item per ingredient with the quantity highlighted", async ({ chatContext }) => {
    const body = await answer(chatContext, "¿Qué tengo en mi carrito?");
    const section = body.blocks[0].sections[0];
    expect(section.title).toBe("Ingredientes");
    expect(section.items).toHaveLength(3);
    expect(section.items.map(plainOf)).toEqual(["Ingrediente 01 · 1 g", "Ingrediente 02 · 2 g", "Ingrediente 03 · 3 g"]);
    expect(section.items.map((item) => item.filter((span) => span.highlight).map((span) => span.text))).toEqual([["1 g"], ["2 g"], ["3 g"]]);
  });

  test("REQ-1 the recipe list lists all recipes, or only those matching a word of the question", async ({ chatContext }) => {
    const all = await answer(chatContext, "¿Qué recetas hay en mi plan?");
    expect(plainOf(all.blocks[0].lead)).toBe("Estas son tus recetas.");
    expect(items(all, "Recetas")).toEqual(["Quesadillas", "Ensalada", "Pollo asado"]);

    const filtered = await answer(chatContext, "¿Qué recetas hay con pollo?");
    expect(plainOf(filtered.blocks[0].lead)).toBe("Estas recetas coinciden con tu pregunta.");
    expect(items(filtered, "Recetas")).toEqual(["Pollo asado"]);
  });

  test("REQ-1 a filter word that matches no recipe lists all of them", async ({ chatContext }) => {
    const body = await answer(chatContext, "¿Qué recetas hay con pescado?");
    expect(plainOf(body.blocks[0].lead)).toBe("Estas son tus recetas.");
    expect(items(body, "Recetas")).toHaveLength(3);
  });

  test("REQ-1 stop words and topic words never filter the recipe list", async ({ chatContext }) => {
    // "con" is in "Tacos con carne" and "desayuno" in "Desayuno ranchero": they would narrow the list if they counted as filter words.
    seedRecipes([
      { name: "Tacos con carne", ingredients: [{ name: "Tortilla" }] },
      { name: "Desayuno ranchero", ingredients: [{ name: "Huevo" }] },
      { name: "Ensalada", ingredients: [{ name: "Lechuga" }] }
    ]);
    for (const question of ["¿Qué recetas hay con queso?", "¿Qué recetas hay para el desayuno?"]) {
      const body = await answer(chatContext, question);
      expect(plainOf(body.blocks[0].lead), question).toBe("Estas son tus recetas.");
      expect(items(body, "Recetas"), question).toEqual(["Tacos con carne", "Desayuno ranchero", "Ensalada"]);
    }
  });

  test("REQ-1 in Todo the recipe list uses the same builder and caps at 8 recipes", async ({ chatContext }) => {
    seedRecipes(Array.from({ length: 10 }, (_, index) => ({ name: `Receta ${String(index + 1).padStart(2, "0")}`, ingredients: [{ name: "Sal" }] })));
    const body = await answer(chatContext, "¿Qué recetas tengo?");
    const list = items(body, "Recetas");
    expect(list).toHaveLength(9);
    expect(list[8]).toBe("y 2 más");
  });

  test("REQ-27 an empty recipe book is a lead with no sections and no sources", async ({ chatContext }) => {
    seedRecipes([]);
    const body = await answer(chatContext, "¿Qué recetas tengo?");
    expect(plainOf(body.blocks[0].lead)).toBe("Aún no tienes recetas.");
    expect(body.blocks[0].sections).toEqual([]);
    expect(body.sources).toEqual([]);
  });

  test("REQ-3 a soft-deleted recipe is missing from the recipe list", async ({ chatContext }) => {
    const ids = seedRecipes([
      { name: "Quesadillas", ingredients: [{ name: "Tortilla" }] },
      { name: "Ensalada", ingredients: [{ name: "Lechuga" }] }
    ]);
    softDeleteRecipe(ids["Ensalada"]);
    const body = await answer(chatContext, "¿Qué recetas tengo?");
    expect(items(body, "Recetas")).toEqual(["Quesadillas"]);
  });

  test("REQ-1 the plan lists the meals, plus supplements and recommendations only when the question names them", async ({ chatContext }) => {
    const plain = await answer(chatContext, "¿Cuál es mi plan?");
    expect(plainOf(plain.blocks[0].lead)).toBe(`Tu plan activo es ${PLAN_NAME}. Tu objetivo: ${OBJECTIVE}`);
    expect(plain.blocks[0].sections.map((section) => section.title)).toEqual(["Comidas"]);
    expect(items(plain, "Comidas")).toEqual(MEALS);

    const both = await answer(chatContext, "¿Qué suplementos y recomendaciones tengo en mi plan?");
    expect(both.blocks[0].sections.map((section) => section.title)).toEqual(["Comidas", "Suplementos", "Recomendaciones"]);
    expect(items(both, "Suplementos")).toEqual(["Vitamina D"]);
    expect(items(both, "Recomendaciones")).toEqual(["Tomar agua durante el día"]);
  });

  test("T006 REQ-1 recommendations get one item per non-empty line and the answer matches", async ({ chatContext }) => {
    seedPlan({ times: "all", recommendations: "Tomar agua\n\nDormir 8 horas\nCaminar a diario\n" });
    const body = await answer(chatContext, "¿Qué recomendaciones tengo?");
    expect(items(body, "Recomendaciones")).toEqual(["Tomar agua", "Dormir 8 horas", "Caminar a diario"]);
    expect(body.answer).toBe(
      [`Tu plan activo es ${PLAN_NAME}. Tu objetivo: ${OBJECTIVE}`, "Comidas", ...MEALS, "Recomendaciones", "Tomar agua", "Dormir 8 horas", "Caminar a diario"].join("\n")
    );
  });

  test("T006 REQ-1 ten recommendation lines show 8 items and a last item 'y 2 más'", async ({ chatContext }) => {
    const lines = Array.from({ length: 10 }, (_, index) => `Recomendación ${index + 1}`);
    seedPlan({ times: "all", recommendations: lines.join("\n") });
    const body = await answer(chatContext, "¿Qué recomendaciones tengo?");
    expect(items(body, "Recomendaciones")).toEqual([...lines.slice(0, 8), "y 2 más"]);
    expect(body.answer).toContain(`Recomendaciones\n${[...lines.slice(0, 8), "y 2 más"].join("\n")}`);
  });

  test("REQ-1 blank recommendations omit the section and the lead stays", async ({ chatContext }) => {
    seedPlan({ times: "all", recommendations: " \n  " });
    const body = await answer(chatContext, "¿Qué recomendaciones tengo?");
    expect(plainOf(body.blocks[0].lead)).toBe(`Tu plan activo es ${PLAN_NAME}. Tu objetivo: ${OBJECTIVE}`);
    expect(body.blocks[0].sections.map((section) => section.title)).toEqual(["Comidas"]);
    expect(body.answer).not.toContain("Recomendaciones");
  });

  test("REQ-27 a plan with zero meals is no plan: the plan, slot-time and schedule answers say so, with 'Subir mi plan' only", async ({ chatContext }) => {
    seedPlan({ times: "all", meals: [] });
    for (const message of ["¿Cuál es mi plan?", "¿A qué hora es mi comida?", "¿Cuál es mi horario?"]) {
      const body = await answer(chatContext, message);
      expect(plainOf(body.blocks[0].lead), message).toBe("Aún no tienes un plan activo.");
      expect(body.blocks[0].sections, message).toEqual([]);
      expect(body.blocks[0].buttons, message).toEqual([{ type: "link", label: "Subir mi plan", href: "/plans" }]);
      expect(body.buttons, message).toEqual([]);
    }
  });

  test("REQ-1 a plan with no supplements says so", async ({ chatContext }) => {
    seedPlan({ times: "all", supplements: false });
    const body = await answer(chatContext, "¿Qué suplementos tomo?");
    expect(items(body, "Suplementos")).toEqual(["Sin suplementos registrados"]);
  });

  test("REQ-3 sources list only the data used, and none on unknown or empty-state replies", async ({ chatContext }) => {
    const sourcesOf = async (message: string) => {
      const { body } = await ask(chatContext.request, message);
      return body.sources;
    };
    expect(await sourcesOf("¿Qué hay en mi carrito?")).toEqual(["Carrito actual"]);
    expect(await sourcesOf("¿Cuál es mi plan?")).toEqual([`Plan activo: ${PLAN_NAME}`]);
    expect(await sourcesOf("¿A qué hora es la cena?")).toEqual([`Plan activo: ${PLAN_NAME}`]);
    expect(await sourcesOf("¿Qué recetas hay en mi plan?")).toEqual(["Recetario"]);

    const { body: nothing } = await ask(chatContext.request, "¿Qué hago ahora?");
    expect(nothing.kind).toBe("no_match");
    expect(nothing.sources).toEqual([]);

    seedCart(0);
    clearPlan();
    seedRecipes([]);
    expect(await sourcesOf("¿Qué hay en mi carrito?")).toEqual([]);
    expect(await sourcesOf("¿Cuál es mi plan?")).toEqual([]);
    expect(await sourcesOf("¿A qué hora es la cena?")).toEqual([]);
  });

  test("REQ-8 a slot's time answers only that slot, the time highlighted", async ({ chatContext }) => {
    const body = await answer(chatContext, "¿A qué hora es la cena?");
    expect(body.answer).toMatch(slotTime("cena", "Entre 8 a 9 pm"));
    expect(body.blocks[0].sections).toEqual([]);
    expect(body.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text)).toEqual(["Entre 8 a 9 pm"]);
  });

  test("REQ-18 with an active plan and times, there is one item per meal and each time is highlighted", async ({ chatContext }) => {
    const body = await answer(chatContext, "¿Cuál es mi horario?");
    expect(plainOf(body.blocks[0].lead)).toBe("Estos son los horarios de tus comidas.");
    expect(body.blocks[0].sections.map((section) => section.title)).toEqual(["Comidas"]);
    expect(items(body, "Comidas")).toEqual(["Desayuno · Entre 7 a 8 am", "Colación · Entre 10 a 11 am", "Comida · Entre 2 a 3 pm", "Cena · Entre 8 a 9 pm"]);
    expect(body.blocks[0].sections[0].items.map((item) => item.filter((span) => span.highlight).map((span) => span.text))).toEqual([
      ["Entre 7 a 8 am"],
      ["Entre 10 a 11 am"],
      ["Entre 2 a 3 pm"],
      ["Entre 8 a 9 pm"]
    ]);
  });

  test("REQ-18 with only some times, every meal is listed and only those with a time are highlighted", async ({ chatContext }) => {
    seedPlan({ times: "some" });
    const body = await answer(chatContext, "¿Cuál es mi horario?");
    expect(items(body, "Comidas")).toEqual(["Desayuno · Entre 7 a 8 am", "Colación", "Comida · Entre 2 a 3 pm", "Cena"]);
    expect(body.blocks[0].sections[0].items.map((item) => item.some((span) => span.highlight))).toEqual([true, false, true, false]);
  });

  test("REQ-8 a slot without a time says so", async ({ chatContext }) => {
    seedPlan({ times: "none" });
    const body = await answer(chatContext, "¿Cuándo desayuno?");
    expect(body.answer).toBe("Tu plan no tiene horario para tu desayuno.");
  });

  test("REQ-18 without meal times the lead says so and the meals are listed without highlights", async ({ chatContext }) => {
    seedPlan({ times: "none" });
    const body = await answer(chatContext, "¿Cuál es mi horario?");
    expect(plainOf(body.blocks[0].lead)).toBe("Tu plan no tiene horarios para tus comidas.");
    expect(items(body, "Comidas")).toEqual(MEALS);
    expect(body.blocks[0].sections[0].items.flat().some((span) => span.highlight)).toBe(false);
  });

  test("REQ-18 without an active plan the lead says so, and there are no sections", async ({ chatContext }) => {
    clearPlan();
    const body = await answer(chatContext, "¿Cuál es mi horario?");
    expect(plainOf(body.blocks[0].lead)).toBe("Aún no tienes un plan activo.");
    expect(body.blocks[0].buttons).toEqual([{ type: "link", label: "Subir mi plan", href: "/plans" }]);
    expect(body.blocks[0].sections).toEqual([]);
  });
});
