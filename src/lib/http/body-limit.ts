export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const PDF_TOO_LARGE = "El PDF pesa más de 20 MB";

export class BodyTooLarge extends Error {
  constructor() {
    super(PDF_TOO_LARGE);
    this.name = "BodyTooLarge";
  }
}

// Reads a request body without ever holding more than `limit` bytes. The declared length is only
// a hint (it can be missing or wrong), so the running total is the real guard.
export async function readCapped(body: ReadableStream<Uint8Array> | null, declaredLength: string | null, limit: number): Promise<Uint8Array> {
  const declared = declaredLength === null ? NaN : Number(declaredLength);
  if (declared > limit) {
    await body?.cancel();
    throw new BodyTooLarge();
  }
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
