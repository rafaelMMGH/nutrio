// Browser-side helpers for calling the app's API routes (mutations and the legacy views' reads).

/** A non-2xx response. `message` is the body's `error` (unchanged for existing callers); `status` lets a caller tell a 500 from a 400. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Message used when an error response has no readable `error` in its body. */
export const REQUEST_FAILED = "Request failed";

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body instanceof Blob ? options.headers : { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: REQUEST_FAILED }));
    throw new ApiError(body.error || REQUEST_FAILED, res.status);
  }
  const type = res.headers.get("content-type") || "";
  return type.includes("application/json") ? res.json() : res.text();
}

export function getErrorMessage(err: unknown, fallback = "No se pudo completar la accion") {
  return err instanceof Error ? err.message : fallback;
}

export function formatAnswer(answer: { answer: string; context_used: string; sources: string[] }) {
  return `${answer.answer}\n\nContexto usado: ${answer.context_used}\nFuentes: ${answer.sources.join(", ") || "sin fuentes"}`;
}
