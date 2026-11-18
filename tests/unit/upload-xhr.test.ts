import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, REQUEST_FAILED } from "@/lib/client/api";
import { UploadNetworkError, uploadWithProgress } from "@/lib/client/upload";

// Node has no XMLHttpRequest, so this records what the helper does and lets a test play the browser's events.
class FakeXhr {
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  aborted = false;
  status = 0;
  responseText = "";
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, responseText: string) {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }
}

const file = { name: "Plan ñandú.pdf", size: 100 } as File;

function start(options: { signal?: AbortSignal; onProgress?: (percent: number) => void; onSent?: () => void } = {}) {
  const xhr = new FakeXhr();
  const promise = uploadWithProgress("/api/plans/upload", file, { ...options, createXhr: () => xhr as unknown as XMLHttpRequest });
  return { xhr, promise };
}

describe("uploadWithProgress", () => {
  it("posts the raw file with the PDF type and an encoded name", () => {
    const { xhr } = start();
    assert.equal(xhr.method, "POST");
    assert.equal(xhr.url, "/api/plans/upload");
    assert.equal(xhr.body, file);
    assert.equal(xhr.headers["Content-Type"], "application/pdf");
    assert.equal(xhr.headers["X-File-Name"], encodeURIComponent(file.name));
  });

  it("reports progress as a whole percent and signals when the body is sent", () => {
    const percents: number[] = [];
    let sent = 0;
    const { xhr } = start({ onProgress: (p) => percents.push(p), onSent: () => sent++ });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 0 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    xhr.upload.onload?.();
    assert.deepEqual(percents, [40, 100]);
    assert.equal(sent, 1);
  });

  it("resolves with the parsed JSON of a 2xx", async () => {
    const { xhr, promise } = start();
    xhr.respond(200, JSON.stringify({ plan: { id: "p1" } }));
    assert.deepEqual(await promise, { plan: { id: "p1" } });
  });

  for (const [label, body] of [["JSON", '{"error":"El PDF pesa más de 20 MB"}'], ["empty", ""], ["HTML", "<html>413 Request Entity Too Large</html>"]] as const) {
    it(`turns a 413 with a ${label} body into an ApiError carrying the status`, async () => {
      const { xhr, promise } = start();
      xhr.respond(413, body);
      await assert.rejects(promise, (err: unknown) => err instanceof ApiError && err.status === 413);
    });
  }

  it("keeps the readable error message of a 500", async () => {
    const { xhr, promise } = start();
    xhr.respond(500, '{"error":"PDF ilegible"}');
    await assert.rejects(promise, (err: unknown) => err instanceof ApiError && err.status === 500 && err.message === "PDF ilegible");
  });

  it("uses REQUEST_FAILED when a 500 has no readable message", async () => {
    for (const body of ["<html>oops</html>", "{}", '{"error":""}']) {
      const { xhr, promise } = start();
      xhr.respond(500, body);
      await assert.rejects(promise, (err: unknown) => err instanceof ApiError && err.status === 500 && err.message === REQUEST_FAILED);
    }
  });

  it("raises UploadNetworkError when there is no response", async () => {
    const failed = start();
    failed.xhr.onerror?.();
    await assert.rejects(failed.promise, UploadNetworkError);
    const timedOut = start();
    timedOut.xhr.ontimeout?.();
    await assert.rejects(timedOut.promise, UploadNetworkError);
  });

  it("aborts through the signal, rejects with AbortError and ignores later events", async () => {
    const controller = new AbortController();
    const percents: number[] = [];
    let sent = 0;
    const { xhr, promise } = start({ signal: controller.signal, onProgress: (p) => percents.push(p), onSent: () => sent++ });
    controller.abort();
    assert.equal(xhr.aborted, true);
    await assert.rejects(promise, (err: unknown) => err instanceof Error && err.name === "AbortError");
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    xhr.upload.onload?.();
    xhr.respond(200, "{}");
    assert.deepEqual(percents, []);
    assert.equal(sent, 0);
  });

  it("does not abort the request when the signal fires after it settled", async () => {
    const controller = new AbortController();
    const { xhr, promise } = start({ signal: controller.signal });
    xhr.respond(200, "{}");
    await promise;
    controller.abort();
    assert.equal(xhr.aborted, false);
  });

  it("does not send when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { xhr, promise } = start({ signal: controller.signal });
    await assert.rejects(promise, (err: unknown) => err instanceof Error && err.name === "AbortError");
    assert.equal(xhr.body, null);
  });
});
