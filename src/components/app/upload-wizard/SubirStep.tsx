"use client";

import type { RefObject } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { plural } from "@/components/dashboard/food";
import type { SubirUpload } from "./useSubirUpload";
import { uploadCounts, type PlanData } from "./upload-wizard-logic";

type Props = { data: PlanData | null; upload: SubirUpload; headingRef: RefObject<HTMLHeadingElement | null> };

export function SubirStep({ data, upload, headingRef }: Props) {
  const { state, rejectionOpen, onFiles, onRemove, onRetry, onDelete, dropRef, rowXRef, retryRef } = upload;
  const counts = data && uploadCounts(data);
  const toReview = (data?.meals ?? []).flatMap((meal) => meal.options).filter((option) => option.requires_review).length;
  return (
    <div className="form">
      <h3>Sube tu PDF</h3>
      <FileDropzone
        phase={state.phase}
        file={state.file && { name: state.file.name, size: state.file.size }}
        progress={state.progress}
        failure={state.failure}
        rowError={state.rowError}
        rejection={state.rejection}
        rejectionOpen={rejectionOpen}
        onFiles={onFiles}
        onCancel={onRemove}
        onRetry={onRetry}
        onRemove={onRemove}
        onDelete={onDelete}
        dropRef={dropRef}
        rowXRef={rowXRef}
        retryRef={retryRef}
      />
      {data && counts && (
        <div className="card uw-result">
          <div>
            <h3 ref={headingRef} tabIndex={-1}>PDF procesado</h3>
            <p className="uw-result-counts"><strong>Detectado:</strong> {plural(counts.meals, "comida", "comidas")}, {plural(counts.options, "opción", "opciones")}, {plural(counts.ingredients, "ingrediente", "ingredientes")} y {plural(counts.complements, "complemento", "complementos")}.</p>
          </div>
          <p className="uw-note">{!counts.meals ? data.recommendations : toReview ? `${plural(toReview, "opción necesita", "opciones necesitan")} revisión antes de confirmar.` : "Todo se leyó con buena confianza. Revisa los datos y confirma."}</p>
        </div>
      )}
    </div>
  );
}
