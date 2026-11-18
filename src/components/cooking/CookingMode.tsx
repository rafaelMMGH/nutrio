"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bell, Check, ChefHat, ListChecks, Mic, Pause, Pencil, Play, RotateCcw, Timer as TimerIcon, Volume2, X } from "lucide-react";
import { foodIcon, isReadableName, mealLabel, dateKey, qty } from "@/components/dashboard/food";
import { send } from "@/components/nutrio/useDailyLogs";
import { recipeMeta } from "@/components/recipes/recipe-meta";
import { backIndex, mealToMark, nextIndex, readyLabel, resumeFrom, screensFor, stepOf, type ScreenKey, type TodayMeal } from "./cooking-logic";
import { findDuration, formatClock, remainingMs, timerLabel, type Timer } from "./durations";
import { canSpeak, speak, stopSpeaking } from "./speak";
import { useTimers } from "./useTimers";
import { useVoiceControl } from "./useVoiceControl";
import { useWakeLock } from "./useWakeLock";
import { speechFor, type VoiceCommand } from "./voice-commands";
import "@/components/nutrio/tokens.css";
import "@/components/recipes/recipes.css";
import "./cooking.css";

type Ingredient = { name: string; quantity: number; unit: string; category: string };
type Recipe = { id: string; name: string; ingredients: Ingredient[]; steps: string[]; appearances?: unknown[] };
type Props = { recipe: Recipe; meals: TodayMeal[]; logs: { date: string; meals_done: string[] }[] };

const storageKey = (id: string) => `nm-cooking:${id}`;
/** A horizontal swipe: at least this far, and within 30° of horizontal (REQ-11). */
const SWIPE_PX = 60;

function readSaved(id: string): unknown {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSaved(id: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(storageKey(id));
    else window.localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Resuming is a convenience (REQ-20): without storage, Modo Cocina still works.
  }
}

const timeOfDay = (at: number) => new Date(at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });

export function CookingMode({ recipe, meals, logs }: Props) {
  const router = useRouter();
  const screens = useMemo(() => screensFor(recipe.ingredients.length, recipe.steps.length), [recipe.ingredients.length, recipe.steps.length]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [resumed, setResumed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [doneIds, setDoneIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const timers = useTimers([]);
  const wake = useWakeLock(true);
  const screen = screens[index];
  const step = stepOf(screen);
  const meta = useMemo(() => recipeMeta(recipe), [recipe]);
  const recipeHref = `/recipes/${recipe.id}`;

  // ----- Resume (REQ-20): read after mount so the server render and hydration agree. -----
  useEffect(() => {
    const saved = resumeFrom(readSaved(recipe.id), Date.now(), recipe.ingredients.length, recipe.steps.length);
    if (saved && (saved.screen !== screens[0] || saved.checked.length || saved.timers.length)) {
      setIndex(Math.max(0, screens.indexOf(saved.screen)));
      setChecked(saved.checked);
      timers.restore(saved.timers);
      setResumed(true);
    } else writeSaved(recipe.id, null);
    setDoneIds(logs.find((log) => log.date === dateKey(new Date()))?.meals_done ?? []);
    setLoaded(true);
    // Only once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (screen === "done") writeSaved(recipe.id, null);
    else writeSaved(recipe.id, { screen, checked, timers: timers.timers, ingredients: recipe.ingredients.length, steps: recipe.steps.length, savedAt: Date.now() });
  }, [loaded, screen, checked, timers.timers, recipe.id, recipe.ingredients.length, recipe.steps.length]);

  function startOver() {
    writeSaved(recipe.id, null);
    timers.clear();
    setChecked([]);
    setIndex(0);
    setResumed(false);
  }

  // ----- Navigation (REQ-10, REQ-11) -----
  const goNext = useCallback(() => setIndex((current) => nextIndex(screens, current)), [screens]);
  const goBack = useCallback(() => setIndex((current) => backIndex(current)), []);
  const exit = useCallback(() => {
    stopSpeaking();
    router.replace(recipeHref);
  }, [router, recipeHref]);

  const mainRef = useRef<HTMLElement>(null);
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    mainRef.current?.scrollTo?.({ top: 0 });
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "Escape") {
        event.preventDefault();
        if (listOpen) setListOpen(false);
        else exit();
        return;
      }
      if (typing || listOpen) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.key === " " && !target?.closest("button, a, [role='button']")) {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack, exit, listOpen]);

  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === "mouse") return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function onPointerUp(event: ReactPointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) * Math.tan(Math.PI / 6)) return;
    if (dx < 0) goNext();
    else goBack();
  }

  // ----- Voice (REQ-21 to REQ-25) -----
  const readable = useMemo(() => ({ name: recipe.name, ingredients: recipe.ingredients, steps: recipe.steps }), [recipe]);
  const readScreen = useCallback(async (key: ScreenKey) => {
    setSpeaking(true);
    await speak(speechFor(key, readable));
    setSpeaking(false);
  }, [readable]);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const onCommand = useCallback((command: VoiceCommand) => {
    if (command === "next") goNext();
    else if (command === "back") goBack();
    else void readScreen(screenRef.current);
  }, [goNext, goBack, readScreen]);
  const voice = useVoiceControl(onCommand, speaking);

  useEffect(() => {
    if (!voice.enabled) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (canSpeak()) void readScreen(screen);
    // Read each new screen once while voice control is on (REQ-23), and the current one when it is turned on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, voice.enabled]);
  useEffect(() => () => stopSpeaking(), []);

  // ----- Marking the meal (REQ-15 to REQ-17) -----
  const mark = doneIds ? mealToMark(meals, recipe.id, doneIds) : ({ state: "none" } as const);
  async function saveMeals(next: string[], previous: string[]) {
    const today = dateKey(new Date());
    setDoneIds(next);
    await send(`/api/daily-logs/${today}`, "PUT", { meals_done: next }).catch((error) => {
      setDoneIds(previous);
      throw error;
    });
  }
  async function markDone() {
    if (mark.state !== "pending" || !doneIds) return;
    const previous = doneIds;
    const label = mealLabel(mark.meal.name);
    setSaving(true);
    try {
      await saveMeals([...previous.filter((id) => id !== mark.meal.id), mark.meal.id], previous);
      toast.success(`${label} marcada como hecha`, {
        action: {
          label: "Deshacer",
          onClick: () => {
            void saveMeals(previous, [...previous, mark.meal.id]).catch(() => toast.error("No se pudo guardar tu registro del día"));
          }
        }
      });
    } catch {
      toast.error("No se pudo guardar tu registro del día");
    } finally {
      setSaving(false);
    }
  }

  // ----- Timers (REQ-18, REQ-19) -----
  const nextTimer = [...timers.timers].sort((a, b) => remainingMs(a, timers.now) - remainingMs(b, timers.now))[0];
  const stepTimer = step !== null ? timers.timers.find((timer) => timer.step === step) : undefined;
  const duration = step !== null ? findDuration(recipe.steps[step]) : null;
  const goToStep = (target: number) => setIndex(Math.max(0, screens.indexOf(`step-${target}`)));

  const progress = screens.length > 1 ? index / (screens.length - 1) : 1;
  const toggle = (item: number) => setChecked((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item].sort((a, b) => a - b)));
  const announce = step !== null ? `Paso ${step + 1} de ${recipe.steps.length}` : screen === "before" ? "Antes de empezar" : screen === "no-steps" ? "Sin pasos" : "¡Listo!";

  return (
    <div className="nt ck" data-screen={screen}>
      <header className="ck-top">
        <button type="button" className="ck-icon-btn" aria-label="Salir del Modo Cocina" onClick={exit}>
          <X size={22} />
        </button>
        <div className="ck-title">
          <span className="ck-eyebrow">
            <ChefHat size={14} /> Modo Cocina
          </span>
          <span className="ck-name">{recipe.name}</span>
        </div>
        <div className="ck-top-actions">
          {nextTimer && (step !== nextTimer.step || timers.timers.length > 1) && (
            <button type="button" className="ck-chip" onClick={() => goToStep(nextTimer.step)} aria-label={`Temporizador del paso ${nextTimer.step + 1}: ${formatClock(remainingMs(nextTimer, timers.now))}. Ir al paso`}>
              <TimerIcon size={16} /> Paso {nextTimer.step + 1} · {formatClock(remainingMs(nextTimer, timers.now))}
              {timers.timers.length > 1 && <b>+{timers.timers.length - 1}</b>}
            </button>
          )}
          {step !== null && recipe.ingredients.length > 0 && (
            <button type="button" className="ck-icon-btn" aria-label="Ver ingredientes" aria-haspopup="dialog" onClick={() => setListOpen(true)}>
              <ListChecks size={20} />
            </button>
          )}
          {voice.state !== "unsupported" && (
            <button
              type="button"
              className="ck-icon-btn ck-voice"
              aria-pressed={voice.enabled}
              aria-label={voice.enabled ? "Desactivar control por voz" : "Control por voz"}
              title="Control por voz: di «siguiente», «atrás» o «repetir»"
              onClick={voice.toggle}
            >
              <Mic size={20} />
            </button>
          )}
        </div>
        <div className="ck-progress" role="progressbar" aria-label="Avance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <p className="ck-sr" aria-live="polite">{announce}</p>

      {(resumed || voice.enabled || voice.state === "denied" || voice.state === "failed" || voice.state === "unsupported") && (
        <div className="ck-notes">
          {resumed && (
            <p className="ck-note">
              Retomamos donde te quedaste.
              <button type="button" className="ck-link" onClick={startOver}>
                <RotateCcw size={14} /> Empezar de nuevo
              </button>
            </p>
          )}
          {voice.enabled && (
            <p className="ck-note is-live" role="status">
              <span className="ck-dot" aria-hidden="true" />
              <span>{speaking ? "Leyendo…" : "Escuchando… di «siguiente», «atrás» o «repetir»"}</span>
            </p>
          )}
          {voice.state === "denied" && <p className="ck-note is-warn" role="alert">Permite el acceso al micrófono para usar tu voz.</p>}
          {voice.state === "failed" && <p className="ck-note is-warn" role="alert">No se pudo usar el control por voz. Intenta de nuevo.</p>}
          {voice.state === "unsupported" && step !== null && <p className="ck-note is-quiet">Tu navegador no permite control por voz.</p>}
        </div>
      )}

      {timers.finished.map((item) => (
        <div key={item.step} className="ck-alarm" role="alert">
          <Bell size={20} />
          <span>
            <b>¡Tiempo! Paso {item.step + 1}</b>
            {Date.now() - item.endedAt > 5000 && <small>Terminó a las {timeOfDay(item.endedAt)}</small>}
          </span>
          <button type="button" className="ck-btn is-small" onClick={() => timers.dismiss(item.step)}>
            Listo
          </button>
        </div>
      ))}

      <main ref={mainRef} className="ck-main" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
        {screen === "before" && (
          <section className="ck-screen ck-before" aria-labelledby="ck-before-title" key="before">
            <div className="ck-before-head">
              <div className={`rx-media ck-media tone-${meta.tone}`} aria-hidden="true">
                <img src={meta.icon} alt="" className="rx-dish" />
                {meta.extras.map((icon, extra) => (
                  <img key={icon} src={icon} alt="" className={`rx-float f${extra}`} />
                ))}
              </div>
              <div>
                <h1 id="ck-before-title">Antes de empezar</h1>
                <p className="ck-lead">Ten esto a la mano y lo demás será fácil.</p>
                <p className={`ck-count${checked.length === recipe.ingredients.length ? " is-all" : ""}`} aria-live="polite">
                  {checked.length === recipe.ingredients.length && <Check size={16} strokeWidth={3} />} {readyLabel(checked.length, recipe.ingredients.length)}
                </p>
              </div>
            </div>
            <IngredientList ingredients={recipe.ingredients} checked={checked} onToggle={toggle} />
          </section>
        )}

        {step !== null && (
          <section className="ck-screen ck-step" aria-labelledby="ck-step-title" key={screen}>
            <p className="ck-step-count" id="ck-step-title">
              Paso {step + 1} <span>de {recipe.steps.length}</span>
            </p>
            <div className="ck-step-text">
              <p>{recipe.steps[step]}</p>
            </div>
            {stepTimer ? (
              <div className="ck-timer" aria-label={`Temporizador del paso ${step + 1}`}>
                <span className="ck-clock" aria-live="off">{formatClock(remainingMs(stepTimer, timers.now))}</span>
                <div className="ck-timer-actions">
                  {stepTimer.endsAt !== null ? (
                    <button type="button" className="ck-btn is-quiet is-small" onClick={() => timers.pause(step)}>
                      <Pause size={16} /> Pausar
                    </button>
                  ) : (
                    <button type="button" className="ck-btn is-quiet is-small" onClick={() => timers.resume(step)}>
                      <Play size={16} /> Reanudar
                    </button>
                  )}
                  <button type="button" className="ck-btn is-quiet is-small" onClick={() => timers.cancel(step)}>
                    <X size={16} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              duration && (
                <button type="button" className="ck-btn is-quiet ck-timer-start" onClick={() => timers.start(step, duration.seconds)}>
                  <TimerIcon size={18} /> {timerLabel(duration.seconds)}
                </button>
              )
            )}
            {voice.enabled && (
              <button type="button" className="ck-link ck-repeat" onClick={() => void readScreen(screen)}>
                <Volume2 size={16} /> Repetir
              </button>
            )}
          </section>
        )}

        {screen === "no-steps" && (
          <section className="ck-screen ck-empty" aria-labelledby="ck-empty-title" key="no-steps">
            <ChefHat size={40} aria-hidden="true" />
            <h1 id="ck-empty-title">Tu plan no incluye pasos para esta receta.</h1>
            <p className="ck-lead">Puedes escribirlos para la próxima vez, o terminar aquí.</p>
            <div className="ck-row">
              <Link href={`${recipeHref}?edit=1`} className="ck-btn is-quiet">
                <Pencil size={18} /> Escribir los pasos
              </Link>
              <button type="button" className="ck-btn" onClick={goNext}>
                Terminar
              </button>
            </div>
          </section>
        )}

        {screen === "done" && (
          <section className="ck-screen ck-done" aria-labelledby="ck-done-title" key="done">
            <div className={`rx-media ck-media is-done tone-${meta.tone}`} aria-hidden="true">
              <img src={meta.icon} alt="" className="rx-dish" />
            </div>
            <h1 id="ck-done-title">¡Listo!</h1>
            <p className="ck-lead">{recipe.name}</p>
            <div className="ck-row">
              {mark.state === "pending" && (
                <button type="button" className="ck-btn" disabled={saving} onClick={() => void markDone()}>
                  <Check size={18} strokeWidth={2.5} /> Marcar como hecha ({mealLabel(mark.meal.name)})
                </button>
              )}
              <Link href={recipeHref} replace className={mark.state === "pending" ? "ck-btn is-quiet" : "ck-btn"}>
                Volver a la receta
              </Link>
            </div>
            {mark.state === "done" && <p className="ck-note is-quiet">Ya marcaste esta comida hoy.</p>}
          </section>
        )}
      </main>

      {screen !== "done" && screen !== "no-steps" && (
        <footer className="ck-foot">
          {wake === "unavailable" && <p className="ck-wake">Tu pantalla podría apagarse mientras cocinas.</p>}
          <div className="ck-nav">
            <button type="button" className="ck-btn is-quiet ck-nav-btn" onClick={goBack} disabled={index === 0}>
              <ArrowLeft size={20} /> Anterior
            </button>
            <button type="button" className={`ck-btn ck-nav-btn${screen === "before" && checked.length === recipe.ingredients.length ? " is-ready" : ""}`} onClick={goNext}>
              {screen === "before" ? "Empezar" : step === recipe.steps.length - 1 ? "Terminar" : "Siguiente"} <ArrowRight size={20} />
            </button>
          </div>
        </footer>
      )}
      {(screen === "done" || screen === "no-steps") && wake === "unavailable" && <p className="ck-wake ck-wake-solo">Tu pantalla podría apagarse mientras cocinas.</p>}

      {listOpen && (
        <div className="ck-sheet-backdrop" onClick={() => setListOpen(false)}>
          <div className="ck-sheet" role="dialog" aria-modal="true" aria-labelledby="ck-sheet-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="ck-sheet-title">Ingredientes</h2>
              <span className="ck-count">{readyLabel(checked.length, recipe.ingredients.length)}</span>
              <button type="button" className="ck-icon-btn" aria-label="Cerrar ingredientes" autoFocus onClick={() => setListOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <IngredientList ingredients={recipe.ingredients} checked={checked} onToggle={toggle} />
          </div>
        </div>
      )}
    </div>
  );
}

function IngredientList({ ingredients, checked, onToggle }: { ingredients: Ingredient[]; checked: number[]; onToggle: (index: number) => void }) {
  return (
    <ul className="ck-ingredients">
      {ingredients.map((item, index) => {
        const readable = isReadableName(item.name);
        const name = readable ? item.name.trim() : "Ingrediente por revisar";
        const amount = item.quantity > 0 ? `${qty(item.quantity)} ${item.unit}`.trim() : item.unit;
        const on = checked.includes(index);
        return (
          <li key={`${item.name}-${index}`}>
            <button type="button" className="ck-ingredient" aria-pressed={on} onClick={() => onToggle(index)}>
              <img src={foodIcon(item.name, item.category)} alt="" width={40} height={40} />
              <span className={readable ? "ck-ing-name" : "ck-ing-name is-unreadable"}>{name}</span>
              {amount && <span className="ck-ing-amount">{amount}</span>}
              <span className="ck-check" aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
