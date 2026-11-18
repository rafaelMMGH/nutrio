import { ApiError, REQUEST_FAILED } from "@/lib/client/api";
import { UploadNetworkError } from "@/lib/client/upload";
import { MAX_PDF_BYTES, PDF_TOO_LARGE } from "@/lib/http/body-limit";

export type FileCheck = { file: File } | { message: string };

export type UploadPhase = "empty" | "uploading" | "processing" | "processed" | "deleting" | "failed";

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// Checks run in REQ-22 order so a file failing several gets the earliest message.
// No files (a drag of text, say) is not a rejection: it returns null and the caller does nothing.
export function checkFiles(files: readonly File[], hasRow: boolean): FileCheck | null {
  if (files.length === 0) return null;
  const [file] = files;
  if (files.length !== 1 || hasRow) return { message: "Sube un solo PDF a la vez" };
  if (!isPdf(file)) return { message: "Solo se aceptan archivos PDF" };
  if (file.size === 0) return { message: "El PDF está vacío" };
  if (file.size > MAX_PDF_BYTES) return { message: PDF_TOO_LARGE };
  return { file };
}

export type UploadState = {
  phase: UploadPhase;
  file: File | null;
  progress: number;
  failure: string | null;
  /** Draft-removal failure, shown under the row. */
  rowError: string | null;
  /** `id` changes on every rejection, even with the same message, so the alert can be re-announced (Q24). */
  rejection: { message: string; id: number } | null;
  /** Bumped when a request starts or the row is dropped; events from an older request are stale. */
  attempt: number;
  rejectionCount: number;
};

export const initialUploadState: UploadState = { phase: "empty", file: null, progress: 0, failure: null, rowError: null, rejection: null, attempt: 0, rejectionCount: 0 };

export const DELETE_FAILED = "No se pudo quitar el PDF. Inténtalo de nuevo.";

// `add` and `reject` come from the user, not from a request, so they carry no attempt; every other
// event carries the attempt it belongs to and is ignored when that is no longer the current one.
export type UploadEvent =
  | { type: "add"; file: File }
  | { type: "reject"; message: string }
  | { type: "progress"; attempt: number; percent: number }
  | { type: "sent"; attempt: number }
  | { type: "done"; attempt: number }
  | { type: "fail"; attempt: number; reason: string }
  | { type: "reject413"; attempt: number; message: string }
  | { type: "remove"; attempt: number }
  | { type: "retry"; attempt: number }
  | { type: "deleteStart"; attempt: number }
  | { type: "deleteFail"; attempt: number }
  | { type: "deleteOk"; attempt: number };

const reject = (state: UploadState, message: string): UploadState => ({ ...state, rejection: { message, id: state.rejectionCount + 1 }, rejectionCount: state.rejectionCount + 1 });
const dropRow = (state: UploadState): UploadState => ({ ...state, phase: "empty", file: null, progress: 0, failure: null, rowError: null, attempt: state.attempt + 1 });

export function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  if (event.type === "add") {
    if (state.phase !== "empty") return state;
    return { ...state, phase: "uploading", file: event.file, progress: 0, failure: null, rowError: null, rejection: null, attempt: state.attempt + 1 };
  }
  if (event.type === "reject") return reject(state, event.message);
  if (event.attempt !== state.attempt) return state;

  const { phase } = state;
  switch (event.type) {
    case "progress":
      return phase === "uploading" ? { ...state, progress: Math.max(state.progress, event.percent) } : state;
    case "sent":
      return phase === "uploading" ? { ...state, phase: "processing", progress: 100 } : state;
    case "done":
      return phase === "processing" ? { ...state, phase: "processed" } : state;
    case "fail":
      return phase === "uploading" || phase === "processing" ? { ...state, phase: "failed", failure: event.reason } : state;
    case "reject413":
      return phase === "uploading" || phase === "processing" ? reject(dropRow(state), event.message) : state;
    case "remove":
      return phase === "uploading" || phase === "failed" ? { ...dropRow(state), rejection: null } : state;
    case "retry":
      return phase === "failed" ? { ...state, phase: "uploading", progress: 0, failure: null, rejection: null, attempt: state.attempt + 1 } : state;
    case "deleteStart":
      return phase === "processed" ? { ...state, phase: "deleting", rowError: null, rejection: null } : state;
    case "deleteFail":
      return phase === "deleting" ? { ...state, phase: "processed", rowError: DELETE_FAILED } : state;
    case "deleteOk":
      return phase === "deleting" ? { ...dropRow(state), rejection: null } : state;
  }
}

/** One row of the REQ-14 table for Subir. */
export type SubirControls = {
  dropzone: "accepts" | "rejects-only";
  rowX: "none" | "cancels" | "deletes-draft" | "busy" | "removes-file";
  reintentar: "none" | "enabled";
  closeX: "enabled" | "disabled";
  anterior: "disabled";
  siguiente: "hidden" | "enabled" | "disabled";
  stepper: "subir-only" | "disabled" | "enabled";
};

const CONTROLS: Record<UploadPhase, SubirControls> = {
  empty: { dropzone: "accepts", rowX: "none", reintentar: "none", closeX: "enabled", anterior: "disabled", siguiente: "hidden", stepper: "subir-only" },
  uploading: { dropzone: "rejects-only", rowX: "cancels", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "hidden", stepper: "disabled" },
  processing: { dropzone: "rejects-only", rowX: "none", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "hidden", stepper: "disabled" },
  processed: { dropzone: "rejects-only", rowX: "deletes-draft", reintentar: "none", closeX: "enabled", anterior: "disabled", siguiente: "enabled", stepper: "enabled" },
  deleting: { dropzone: "rejects-only", rowX: "busy", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "disabled", stepper: "disabled" },
  failed: { dropzone: "rejects-only", rowX: "removes-file", reintentar: "enabled", closeX: "enabled", anterior: "disabled", siguiente: "hidden", stepper: "subir-only" },
};

export const subirControls = (phase: UploadPhase): SubirControls => CONTROLS[phase];

// REQ-25: what the polite status region says when the phase changes, or null for silence.
// "Processed" also follows "uploading": `sent` and `done` can land in one render batch, skipping "processing".
// A retry (failed to uploading) is not a new file, and every entry into "failed" is announced again.
export function announcementFor(before: UploadPhase, phase: UploadPhase, name: string | undefined, failure: string | null): string | null {
  if (before === phase) return null;
  if (phase === "uploading" && before === "empty") return `Se agregó ${name}`;
  if (phase === "processed" && (before === "processing" || before === "uploading")) return `PDF procesado: ${name}`;
  if (phase === "failed") return `No se pudo procesar el PDF: ${failure}`;
  return null;
}

const NO_CONNECTION = "sin conexión con el servidor";

// REQ-24 <motivo>: the readable server message, else the status, and "no connection" when no response arrived.
// A TypeError is how fetch (api(), used by the confirm path) reports a network failure; anything else never shows its raw message, which may be English.
export function failureReason(err: unknown): string {
  if (err instanceof UploadNetworkError || err instanceof TypeError) return NO_CONNECTION;
  if (err instanceof ApiError) return err.message && err.message !== REQUEST_FAILED ? err.message : `error del servidor (${err.status})`;
  return "error inesperado";
}

// Same rule as the dropzone reference: "512 B", whole "KB", then MB with one decimal below 10 (no ".0"). No GB unit.
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))} MB`;
}
