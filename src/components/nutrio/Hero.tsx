"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Check, Clock, CookingPot, Star } from "lucide-react";
import { foodIcon, mealLabel, mealTitle, type Meal } from "@/components/dashboard/food";
import { prepMinutes, recipeRating } from "@/lib/metrics";
import { HoldToConfirm } from "./HoldToConfirm";
import { CookingModeIcon } from "@/components/cooking/CookingModeIcon";
import { DottedProgress, Figure, IconBadge, IconButton, Pill } from "./primitives";

// How long after the hold completes the carousel waits before moving to the next pending meal, so the drawn check and "Cumplida" are seen first.
const ADVANCE_DELAY = 900;
// How long "Marcar cumplida" must be held.
const HOLD_MS = 800;

// Fixed until the real logic exists (alt-dashboard P9).
const PREP_PROGRESS = 0.68;

// Where the ingredient icons sit on the plate (% of the plate box) and how big they are (px at 1440).
const SPOTS = [
  { x: 50, y: 46, size: 168 },
  { x: 33, y: 62, size: 116 },
  { x: 66, y: 30, size: 112 },
  { x: 68, y: 62, size: 104 },
  { x: 36, y: 32, size: 96 },
  { x: 52, y: 76, size: 88 }
];
const DOTS = [
  { x: 58, y: 28 },
  { x: 71, y: 44 },
  { x: 44, y: 55 },
  { x: 38, y: 74 }
];

function plateIcons(meal: Meal) {
  const icons = (meal.recipe?.ingredients ?? []).map((item) => foodIcon(item.name, item.category));
  return [...new Set(icons)].slice(0, SPOTS.length);
}

type Props = { meals: Meal[]; doneIds: string[]; onToggle: (mealId: string, done: boolean) => void };

// Left column (alt-dashboard §5.3): one slide per meal option of today, in the plan's order. No autoplay.
export function Hero({ meals, doneIds, onToggle }: Props) {
  // Opens on the first meal still pending today.
  const [index, setIndex] = useState(() => Math.max(0, meals.findIndex((meal) => !doneIds.includes(meal.id))));
  const meal = meals[Math.min(index, meals.length - 1)];

  // After marking a meal done the carousel moves on to the next pending one. The short wait lets "Cumplida" show first.
  const advance = useRef<number | undefined>(undefined);
  const cancelAdvance = () => window.clearTimeout(advance.current);
  useEffect(() => cancelAdvance, []);
  function go(next: number) {
    cancelAdvance();
    setIndex(next);
  }
  function toggle(mealId: string, done: boolean) {
    cancelAdvance();
    onToggle(mealId, done);
    if (!done) return;
    // The next meal after this one that is still pending, wrapping around; with none left the slide stays.
    const pending = (id: string) => id !== mealId && !doneIds.includes(id);
    const steps = meals.map((_, step) => (index + step) % meals.length).slice(1);
    const next = steps.find((position) => pending(meals[position].id));
    if (next !== undefined) advance.current = window.setTimeout(() => setIndex(next), ADVANCE_DELAY);
  }

  if (!meal) {
    return (
      <section className="nt-hero is-empty" aria-labelledby="nt-dash-title">
        <h1 id="nt-dash-title">Dashboard</h1>
        <Pill tone="yellow">Platillo del día</Pill>
        <p className="nt-hero-empty">Hoy no tienes comidas planificadas</p>
        <Link href="/plans" className="nt-link">
          Ir a Planes <ArrowUpRight size={16} aria-hidden />
        </Link>
        <div className="nt-plate-clip" aria-hidden>
          <div className="nt-plate">
            <div className="nt-plate-dish" />
          </div>
        </div>
      </section>
    );
  }

  const title = mealTitle(meal);
  const icons = plateIcons(meal);
  const done = doneIds.includes(meal.id);
  const recipeHref = meal.recipe ? `/recipes/${meal.recipe.id}` : "/recipes";
  const rating = recipeRating(meal.recipe?.id ?? meal.id).toFixed(1);
  const eta = prepMinutes(meal.recipe?.ingredients.length ?? 0);

  function onKey(event: KeyboardEvent) {
    const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 0;
    if (!step || meals.length < 2) return;
    event.preventDefault();
    go((index + step + meals.length) % meals.length);
  }

  return (
    <section className="nt-hero" aria-labelledby="nt-dash-title" aria-roledescription="carrusel">
      <h1 id="nt-dash-title">Dashboard</h1>
      <div className="nt-hero-copy" aria-live="polite">
        <Pill tone="yellow">Platillo del día</Pill>
        <h2 title={title}>{title}</h2>
        <p className="nt-hero-meal">{mealLabel(meal.name)}</p>
        <div className="nt-hero-actions">
          <Pill tone="surface" className="nt-rating" aria-label={`Puntuación ${rating} de 5`}>
            <Star size={16} fill="var(--nt-yellow-accent)" stroke="var(--nt-yellow-accent)" aria-hidden /> {rating}
          </Pill>
          <HoldToConfirm
            key={meal.id}
            className={`nt-done${done ? " is-done" : ""}`}
            label="Marcar cumplida"
            confirmedLabel="Cumplida"
            duration={HOLD_MS}
            icon={<Check size={16} aria-hidden />}
            confirmed={done}
            onConfirm={() => toggle(meal.id, true)}
            onUndo={() => toggle(meal.id, false)}
          />
          {meal.recipe && (
            <IconButton href={`/recipes/${meal.recipe.id}/cook`} label="Modo Cocina" dark className="nt-cook">
              <CookingModeIcon />
            </IconButton>
          )}
        </div>
      </div>

      {/* Plate drawn in CSS with the recipe's ingredient icons: the recipes have no photos yet (ronda 2, R1). */}
      <div className="nt-plate-clip" aria-hidden>
        <div className="nt-plate" key={meal.id}>
          <div className="nt-plate-dish" />
          {icons.length ? (
            icons.map((src, i) => <img key={src} src={src} alt="" className="nt-plate-food" style={{ left: `${SPOTS[i].x}%`, top: `${SPOTS[i].y}%`, width: `${SPOTS[i].size / 6.4}%` }} fetchPriority={index === 0 && i === 0 ? "high" : undefined} />)
          ) : (
            <img src="/food/plate.png" alt="" className="nt-plate-food" style={{ left: "50%", top: "48%", width: "26%" }} />
          )}
          {DOTS.map((dot) => (
            <i key={`${dot.x}-${dot.y}`} className="nt-plate-dot" style={{ left: `${dot.x}%`, top: `${dot.y}%` }} />
          ))}
        </div>
      </div>

      {meals.length > 1 && (
        <div className="nt-pager" role="tablist" aria-label="Comidas de hoy" aria-orientation="vertical" onKeyDown={onKey}>
          {meals.map((item, i) => (
            <button key={item.id} type="button" role="tab" aria-selected={i === index} tabIndex={i === index ? 0 : -1} aria-label={`${mealLabel(item.name)}: ${mealTitle(item)}`} title={mealLabel(item.name)} className={i === index ? "is-active" : undefined} onClick={() => go(i)} ref={(node) => { if (node && i === index && document.activeElement?.parentElement === node.parentElement) node.focus(); }} />
          ))}
        </div>
      )}

      <Link href={recipeHref} className="nt-prep" aria-label={`Preparación actual: ${title}, ver receta`}>
        <span className="nt-prep-head">
          <IconBadge>
            <CookingPot />
          </IconBadge>
          <span className="nt-prep-text">
            <strong>Preparación actual</strong>
            <small>
              <Clock size={13} aria-hidden /> Tiempo estimado: {eta} min
            </small>
          </span>
          <span className="nt-arrow" aria-hidden>
            <ArrowUpRight size={18} />
          </span>
        </span>
        <span className="nt-prep-bar">
          <DottedProgress ratio={PREP_PROGRESS} />
          <Figure value={Math.round(PREP_PROGRESS * 100)} unit="%" />
        </span>
      </Link>
    </section>
  );
}
