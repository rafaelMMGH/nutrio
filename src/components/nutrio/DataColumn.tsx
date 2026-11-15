"use client";

import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ArrowUp, ArrowUpRight, ChevronDown, ClipboardList, ConciergeBell, Flame, Gauge, HandPlatter, Package, Utensils } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Metrics, Period } from "@/lib/metrics";
import { Card, Figure, IconBadge, Pill, RadialGauge, SegmentedTabs } from "./primitives";

const two = (value: number) => String(Math.max(0, Math.round(value))).padStart(2, "0");

/* ---------- KPI tiles (§5.4) ---------- */

export type Kpis = { mealsToday: number; plans: number; recipes: number; pendingGroceries: number };

export function KpiRow({ kpis }: { kpis: Kpis }) {
  const tiles: { label: string; value: number; icon: ReactNode }[] = [
    { label: "Comidas de hoy", value: kpis.mealsToday, icon: <HandPlatter /> },
    { label: "Planes disponibles", value: kpis.plans, icon: <ClipboardList /> },
    { label: "Recetas disponibles", value: kpis.recipes, icon: <ConciergeBell /> },
    { label: "Compras pendientes", value: kpis.pendingGroceries, icon: <Package /> }
  ];
  return (
    <div className="nt-kpis" role="list" aria-label="Resumen">
      {tiles.map((tile, index) => (
        <Card as="div" tone="glass" key={tile.label} className="nt-kpi" role="listitem" style={{ "--i": index } as CSSProperties}>
          <IconBadge>{tile.icon}</IconBadge>
          <span className="nt-kpi-text">
            <span className="nt-kpi-label">{tile.label}</span>
            <Figure className="text-center" value={two(tile.value)} />
          </span>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Métricas (§5.5) ---------- */

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "all", label: "Histórico" }
];

const percent = (ratio: number | null) => (ratio === null ? null : Math.round(ratio * 100));
const kg = (value: number) => value.toLocaleString("es-MX", { maximumFractionDigits: 1 });

type MetricsProps = {
  period: Period;
  onPeriod: (period: Period) => void;
  metrics: Metrics;
  weightToday: number | null;
  weightGoal: number | null;
  onSaveWeight: (weight: number | null, goal: number | null) => void;
};

export function MetricsCard({ period, onPeriod, metrics, weightToday, weightGoal, onSaveWeight }: MetricsProps) {
  const [editing, setEditing] = useState(false);
  const { adherence, calories, protein, weight } = metrics;
  return (
    <Card tone="black" className="nt-metrics" aria-labelledby="nt-metrics-title">
      <header className="nt-card-head">
        <IconBadge>
          <Gauge />
        </IconBadge>
        <h2 id="nt-metrics-title">Métricas</h2>
        <SegmentedTabs tabs={PERIODS} value={period} onChange={onPeriod} label="Periodo" onInk />
      </header>
      <div className="nt-gauges" role="tabpanel" aria-label={PERIODS.find((item) => item.value === period)?.label}>
        <GaugeTile value={percent(adherence.ratio)} ratio={adherence.ratio} color="var(--nt-yellow-accent)" label="Adherencia" detail={adherence.ratio === null ? null : `${adherence.done}/${adherence.planned}`} />
        <GaugeTile value={percent(calories.ratio)} ratio={calories.ratio} color="var(--nt-sky-accent)" label="Calorías" detail={calories.kcal === null ? null : `≈${calories.kcal} kcal`} />
        <GaugeTile value={percent(protein.ratio)} ratio={protein.ratio} color="#ffffff" label="Proteína" detail={protein.grams === null ? null : `≈${protein.grams} g`} />
        <GaugeTile
          value={percent(weight.ratio)}
          ratio={weight.ratio}
          color="var(--nt-orange)"
          label="Peso"
          detail={weight.current === null ? null : `${kg(weight.current)} kg`}
          onClick={() => setEditing(true)}
          actionLabel="Registrar peso y meta"
        />
      </div>
      {editing && <WeightDialog weight={weightToday} goal={weightGoal} onClose={() => setEditing(false)} onSave={(nextWeight, nextGoal) => { setEditing(false); onSaveWeight(nextWeight, nextGoal); }} />}
    </Card>
  );
}

// One dial: big percentage, wedge and "Label (detail)". No data shows "—" and an empty dial. Over 100% the dial stays full.
function GaugeTile({ value, ratio, color, label, detail, onClick, actionLabel }: { value: number | null; ratio: number | null; color: string; label: string; detail: string | null; onClick?: () => void; actionLabel?: string }) {
  const body = (
    <>
      <Figure className="nt-gauge-value" value={value === null ? "—" : value} unit={value === null ? undefined : "%"} />
      <RadialGauge ratio={ratio} color={color} />
      <span className="nt-gauge-label">
        {label}
        {detail && ` (${detail})`}
      </span>
    </>
  );
  const text = `${label}: ${value === null ? "sin datos" : `${value} %`}${detail ? `, ${detail}` : ""}`;
  return onClick ? (
    <button type="button" className="nt-gauge-tile" onClick={onClick} aria-label={`${text}. ${actionLabel}`} title={actionLabel}>
      {body}
    </button>
  ) : (
    <div className="nt-gauge-tile" role="img" aria-label={text}>
      {body}
    </div>
  );
}

function parseKg(value: string) {
  const number = Number(value.replace(",", "."));
  return value.trim() === "" ? null : Number.isFinite(number) ? Math.round(number * 10) / 10 : NaN;
}

function WeightDialog({ weight, goal, onSave, onClose }: { weight: number | null; goal: number | null; onSave: (weight: number | null, goal: number | null) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ weight: weight === null ? "" : String(weight), goal: goal === null ? "" : String(goal) });
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const nextWeight = parseKg(draft.weight);
    const nextGoal = parseKg(draft.goal);
    if ([nextWeight, nextGoal].some((value) => value !== null && (Number.isNaN(value) || value < 20 || value > 400))) return setError("Escribe un peso entre 20 y 400 kg.");
    onSave(nextWeight, nextGoal);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="nt-weight-form" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Peso y meta</DialogTitle>
            <DialogDescription>Registra tu peso de hoy y el peso que quieres alcanzar.</DialogDescription>
          </DialogHeader>
          <label>
            Peso de hoy (kg)
            <input autoFocus inputMode="decimal" value={draft.weight} placeholder="62.5" onChange={(event) => setDraft({ ...draft, weight: event.target.value })} aria-invalid={Boolean(error)} />
          </label>
          <label>
            Meta (kg)
            <input inputMode="decimal" value={draft.goal} placeholder="56" onChange={(event) => setDraft({ ...draft, goal: event.target.value })} aria-invalid={Boolean(error)} />
          </label>
          {error && <p role="alert" className="nt-weight-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Yellow and sky cards (§5.6) ---------- */

// Bar heights (0–1) and whether the bar is filled, as in the reference.
const BARS: [number, boolean][] = [[0.52, false], [0.62, false], [0.76, true], [0.66, true], [0.5, false], [0.42, false], [0.62, false], [0.68, true], [0.8, true]];
const HOURS = ["7:00", "10:00", "13:00", "17:00", "21:00"];

// TODO: solo visual — pendiente de revisión
export function CaloriesCard() {
  return (
    <Card tone="yellow" className="nt-cal" aria-labelledby="nt-cal-title">
      <header className="nt-card-head">
        <IconBadge>
          <Flame />
        </IconBadge>
        <h2 id="nt-cal-title">Resumen calórico</h2>
        <Pill className="nt-push" aria-hidden>
          Hoy <ChevronDown size={16} />
        </Pill>
      </header>
      <div className="nt-cal-main">
        <div>
          <span className="nt-small">Calorías del día</span>
          <p className="nt-cal-total">
            1,850<small>kcal</small>
          </p>
          <Pill tone="success">
            <ArrowUp size={12} aria-hidden /> +12.8%
          </Pill>
        </div>
        <dl className="nt-cal-side">
          <div>
            <dt>Comidas completadas</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Promedio por comida</dt>
            <dd>462</dd>
          </div>
        </dl>
      </div>
      <div className="nt-bars" aria-hidden>
        {BARS.map(([height, filled], index) => (
          <i key={index} className={filled ? "is-filled" : undefined} style={{ height: `${height * 100}%` }} />
        ))}
      </div>
      <div className="nt-hours" aria-hidden>
        {HOURS.map((hour) => (
          <span key={hour}>{hour}</span>
        ))}
      </div>
    </Card>
  );
}

// TODO: solo visual — pendiente de revisión
export function ComplianceCard() {
  return (
    <Card tone="sky" className="nt-comp" aria-labelledby="nt-comp-title">
      <header className="nt-card-head">
        <IconBadge>
          <Utensils />
        </IconBadge>
        <h2 id="nt-comp-title">Cumplimiento del plan</h2>
        <span className="nt-arrow nt-push" aria-hidden>
          <ArrowUpRight size={18} />
        </span>
      </header>
      <div className="nt-arc">
        <span className="nt-live">
          <i aria-hidden /> En vivo
        </span>
        <svg viewBox="0 0 200 104" preserveAspectRatio="xMidYMax meet" aria-hidden>
          <defs>
            <linearGradient id="nt-arc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--nt-sky-deep)" stopOpacity="0.38" />
              <stop offset="1" stopColor="var(--nt-sky-deep)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M10 100 A90 90 0 0 1 143 21 L133 38 A70 70 0 0 0 30 100 Z" fill="url(#nt-arc-fill)" />
          <path d="M10 100 A90 90 0 0 1 143 21" fill="none" stroke="var(--nt-sky-deep)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M143 21 A90 90 0 0 1 181 63" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M181 63 A90 90 0 0 1 190 100" fill="none" stroke="var(--nt-orange)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="10" cy="100" r="2.6" fill="#fff" stroke="var(--nt-sky-deep)" strokeWidth="1" />
          <circle cx="190" cy="100" r="2.6" fill="#fff" stroke="var(--nt-orange)" strokeWidth="1" />
        </svg>
        <p className="nt-arc-total">
          <b>32</b>
          <span>Comidas planificadas</span>
        </p>
      </div>
      <dl className="nt-comp-stats">
        <div>
          <dd>25</dd>
          <dt><i style={{ background: "var(--nt-sky-deep)" }} aria-hidden /> Cumplidas</dt>
        </div>
        <div>
          <dd>05</dd>
          <dt><i style={{ background: "#ffffff" }} aria-hidden /> Pendientes</dt>
        </div>
        <div>
          <dd>02</dd>
          <dt><i style={{ background: "var(--nt-orange)" }} aria-hidden /> Omitidas</dt>
        </div>
      </dl>
    </Card>
  );
}
