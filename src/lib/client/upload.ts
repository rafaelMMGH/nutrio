// Browser upload with progress. fetch cannot report upload progress, so this uses XMLHttpRequest.
import { ApiError, REQUEST_FAILED } from "@/lib/client/api";

/** The upload ended with no HTTP response (network error, timeout, or a connection closed early). */
export class UploadNetworkError extends Error {
  constructor() {
    super("Network error");
    this.name = "UploadNetworkError";
  }
}

export type UploadOptions = {
  onProgress?: (percent: number) => void;
  /** The whole body has been sent; the server is now processing it. */
  onSent?: () => void;
  signal?: AbortSignal;
  /** Test seam: Node has no XMLHttpRequest. */
  createXhr?: () => XMLHttpRequest;
};

const abortError = () => new DOMException("The upload was aborted", "AbortError");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function uploadWithProgress(url: string, file: File, { onProgress, onSent, signal, createXhr = () => new XMLHttpRequest() }: UploadOptions = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const xhr = createXhr();
    // After a settle (abort included) no callback may fire, so a cancelled upload cannot update the UI.
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      settle();
    };
    const onAbort = () => finish(() => {
      xhr.abort();
      reject(abortError());
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (!settled && event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.upload.onload = () => {
      if (!settled) onSent?.();
    };
    xhr.onload = () => finish(() => {
      const body = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      const message = (body as { error?: unknown } | undefined)?.error;
      reject(new ApiError(typeof message === "string" && message ? message : REQUEST_FAILED, xhr.status));
    });
    // No xhr.timeout is set, so ontimeout never fires and a hung server leaves the processing row locked; the spec accepts that.
    xhr.onerror = xhr.ontimeout = () => finish(() => reject(new UploadNetworkError()));
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });
}
