// Voice commands (REQ-22) and the text read aloud for each screen (REQ-23). Pure, unit tested.
import { isReadableName, qty } from "@/components/dashboard/food";
import { stepOf, type ScreenKey } from "./cooking-logic";

export type VoiceCommand = "next" | "back" | "repeat";

const PHRASES: [string, VoiceCommand][] = [
  ["siguiente", "next"],
  ["atras", "back"],
  ["anterior", "back"],
  ["regresa", "back"],
  ["regresar", "back"],
  ["repetir", "repeat"],
  ["repite", "repeat"],
  ["repites", "repeat"],
  ["otra vez", "repeat"]
];

const fold = (text: string) => ` ${text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/** The command in what was heard, matched as whole words; the last one in the phrase wins. */
export function commandFrom(transcript: string): VoiceCommand | null {
  const text = fold(transcript || "");
  let best: { at: number; command: VoiceCommand } | null = null;
  for (const [phrase, command] of PHRASES) {
    const at = text.lastIndexOf(` ${phrase} `);
    if (at >= 0 && (!best || at > best.at)) best = { at, command };
  }
  return best?.command ?? null;
}

type Readable = { name: string; ingredients: { name: string; quantity: number; unit: string }[]; steps: string[] };

function ingredientText(item: Readable["ingredients"][number]) {
  const name = isReadableName(item.name) ? item.name.trim() : "un ingrediente por revisar";
  const amount = Number(item.quantity) > 0 ? `${qty(item.quantity)} ${item.unit}`.trim() : "";
  return amount ? `${amount} de ${name}` : name;
}

/** What "repetir" and voice mode read for a screen. */
export function speechFor(screen: ScreenKey, recipe: Readable) {
  const step = stepOf(screen);
  if (step !== null) return `Paso ${step + 1} de ${recipe.steps.length}. ${recipe.steps[step] ?? ""}`.trim();
  if (screen === "before") return `Antes de empezar. Ten a la mano: ${recipe.ingredients.map(ingredientText).join(", ")}.`;
  if (screen === "no-steps") return "Tu plan no incluye pasos para esta receta.";
  return `¡Listo! ${recipe.name}.`;
}
