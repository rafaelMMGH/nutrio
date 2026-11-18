"use client";

import type { RefObject } from "react";
import type { PlanData, WizardEdits } from "./upload-wizard-logic";

type Props = {
  data: PlanData;
  edits: WizardEdits;
  setEdits: (edits: WizardEdits) => void;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export function DatosStep({ data, edits, setEdits, disabled, headingRef }: Props) {
  const summary = data.nutrition_summary || {};
  return (
    <div className="list">
      <h3 ref={headingRef} tabIndex={-1}>Datos del plan</h3>
      <label>Nombre<input value={edits.name ?? data.name ?? ""} disabled={disabled} onChange={(event) => setEdits({ ...edits, name: event.target.value })} /></label>
      <label>Objetivo<input value={edits.objective ?? data.objective ?? ""} disabled={disabled} onChange={(event) => setEdits({ ...edits, objective: event.target.value })} /></label>
      {summary.kcal && (
        <div className="item">
          <h3>{summary.kcal} kcal al día</h3>
          {summary.macros && <p>Carbohidratos {summary.macros.carbohidratos}% · Proteínas {summary.macros.proteinas}% · Lípidos {summary.macros.lipidos}%</p>}
        </div>
      )}
    </div>
  );
}
