"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { uploadWithProgress } from "@/lib/client/upload";
import { PDF_TOO_LARGE } from "@/lib/http/body-limit";
import { checkFiles, failureReason, initialUploadState, uploadReducer, type UploadEvent, type UploadState } from "./upload-phase";
import type { UploadResult } from "./upload-wizard-logic";

// Where focus lands after the next render (REQ-16). The wizard handles the "PDF procesado" heading itself.
type FocusTarget = "drop" | "rowX" | "retry";

export type SubirUpload = ReturnType<typeof useSubirUpload>;

type Options = { onProcessed: (result: UploadResult) => void; onReset: () => void; refresh: () => void };

export function useSubirUpload({ onProcessed, onReset, refresh }: Options) {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  // Mirrors the reducer synchronously: request callbacks need the attempt they started, and a second
  // drop in the same tick must already see the row. The reducer is pure, so running it twice is safe.
  const latest = useRef<UploadState>(initialUploadState);
  const send = (event: UploadEvent) => {
    latest.current = uploadReducer(latest.current, event);
    dispatch(event);
  };

  const controller = useRef<AbortController | null>(null);
  const planId = useRef<string | null>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const rowXRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    ({ drop: dropRef, rowX: rowXRef, retry: retryRef })[target].current?.focus();
  });

  // Q24: a new rejection while one is open closes the Alert and reopens it a frame later, so it counts
  // as a new opening and is announced again. Closing and opening in one tick would batch into no change.
  const [rejectionOpen, setRejectionOpen] = useState(true);
  const hadRejection = useRef(false);
  const rejectionId = state.rejection?.id;
  useEffect(() => {
    const had = hadRejection.current;
    hadRejection.current = rejectionId !== undefined;
    if (rejectionId === undefined || !had) return setRejectionOpen(true);
    setRejectionOpen(false);
    // Two frames: the false above is committed by a passive effect, and one rAF often fires before React
    // renders it, which would batch false and true into no change.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setRejectionOpen(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [rejectionId]);

  useEffect(() => () => controller.current?.abort(), []);

  async function start(file: File) {
    const attempt = latest.current.attempt;
    const own = new AbortController();
    controller.current = own;
    try {
      const result = (await uploadWithProgress("/api/plans/upload", file, {
        signal: own.signal,
        onProgress: (percent) => send({ type: "progress", attempt, percent }),
        onSent: () => {
          // The cancel X disappears here; keep focus in the dialog if it was on it.
          const current = latest.current;
          if (current.attempt === attempt && current.phase === "uploading" && document.activeElement === rowXRef.current) {
            pendingFocus.current = "drop";
          }
          send({ type: "sent", attempt });
        }
      })) as UploadResult;
      if (latest.current.attempt !== attempt) return;
      planId.current = result.plan.id;
      send({ type: "sent", attempt });
      send({ type: "done", attempt });
      onProcessed(result);
      refresh();
    } catch (err) {
      if (own.signal.aborted || latest.current.attempt !== attempt) return;
      if (err instanceof ApiError && err.status === 413) {
        pendingFocus.current = "drop";
        send({ type: "reject413", attempt, message: PDF_TOO_LARGE });
      } else {
        pendingFocus.current = "retry";
        send({ type: "fail", attempt, reason: failureReason(err) });
      }
    }
  }

  const onFiles = (files: File[]) => {
    const check = checkFiles(files, latest.current.file !== null);
    if (!check) return;
    if ("message" in check) return send({ type: "reject", message: check.message });
    send({ type: "add", file: check.file });
    void start(check.file);
  };

  // The cancel X (uploading) and the remove X (failed) both drop the row.
  const onRemove = () => {
    controller.current?.abort();
    pendingFocus.current = "drop";
    send({ type: "remove", attempt: latest.current.attempt });
  };

  const onRetry = () => {
    const { file, attempt } = latest.current;
    if (!file) return;
    pendingFocus.current = "drop";
    send({ type: "retry", attempt });
    void start(file);
  };

  const onDelete = async () => {
    if (latest.current.phase !== "processed") return;
    const attempt = latest.current.attempt;
    send({ type: "deleteStart", attempt });
    try {
      await api(`/api/plans/${planId.current}`, { method: "DELETE" });
      pendingFocus.current = "drop";
      send({ type: "deleteOk", attempt });
      onReset();
      refresh();
    } catch (err) {
      console.error("No se pudo eliminar el plan", err);
      pendingFocus.current = "rowX";
      send({ type: "deleteFail", attempt });
    }
  };

  return { state, rejectionOpen, onFiles, onRemove, onRetry, onDelete, dropRef, rowXRef, retryRef };
}
