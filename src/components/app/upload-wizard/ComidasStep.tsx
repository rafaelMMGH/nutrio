"use client";

import type { RefObject } from "react";
import { formatTime, mealLabel, qty } from "@/components/dashboard/food";
import { Badge, Empty } from "@/components/app/feedback";
import type { PlanData } from "./upload-wizard-logic";

const line = (item: { quantity: number; unit: string; name: string }) => `${qty(item.quantity)} ${item.unit} ${item.name}`.replace(/\s+/g, " ").trim();

// Today's content (meals, options with ingredients, add-ons); US2 replaces it with collapsible review cards.
export function ComidasStep({ data, headingRef }: { data: PlanData; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const meals = data.meals ?? [];
  return (
    <div className="list">
      <h3 ref={headingRef} tabIndex={-1}>Comidas</h3>
      {meals.length ? meals.map((meal, index) => (
        <div className="item" key={index}>
          <div className="row between"><h4>{mealLabel(meal.name)}</h4>{meal.time_window && <Badge>{formatTime(meal.time_window)}</Badge>}</div>
          {meal.options.map((option, optionIndex) => (
            <div className={option.requires_review ? "uw-option uw-review" : "uw-option"} key={optionIndex}>
              <div className="row between"><strong>{option.recipe.name}</strong><Badge tone={option.requires_review ? "warn" : "success"}>confianza {Math.round(option.confidence_score * 100)}%</Badge></div>
              <ul className="uw-lines">
                {option.recipe.ingredients.map((item, itemIndex) => <li key={itemIndex}><strong>{line(item)}</strong>{item.notes ? <span> · {item.notes}</span> : null}</li>)}
              </ul>
            </div>
          ))}
          {meal.add_ons?.map((addOn, addOnIndex) => (
            <p key={addOnIndex}>
              <strong>{addOn.name}:</strong>{" "}
              {addOn.ingredients.map((item, itemIndex) => <span key={itemIndex}>{itemIndex ? " + " : ""}{line(item)}{item.notes ? <em className="uw-muted"> ({item.notes})</em> : null}</span>)}
            </p>
          ))}
          {meal.equivalents && <p className="uw-muted">Equivalentes: {Object.entries(meal.equivalents).map(([group, amount]) => `${group} ${amount}`).join(" · ")}</p>}
        </div>
      )) : <Empty message="No se detectaron comidas en el PDF." />}
    </div>
  );
}
