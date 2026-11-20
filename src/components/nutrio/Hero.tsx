"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { ArrowUpRight, Beef, Clock, CookingPot, Star } from "lucide-react";
import { foodIcon, mealLabel, mealTitle, type Meal } from "@/components/dashboard/food";
import { prepMinutes, recipeRating } from "@/lib/metrics";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { DottedProgress, Figure, IconBadge, Pill } from "./primitives";

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

function plateIcons(meal: Meal) {
  const icons = (meal.recipe?.ingredients ?? []).map((item) => foodIcon(item.name, item.category));
  return [...new Set(icons)].slice(0, SPOTS.length);
}

type Props = { meals: Meal[]; doneIds: string[]; index: number; saving: ReadonlySet<string>; said: string; onSelect: (index: number) => void; onPress: (mealId: string) => void };

// Left column (alt-dashboard §5.3): one slide per meal option of today, in the plan's order. No autoplay.
export function Hero({ meals, doneIds, index, saving, said, onSelect: go, onPress: press }: Props) {
  const meal = meals[Math.min(index, meals.length - 1)];

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
  const dish = title.trim();
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
          <ActionButton
            label="Marcar cumplida"
            pendingLabel="Guardando"
            successLabel="Cumplida"
            state={saving.has(meal.id) ? "pending" : done ? "success" : "idle"}
            instantKey={meal.id}
            onPress={() => press(meal.id)}
          />
        </div>
      </div>
      {/* Outside .nt-hero-copy, which is already a live region: nested regions are announced twice. */}
      <div role="status" className="sr-only">
        {said}
      </div>

      {/* Plate drawn in CSS with the recipe's ingredient icons: the recipes have no photos yet (ronda 2, R1). */}
      <div className="nt-plate-clip">
        <div className="nt-plate" key={meal.id}>
          <div className="nt-plate-dish" aria-hidden />
          {icons.length ? (
            icons.map((src, i) => <img key={src} src={src} alt="" className="nt-plate-food" aria-hidden style={{ left: `${SPOTS[i].x}%`, top: `${SPOTS[i].y}%`, width: `${SPOTS[i].size / 6.4}%` }} fetchPriority={index === 0 && i === 0 ? "high" : undefined} />)
          ) : (
            <img src="/food/plate.png" alt="" className="nt-plate-food" style={{ left: "50%", top: "48%", width: "26%" }} aria-hidden />
          )}
        </div>
        {/* A sibling of the plate, not inside it: unkeyed, unmasked and unanimated, so the pill stays still while the plate animates in
            (specs/dashboard-polish REQ-30). It opens Modo Cocina for the meal on screen (specs/cooking-mode REQ-4). */}
        {meal.recipe && (
          <div className="nt-cook-layer">
            <Link href={`/recipes/${meal.recipe.id}/cook`} className="nt-cook-pill" aria-label={dish ? `Modo Cocina: ${dish}` : "Modo Cocina"}>
              <span className="nt-cook-badge" aria-hidden>
                <Beef size={18} />
              </span>
              <span className="nt-cook-text">
                <span className="nt-cook-title">Abrir Modo Cocina</span>
              </span>
            </Link>
          </div>
        )}
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
