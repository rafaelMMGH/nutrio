"use client";

import type { FormEvent, RefObject } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plural } from "@/components/dashboard/food";
import { uploadCounts, type PlanData } from "./upload-wizard-logic";

type Props = {
  data: PlanData | null;
  busy: boolean;
  /** Which request is running, so only its own button shows the spinner. */
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onChangePdf: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  submitRef: RefObject<HTMLButtonElement | null>;
  changeRef: RefObject<HTMLButtonElement | null>;
};

export function SubirStep({ data, busy, uploading, deleting, onUpload, onChangePdf, headingRef, fileRef, submitRef, changeRef }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (file) onUpload(file);
  }

  if (!data) {
    return (
      <form className="form" onSubmit={submit}>
        <h3 ref={headingRef} tabIndex={-1}>Sube tu PDF</h3>
        <p>Sube el PDF privado del plan. El MVP guarda el archivo localmente y extrae estructura inicial cuando el texto esta disponible.</p>
        <input ref={fileRef} name="pdf" type="file" accept="application/pdf" required disabled={busy} />
        <Button ref={submitRef} type="submit" disabled={busy} aria-busy={uploading}>
          {uploading && <Loader2 size={16} className="spin" aria-hidden="true" />}Procesar PDF
        </Button>
      </form>
    );
  }

  const counts = uploadCounts(data);
  const toReview = (data.meals ?? []).flatMap((meal) => meal.options).filter((option) => option.requires_review).length;
  return (
    <div className="card uw-result">
      <div>
        <h3 ref={headingRef} tabIndex={-1}>PDF procesado</h3>
        <p className="uw-result-counts"><strong>Detectado:</strong> {plural(counts.meals, "comida", "comidas")}, {plural(counts.options, "opción", "opciones")}, {plural(counts.ingredients, "ingrediente", "ingredientes")} y {plural(counts.complements, "complemento", "complementos")}.</p>
      </div>
      <p className="uw-note">{!counts.meals ? data.recommendations : toReview ? `${plural(toReview, "opción necesita", "opciones necesitan")} revisión antes de confirmar.` : "Todo se leyó con buena confianza. Revisa los datos y confirma."}</p>
      <div>
        <Button ref={changeRef} type="button" variant="outline" disabled={busy} aria-busy={deleting} onClick={onChangePdf}>
          {deleting && <Loader2 size={16} className="spin" aria-hidden="true" />}Cambiar PDF
        </Button>
      </div>
    </div>
  );
}
