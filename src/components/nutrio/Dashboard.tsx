"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/app/AppShell";
import { type Meal } from "@/components/dashboard/food";
import { kpiContexts, type GroceriesSource } from "@/lib/kpis";
import { dashboardMetrics, type Period } from "@/lib/metrics";
import { streaks } from "@/lib/streak";
import { CaloriesCard, ComplianceCard, KpiRow, MetricsCard } from "./DataColumn";
import { Hero } from "./Hero";
import { TAP_LOCK_MS, acceptTap, createAdvance } from "./mark-logic";
import { useToday } from "./useToday";
import { send, useDailyLogs, type ServerLog } from "./useDailyLogs";
import "./primitives.css";
import "./dashboard.css";

export type DashboardProps = {
  meals: Meal[];
  /** When the active plan version was created; null without an active schedule ("Sin plan activo"). Unused until the counts card. */
  planCreatedAt: string | null;
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

  const doneIds = todayLog.meals_done;
  // Opens on the first meal still pending today.
  const [index, setIndex] = useState(() => Math.max(0, meals.findIndex((meal) => !doneIds.includes(meal.id))));
  const shownId = meals[Math.min(index, meals.length - 1)]?.id;

  // Meals whose mark is being saved, and until when each ignores further taps (specs/dashboard-polish REQ-25).
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const lockedUntil = useRef(new Map<string, number>());
  // What the status region says (REQ-24); empty after a failure, which only the toast reports.
  const [said, setSaid] = useState("");
  // Read when a timer or a save settles, after the render that started it.
  const live = useRef({ mealId: shownId, doneIds, saving });
  live.current = { mealId: shownId, doneIds, saving };

  // After a mark is saved the carousel moves on to the next pending meal (REQ-6); the wait lets "Cumplida" show first.
  const [advance] = useState(createAdvance);
  // The meal the pending advance was armed for: only a rollback of that meal cancels it (REQ-25d).
  const advanceFor = useRef<string | null>(null);
  const mounted = useRef(false);
  const reannounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set on every mount, not just initially: strict mode runs effect, cleanup, effect.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      advance.cancel();
      clearTimeout(reannounce.current);
    };
  }, [advance]);
  function say(text: string) {
    clearTimeout(reannounce.current);
    setSaid(text);
  }
  function go(next: number) {
    advance.cancel();
    setIndex(next);
    const target = meals[next].id;
    if (live.current.saving.has(target)) return say("Guardando");
    if (!live.current.doneIds.includes(target)) return say("");
    // Moving between two done meals would leave the same text, which a screen reader does not announce again: clear first.
    say("");
    reannounce.current = setTimeout(() => setSaid("Cumplida"), 80);
  }

  async function press(mealId: string) {
    if (!acceptTap({ pending: saving.has(mealId), lockedUntil: lockedUntil.current.get(mealId) ?? 0, now: Date.now() })) return;
    lockedUntil.current.set(mealId, Date.now() + TAP_LOCK_MS);
    advance.cancel();
    const marking = !doneIds.includes(mealId);
    if (marking) setSaving((current) => new Set(current).add(mealId));
    say(marking ? "Guardando" : "Comida desmarcada");
    const result = await toggleMeal(mealId, marking);
    if (!mounted.current) return;
    if (marking) setSaving((current) => new Set([...current].filter((id) => id !== mealId)));
    const onScreen = live.current.mealId === mealId;
    if (result === "failed") {
      if (advanceFor.current === mealId) advance.cancel();
      if (onScreen) say("");
    } else if (result === "saved" && marking && onScreen) {
      say("Cumplida");
      advanceFor.current = mealId;
      advance.start(meals.findIndex((item) => item.id === mealId), meals, () => live.current.doneIds, go);
    }
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
      <Hero meals={meals} doneIds={doneIds} index={index} saving={saving} said={said} onSelect={go} onPress={press} />
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
