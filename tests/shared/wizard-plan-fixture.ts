// The upload response ("ingestPdfPlan" result) shared by tests/unit/upload-wizard-logic.test.ts and the wizard e2e
// tests. Shaped like STRUCTURED_PLAN in theme-palette.spec.ts, but with four meals. No Playwright import, so
// `tsx --test` can load it.
//
// Counted by hand: 4 meals; 6 options, 2 of them needing review (Desayuno "Huevos con jamón", Comida "Pollo asado");
// 11 ingredients (2 + 1, 3 + 2, 1, 2); 2 complements (the add-ons of Desayuno and Comida); no supplements; one
// recommendation.

const ingredient = (name: string, quantity: number, unit: string) => ({ name, quantity, unit, notes: "" });
const option = (name: string, requiresReview: boolean, confidence: number, ingredients: ReturnType<typeof ingredient>[]) => ({
  requires_review: requiresReview,
  confidence_score: confidence,
  recipe: { name, ingredients }
});

export const WIZARD_PLAN = {
  plan: { id: "plan-e2e" },
  structured_data: {
    name: "Plan de prueba",
    objective: "Bajar de peso",
    nutrition_summary: { kcal: 1800, macros: { carbohidratos: 50, proteinas: 25, lipidos: 25 } },
    supplements: [],
    recommendations: "Beber dos litros de agua al día.",
    meals: [
      {
        name: "Desayuno",
        time_window: "08:00",
        equivalents: { Cereales: 2, Frutas: 1 },
        add_ons: [{ name: "Acompañar tu desayuno", ingredients: [ingredient("Café", 1, "taza")] }],
        options: [
          option("Huevos con jamón", true, 0.62, [ingredient("Huevo", 2, "pieza"), ingredient("Jamón", 40, "g")]),
          option("Avena con fruta", false, 0.95, [ingredient("Avena", 0.5, "taza")])
        ]
      },
      {
        name: "Comida",
        time_window: "14:00",
        add_ons: [{ name: "Acompañar tu comida", ingredients: [ingredient("Agua de limón", 1, "vaso")] }],
        options: [
          option("Pollo asado", true, 0.7, [ingredient("Pollo", 120, "g"), ingredient("Arroz", 0.5, "taza"), ingredient("Brócoli", 1, "taza")]),
          option("Pescado al horno", false, 0.93, [ingredient("Pescado", 120, "g"), ingredient("Papa", 1, "pieza")])
        ]
      },
      {
        name: "Colación",
        time_window: "17:00",
        options: [option("Yogurt con nueces", false, 0.9, [ingredient("Yogurt", 1, "taza")])]
      },
      {
        name: "Cena",
        time_window: "20:00",
        options: [option("Quesadilla de nopales", false, 0.91, [ingredient("Tortilla", 2, "pieza"), ingredient("Nopal", 1, "taza")])]
      }
    ]
  }
};
