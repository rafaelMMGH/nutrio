// What counts as a recipe, shared by the server and the client so every count in the app agrees.

// Only dishes from the plans: a single-ingredient option ("Plátano", "Mango picado") is an ingredient, not a meal.
export function isDish(ingredientCount: number) {
  return ingredientCount > 1;
}
