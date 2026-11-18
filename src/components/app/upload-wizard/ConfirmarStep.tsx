"use client";

import { useId, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { plural } from "@/components/dashboard/food";
import { confirmSummary, type PlanData, type WizardEdits } from "./upload-wizard-logic";

type Props = { data: PlanData; edits: WizardEdits; headingRef: RefObject<HTMLHeadingElement | null> };

export function ConfirmarStep({ data, edits, headingRef }: Props) {
  const summary = confirmSummary(data, edits);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <div className="list">
      <div className="card uw-confirm">
        <h3 ref={headingRef} tabIndex={-1}>Listo para confirmar</h3>
        <p>Al confirmar, el plan queda activo y listo para planificar compras.</p>
        <dl className="uw-summary">
          <div><dt>Plan</dt><dd>{summary.name}</dd></div>
          {summary.kcal ? <div><dt>Calorías</dt><dd>{summary.kcal} kcal al día</dd></div> : null}
          <div><dt>Comidas</dt><dd>{plural(summary.meals, "comida", "comidas")} y {plural(summary.options, "opción", "opciones")}</dd></div>
          {summary.supplements.length > 0 && <div><dt>Suplementos</dt><dd>{summary.supplements.join(", ")}</dd></div>}
        </dl>
        <p className="uw-note">Las recetas con los mismos ingredientes, cantidades y unidades se reutilizan en lugar de duplicarse.</p>
      </div>
      {summary.recommendations && (
        <section className="uw-card">
          <h4 className="uw-card-title">
            <button type="button" className="uw-card-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
              <span className="uw-card-main"><span className="uw-card-name">Recomendaciones</span></span>
              <ChevronDown className="uw-chevron" size={18} aria-hidden />
            </button>
          </h4>
          <div id={bodyId} className="uw-card-body" hidden={!open}>
            <p className="uw-pre">{summary.recommendations}</p>
          </div>
        </section>
      )}
    </div>
  );
}
