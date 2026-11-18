import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_PDF_BYTES } from "@/lib/http/body-limit";
import { checkFiles, isPdf } from "@/components/app/upload-wizard/upload-phase";

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
    assert.ok("file" in checkFiles([pdf(MAX_PDF_BYTES)], false));
  });
  it("reports the earliest failing check", () => {
    assert.deepEqual(checkFiles([file("a.png", "image/png", 0), pdf()], false), { message: "Sube un solo PDF a la vez" });
    assert.deepEqual(checkFiles([file("a.png", "image/png", 0)], false), { message: "Solo se aceptan archivos PDF" });
    assert.deepEqual(checkFiles([pdf(0)], true), { message: "Sube un solo PDF a la vez" });
  });
});
