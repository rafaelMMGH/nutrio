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
});
