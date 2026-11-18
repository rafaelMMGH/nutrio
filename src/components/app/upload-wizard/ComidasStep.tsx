"use client";

import { useId, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { formatTime, mealLabel, qty } from "@/components/dashboard/food";
import { Empty } from "@/components/app/feedback";
import { reviewCount, type Meal, type PlanData } from "./upload-wizard-logic";

const line = (item: { quantity: number; unit: string; name: string }) => `${qty(item.quantity)} ${item.unit} ${item.name}`.replace(/\s+/g, " ").trim();
const optionCount = (count: number) => (count === 1 ? "1 opción" : `${count} opciones`);

function MealCard({ meal }: { meal: Meal }) {
  const needsReview = reviewCount(meal) > 0;
  // Only the starting state depends on review; the user then controls it.
  const [open, setOpen] = useState(needsReview);
  const bodyId = useId();
  return (
    <section className={needsReview ? "uw-card uw-card-review" : "uw-card"}>
      <h4 className="uw-card-title">
        <button type="button" className="uw-card-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          <span className="uw-card-main">
            <span className="uw-card-name">{mealLabel(meal.name)}</span>
            <span className="uw-muted">{[meal.time_window && formatTime(meal.time_window), optionCount(meal.options.length)].filter(Boolean).join(" · ")}</span>
          </span>
          {needsReview && <span className="uw-flag">Requiere revisión</span>}
          <ChevronDown className="uw-chevron" size={18} aria-hidden />
        </button>
      </h4>
      <div id={bodyId} className="uw-card-body" hidden={!open}>
        {meal.options.length ? meal.options.map((option, optionIndex) => (
          <div className={option.requires_review ? "uw-option uw-review" : "uw-option"} key={optionIndex}>
            <div className="row between">
              <strong>{option.recipe.name}</strong>
              <span className={option.requires_review ? "uw-badge uw-badge-warn" : "uw-badge"}>confianza {Math.round(option.confidence_score * 100)}%</span>
            </div>
            <ul className="uw-lines">
              {option.recipe.ingredients.map((item, itemIndex) => <li key={itemIndex}><strong>{line(item)}</strong>{item.notes ? <span> · {item.notes}</span> : null}</li>)}
            </ul>
          </div>
        )) : <p className="uw-muted">Sin opciones detectadas</p>}
        {meal.add_ons?.map((addOn, addOnIndex) => (
          <p className="uw-addon" key={addOnIndex}>
            <strong>{addOn.name}:</strong>{" "}
            {addOn.ingredients.map((item, itemIndex) => <span key={itemIndex}>{itemIndex ? " + " : ""}{line(item)}{item.notes ? <em className="uw-muted"> ({item.notes})</em> : null}</span>)}
          </p>
        ))}
        {meal.equivalents && <p className="uw-muted">Equivalentes: {Object.entries(meal.equivalents).map(([group, amount]) => `${group} ${amount}`).join(" · ")}</p>}
      </div>
    </section>
  );
}

export function ComidasStep({ data, headingRef }: { data: PlanData; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const meals = data.meals ?? [];
  return (
    <div className="list">
      <h3 ref={headingRef} tabIndex={-1}>Comidas</h3>
      {meals.length ? meals.map((meal, index) => <MealCard meal={meal} key={index} />) : <Empty message="No se detectaron comidas en el PDF." />}
    </div>
  );
}
