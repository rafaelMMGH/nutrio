import { MAX_PDF_BYTES, PDF_TOO_LARGE } from "@/lib/http/body-limit";

export type FileCheck = { file: File } | { message: string };

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// Checks run in REQ-22 order so a file failing several gets the earliest message.
export function checkFiles(files: readonly File[], hasRow: boolean): FileCheck {
  const [file] = files;
  if (files.length !== 1 || hasRow) return { message: "Sube un solo PDF a la vez" };
  if (!isPdf(file)) return { message: "Solo se aceptan archivos PDF" };
  if (file.size === 0) return { message: "El PDF está vacío" };
  if (file.size > MAX_PDF_BYTES) return { message: PDF_TOO_LARGE };
  return { file };
}
