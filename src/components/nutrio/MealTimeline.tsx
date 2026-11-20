"use client";

import { Check, HandPlatter } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { useShell } from "@/components/app/AppShell";
import type { Meal } from "@/components/dashboard/food";
import { Card, IconBadge } from "./primitives";
import { listScrollTop, rowLabel, timelineRows } from "./timeline-logic";

type Props = { meals: Meal[]; doneIds: string[]; hasPlan: boolean; shownId: string | undefined; onSelect: (id: string) => void };

// Matches the edge fade in meal-timeline.css; rows are kept this far from an edge.
const FADE_PX = 16;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Today's meals in the plan's order, with the one on the hero marked (specs/dashboard-real-data REQ-1 to REQ-4).
export function MealTimeline({ meals, doneIds, hasPlan, shownId, onSelect }: Props) {
  const { openUpload } = useShell();
  const { rows, hasTimes } = timelineRows(meals, doneIds);
  const listRef = useRef<HTMLUListElement>(null);

  // The edge fades follow what is scrolled out of view (REQ-7); the CSS draws them.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const top = list.scrollTop > 1 ? FADE_PX : 0;
      const bottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1 ? FADE_PX : 0;
      list.style.setProperty("--nt-tl-fade-top", `${top}px`);
      list.style.setProperty("--nt-tl-fade-bottom", `${bottom}px`);
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [rows.length]);

  // Scrolls only the list, never the page, so the row is whole and clear of the fades.
  function reveal(row: HTMLElement) {
    const list = listRef.current;
    if (!list) return;
    const box = row.getBoundingClientRect();
    const top = box.top - list.getBoundingClientRect().top - list.clientTop + list.scrollTop;
    const next = listScrollTop({ top, bottom: top + box.height, scrollTop: list.scrollTop, height: list.clientHeight, scrollHeight: list.scrollHeight, pad: FADE_PX });
    if (next !== list.scrollTop) list.scrollTo({ top: next, behavior: reducedMotion() ? "instant" : "smooth" });
  }

  // The row on the hero follows the hero, also when it changes from the hero's own controls (REQ-5).
  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>("[aria-current='true']");
    if (current) reveal(current);
  }, [shownId]);

  // On a phone the hero is far above the rows: bring it under the top bar. Focus stays on the row (REQ-9).
  function select(id: string) {
    onSelect(id);
    if (!matchMedia("(max-width: 937px)").matches) return;
    const hero = document.querySelector(".nt-hero");
    if (!hero) return;
    const bar = document.querySelector(".nt-topbar")?.getBoundingClientRect().bottom ?? 0;
    window.scrollTo({ top: scrollY + hero.getBoundingClientRect().top - Math.max(bar, 0), behavior: reducedMotion() ? "instant" : "smooth" });
  }

  return (
    <Card tone="yellow" className="nt-today" aria-labelledby="nt-today-title">
      <header className="nt-card-head">
        <IconBadge>
          <HandPlatter />
        </IconBadge>
        <h2 id="nt-today-title">Comidas de hoy</h2>
      </header>
      {rows.length ? (
        <ul ref={listRef} aria-label="Comidas de hoy" className="nt-today-list" style={{ "--nt-tl-rows": rows.length } as CSSProperties}>
          {rows.map((row) => (
            <li key={row.id}>
              {/* The label carries time, name and state, so every visible part is hidden from readers. */}
              <button type="button" className={`nt-today-row is-${row.state}`} aria-label={rowLabel(row)} aria-current={row.id === shownId ? "true" : undefined} onFocus={(event) => reveal(event.currentTarget)} onClick={() => select(row.id)}>
                {hasTimes && (
                  <span className="nt-today-time" aria-hidden>
                    {row.time}
                  </span>
                )}
                <span className="nt-today-name" aria-hidden>
                  {row.name}
                </span>
                {row.state === "done" && (
                  <span className="nt-today-state" aria-hidden>
                    <Check size={16} /> Cumplida
                  </span>
                )}
                {row.state === "next" && (
                  <span className="nt-today-state nt-today-pill" aria-hidden>
                    Siguiente
                  </span>
                )}
                {row.state === "pending" && (
                  <span className="nt-today-state" aria-hidden>
                    Pendiente
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : hasPlan ? (
        <p className="nt-today-empty">Tu plan no tiene comidas</p>
      ) : (
        <div className="nt-today-empty">
          <p>Sin plan activo</p>
          <button type="button" className="nt-link" onClick={openUpload}>
            Subir plan
          </button>
        </div>
      )}
    </Card>
  );
}
