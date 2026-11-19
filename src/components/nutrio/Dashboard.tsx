"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/app/AppShell";
import { type Meal } from "@/components/dashboard/food";
import { kpiContexts, type GroceriesSource } from "@/lib/kpis";
import { dashboardMetrics, type Period } from "@/lib/metrics";
import { streaks } from "@/lib/streak";
import { CaloriesCard, ComplianceCard, KpiRow, MetricsCard } from "./DataColumn";
import { Hero } from "./Hero";
import { useToday } from "./useToday";
import { send, useDailyLogs, type ServerLog } from "./useDailyLogs";
import "./primitives.css";
import "./dashboard.css";

export type DashboardProps = {
  meals: Meal[];
  dailyLogs: ServerLog[];
  kcalGoal: number | null;
  proteinPct: number | null;
  weightGoal: number | null;
  counts: { plans: number; recipes: number; pendingGroceries: number };
  /** What the KPI tiles say under their numbers; computed on the server so both renders agree. */
  kpiContext: { plan: string; planName: string | null; newRecipes: number; groceries: GroceriesSource };
};

// Redesigned dashboard (specs/alt-dashboard/plan.md): hero carousel on the left, data column on the right.
export function Dashboard({ meals, dailyLogs, kcalGoal, proteinPct, weightGoal: serverGoal, counts, kpiContext }: DashboardProps) {
  const { refresh } = useShell();
  const today = useToday();
  const logs = useDailyLogs(dailyLogs, refresh);
  const [period, setPeriod] = useState<Period>("week");

  // The goal changes optimistically and rolls back if the save fails.
  const [weightGoal, setWeightGoal] = useState(serverGoal);
  useEffect(() => setWeightGoal(serverGoal), [serverGoal]);

  const slotIds = useMemo(() => meals.map((meal) => meal.id), [meals]);
  const allLogs = logs.list();
  const metrics = dashboardMetrics({ logs: allLogs, slotIds, today, period, kcalGoal, proteinPct, weightGoal });
  const todayLog = logs.get(today);
  // From the optimistic logs, so marking, unmarking and a rollback move Racha with no extra request (REQ-15).
  const streak = streaks({ logs: allLogs, slotIds, today });

  function toggleMeal(mealId: string, done: boolean) {
    return logs.setMeal(today, mealId, done);
  }

  async function saveWeight(weight: number | null, goal: number | null) {
    if (weight !== (todayLog.weight_kg ?? null)) void logs.save(today, { weight_kg: weight });
    if (goal === weightGoal) return;
    const previous = weightGoal;
    setWeightGoal(goal);
    try {
      await send("/api/goals", "PUT", { weight_goal_kg: goal });
      refresh();
    } catch {
      setWeightGoal(previous);
      toast.error("No se pudo guardar tu meta");
    }
  }

  return (
    <div className="nt-dash">
      <Hero meals={meals} doneIds={todayLog.meals_done} onToggle={toggleMeal} />
      <div className="nt-data">
        <KpiRow
          kpis={{ streak, ...counts }}
          contexts={kpiContexts({ plan: kpiContext.plan, newRecipes: kpiContext.newRecipes, recipes: counts.recipes, pending: counts.pendingGroceries, groceries: kpiContext.groceries })}
          planName={kpiContext.planName}
        />
        <MetricsCard period={period} onPeriod={setPeriod} metrics={metrics} weightToday={todayLog.weight_kg ?? null} weightGoal={weightGoal} onSaveWeight={saveWeight} />
        <div className="nt-pair">
          <CaloriesCard />
          <ComplianceCard />
        </div>
      </div>
    </div>
  );
}
