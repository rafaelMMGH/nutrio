"use client";

import { Check, HandPlatter } from "lucide-react";
import { useShell } from "@/components/app/AppShell";
import type { Meal } from "@/components/dashboard/food";
import { Card, IconBadge } from "./primitives";
import { rowLabel, timelineRows } from "./timeline-logic";

type Props = { meals: Meal[]; doneIds: string[]; hasPlan: boolean; shownId: string | undefined; onSelect: (id: string) => void };

// Today's meals in the plan's order, with the one on the hero marked (specs/dashboard-real-data REQ-1 to REQ-4).
export function MealTimeline({ meals, doneIds, hasPlan, shownId, onSelect }: Props) {
  const { openUpload } = useShell();
  const { rows, hasTimes } = timelineRows(meals, doneIds);

  return (
    <Card tone="yellow" className="nt-today" aria-labelledby="nt-today-title">
      <header className="nt-card-head">
        <IconBadge>
          <HandPlatter />
        </IconBadge>
        <h2 id="nt-today-title">Comidas de hoy</h2>
      </header>
      {rows.length ? (
        <ul aria-label="Comidas de hoy" className="nt-today-list">
          {rows.map((row) => (
            <li key={row.id}>
              {/* The label carries time, name and state, so every visible part is hidden from readers. */}
              <button type="button" className={`nt-today-row is-${row.state}`} aria-label={rowLabel(row)} aria-current={row.id === shownId ? "true" : undefined} onClick={() => onSelect(row.id)}>
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
