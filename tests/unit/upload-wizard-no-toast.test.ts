import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const DIR = join(process.cwd(), "src/components/app/upload-wizard");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// Any quoted "sonner" covers import/require/dynamic import; toast( and toast.x( cover a re-exported helper.
// Shared UI the wizard renders; they must stay toast-free too.
const EXTRA_FILES = ["src/components/ui/file-dropzone.tsx", "src/components/ui/alert.tsx"].map((file) => join(process.cwd(), file));

const TOAST_USE = /["']sonner["']|\btoast(\.\w+)?\s*\(/;

test("REQ-4/15/24/25: no upload wizard file imports sonner or calls toast", () => {
  const files = [...sourceFiles(DIR), ...EXTRA_FILES];
  assert.ok(files.length > 0);
  const offenders = files.filter((path) => TOAST_USE.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
});
