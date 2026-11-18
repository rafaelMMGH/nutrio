// Pure decisions for the Stepper: the component only renders what these return.

export type StepStatus = "error" | "current" | "completed" | "available" | "pending";
export type StepMarker = "error" | "current" | "check" | "number";

export type StepView = {
  status: StepStatus;
  marker: StepMarker;
  /** Spanish screen-reader status; null for the current step unless it is in error. */
  srStatus: string | null;
  selectable: boolean;
};

type StepViewInput = { current: number; furthest: number; error: boolean; disabled: boolean };

export function stepView(index: number, { current, furthest, error, disabled }: StepViewInput): StepView {
  // Selectability depends only on progress: error never locks or unlocks a step.
  const selectable = index <= furthest && !disabled;
  if (error) return { status: "error", marker: "error", srStatus: "con error", selectable };
  // The current step shows one "you are here" signal, even if it was passed before.
  if (index === current) return { status: "current", marker: "current", srStatus: null, selectable };
  if (index < furthest) return { status: "completed", marker: "check", srStatus: "completada", selectable };
  if (index === furthest) return { status: "available", marker: "number", srStatus: "disponible", selectable };
  return { status: "pending", marker: "number", srStatus: "sin iniciar", selectable };
}

export function announcement(index: number, total: number, label: string): string {
  return `Paso ${index + 1} de ${total}: ${label}`;
}

/** The one line shown in the compact layout: the error text when there is one, otherwise the step name. */
export function compactCaption(step: { label: string; error?: string }): string {
  return step.error || step.label;
}
