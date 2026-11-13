// Copy with REQ-28 variants (spec assistant-data-scope, Copy): the server picks one by hashing the question, so a test
// that does not pin the question accepts any of them. Shared by the unit tests and the e2e specs.

export const GREETINGS = ["¡Hola! ¿En qué te ayudo?", "¡Hola! ¿Qué quieres saber?", "¡Hola! Pregúntame por tu plan, tu avance o tu carrito."];
export const THANKS = ["¡Con gusto!", "¡De nada!", "Para eso estoy."];
export const NO_MATCH_LEADS = ["No entendí tu pregunta. Puedo ayudarte con:", "Perdón, no entendí. Puedo ayudarte con:"];
export const NO_MATCH_LEAD = /^(No entendí tu pregunta|Perdón, no entendí)\. Puedo ayudarte con:$/;

/** The plain answer of one slot's time under either variant ("Tu horario de cena: …" or "Tu cena es: …"). */
export const slotTime = (ref: string, time: string) => new RegExp(`^(Tu horario de ${ref}: ${time}|Tu ${ref} es: ${time})\\.$`);
