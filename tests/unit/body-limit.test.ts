import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BodyTooLarge, MAX_PDF_BYTES, readCapped } from "@/lib/http/body-limit";

const CHUNK = 64 * 1024;
// Fails the stream if anything reads far past the cap, so a missing cancel shows up as an error, not a hang.
const ERROR_AFTER = MAX_PDF_BYTES + CHUNK;

function chunkedStream(totalBytes: number) {
  const state = { pulled: 0, cancelled: false, errored: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled > ERROR_AFTER) {
        state.errored = true;
        controller.error(new Error("read past the cap"));
        return;
      }
      const size = Math.min(CHUNK, totalBytes - state.pulled);
      if (size <= 0) return controller.close();
      state.pulled += size;
      controller.enqueue(new Uint8Array(size));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { body, state };
}

describe("readCapped", () => {
  it("refuses a declared length above the limit before pulling the stream", async () => {
    const { body, state } = chunkedStream(MAX_PDF_BYTES + 1);
    await assert.rejects(readCapped(body, String(MAX_PDF_BYTES + 1), MAX_PDF_BYTES), BodyTooLarge);
    assert.equal(state.pulled, 0);
    assert.equal(state.cancelled, true);
  });

  it("returns exactly the limit, declared or not", async () => {
    const declared = await readCapped(chunkedStream(MAX_PDF_BYTES).body, String(MAX_PDF_BYTES), MAX_PDF_BYTES);
    assert.equal(declared.byteLength, MAX_PDF_BYTES);
    const undeclared = await readCapped(chunkedStream(MAX_PDF_BYTES).body, null, MAX_PDF_BYTES);
    assert.equal(undeclared.byteLength, MAX_PDF_BYTES);
  });

  it("caps a stream with no declared length and cancels the reader without erroring it", async () => {
    const { body, state } = chunkedStream(MAX_PDF_BYTES * 2);
    await assert.rejects(readCapped(body, null, MAX_PDF_BYTES), BodyTooLarge);
    assert.equal(state.cancelled, true);
    assert.equal(state.errored, false);
  });

  it("caps a stream whose declared length is below the real size", async () => {
    const { body, state } = chunkedStream(MAX_PDF_BYTES * 2);
    await assert.rejects(readCapped(body, "1000", MAX_PDF_BYTES), BodyTooLarge);
    assert.equal(state.cancelled, true);
    assert.equal(state.errored, false);
  });

  it("returns an empty array for a missing body", async () => {
    assert.equal((await readCapped(null, null, MAX_PDF_BYTES)).byteLength, 0);
  });

  it("ignores an unparseable or negative declared length and trusts the running total", async () => {
    for (const declared of ["abc", "-5", " 100 ", ""]) {
      const bytes = await readCapped(chunkedStream(100).body, declared, MAX_PDF_BYTES);
      assert.equal(bytes.byteLength, 100, `declared ${JSON.stringify(declared)}`);
    }
    await assert.rejects(readCapped(chunkedStream(MAX_PDF_BYTES + 1).body, "abc", MAX_PDF_BYTES), BodyTooLarge);
  });

  it("refuses a padded declared length above the limit", async () => {
    await assert.rejects(readCapped(chunkedStream(10).body, ` ${MAX_PDF_BYTES + 1} `, MAX_PDF_BYTES), BodyTooLarge);
  });

  it("returns an empty array for a stream that closes at once", async () => {
    const body = new ReadableStream<Uint8Array>({ start: (controller) => controller.close() });
    assert.equal((await readCapped(body, null, MAX_PDF_BYTES)).byteLength, 0);
  });

  it("rethrows the error of a stream that fails mid-read", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new Uint8Array(10));
        else controller.error(new Error("connection reset"));
      },
    });
    await assert.rejects(readCapped(body, null, MAX_PDF_BYTES), /connection reset/);
  });

  it("still reports too large when cancelling the stream fails", async () => {
    const failingCancel = (totalBytes: number) => {
      const { body } = chunkedStream(totalBytes);
      return Object.assign(body, { cancel: () => Promise.reject(new Error("cancel failed")) }) as ReadableStream<Uint8Array>;
    };
    await assert.rejects(readCapped(failingCancel(10), String(MAX_PDF_BYTES + 1), MAX_PDF_BYTES), BodyTooLarge);
    const stream = new ReadableStream<Uint8Array>({
      pull: (controller) => controller.enqueue(new Uint8Array(MAX_PDF_BYTES + 1)),
    });
    const reader = stream.getReader();
    reader.cancel = () => Promise.reject(new Error("cancel failed"));
    const wrapped = { getReader: () => reader, cancel: () => Promise.resolve() } as unknown as ReadableStream<Uint8Array>;
    await assert.rejects(readCapped(wrapped, null, MAX_PDF_BYTES), BodyTooLarge);
  });
});
