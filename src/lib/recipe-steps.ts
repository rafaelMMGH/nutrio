import { normalizeText } from "@/lib/assistant";

// The plan's preparation note, one sentence per step; PDFs without a note only carry "Extraído de …".
// Shared by the recipe page and the assistant so both show the same steps.
export function recipeSteps(description = ""): string[] {
  const text = description.trim();
  if (!text || normalizeText(text).startsWith("extraido de")) return [];
  return text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/).map((step) => step.trim()).filter((step) => step.length > 2);
}
