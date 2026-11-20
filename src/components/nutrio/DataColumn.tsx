"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ClipboardList, ConciergeBell, Flame, Gauge, Package, Utensils } from "lucide-react";
import { useShell } from "@/components/app/AppShell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { metricReadouts, type DialReadout, type Metrics, type Period } from "@/lib/metrics";
import { kpiContexts, streakText } from "@/lib/kpis";
import { Card, Figure, IconBadge, RadialGauge, SegmentedTabs } from "./primitives";
import DetentDial from "./DetentDial";
import { showEndLabels } from "./dial-logic";
import { RollingNumber } from "./RollingNumber";

/* ---------- KPI tiles (§5.4) ---------- */

export type Kpis = { streak: { current: number; best: number }; plans: number; recipes: number; pendingGroceries: number };
export type KpiContexts = ReturnType<typeof kpiContexts>;

type Tile = { label: string; value: number; context: string; title?: string; icon: ReactNode; unit?: string; phrase?: string };

/** `planName` is the full name of the active plan, shown on hover of the Planes line (which only says since when it exists). */
export function KpiRow({ kpis, contexts, planName }: { kpis: Kpis; contexts: KpiContexts; planName: string | null }) {
  const streak = streakText(kpis.streak);
  const tiles: Tile[] = [
    // The flame is decorative: the tile reads as one phrase (REQ-29), so its visible parts are aria-hidden.
    { label: "Racha", value: kpis.streak.current, context: streak.context, unit: streak.unit, phrase: `Racha, ${streak.value}, ${streak.context}`, icon: <Flame /> },
    { label: "Planes", value: kpis.plans, context: contexts.plan, title: planName ?? undefined, icon: <ClipboardList /> },
    { label: "Recetas", value: kpis.recipes, context: contexts.recipes, icon: <ConciergeBell /> },
    { label: "Compras", value: kpis.pendingGroceries, context: contexts.groceries, icon: <Package /> }
  ];
  return (
    <div className="nt-kpis" role="list" aria-label="Resumen">
      {tiles.map((tile, index) => {
        const hidden = tile.phrase ? true : undefined;
        return (
          <Card as="div" tone="glass" key={tile.label} className={tile.phrase ? "nt-kpi nt-kpi-streak" : "nt-kpi"} role="listitem" style={{ "--i": index } as CSSProperties}>
            <IconBadge>{tile.icon}</IconBadge>
            <span className="nt-kpi-text">
              {tile.phrase && <span className="sr-only">{tile.phrase}</span>}
              <span className="nt-kpi-label" aria-hidden={hidden}>{tile.label}</span>
              {/* The number rolls once its own tile has landed (450 ms entrance). Racha shows a real zero, not a dash. */}
              <span className="nt-kpi-figure" aria-hidden={hidden}>
                <RollingNumber value={tile.value} minDigits={tile.unit ? 1 : 2} delay={index * 60 + 450} dashForZero={!tile.unit} />
                {tile.unit && <span className="nt-kpi-unit">{tile.unit}</span>}
              </span>
              <span className="nt-kpi-context" title={tile.title ?? tile.context} aria-hidden={hidden}>{tile.context}</span>
            </span>
          </Card>
        );
      })}
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
  const { weight } = metrics;
  const dials = metricReadouts(metrics);
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
        <DialTile label="Adherencia" accent="var(--nt-yellow-accent)" dial={dials.adherence} longestReadout={4} />
        <DialTile label="Calorías" accent="var(--nt-sky-accent)" dial={dials.calories} longestReadout={estimateLength(dials.calories)} />
        <DialTile label="Proteína" accent="var(--nt-dial-white)" dial={dials.protein} longestReadout={estimateLength(dials.protein)} />
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

const whole = (n: number) => Math.round(n).toLocaleString("en-US");
/** "≈ " plus the target: the longest the estimate readout gets in any period, so its font does not change with the tab. */
const estimateLength = (dial: DialReadout) => Math.max(dial.readout.length, dial.valueText === "Sin datos" ? 0 : `≈ ${whole(dial.max)}`.length);

/**
 * Adherencia, Calorías or Proteína: a read-only dial (specs/metric-dials), its name and, under it, the line with the unit.
 * The dial's size comes from CSS (dashboard.css); only the end labels need it here, so the tile measures the box.
 */
function DialTile({ label, accent, dial, longestReadout }: { label: string; accent: string; dial: DialReadout; longestReadout: number }) {
  const labelId = useId();
  const tile = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    const box = tile.current?.querySelector(".nt-dial-box");
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect.width));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const endLabels = size !== null && showEndLabels(size, whole(dial.max).length);
  return (
    <div ref={tile} className="nt-gauge-tile nt-dial-tile" style={{ "--nt-dial-accent": accent, "--nt-dial-n": Math.max(longestReadout, 1) } as CSSProperties}>
      <DetentDial
        labelledBy={labelId}
        min={dial.min}
        max={dial.max}
        step={(dial.max - dial.min) / 40}
        value={dial.value}
        readout={dial.readout}
        valueText={dial.valueText}
        readOnly
        endLabels={endLabels}
        formatEnd={whole}
      />
      <span id={labelId} className="nt-gauge-label">{label}</span>
      {/* The unit lives on this line; the dial's value text already says it all to a screen reader. */}
      <span className="nt-dial-line" aria-hidden="true">{dial.line}</span>
    </div>
  );
}

// Peso keeps its gauge until it becomes a dial (US3): big percentage, wedge and "Label (detail)". No data shows "—" and an empty dial. Over 100% the dial stays full.
function GaugeTile({ value, ratio, color, label, detail, onClick, actionLabel }: { value: number | null; ratio: number | null; color: string; label: string; detail: string | null; onClick: () => void; actionLabel: string }) {
  const text = `${label}: ${value === null ? "sin datos" : `${value} %`}${detail ? `, ${detail}` : ""}`;
  return (
    <button type="button" className="nt-gauge-tile" onClick={onClick} aria-label={`${text}. ${actionLabel}`} title={actionLabel}>
      <Figure className="nt-gauge-value" value={value === null ? "—" : value} unit={value === null ? undefined : "%"} />
      <RadialGauge ratio={ratio} color={color} />
      <span className="nt-gauge-label">
        {label}
        {detail && ` (${detail})`}
      </span>
    </button>
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

/* ---------- Sky card (§5.6) ---------- */

type ComplianceCounts = { planned: number; done: number; unmarked: number; pending: number };

/** Cumplimiento del plan: real counts since the plan began (spec dashboard-real-data REQ-12 to REQ-15). `since` is the "Desde …" header. */
export function ComplianceCard({ counts, since, hasPlan }: { counts: ComplianceCounts; since: string; hasPlan: boolean }) {
  const { openUpload } = useShell();
  const { planned, done, unmarked, pending } = counts;
  const stats = [
    { label: "Cumplidas", value: done, dot: "done" },
    { label: "Sin marcar", value: unmarked, dot: "unmarked" },
    { label: "Pendientes", value: pending, dot: "pending" }
  ];
  return (
    <Card tone="sky" className="nt-comp" aria-labelledby="nt-comp-title">
      <header className="nt-card-head">
        <IconBadge>
          <Utensils />
        </IconBadge>
        <h2 id="nt-comp-title">Cumplimiento del plan</h2>
        {hasPlan && <span className="nt-since nt-push">{since}</span>}
      </header>
      {hasPlan ? (
        <>
          <div className="nt-arc">
            {/* pathLength 100 makes the dash length the percentage, whatever the arc's size. */}
            <svg viewBox="0 0 200 104" preserveAspectRatio="xMidYMax meet" role="img" aria-label={`${done} de ${planned} comidas cumplidas`}>
              <path className="nt-arc-track" d="M10 100 A90 90 0 0 1 190 100" fill="none" pathLength={100} />
              {done > 0 && <path className="nt-arc-fill" d="M10 100 A90 90 0 0 1 190 100" fill="none" pathLength={100} strokeDasharray={`${Math.min(100, (done / planned) * 100)} 100`} />}
            </svg>
            <p className="nt-arc-total">
              <b>{planned}</b>
              <span>Planificadas</span>
            </p>
          </div>
          <dl className="nt-comp-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>
                  <i className={`nt-dot-${stat.dot}`} aria-hidden /> {stat.label}
                </dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </>
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
