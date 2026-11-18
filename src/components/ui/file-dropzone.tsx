"use client"

/*
 * Adapted from the uiarc File dropzone (https://uiarc.dev/r/file-dropzone.json), MIT License.
 *
 * Copyright (c) 2026 Elia Kuratli
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice
 * and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Changes: controlled and single-file. The wizard owns the phase, progress, failure and rejection, and the component
 * renders them and emits intents (files, cancel, retry, remove, delete). Dropped: the multi-file list, thumbnails, glow,
 * SVG edge, shake and upload engine. Added: a danger Alert for rejections and a warning Alert under the row, a polite
 * status region that announces each change once, Spanish copy, and plain CSS with an `fdz-` prefix.
 */

import { useEffect, useRef, useState } from "react"
import type { DragEvent, RefObject } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, LoaderCircle, RotateCw, Upload, X } from "lucide-react"

import { Alert } from "./alert"
import { announcementFor, formatSize, subirControls, type UploadPhase } from "../app/upload-wizard/upload-phase"
import "./file-dropzone.css"

export type FileDropzoneProps = {
  phase: UploadPhase
  file: { name: string; size: number } | null
  /** 0 to 100. */
  progress: number
  failure: string | null
  rowError: string | null
  rejection: { message: string; id: number } | null
  rejectionOpen: boolean
  onFiles: (files: File[]) => void
  onCancel: () => void
  onRetry: () => void
  /** Failed row: drops the file and returns to the empty dropzone. */
  onRemove: () => void
  /** Processed row: deletes the draft. */
  onDelete: () => void
  dropRef?: RefObject<HTMLButtonElement | null>
  rowXRef?: RefObject<HTMLButtonElement | null>
  retryRef?: RefObject<HTMLButtonElement | null>
}

const ACCEPT = ".pdf,application/pdf"
const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files")

/** Keeps the last non-null value so an Alert keeps its title while it closes. */
function useLast<T>(value: T | null): T | null {
  const last = useRef(value)
  if (value !== null) last.current = value
  return value ?? last.current
}

/** Each announcement is a new node in an always-mounted polite region, so repeating the same text is read again. */
function useAnnouncement(phase: UploadPhase, name: string | undefined, failure: string | null) {
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" })
  // Starts at the first phase so a remount in an existing phase does not announce it again.
  const previous = useRef<UploadPhase>(phase)
  useEffect(() => {
    const before = previous.current
    previous.current = phase
    const text = announcementFor(before, phase, name, failure)
    if (text) setAnnouncement(current => ({ id: current.id + 1, text }))
  }, [phase, name, failure])
  return announcement
}

export function FileDropzone({ phase, file, progress, failure, rowError, rejection, rejectionOpen, onFiles, onCancel, onRetry, onRemove, onDelete, dropRef, rowXRef, retryRef }: FileDropzoneProps) {
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const controls = subirControls(phase)
  const announcement = useAnnouncement(phase, file?.name, failure)
  const shownRejection = useLast(rejection)
  const shownRowError = useLast(rowError)

  const emit = (list: FileList | null) => { if (list?.length) onFiles(Array.from(list)) }
  const onFilesRef = useRef(emit)
  onFilesRef.current = emit

  // Paste works while the pointer is over the dropzone or focus is inside it; text fields keep their own paste.
  const pasteArmed = hovered || focusWithin
  useEffect(() => {
    if (!pasteArmed) return
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files
      if (!files?.length) return
      if ((event.target as HTMLElement | null)?.closest("input:not([type=file]), textarea, [contenteditable]:not([contenteditable='false'])")) return
      event.preventDefault()
      onFilesRef.current(files)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [pasteArmed])

  const fade = { duration: reduce ? 0 : 0.2 }
  const rowMotion = { initial: reduce ? { opacity: 0 } : { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, // pointerEvents: the row stays mounted for the 0.2s exit and must not be clickable meanwhile.
    exit: reduce ? { opacity: 0, pointerEvents: "none" as const } : { opacity: 0, y: -6, pointerEvents: "none" as const }, transition: fade }
  const removeLabel = file ? (phase === "uploading" ? `Cancelar subida de ${file.name}` : `Quitar ${file.name}`) : ""

  return (
    <div className="fdz-root" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocus={() => setFocusWithin(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false) }}>
      <div className="fdz-zone" data-dragging={dragging ? "" : undefined}
        onDragEnter={event => { if (!carriesFiles(event)) return; event.preventDefault(); dragDepth.current += 1; setDragging(true) }}
        onDragOver={event => { if (!carriesFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy" }}
        onDragLeave={event => { if (!carriesFiles(event)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }}
        onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); emit(event.dataTransfer.files) }}>
        <button ref={dropRef} type="button" className="fdz-trigger" onClick={() => inputRef.current?.click()}>
          <Upload className="fdz-icon" aria-hidden="true" />
          <span className="fdz-prompt">{dragging && !file ? "Suelta el PDF para subirlo" : "Arrastra tu PDF aquí"}</span>
          <span>
            <span className="fdz-secondary">o elígelo desde tu equipo</span>
            <span className="fdz-note">Solo PDF · máximo 20 MB</span>
          </span>
        </button>
        <input ref={inputRef} className="fdz-input" type="file" accept={ACCEPT} tabIndex={-1} aria-hidden="true" onChange={event => { emit(event.target.files); event.target.value = "" }} />
      </div>
      <div className="fdz-alert-slot">
        <Alert tone="danger" title={shownRejection?.message ?? ""} open={rejectionOpen && !!rejection} />
      </div>
      <AnimatePresence initial={false}>
        {file && (
          <motion.div key="row" className="fdz-row" {...rowMotion}>
            <div className="fdz-copy">
              {phase === "processed" ? (
                <span className="fdz-status" data-phase={phase}><Check className="fdz-done" aria-hidden="true" /><span className="fdz-name" title={file.name}>{file.name}</span></span>
              ) : (
                <span className="fdz-name" title={file.name}>{file.name}</span>
              )}
              {phase === "uploading" && <span className="fdz-status" data-phase={phase}>Subiendo… <span className="fdz-percent">{Math.round(progress)}%</span></span>}
              {phase === "processing" && <span className="fdz-status" data-phase={phase}>Procesando PDF…</span>}
              {phase === "failed" && <span className="fdz-status" data-phase={phase}><span className="fdz-reason">No se pudo procesar el PDF: {failure}</span></span>}
              {(phase === "uploading" || phase === "processing") && (
                <span className="fdz-bar" role="progressbar" aria-label={phase === "uploading" ? `Subiendo ${file.name}` : "Procesando PDF"}
                  {...(phase === "uploading" ? { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(progress) } : {})} data-indeterminate={phase === "processing" ? "" : undefined}>
                  {phase === "uploading"
                    ? <motion.span className="fdz-bar-fill" initial={false} animate={{ scaleX: Math.min(100, Math.max(0, progress)) / 100 }} transition={reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }} />
                    : <span className="fdz-bar-fill" />}
                </span>
              )}
            </div>
            <span className="fdz-size">{formatSize(file.size)}</span>
            <div className="fdz-actions">
              {controls.reintentar === "enabled" && <button ref={retryRef} type="button" className="fdz-retry" onClick={onRetry}><RotateCw className="fdz-remove-icon" aria-hidden="true" />Reintentar</button>}
              {controls.rowX !== "none" && (
                <button ref={rowXRef} type="button" className="fdz-remove" aria-label={removeLabel} title={phase === "processed" ? "Quitar y empezar de nuevo" : undefined}
                  aria-busy={controls.rowX === "busy" ? true : undefined} disabled={controls.rowX === "busy"}
                  onClick={controls.rowX === "cancels" ? onCancel : controls.rowX === "deletes-draft" ? onDelete : onRemove}>
                  {controls.rowX === "busy" ? <LoaderCircle className="fdz-spinner" aria-hidden="true" /> : <X className="fdz-remove-icon" aria-hidden="true" />}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="fdz-alert-slot">
        <Alert tone="warning" title={shownRowError ?? ""} open={!!rowError} />
      </div>
      <span className="fdz-sr" role="status" aria-live="polite"><span key={announcement.id}>{announcement.text}</span></span>
    </div>
  )
}
