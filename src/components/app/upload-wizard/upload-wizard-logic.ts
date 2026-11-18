// Pure decisions for the upload wizard: the components only render what these return.

type Ingredient = { name: string; quantity: number; unit: string; notes?: string };
type MealOption = { requires_review: boolean; confidence_score: number; recipe: { name: string; ingredients: Ingredient[] } };
export type Meal = {
  name: string;
  time_window?: string;
  equivalents?: Record<string, number>;
  add_ons?: { name: string; ingredients: Ingredient[] }[];
  options: MealOption[];
};

/** The `structured_data` of the upload response. */
export type PlanData = {
  name: string;
  objective?: string;
  nutrition_summary?: { kcal?: number; macros?: { carbohidratos: number; proteinas: number; lipidos: number } };
  supplements?: { name: string }[];
  recommendations?: string;
  meals?: Meal[];
};

export type UploadResult = { plan: { id: string }; structured_data: PlanData };
export type WizardEdits = { name?: string; objective?: string };
export type WizardState = { step: number; furthest: number; data: UploadResult | null };

export const WIZARD_STEPS = [
  { id: "subir", label: "Subir", description: "Tu PDF del plan" },
  { id: "datos", label: "Datos", description: "Nombre, objetivo y calorías" },
  { id: "comidas", label: "Comidas", description: "Opciones, ingredientes y complementos" },
  { id: "confirmar", label: "Confirmar", description: "Revisa y activa el plan" }
] as const;

const LAST = WIZARD_STEPS.length - 1;

export function reviewCount(meal: Pick<Meal, "options">): number {
  return meal.options.filter((option) => option.requires_review).length;
}

/** The Comidas caption (REQ-10): no meals, or how many options need review; undefined when there is nothing to flag. */
export function comidasError(data: Pick<PlanData, "meals">): string | undefined {
  const meals = data.meals ?? [];
  if (!meals.length) return "No se detectaron comidas en el PDF";
  const count = meals.reduce((sum, meal) => sum + reviewCount(meal), 0);
  if (count === 0) return undefined;
  return count === 1 ? "1 opción necesita revisión" : `${count} opciones necesitan revisión`;
}

/** The steps handed to the Stepper: Comidas is the only one that can carry an error (REQ-6, REQ-10). */
export function wizardSteps(data: Pick<PlanData, "meals"> | null) {
  return WIZARD_STEPS.map(({ id, label, description }) => ({ id, label, description, error: id === "comidas" && data ? comidasError(data) : undefined }));
}

/** Stepper jump: only steps already reached can be selected; furthest never changes. */
export function goTo(state: WizardState, target: number): WizardState {
  if (!Number.isInteger(target) || target < 0 || target > state.furthest) return state;
  return { ...state, step: target };
}

/** Siguiente: needs a processed PDF, and raises furthest when it moves past it. */
export function next(state: WizardState): WizardState {
  if (!state.data || state.step >= LAST) return state;
  const step = state.step + 1;
  return { ...state, step, furthest: Math.max(state.furthest, step) };
}

export function prev(state: WizardState): WizardState {
  return state.step === 0 ? state : { ...state, step: state.step - 1 };
}

/** "Cambiar PDF": back to an empty Subir with every later step locked. */
export function resetAfterChange(): WizardState {
  return { step: 0, furthest: 0, data: null };
}

export function uploadCounts(data: Pick<PlanData, "meals">) {
  const meals = data.meals ?? [];
  const options = meals.flatMap((meal) => meal.options);
  return {
    meals: meals.length,
    options: options.length,
    ingredients: options.reduce((sum, option) => sum + option.recipe.ingredients.length, 0),
    complements: meals.reduce((sum, meal) => sum + (meal.add_ons?.length ?? 0), 0)
  };
}

export function nameMissing(data: Pick<PlanData, "name">, edits: WizardEdits): boolean {
  return !(edits.name ?? data.name ?? "").trim();
}

/** The PATCH body: confirmed status plus the trimmed, non-empty edits. */
export function confirmChanges(edits: WizardEdits) {
  const changes = Object.fromEntries(Object.entries(edits).map(([key, value]) => [key, value?.trim()]).filter(([, value]) => value));
  return { processing_status: "confirmed", ...changes };
}
