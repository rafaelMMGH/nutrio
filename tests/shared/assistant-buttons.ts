// The Topics table's "Button" column (spec assistant-data-scope): the message other answers use to offer a topic, the
// one topic it must resolve to under REQ-6, and a lead pattern once its builder exists. Shared by the unit sweep and
// the e2e resendSweep, so a button that resolves to the wrong topic fails even though two calls always agree.
// Slot and dish buttons ("¿A qué hora es mi <slot>?", "¿Qué lleva <receta>?") join with their tasks (T028, T026).

export const BUTTON_TOPICS: Record<string, { topic: string; lead?: RegExp }> = {
  "Mi cena de hoy": { topic: "slotOptions" },
  "Mi carrito": { topic: "cart", lead: /carrito/ },
  "¿Qué recetas hay en mi plan?": { topic: "recipes", lead: /recetas/ },
  "¿Cuál es mi horario?": { topic: "mealTimes", lead: /horarios/ },
  "¿Cuál es mi plan?": { topic: "plan", lead: /objetivo|plan activo/ },
  "¿Qué suplementos tomo?": { topic: "plan", lead: /objetivo|plan activo/ },
  "¿Cuál es mi meta?": { topic: "goals" },
  "Mi peso": { topic: "weight" },
  "¿Cuánto ejercicio llevo?": { topic: "exercise" },
  "¿Cuánta agua llevo?": { topic: "water" },
  "¿Cuántas comidas llevo?": { topic: "mealsDone" },
  "Mi avance de la semana": { topic: "weekly" }
};
