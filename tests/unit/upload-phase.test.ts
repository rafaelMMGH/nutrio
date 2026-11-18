import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_PDF_BYTES } from "@/lib/http/body-limit";
import { ApiError, REQUEST_FAILED } from "@/lib/client/api";
import { UploadNetworkError } from "@/lib/client/upload";
import {
  announcementFor,
  checkFiles,
  failureReason,
  formatSize,
  initialUploadState,
  isPdf,
  subirControls,
  uploadReducer,
  type UploadEvent,
  type UploadPhase,
  type UploadState,
} from "@/components/app/upload-wizard/upload-phase";

// Only name, type and size are read, so a plain object stands in for File without allocating 20 MiB.
const file = (name: string, type: string, size: number) => ({ name, type, size }) as File;
const pdf = (size = 1000) => file("plan.pdf", "application/pdf", size);

describe("isPdf", () => {
  it("accepts the PDF type or a .pdf name in any case", () => {
    assert.equal(isPdf(pdf()), true);
    assert.equal(isPdf(file("PLAN.PDF", "", 10)), true);
    assert.equal(isPdf(file("x.Pdf", "", 10)), true);
  });
  it("refuses other files", () => {
    assert.equal(isPdf(file("a.png", "image/png", 10)), false);
    assert.equal(isPdf(file("plan.pdf.png", "", 10)), false);
  });
});

describe("checkFiles", () => {
  it("returns the file when every check passes", () => {
    const f = pdf();
    assert.deepEqual(checkFiles([f], false), { file: f });
  });
  it("refuses two files, or one while a row exists", () => {
    assert.deepEqual(checkFiles([pdf(), pdf()], false), { message: "Sube un solo PDF a la vez" });
    assert.deepEqual(checkFiles([pdf()], true), { message: "Sube un solo PDF a la vez" });
  });
  it("refuses a non-PDF, an empty PDF and an oversized PDF", () => {
    assert.deepEqual(checkFiles([file("a.png", "image/png", 10)], false), { message: "Solo se aceptan archivos PDF" });
    assert.deepEqual(checkFiles([pdf(0)], false), { message: "El PDF está vacío" });
    assert.deepEqual(checkFiles([pdf(MAX_PDF_BYTES + 1)], false), { message: "El PDF pesa más de 20 MB" });
  });
  it("accepts exactly the limit", () => {
    const result = checkFiles([pdf(MAX_PDF_BYTES)], false);
    assert.ok(result && "file" in result);
  });
  it("reports the earliest failing check", () => {
    assert.deepEqual(checkFiles([file("a.png", "image/png", 0), pdf()], false), { message: "Sube un solo PDF a la vez" });
    assert.deepEqual(checkFiles([file("a.png", "image/png", 0)], false), { message: "Solo se aceptan archivos PDF" });
    assert.deepEqual(checkFiles([pdf(0)], true), { message: "Sube un solo PDF a la vez" });
  });
});

describe("checkFiles with no files", () => {
  it("ignores an empty list, such as dragged text, with or without a row", () => {
    assert.equal(checkFiles([], false), null);
    assert.equal(checkFiles([], true), null);
  });
});

const run = (state: UploadState, ...events: UploadEvent[]) => events.reduce(uploadReducer, state);
const reach = {
  uploading: () => run(initialUploadState, { type: "add", file: pdf() }),
  processing: () => run(reach.uploading(), { type: "sent", attempt: 1 }),
  processed: () => run(reach.processing(), { type: "done", attempt: 1 }),
  deleting: () => run(reach.processed(), { type: "deleteStart", attempt: 1 }),
  failed: () => run(reach.processing(), { type: "fail", attempt: 1, reason: "boom" }),
};

describe("uploadReducer", () => {
  it("starts empty", () => {
    assert.equal(initialUploadState.phase, "empty");
    assert.equal(initialUploadState.file, null);
    assert.equal(initialUploadState.rejection, null);
  });

  it("add starts an upload at 0 and clears the rejection", () => {
    const rejected = run(initialUploadState, { type: "reject", message: "x" });
    const state = run(rejected, { type: "add", file: pdf() });
    assert.equal(state.phase, "uploading");
    assert.equal(state.progress, 0);
    assert.equal(state.rejection, null);
    assert.equal(state.attempt, 1);
  });

  it("add is ignored while a row is present", () => {
    const state = reach.uploading();
    assert.equal(uploadReducer(state, { type: "add", file: pdf() }), state);
  });

  it("progress is monotonic and only applies while uploading", () => {
    let state = run(reach.uploading(), { type: "progress", attempt: 1, percent: 40 });
    assert.equal(state.progress, 40);
    state = uploadReducer(state, { type: "progress", attempt: 1, percent: 30 });
    assert.equal(state.progress, 40);
    const processing = reach.processing();
    assert.equal(uploadReducer(processing, { type: "progress", attempt: 1, percent: 50 }), processing);
  });

  it("sent moves uploading to processing at 100", () => {
    const state = reach.processing();
    assert.equal(state.phase, "processing");
    assert.equal(state.progress, 100);
  });

  it("done moves processing to processed, and fail records the reason", () => {
    assert.equal(reach.processed().phase, "processed");
    const failed = reach.failed();
    assert.equal(failed.phase, "failed");
    assert.equal(failed.failure, "boom");
    assert.equal(run(reach.uploading(), { type: "fail", attempt: 1, reason: "r" }).phase, "failed");
  });

  it("reject413 empties the row and sets the rejection, also during upload", () => {
    for (const from of [reach.uploading(), reach.processing()]) {
      const state = uploadReducer(from, { type: "reject413", attempt: 1, message: "El PDF pesa más de 20 MB" });
      assert.equal(state.phase, "empty");
      assert.equal(state.file, null);
      assert.equal(state.rejection?.message, "El PDF pesa más de 20 MB");
    }
  });

  it("reject keeps the phase and replaces the previous rejection", () => {
    const state = run(reach.processed(), { type: "reject", message: "a" }, { type: "reject", message: "b" });
    assert.equal(state.phase, "processed");
    assert.equal(state.rejection?.message, "b");
  });

  it("Q24: the same rejection twice gets a new id", () => {
    const first = run(initialUploadState, { type: "reject", message: "Solo se aceptan archivos PDF" });
    const second = uploadReducer(first, { type: "reject", message: "Solo se aceptan archivos PDF" });
    assert.ok(first.rejection && second.rejection);
    assert.notEqual(second.rejection.id, first.rejection.id);
    const afterClear = run(second, { type: "add", file: pdf() }, { type: "remove", attempt: 1 }, { type: "reject", message: "Solo se aceptan archivos PDF" });
    assert.notEqual(afterClear.rejection?.id, second.rejection.id);
  });

  it("add, remove and retry clear the rejection", () => {
    const rejected = (state: UploadState) => uploadReducer(state, { type: "reject", message: "m" });
    assert.equal(uploadReducer(rejected(reach.uploading()), { type: "remove", attempt: 1 }).rejection, null);
    assert.equal(uploadReducer(rejected(reach.failed()), { type: "retry", attempt: 1 }).rejection, null);
    assert.equal(uploadReducer(rejected(initialUploadState), { type: "add", file: pdf() }).rejection, null);
  });

  it("deleteStart and deleteOk clear a rejection left over from a refused drop", () => {
    const rejected = uploadReducer(reach.processed(), { type: "reject", message: "m" });
    const deleting = uploadReducer(rejected, { type: "deleteStart", attempt: 1 });
    assert.equal(deleting.rejection, null);
    assert.equal(uploadReducer(run(reach.deleting(), { type: "reject", message: "m" }), { type: "deleteOk", attempt: 1 }).rejection, null);
  });

  it("reject while uploading leaves phase, file, progress and attempt unchanged", () => {
    const uploading = run(reach.uploading(), { type: "progress", attempt: 1, percent: 30 });
    const state = uploadReducer(uploading, { type: "reject", message: "m" });
    assert.equal(state.phase, "uploading");
    assert.equal(state.file, uploading.file);
    assert.equal(state.progress, 30);
    assert.equal(state.attempt, uploading.attempt);
    assert.equal(state.rejection?.message, "m");
  });

  it("remove empties an uploading or failed row but not a processed one", () => {
    const processed = reach.processed();
    assert.equal(uploadReducer(processed, { type: "remove", attempt: 1 }), processed);
    for (const from of [reach.uploading(), reach.failed()]) {
      const state = uploadReducer(from, { type: "remove", attempt: 1 });
      assert.equal(state.phase, "empty");
      assert.equal(state.file, null);
    }
  });

  it("remove is ignored while deleting", () => {
    const state = reach.deleting();
    assert.equal(uploadReducer(state, { type: "remove", attempt: 1 }), state);
  });

  it("retry restarts the same file from 0", () => {
    const failed = reach.failed();
    const state = uploadReducer(failed, { type: "retry", attempt: 1 });
    assert.equal(state.phase, "uploading");
    assert.equal(state.progress, 0);
    assert.equal(state.file, failed.file);
    assert.equal(state.failure, null);
    assert.equal(state.attempt, 2);
  });

  it("delete start, failure and success", () => {
    assert.equal(reach.deleting().phase, "deleting");
    const failed = uploadReducer(reach.deleting(), { type: "deleteFail", attempt: 1 });
    assert.equal(failed.phase, "processed");
    assert.equal(failed.rowError, "No se pudo quitar el PDF. Inténtalo de nuevo.");
    assert.equal(uploadReducer(failed, { type: "deleteStart", attempt: 1 }).rowError, null);
    const ok = uploadReducer(reach.deleting(), { type: "deleteOk", attempt: 1 });
    assert.equal(ok.phase, "empty");
    assert.equal(ok.rowError, null);
  });

  it("ignores stale events after remove or retry", () => {
    const uploading = reach.uploading();
    const removed = uploadReducer(uploading, { type: "remove", attempt: 1 });
    assert.equal(uploadReducer(removed, { type: "remove", attempt: 1 }), removed);
    const again = uploadReducer(removed, { type: "add", file: pdf() });
    for (const event of [
      { type: "progress", attempt: 1, percent: 90 },
      { type: "sent", attempt: 1 },
      { type: "done", attempt: 1 },
      { type: "fail", attempt: 1, reason: "late" },
      { type: "reject413", attempt: 1, message: "late" },
      { type: "remove", attempt: 1 },
    ] satisfies UploadEvent[]) {
      assert.equal(uploadReducer(again, event), again, event.type);
    }
    const retried = uploadReducer(reach.failed(), { type: "retry", attempt: 1 });
    assert.equal(uploadReducer(retried, { type: "fail", attempt: 1, reason: "late" }), retried);
  });

  it("ignores events that do not fit the phase", () => {
    assert.equal(uploadReducer(initialUploadState, { type: "done", attempt: 0 }), initialUploadState);
    const uploading = reach.uploading();
    assert.equal(uploadReducer(uploading, { type: "done", attempt: 1 }), uploading);
    const processed = reach.processed();
    assert.equal(uploadReducer(processed, { type: "deleteFail", attempt: 1 }), processed);
  });
});

describe("subirControls", () => {
  const rows: Record<UploadPhase, ReturnType<typeof subirControls>> = {
    empty: { dropzone: "accepts", rowX: "none", reintentar: "none", closeX: "enabled", anterior: "disabled", siguiente: "hidden", stepper: "subir-only" },
    uploading: { dropzone: "rejects-only", rowX: "cancels", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "hidden", stepper: "disabled" },
    processing: { dropzone: "rejects-only", rowX: "none", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "hidden", stepper: "disabled" },
    processed: { dropzone: "rejects-only", rowX: "deletes-draft", reintentar: "none", closeX: "enabled", anterior: "disabled", siguiente: "enabled", stepper: "enabled" },
    deleting: { dropzone: "rejects-only", rowX: "busy", reintentar: "none", closeX: "disabled", anterior: "disabled", siguiente: "disabled", stepper: "disabled" },
    failed: { dropzone: "rejects-only", rowX: "removes-file", reintentar: "enabled", closeX: "enabled", anterior: "disabled", siguiente: "hidden", stepper: "subir-only" },
  };
  for (const phase of Object.keys(rows) as UploadPhase[]) {
    it(`matches the REQ-14 row for ${phase}`, () => {
      assert.deepEqual(subirControls(phase), rows[phase]);
    });
  }
});

describe("failureReason", () => {
  it("keeps a readable message", () => {
    assert.equal(failureReason(new ApiError("PDF ilegible", 500)), "PDF ilegible");
  });
  it("falls back to the status when the message is not readable", () => {
    assert.equal(failureReason(new ApiError(REQUEST_FAILED, 500)), "error del servidor (500)");
    assert.equal(failureReason(new ApiError("", 502)), "error del servidor (502)");
  });
  it("reports no connection for a missing response", () => {
    assert.equal(failureReason(new UploadNetworkError()), "sin conexión con el servidor");
    assert.equal(failureReason(new TypeError("Failed to fetch")), "sin conexión con el servidor");
  });
  it("never shows a raw error message", () => {
    assert.equal(failureReason(new Error("Something broke")), "error inesperado");
    assert.equal(failureReason("boom"), "error inesperado");
    assert.equal(failureReason(new RangeError("x")), "error inesperado");
  });
});

describe("formatSize", () => {
  it("uses one decimal below 10 and whole numbers from 10 up", () => {
    assert.equal(formatSize(1_258_291), "1.2 MB");
    assert.equal(formatSize(1024 * 1024), "1 MB");
    assert.equal(formatSize(10 * 1024 * 1024), "10 MB");
    assert.equal(formatSize(MAX_PDF_BYTES), "20 MB");
    assert.equal(formatSize(15.6 * 1024 * 1024), "16 MB");
  });
  it("covers bytes and kilobytes", () => {
    assert.equal(formatSize(0), "0 B");
    assert.equal(formatSize(512), "512 B");
    assert.equal(formatSize(1536), "2 KB");
    assert.equal(formatSize(20 * 1024), "20 KB");
  });
  it("has no GB unit", () => {
    assert.equal(formatSize(1024 ** 3), "1024 MB");
  });
});

describe("announcementFor", () => {
  it("announces the added file only for empty to uploading", () => {
    assert.equal(announcementFor("empty", "uploading", "plan.pdf", null), "Se agregó plan.pdf");
  });
  it("does not announce a retry as an added file", () => {
    assert.equal(announcementFor("failed", "uploading", "plan.pdf", null), null);
  });
  it("announces processed after processing, and after uploading when sent and done batch together", () => {
    assert.equal(announcementFor("processing", "processed", "plan.pdf", null), "PDF procesado: plan.pdf");
    assert.equal(announcementFor("uploading", "processed", "plan.pdf", null), "PDF procesado: plan.pdf");
  });
  it("announces the failure on entering failed, again after a retry", () => {
    assert.equal(announcementFor("processing", "failed", "plan.pdf", "boom"), "No se pudo procesar el PDF: boom");
    assert.equal(announcementFor("failed", "uploading", "plan.pdf", null), null);
    assert.equal(announcementFor("uploading", "failed", "plan.pdf", "boom"), "No se pudo procesar el PDF: boom");
  });
  it("stays silent otherwise", () => {
    assert.equal(announcementFor("processed", "processed", "plan.pdf", null), null);
    assert.equal(announcementFor("processed", "deleting", "plan.pdf", null), null);
    assert.equal(announcementFor("deleting", "processed", "plan.pdf", null), null);
    assert.equal(announcementFor("uploading", "empty", "plan.pdf", null), null);
    assert.equal(announcementFor("deleting", "empty", "plan.pdf", null), null);
  });
});
