"use client"

/*
 * Adapted from the uiarc Stepper (https://uiarc.dev/r/stepper.json), MIT License.
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
 * Changes: a `furthest` prop (selectability and connector fill), a `disabled` prop, a "disponible" status, no
 * `completeLabel`, Spanish strings, status decisions moved to stepper-logic.ts, plain CSS with a `stepper-` prefix.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { announcement, compactCaption, stepView, type StepMarker } from "./stepper-logic"
import "./stepper.css"

export type StepperStep = {
  /** Stable key, so each step keeps its own motion when the list changes. */
  id: string
  label: string
  description?: string
  /** Marks the step as failed: the marker shows an alert and this message replaces the description. */
  error?: string
}

type StepperProps = {
  steps: StepperStep[]
  /** Index of the step being shown. */
  current: number
  /** Index of the furthest step reached: steps up to it can be selected and their connectors are filled. */
  furthest: number
  orientation?: "horizontal" | "vertical"
  /** Without it the stepper is a read-only indicator. */
  onStepSelect?: (index: number) => void
  /** `current` shows only the active step's description. Errors always show. */
  details?: "all" | "current"
  /** Markers only; the labels stay available to assistive tech and a one-line caption names the current step. */
  compact?: boolean
  /** Locks every step, for example while a request is running. */
  disabled?: boolean
  label?: string
  className?: string
}

// Local copy of the uiarc motion tokens this component uses.
const motionTokens = {
  duration: { fast: 0.15, standard: 0.2 },
  ease: { enter: [0.16, 1, 0.3, 1] },
  spring: { snappy: { type: "spring", visualDuration: 0.2, bounce: 0 }, smooth: { type: "spring", visualDuration: 0.3, bounce: 0 } },
  stagger: { line: 0.08 }
} as const

const still = { duration: 0 } as const
const blur = (radius: number) => `blur(${radius}px)`
const glyphFrom = { opacity: 0, scale: 0.5, filter: blur(2) }
const glyphRest = { opacity: 1, scale: 1, filter: blur(0) }
const textFrom = { opacity: 0, y: "0.3em", filter: blur(4) }
const textRest = { opacity: 1, y: 0, filter: blur(0) }

/** Text that rises in with a small blur when it changes. Its slot springs to the new height, so a message that wraps
 *  eases the steps below it down instead of pushing them; unrelated resizes (fonts, container width) follow exactly. */
function SwapText({ text, className, reduced }: { text?: string; className?: string; reduced: boolean }) {
  const inner = useRef<HTMLSpanElement>(null)
  const armedUntil = useRef(0)
  const height = useMotionValue<number | "auto">("auto")
  // Only a resize that follows a text change is animated; the window closes so later layout shifts are not.
  useLayoutEffect(() => {
    armedUntil.current = performance.now() + 700
  }, [text])
  useEffect(() => {
    const node = inner.current
    if (!node || typeof ResizeObserver === "undefined") return
    let measured = false
    const observer = new ResizeObserver(() => {
      const target = node.offsetHeight
      if (!measured || reduced || performance.now() > armedUntil.current) {
        measured = true
        height.jump(target)
        return
      }
      animate(height, target, motionTokens.spring.smooth)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [height, reduced])
  const leave = reduced ? still : { duration: motionTokens.duration.fast }
  return (
    <motion.span className="stepper-slot" style={{ height }}>
      <span ref={inner} className="stepper-slot-inner">
        <AnimatePresence mode="popLayout" initial={false}>
          {text ? (
            <motion.span
              key={`${className}:${text}`}
              className={className}
              initial={textFrom}
              animate={textRest}
              exit={{ opacity: 0, y: "-0.3em", filter: blur(2), transition: leave }}
              transition={reduced ? still : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}
            >
              {text}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

/** The number, check and alert share one spot: the outgoing glyph shrinks away while the next one pops in. */
function Glyph({ kind, number, reduced }: { kind: StepMarker; number: number; reduced: boolean }) {
  const pop = reduced ? still : { scale: motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } }
  const exit = { ...glyphFrom, transition: reduced ? still : { duration: motionTokens.duration.fast } }
  const draw = reduced ? still : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter, delay: 0.04 }
  if (kind !== "check" && kind !== "error") {
    return <motion.span className="stepper-glyph" initial={glyphFrom} animate={glyphRest} exit={exit} transition={pop}>{number}</motion.span>
  }
  return (
    <motion.svg className="stepper-glyph stepper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={glyphFrom} animate={glyphRest} exit={exit} transition={pop}>
      {kind === "check" ? (
        <motion.path d="M5.5 12.5l4.25 4.25L18.5 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={draw} />
      ) : (
        <>
          <motion.path d="M12 6.75v6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={draw} />
          <motion.circle cx={12} cy={17.4} r={1.4} fill="currentColor" stroke="none" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={reduced ? still : { ...motionTokens.spring.snappy, delay: 0.16 }} />
        </>
      )}
    </motion.svg>
  )
}

function Stepper({ steps, current, furthest, orientation = "horizontal", onStepSelect, details = "all", compact = false, disabled = false, label = "Progreso", className }: StepperProps) {
  const reduced = useReducedMotion() ?? false
  const count = steps.length
  const vertical = orientation === "vertical"
  const interactive = Boolean(onStepSelect)
  const now = steps[current]
  // Remember where progress came from, so a jump across several steps fills or drains its connectors one after another.
  const [travel, setTravel] = useState({ to: furthest, from: furthest })
  if (travel.to !== furthest) setTravel({ to: furthest, from: travel.to })
  const connectorDelay = (index: number) => {
    if (reduced) return 0
    const gap = motionTokens.stagger.line
    if (furthest > travel.from) return index >= travel.from && index < furthest ? (index - travel.from) * gap : 0
    return index >= furthest && index < travel.from ? (travel.from - 1 - index) * gap : 0
  }

  /** Arrow keys move among the steps that can be selected; Home and End jump to the first and the last of them. */
  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const back = vertical ? ["ArrowUp"] : ["ArrowLeft", "ArrowUp"]
    const ahead = vertical ? ["ArrowDown"] : ["ArrowRight", "ArrowDown"]
    if (![...back, ...ahead, "Home", "End"].includes(event.key)) return
    const targets = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-selectable]"))
    const at = targets.indexOf(event.target as HTMLButtonElement)
    if (at < 0) return
    event.preventDefault()
    const to = event.key === "Home" ? 0 : event.key === "End" ? targets.length - 1 : back.includes(event.key) ? Math.max(0, at - 1) : Math.min(targets.length - 1, at + 1)
    targets[to]?.focus()
  }

  const Root = interactive ? "nav" : "div"
  return (
    <Root className={cn("stepper-root", vertical ? "stepper-vertical" : "stepper-horizontal", compact && "stepper-compact", className)} aria-label={label} role={interactive ? undefined : "group"}>
      <ol className="stepper-list" onKeyDown={interactive ? onKeyDown : undefined}>
        {steps.map((step, index) => {
          const view = stepView(index, { current, furthest, error: Boolean(step.error), disabled })
          // aria-current follows the index alone, so the current step keeps it even when it is in error.
          const isCurrent = index === current
          const detail = step.error ?? (details === "all" || isCurrent ? step.description : undefined)
          // Each connector fills as soon as the step after it is reached.
          const filled = index < furthest
          const fillDelay = connectorDelay(index)
          const content = (
            <>
              <span className="stepper-marker" aria-hidden="true">
                <AnimatePresence initial={false}>
                  {isCurrent ? (
                    <motion.span key="ring" className="stepper-ring" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6, transition: reduced ? still : { duration: motionTokens.duration.fast } }} transition={reduced ? still : motionTokens.spring.snappy} />
                  ) : null}
                </AnimatePresence>
                <span className="stepper-disc">
                  <AnimatePresence initial={false}>
                    <Glyph key={view.marker === "current" ? "number" : view.marker} kind={view.marker} number={index + 1} reduced={reduced} />
                  </AnimatePresence>
                </span>
              </span>
              <span className="stepper-text">
                <span className="stepper-label">{step.label}</span>
                {view.srStatus ? <span className="stepper-sr">, {view.srStatus}</span> : null}
                <SwapText text={detail} className={step.error ? "stepper-error" : "stepper-description"} reduced={reduced} />
              </span>
            </>
          )
          return (
            <li key={step.id} className="stepper-item" data-status={view.status}>
              {index < count - 1 ? (
                <span className="stepper-connector" aria-hidden="true">
                  <motion.span className="stepper-fill" initial={false} animate={vertical ? { scaleY: filled ? 1 : 0 } : { scaleX: filled ? 1 : 0 }} transition={reduced ? still : { ...motionTokens.spring.smooth, delay: fillDelay }} />
                </span>
              ) : null}
              {interactive ? (
                <button
                  type="button"
                  className="stepper-head"
                  data-selectable={view.selectable || undefined}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-disabled={view.selectable ? undefined : true}
                  tabIndex={view.selectable ? undefined : -1}
                  onClick={view.selectable ? () => onStepSelect?.(index) : undefined}
                >
                  {content}
                </button>
              ) : (
                <span className="stepper-head" aria-current={isCurrent ? "step" : undefined}>{content}</span>
              )}
            </li>
          )
        })}
      </ol>
      {vertical || !now ? null : (
        <span className="stepper-caption" aria-hidden="true">
          <SwapText text={compactCaption(now)} className={now.error ? "stepper-error" : "stepper-caption-label"} reduced={reduced} />
        </span>
      )}
      {now ? <span className="stepper-sr" aria-live="polite">{announcement(current, count, now.label)}</span> : null}
    </Root>
  )
}

export { Stepper }
export type { StepperProps }
