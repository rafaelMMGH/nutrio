// The Topics table's "Button" column (spec assistant-data-scope): the message other answers use to offer a topic, the
// one topic it must resolve to under REQ-6, and a lead pattern once its builder exists. Shared by the unit sweep and
// the e2e resendSweep, so a button that resolves to the wrong topic fails even though two calls always agree.
// Slot time buttons ("¿A qué hora es mi <slot ref>?", T028) and options buttons ("¿Cuál es mi <slot ref>?", masculine
// ordinals and "Colación 11" included), the option buttons and the paging buttons (T032, T033) are here.

// A slot with a single option answers with that option's detail ("<ref>, opción 1 lleva:").
const OPTIONS_LEAD = /opciones|elegir|lleva/;
// An option button opens the option's detail or, past the last option, says how many there are.
const OPTION_LEAD = /lleva|opciones/;

export const BUTTON_TOPICS: Record<string, { topic: string; lead?: RegExp }> = {
  "Mi cena de hoy": { topic: "slotOptions", lead: OPTIONS_LEAD },
  // The non-generic recipes of the fixture: each "¿Qué lleva <receta>?" opens that recipe's detail (T036).
  ...Object.fromEntries(
    ["Pollo asado", "Ensalada de pollo", "Sándwich de atún", "Atole de avena", "Chilaquiles verdes", "Tacos de frijol"].map((name) => [`¿Qué lleva ${name}?`, { topic: "dish", lead: /lleva/ }] as const)
  ),
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
  "Mi avance de la semana": { topic: "weekly" },
  "¿A qué hora es mi desayuno?": { topic: "mealTimes", lead: /horario de desayuno|Tu desayuno es/ },
  "¿A qué hora es mi colación?": { topic: "mealTimes", lead: /horario de colación|Tu colación es/ },
  "¿A qué hora es mi comida?": { topic: "mealTimes", lead: /horario de comida|Tu comida es/ },
  "¿A qué hora es mi cena?": { topic: "mealTimes", lead: /horario de cena|Tu cena es/ },
  "¿A qué hora es mi primera colación?": { topic: "mealTimes", lead: /horario de primera colación|Tu primera colación es/ },
  "¿A qué hora es mi segunda colación?": { topic: "mealTimes", lead: /horario de segunda colación|Tu segunda colación es/ },
  "¿Cuál es mi desayuno?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  "¿Cuál es mi colación?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  "¿Cuál es mi comida?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  "¿Cuál es mi cena?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  ...Object.fromEntries(
    ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima", "octava", "novena", "décima"].map((ordinal) => [`¿Cuál es mi ${ordinal} colación?`, { topic: "slotOptions", lead: OPTIONS_LEAD }] as const)
  ),
  "¿Cuál es mi primer desayuno?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  "¿Cuál es mi segundo desayuno?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  "¿Cuál es mi colación 11?": { topic: "slotOptions", lead: OPTIONS_LEAD },
  ...Object.fromEntries(
    ["Cena", "Comida", "Segunda colación", "Colación 11"].flatMap((ref) => [
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`${ref}, opción ${n}`, { topic: "slotOptions", lead: OPTION_LEAD }] as const),
      ...[1, 2, 3].map((page) => [`${ref}, más opciones (página ${page})`, { topic: "slotOptions", lead: OPTIONS_LEAD }] as const)
    ])
  )
};
