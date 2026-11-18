// Durations named in a step's text (REQ-18) and the timer arithmetic (REQ-19). Pure, unit tested.

const WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cuarentaicinco: 45
};
const NUMBER = `(\\d+(?:[.,]\\d+)?|${Object.keys(WORDS).join("|")})`;
const UNIT = "(horas?|hrs?|minutos?|mins?|segundos?|segs?)";
const RANGE = new RegExp(`(?:^|[^\\p{L}\\d])${NUMBER}(?:\\s*(?:a|-|–|o)\\s*${NUMBER})?\\s*${UNIT}(?![\\p{L}])(\\s+y\\s+media)?`, "u");
const HALF_HOUR = /(?:^|[^\p{L}])media\s+hora(?![\p{L}])/u;
/** Durations under this are not cooking times ("10 disparos de 1 segundo de aceite en aerosol"). */
const MIN_SECONDS = 10;

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const toNumber = (token: string) => WORDS[token] ?? Number(token.replace(",", "."));
const unitSeconds = (unit: string) => (unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1);

/** The first duration a step names, in seconds; a range uses its upper bound; null when there is none. */
export function findDuration(text: string): { seconds: number } | null {
  const folded = fold(text || "");
  const match = RANGE.exec(folded);
  let seconds: number | null = null;
  if (match) {
    const amount = toNumber(match[2] ?? match[1]);
    seconds = Math.round(amount * unitSeconds(match[3]) + (match[4] && match[3].startsWith("h") ? 1800 : 0));
  } else if (HALF_HOUR.test(folded)) seconds = 1800;
  return seconds !== null && Number.isFinite(seconds) && seconds >= MIN_SECONDS ? { seconds } : null;
}

/** "Temporizador 10 min", "Temporizador 30 s", "Temporizador 1 h 30 min". */
export function timerLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts = [hours && `${hours} h`, minutes && `${minutes} min`, !hours && !minutes && `${rest} s`].filter(Boolean);
  return `Temporizador ${parts.join(" ")}`;
}

/** "08:41", or "1:02:05" past an hour. Rounds up so a running timer never shows 00:00 early. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** A timer keeps its end time while running and its time left while paused, so a hidden tab or a reload stays exact. */
export type Timer = { step: number; totalMs: number; endsAt: number | null; leftMs: number | null };

export function startTimer(step: number, totalMs: number, now: number): Timer {
  return { step, totalMs, endsAt: now + totalMs, leftMs: null };
}

export function remainingMs(timer: Timer, now: number) {
  return Math.max(0, timer.endsAt !== null ? timer.endsAt - now : timer.leftMs ?? 0);
}

export function pauseTimer(timer: Timer, now: number): Timer {
  return timer.endsAt === null ? timer : { ...timer, endsAt: null, leftMs: remainingMs(timer, now) };
}

export function resumeTimer(timer: Timer, now: number): Timer {
  return timer.endsAt !== null ? timer : { ...timer, endsAt: now + (timer.leftMs ?? 0), leftMs: null };
}
