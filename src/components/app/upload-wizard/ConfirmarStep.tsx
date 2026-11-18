"use client";

import type { RefObject } from "react";
import type { PlanData } from "./upload-wizard-logic";

// Today's content; US3 replaces it with the summary.
export function ConfirmarStep({ data, headingRef }: { data: PlanData; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="list">
      <div className="card">
        <h3 ref={headingRef} tabIndex={-1}>Listo para confirmar</h3>
        <p>Al confirmar, el plan queda activo y listo para planificar compras.</p>
        <p>Las recetas con los mismos ingredientes, cantidades y unidades se reutilizan en lugar de duplicarse.</p>
      </div>
      <div className="two">
        <div className="card"><h3>Suplementos</h3><p>{(data.supplements ?? []).map((item) => item.name).join(", ") || "Sin suplementos"}</p></div>
        <div className="card"><h3>Recomendaciones</h3><p className="uw-pre">{data.recommendations}</p></div>
      </div>
    </div>
  );
}
