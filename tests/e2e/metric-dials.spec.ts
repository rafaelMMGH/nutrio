import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { END_LABEL_MIN_D, F_MIN, inKnobFont, showEndLabels } from "../../src/components/nutrio/dial-logic";
import { sql } from "./database";
import { expect, test } from "./fixtures";
import { contrast, effectiveBackground, seedTheme, toRgb, type Theme } from "./theme-helpers";

// The three read-only metric dials of the Métricas card (specs/metric-dials, US1: REQ-1 to REQ-9, REQ-43 to REQ-45),
// written before the tiles render them. Option (c) of plan "Chosen (T006)": the number without its unit inside the
// knob ("78%", "≈ 1,445"), the unit on the line under the dial ("meta 1,850 kcal"), aria-valuetext keeps the units.
// Peso keeps its GaugeTile and modal in this batch, so these tests never assert on it beyond "it is still there".
// Real UI, real routes, real Postgres (the e2e copy); every test sets its data by SQL and the afterEach puts it back.

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysAgo = (days: number) => {
  const now = new Date();
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
};
const TODAY = daysAgo(0);

/* ---------- Data: the e2e copy, changed by SQL and restored after each test ---------- */

const ACTIVE_VERSIONS = "select v.id from plan_versions v join plans p on p.id = v.plan_id where v.is_current and p.status = 'active' and p.deleted_at is null";
const LIVE_SLOTS = `select id from meal_types where deleted_at is null and plan_version_id in (${ACTIVE_VERSIONS}) order by display_order`;
// 1,850 kcal at this percentage is a 112 g protein target (the spec's example), a hair above so 87.5 g rounds half up to 88.
const PROTEIN_PCT = 24.2162163;
const KCAL = 1850;
const PROTEIN_GOAL = (KCAL * PROTEIN_PCT) / 100 / 4;
// 25 of 32 meals: two meals a day for the 16 days of the "Histórico" tab, oldest first; today has nothing done yet.
const DONE_25_OF_32 = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0];

function backUp() {
  sql(
    `create table if not exists e2e_dials_logs as select * from daily_logs; create table if not exists e2e_dials_versions as select id, structured_data from plan_versions; create table if not exists e2e_dials_slots as select id from meal_types where deleted_at is null`
  );
}

function restore() {
  if (!sql("select to_regclass('e2e_dials_logs')")) return;
  sql(
    "delete from daily_logs; insert into daily_logs select * from e2e_dials_logs; update plan_versions v set structured_data = b.structured_data from e2e_dials_versions b where b.id = v.id; update meal_types set deleted_at = null where id in (select id from e2e_dials_slots); drop table e2e_dials_logs, e2e_dials_versions, e2e_dials_slots"
  );
}

/**
 * `slots` meals a day stay in the active plan; `done[i]` meals are done on the day i places before the last one
 * (the last is today), one log row per entry, none when empty; `kcal` is the plan's kcal target (null: no target).
 */
function scenario({ slots, done, kcal }: { slots: number; done: number[]; kcal: number | null }) {
  backUp();
  // Back to the full plan first, so a scenario never depends on what the previous one removed.
  sql("update meal_types set deleted_at = null where id in (select id from e2e_dials_slots)");
  const live = sql(LIVE_SLOTS).split("\n").filter(Boolean);
  if (live.length < slots) throw new Error(`the active plan has ${live.length} meals, the scenario needs ${slots}`);
  const kept = live.slice(0, slots);
  const rows = done.map((count, index) => `('e2e-dials-${index}', (select id from users order by seq limit 1), '${daysAgo(done.length - 1 - index)}', '{${kept.slice(0, count).join(",")}}', 0, now(), now())`);
  const summary = kcal === null
    ? "(structured_data::jsonb #- '{nutrition_summary,kcal}' #- '{nutrition_summary,macros}')"
    : `jsonb_set(jsonb_set(structured_data::jsonb, '{nutrition_summary,kcal}', '${kcal}'::jsonb), '{nutrition_summary,macros}', '{"proteinas": ${PROTEIN_PCT}}'::jsonb)`;
  sql(
    [
      `update meal_types set deleted_at = now() where id in (${live.filter((id) => !kept.includes(id)).map((id) => `'${id}'`).join(",") || "''"})`,
      "delete from daily_logs",
      rows.length ? `insert into daily_logs (id, user_id, date, meals_done, water_glasses, created_at, updated_at) values ${rows.join(",")}` : "select 1",
      `update plan_versions set structured_data = ${summary}::json where id in (${ACTIVE_VERSIONS})`
    ].join("; ")
  );
}

test.afterEach(() => restore());

/* ---------- What the card should say, from the same arithmetic the spec states ---------- */

const whole = (value: number) => Math.round(value).toLocaleString("en-US");

function readouts(done: number, planned: number, kcal: number) {
  const ratio = done / planned;
  const goalProtein = (kcal * PROTEIN_PCT) / 100 / 4;
  const adherence = { readout: `${Math.round(ratio * 100)}%`, line: `${done} de ${planned} ${planned === 1 ? "comida" : "comidas"}`, value: ratio * 100, max: 100 };
  const calories = { readout: `≈ ${whole(ratio * kcal)}`, line: `meta ${whole(kcal)} kcal`, value: ratio * kcal, max: kcal };
  const protein = { readout: `≈ ${whole(ratio * goalProtein)}`, line: `meta ${whole(goalProtein)} g`, value: ratio * goalProtein, max: goalProtein };
  return {
    Adherencia: { ...adherence, valueText: `${adherence.readout}, ${adherence.line}` },
    Calorías: { ...calories, valueText: `${calories.readout} kcal, ${calories.line}` },
    Proteína: { ...protein, valueText: `${protein.readout} g, ${protein.line}` }
  };
}

type Period = "week" | "month" | "year" | "all";
const TABS: Record<Period, string> = { week: "Semana", month: "Mes", year: "Año", all: "Histórico" };

/** Done and planned meals of a period for `done` (see `scenario`), with the rules of dashboardMetrics. */
function periodCounts(period: Period, slots: number, done: number[]) {
  const now = new Date();
  const start = {
    week: daysAgo((now.getDay() + 6) % 7),
    month: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    year: dayKey(new Date(now.getFullYear(), 0, 1)),
    all: daysAgo(done.length - 1)
  }[period];
  const utc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  const days = Math.round((utc(TODAY) - utc(start)) / 86_400_000) + 1;
  const inPeriod = done.reduce((sum, count, index) => (daysAgo(done.length - 1 - index) >= start ? sum + count : sum), 0);
  return { done: inPeriod, planned: slots * days };
}

/* ---------- Page helpers ---------- */

const DIALS = ["Adherencia", "Calorías", "Proteína"] as const;
type Dial = (typeof DIALS)[number];

async function open(page: Page, size?: { width: number; height: number }) {
  if (size) await page.setViewportSize(size);
  await page.goto("/");
  await expect(page.locator(".nt-dash h1")).toHaveText("Dashboard");
  await page.waitForLoadState("networkidle");
  // Every test here is about the dials, so a page without them fails right here and says so.
  await expect(card(page).getByRole("meter")).toHaveCount(3);
}

const card = (page: Page) => page.locator(".nt-metrics");
const tiles = (page: Page) => card(page).locator(".nt-gauges > *");
// The knob carries role="meter" and is named by the tile's label (aria-labelledby): "the name underneath".
const meter = (page: Page, name: Dial) => card(page).getByRole("meter", { name, exact: true });
// `has` is queried inside the tile, so the inner locator must not start from the card again.
const tileOf = (page: Page, name: Dial) => tiles(page).filter({ has: page.getByRole("meter", { name, exact: true }) });
const tab = (page: Page, period: Period) => card(page).getByRole("tab", { name: TABS[period], exact: true });
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** The needle's rotation in degrees (the indicator is the only part of the knob that turns). */
const needle = (dial: Locator) =>
  dial.locator(".nt-dial-turn").evaluate((node) => {
    const transform = getComputedStyle(node).transform;
    if (transform === "none") return 0;
    const matrix = new DOMMatrix(transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  });
/** Where the needle points for `value` on a 0..max scale: the dial sweeps 270° from -135°. */
const angleOf = (value: number, max: number) => -135 + (270 * value) / max;
const ANGLE_TOLERANCE = 3;

/** One macrotask in the page without its timers: they may be paused by page.clock. */
const macrotask = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      })
  );

const saved = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400);

async function expectDial(page: Page, name: Dial, expected: { readout: string; line: string; valueText: string }) {
  const dial = meter(page, name);
  await expect(dial).toHaveAttribute("aria-valuetext", expected.valueText);
  await expect(dial.locator(".nt-dial-readout")).toHaveText(expected.readout);
  await expect(tileOf(page, name).getByText(expected.line, { exact: true })).toBeVisible();
}

/**
 * A tab change starts a glide, a digit roll and a 150 ms colour fade of the ticks; the tests that read the resting
 * state wait until the value text is the new one and the needle and the digits have stopped changing.
 */
async function atRest(dial: Locator, expected: { readout: string; valueText: string }) {
  await expect(dial).toHaveAttribute("aria-valuetext", expected.valueText);
  let last = "";
  await expect
    .poll(async () => {
      const now = `${await needle(dial)}|${await dial.locator(".nt-dial-readout").textContent()}`;
      const same = now === last && now.endsWith(`|${expected.readout}`);
      last = now;
      return same;
    })
    .toBe(true);
}

/* ---------- REQ-10: the dependency ---------- */

test("REQ-10: motion is pinned to an exact version", () => {
  const { dependencies } = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
  expect(dependencies.motion).toMatch(/^\d+\.\d+\.\d+$/);
});

/* ---------- REQ-2, REQ-43: read-only meters ---------- */

test("REQ-2, REQ-43: Adherencia, Calorías and Proteína are meters, not sliders, and not keyboard stops", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await open(page);
  await expect(card(page).getByRole("meter")).toHaveCount(3);
  await expect(card(page).getByRole("slider", { name: /^(Adherencia|Calorías|Proteína)$/ })).toHaveCount(0);
  for (const name of DIALS) {
    const dial = meter(page, name);
    await expect(dial).toHaveCount(1);
    expect(await dial.getAttribute("tabindex"), `${name} tabindex`).toBeNull();
  }

  // Tab through the card from the active tab: focus lands on the tabs and on Peso's button, never on a dial.
  await tab(page, "week").focus();
  const stops: string[] = [];
  for (let press = 0; press < 8; press++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      return { inCard: !!el?.closest(".nt-metrics"), dial: !!el?.closest(".nt-dial-knob, [role=meter]"), text: (el?.getAttribute("aria-label") ?? el?.textContent ?? "").slice(0, 30) };
    });
    expect(stop.dial, `Tab press ${press + 1} landed on a dial (${stop.text})`).toBe(false);
    if (stop.inCard) stops.push(stop.text);
  }
  expect(stops.some((text) => text.startsWith("Peso")), `Peso's button is reached (${stops.join(" | ")})`).toBe(true);
});

test("REQ-2: drag, click and wheel change nothing, send no request, and the dial keeps full strength", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await open(page);
  await tab(page, "all").click();
  const requests: string[] = [];
  page.on("request", (request) => ["fetch", "xhr"].includes(request.resourceType()) && requests.push(`${request.method()} ${new URL(request.url()).pathname}`));

  const settled = readouts(25, 32, KCAL);
  for (const name of DIALS) {
    const dial = meter(page, name);
    await expect(dial).toBeVisible();
    await atRest(dial, settled[name]);
    const before = { text: await dial.getAttribute("aria-valuetext"), now: await dial.getAttribute("aria-valuenow"), angle: await needle(dial), readout: await dial.locator(".nt-dial-readout").textContent() };
    const { x, y, width, height } = await box(dial);
    const [cx, cy, radius] = [x + width / 2, y + height / 2, width / 2];
    // A drag along the ring from 12 o'clock round to 9, a click, and a wheel turn with the pointer over the knob.
    await page.mouse.move(cx, cy - radius + 4);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      const turn = (-step * Math.PI) / 8;
      await page.mouse.move(cx + (radius - 4) * Math.sin(turn), cy - (radius - 4) * Math.cos(turn));
    }
    await page.mouse.up();
    await page.mouse.click(cx, cy);
    await page.mouse.wheel(0, 240);
    await page.mouse.wheel(0, -240);
    const after = { text: await dial.getAttribute("aria-valuetext"), now: await dial.getAttribute("aria-valuenow"), angle: await needle(dial), readout: await dial.locator(".nt-dial-readout").textContent() };
    expect(after, name).toEqual(before);
    // Full strength and the normal cursor (REQ-2), not the disabled look and not the grab hand of Peso's dial.
    const look = await dial.evaluate((node) => ({ opacity: getComputedStyle(node.closest(".nt-dial")!).opacity, knobOpacity: getComputedStyle(node).opacity, cursor: getComputedStyle(node).cursor }));
    expect(look, name).toEqual({ opacity: "1", knobOpacity: "1", cursor: "default" });
  }
  expect(requests, "requests sent by dragging, clicking and scrolling").toEqual([]);
});

/* ---------- REQ-3, 4, 5, 43: names, values, lines ---------- */

test("REQ-3, 4, 5, 43: 25 of 32 meals and 1,850 kcal read 78%, ≈ 1,445 and ≈ 88 with their lines and value text", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await open(page);
  await tab(page, "all").click();
  // The spec's literal examples, so a wrong formula cannot hide behind the helper that derives them.
  await expectDial(page, "Adherencia", { readout: "78%", line: "25 de 32 comidas", valueText: "78%, 25 de 32 comidas" });
  await expectDial(page, "Calorías", { readout: "≈ 1,445", line: "meta 1,850 kcal", valueText: "≈ 1,445 kcal, meta 1,850 kcal" });
  await expectDial(page, "Proteína", { readout: "≈ 88", line: "meta 112 g", valueText: "≈ 88 g, meta 112 g" });

  const expected = readouts(25, 32, KCAL);
  for (const name of DIALS) {
    const dial = meter(page, name);
    await atRest(dial, expected[name]);
    // The scale runs from 0 to 100, to the kcal target and to the protein target; the needle shows the unrounded value.
    expect(Number(await dial.getAttribute("aria-valuemin")), `${name} min`).toBe(0);
    expect(Number(await dial.getAttribute("aria-valuemax")), `${name} max`).toBeCloseTo(expected[name].max, 3);
    expect(Math.abs(Number(await dial.getAttribute("aria-valuenow")) - expected[name].value), `${name} now`).toBeLessThanOrEqual(1);
    expect(Math.abs((await needle(dial)) - angleOf(expected[name].value, expected[name].max)), `${name} needle`).toBeLessThanOrEqual(ANGLE_TOLERANCE);

    // The number sits inside the knob; the line and the name sit under the dial; screen readers get the value text only.
    const tile = tileOf(page, name);
    const [dialBox, knob, number, line, label] = [await box(tile.locator(".nt-dial-box")), await box(dial), await box(dial.locator(".nt-dial-digits")), await box(tile.getByText(expected[name].line, { exact: true })), await box(tile.getByText(name, { exact: true }))];
    expect(number.x, `${name} number inside the knob (left)`).toBeGreaterThanOrEqual(knob.x);
    expect(number.x + number.width, `${name} number inside the knob (right)`).toBeLessThanOrEqual(knob.x + knob.width);
    expect(line.y, `${name} line under the dial`).toBeGreaterThanOrEqual(dialBox.y + dialBox.height - 1);
    expect(label.y, `${name} name under the dial`).toBeGreaterThanOrEqual(dialBox.y + dialBox.height - 1);
    await expect(tile.getByText(expected[name].line, { exact: true })).toHaveAttribute("aria-hidden", "true");
    expect(await dial.locator(".nt-dial-readout").evaluate((node) => !!node.closest("[aria-hidden=true]") || !!node.querySelector("[aria-hidden=true]")), `${name} readout hidden from screen readers`).toBe(true);
  }
});

test("REQ-3: marking one more meal done moves Adherencia, Calorías and Proteína without a reload", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await open(page);
  await tab(page, "all").click();
  await expectDial(page, "Adherencia", { readout: "78%", line: "25 de 32 comidas", valueText: "78%, 25 de 32 comidas" });
  // A bare click confirms at once (the way a screen reader presses the button), so no real hold is needed.
  await Promise.all([saved(page), page.locator(".nt-done").dispatchEvent("click")]);
  await expectDial(page, "Adherencia", { readout: "81%", line: "26 de 32 comidas", valueText: "81%, 26 de 32 comidas" });
  const expected = readouts(26, 32, KCAL);
  await expectDial(page, "Calorías", expected.Calorías);
  await expectDial(page, "Proteína", expected.Proteína);
});

test("REQ-3: 1 of 1 meals reads 100% and \"1 de 1 comida\"", async ({ page }) => {
  scenario({ slots: 1, done: [1], kcal: KCAL });
  await open(page);
  await tab(page, "all").click();
  await expectDial(page, "Adherencia", { readout: "100%", line: "1 de 1 comida", valueText: "100%, 1 de 1 comida" });
  await expectDial(page, "Calorías", readouts(1, 1, KCAL).Calorías);
});

/* ---------- REQ-6, 43: no data, no target, nothing done ---------- */

const NO_DATA = { readout: "—", valueText: "Sin datos" };

async function expectNoData(page: Page, name: Dial) {
  const dial = meter(page, name);
  await expect(dial).toHaveAttribute("aria-valuetext", NO_DATA.valueText);
  await expect(dial.locator(".nt-dial-readout")).toHaveText(NO_DATA.readout);
  expect(Number(await dial.getAttribute("aria-valuemin")), `${name} min`).toBe(0);
  expect(Number(await dial.getAttribute("aria-valuemax")), `${name} max`).toBe(100);
  expect(Number(await dial.getAttribute("aria-valuenow")), `${name} now`).toBe(0);
  expect(await needle(dial), `${name} needle rests at 0`).toBeCloseTo(angleOf(0, 100), 0);
}

test("REQ-6, 43: no logs in the period reads \"—\", \"Sin datos\" and rests the needle at 0", async ({ page }) => {
  scenario({ slots: 2, done: [], kcal: KCAL });
  await open(page);
  for (const name of DIALS) await expectNoData(page, name);
});

test("REQ-6, 43: no plan target leaves Calorías and Proteína at \"—\" with no meta line, and Adherencia keeps its value", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: null });
  await open(page);
  await tab(page, "all").click();
  await expectDial(page, "Adherencia", { readout: "78%", line: "25 de 32 comidas", valueText: "78%, 25 de 32 comidas" });
  for (const name of ["Calorías", "Proteína"] as const) {
    await expectNoData(page, name);
    await expect(tileOf(page, name)).not.toContainText("meta");
  }
});

test("REQ-6: logged days with no meal done show zeros, with the meta lines", async ({ page }) => {
  scenario({ slots: 2, done: Array.from({ length: 16 }, () => 0), kcal: KCAL });
  await open(page);
  await tab(page, "all").click();
  await expectDial(page, "Adherencia", { readout: "0%", line: "0 de 32 comidas", valueText: "0%, 0 de 32 comidas" });
  await expectDial(page, "Calorías", { readout: "≈ 0", line: "meta 1,850 kcal", valueText: "≈ 0 kcal, meta 1,850 kcal" });
  await expectDial(page, "Proteína", { readout: "≈ 0", line: "meta 112 g", valueText: "≈ 0 g, meta 112 g" });
  for (const name of DIALS) expect(await needle(meter(page, name)), `${name} needle`).toBeCloseTo(angleOf(0, 100), 0);
});

/* ---------- REQ-7: the tabs and the glide ---------- */

test("REQ-7: all three dials follow Semana, Mes, Año and Histórico", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await open(page);
  for (const period of ["month", "year", "all", "week"] as const) {
    await tab(page, period).click();
    await expect(tab(page, period)).toHaveAttribute("aria-selected", "true");
    const { done, planned } = periodCounts(period, 2, DONE_25_OF_32);
    const expected = readouts(done, planned, KCAL);
    for (const name of DIALS) await expectDial(page, name, expected[name]);
  }
});

/**
 * Opens the dashboard with the page clock installed, then pauses it, so the tests below decide how much time passes.
 * Motion's value animations follow page.clock (plan "Clock check (T003)"); the needle must be one of them.
 */
async function openOnClock(page: Page) {
  await page.clock.install({ time: new Date() });
  await open(page);
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
}

const FRAME_MS = 16;

test("REQ-7: after a tab change the needle glides between the old and the new angle, and has settled after 2 s", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await openOnClock(page);
  const week = periodCounts("week", 2, DONE_25_OF_32);
  const all = periodCounts("all", 2, DONE_25_OF_32);
  const before = readouts(week.done, week.planned, KCAL);
  const after = readouts(all.done, all.planned, KCAL);
  const from: Record<string, number> = {};
  for (const name of DIALS) {
    from[name] = await needle(meter(page, name));
    expect(Math.abs(from[name] - angleOf(before[name].value, before[name].max)), `${name} starts on its value`).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  }

  await tab(page, "all").click();
  for (const name of DIALS) await expect(meter(page, name)).toHaveAttribute("aria-valuetext", after[name].valueText);
  await macrotask(page);
  await page.clock.runFor(FRAME_MS + 100);
  for (const name of DIALS) {
    const target = angleOf(after[name].value, after[name].max);
    expect(Math.abs(target - from[name]), `${name} has somewhere to glide`).toBeGreaterThan(10);
    const sampled = await needle(meter(page, name));
    expect(sampled, `${name} after ~100 ms is past its start`).toBeGreaterThan(Math.min(from[name], target));
    expect(sampled, `${name} after ~100 ms has not arrived`).toBeLessThan(Math.max(from[name], target));
    // Strictly between, on the way: the distance to the start and to the target are both still open.
    expect(Math.abs(sampled - from[name]), `${name} moved`).toBeGreaterThan(0.5);
    expect(Math.abs(sampled - target), `${name} is still travelling`).toBeGreaterThan(0.5);
  }
  await page.clock.runFor(2_000);
  for (const name of DIALS) expect(Math.abs((await needle(meter(page, name))) - angleOf(after[name].value, after[name].max)), `${name} settled`).toBeLessThanOrEqual(ANGLE_TOLERANCE);
});

test("REQ-7: under reduced motion the needle is on the new value after one frame", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openOnClock(page);
  const all = periodCounts("all", 2, DONE_25_OF_32);
  const after = readouts(all.done, all.planned, KCAL);
  await tab(page, "all").click();
  for (const name of DIALS) await expect(meter(page, name)).toHaveAttribute("aria-valuetext", after[name].valueText);
  await macrotask(page);
  await page.clock.runFor(FRAME_MS + 4);
  for (const name of DIALS) expect(Math.abs((await needle(meter(page, name))) - angleOf(after[name].value, after[name].max)), `${name} is already there`).toBeLessThanOrEqual(ANGLE_TOLERANCE);
});

test("first render: the needles already sit on their values, with no entrance animation", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await openOnClock(page);
  const week = periodCounts("week", 2, DONE_25_OF_32);
  const expected = readouts(week.done, week.planned, KCAL);
  for (const name of DIALS) expect(Math.abs((await needle(meter(page, name))) - angleOf(expected[name].value, expected[name].max)), `${name} at rest on load`).toBeLessThanOrEqual(ANGLE_TOLERANCE);
});

/* ---------- REQ-8: end labels ---------- */

// The rule is dial-logic's showEndLabels(D, longest label): the dial must reach END_LABEL_MIN_D and the label must fit.
const endLabelCases = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 900 },
  { width: 938, height: 780 },
  { width: 937, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

test("REQ-8: end labels show only on dials that reach the plan's threshold, and then read 0 and the maximum", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  const longest: Record<Dial, number> = { Adherencia: "100".length, Calorías: whole(KCAL).length, Proteína: whole(PROTEIN_GOAL).length };
  const seen = new Set<boolean>();
  for (const size of endLabelCases) {
    await open(page, size);
    for (const name of DIALS) {
      const tile = tileOf(page, name);
      const dialSize = (await box(tile.locator(".nt-dial-box"))).width;
      const wanted = showEndLabels(dialSize, longest[name]);
      seen.add(wanted);
      const labels = tile.locator(".nt-dial-end");
      await expect(labels, `${name} at ${size.width}×${size.height}, dial ${dialSize.toFixed(1)}px (threshold ${END_LABEL_MIN_D})`).toHaveCount(wanted ? 2 : 0);
      if (wanted) {
        const [first, last] = await labels.allTextContents();
        expect(first).toBe("0");
        expect(Number(last.replace(/,/g, "")), `${name} maximum at ${size.width}×${size.height}`).toBeCloseTo(name === "Proteína" ? Math.round(PROTEIN_GOAL) : name === "Calorías" ? KCAL : 100, 0);
      }
    }
  }
  // The sizes above must exercise both sides of the threshold, or the test would prove nothing.
  expect([...seen].sort(), "some size shows labels and some does not").toEqual([false, true]);
});

/* ---------- REQ-1, 44: colours ---------- */

type Paint = { lit: string; unlit: string; knob: string; line: string; indicator: string; readout: string; end: string | null; all: string[] };

const paintOf = (tile: Locator): Promise<Paint> =>
  tile.evaluate((root) => {
    const style = (element: Element | null, property: string) => (element ? getComputedStyle(element).getPropertyValue(property) : "");
    const lit = [...root.querySelectorAll(".nt-dial-tick.is-lit")].at(-1) ?? null;
    return {
      lit: style(lit, "stroke"),
      unlit: style(root.querySelector(".nt-dial-tick:not(.is-lit)"), "stroke"),
      knob: style(root.querySelector(".nt-dial-knob"), "background-color"),
      line: style(root.querySelector(".nt-dial-knob"), "border-top-color"),
      indicator: style(root.querySelector(".nt-dial-indicator"), "background-color"),
      readout: style(root.querySelector(".nt-dial-readout"), "color"),
      end: root.querySelector(".nt-dial-end") ? style(root.querySelector(".nt-dial-end"), "color") : null,
      all: [root, ...root.querySelectorAll("*")].flatMap((element) => {
        const computed = getComputedStyle(element);
        return [computed.color, computed.backgroundColor, computed.borderTopColor, computed.stroke, computed.fill, computed.outlineColor, computed.boxShadow];
      })
    };
  });

const token = (page: Page, name: string) => page.evaluate((property) => getComputedStyle(document.querySelector(".nt-metrics")!).getPropertyValue(property).trim(), name);
const accents: Record<Dial, string> = { Adherencia: "--nt-yellow-accent", Calorías: "--nt-sky-accent", Proteína: "--nt-dial-white" };

for (const theme of ["light", "dark"] as Theme[]) {
  test(`REQ-1, 44: fill, ticks, knob, text and end labels are token colours with enough contrast, ${theme} theme`, async ({ page }) => {
    scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
    await seedTheme(page, theme);
    // 1920×1080 is the size whose dials show their end labels.
    await open(page, { width: 1920, height: 1080 });
    await tab(page, "all").click();
    for (const name of DIALS) await atRest(meter(page, name), readouts(25, 32, KCAL)[name]);
    const rgb = async (name: string) => toRgb(page, await token(page, name));
    for (const name of DIALS) {
      const tile = tileOf(page, name);
      const paint = await paintOf(tile);
      expect(paint.end, `${name} shows its end labels here`).not.toBeNull();
      // Every colour the dial draws: none is a stock Tailwind zinc or orange (those are authored as oklch).
      expect(paint.all.filter((value) => value.includes("oklch(")), `${name} stock colours`).toEqual([]);
      expect(await toRgb(page, paint.lit), `${name} lit ticks`).toEqual(await rgb(accents[name]));
      expect(await toRgb(page, paint.indicator), `${name} indicator`).toEqual(await rgb(accents[name]));
      expect(await toRgb(page, paint.unlit), `${name} unlit ticks`).toEqual(await rgb("--nt-dial-tick"));
      expect(await toRgb(page, paint.knob), `${name} knob`).toEqual(await rgb("--nt-dial-knob"));
      expect(await toRgb(page, paint.line), `${name} knob outline`).toEqual(await rgb("--nt-dial-line"));
      expect(await toRgb(page, paint.readout), `${name} readout`).toEqual(await rgb("--nt-dial-white"));
      expect(await toRgb(page, paint.end!), `${name} end labels`).toEqual(await rgb("--nt-muted-on-ink"));

      // REQ-44: graphics 3:1 and text 4.5:1 against what they sit on.
      const [onTile, onKnob] = [await effectiveBackground(tile), await effectiveBackground(meter(page, name))];
      expect(contrast(await toRgb(page, paint.lit), onTile), `${name} fill`).toBeGreaterThanOrEqual(3);
      expect(contrast(await toRgb(page, paint.unlit), onTile), `${name} unlit ticks`).toBeGreaterThanOrEqual(3);
      expect(contrast(await toRgb(page, paint.line), onTile), `${name} knob outline`).toBeGreaterThanOrEqual(3);
      expect(contrast(await toRgb(page, paint.indicator), onKnob), `${name} indicator`).toBeGreaterThanOrEqual(3);
      expect(contrast(await toRgb(page, paint.readout), onKnob), `${name} readout text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(await toRgb(page, paint.end!), onTile), `${name} end labels`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("REQ-1: switching the theme leaves the dial colours unchanged (the card is black in both)", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  await seedTheme(page, "light");
  await open(page, { width: 1920, height: 1080 });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const collect = async () => {
    const paints: Record<string, Pick<Paint, "lit" | "unlit" | "knob" | "line" | "indicator" | "readout" | "end">> = {};
    for (const name of DIALS) {
      const paint = await paintOf(tileOf(page, name));
      paints[name] = { lit: paint.lit, unlit: paint.unlit, knob: paint.knob, line: paint.line, indicator: paint.indicator, readout: paint.readout, end: paint.end };
    }
    return paints;
  };
  const light = await collect();
  await page.locator(".nt-sidebar .theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await collect()).toEqual(light);
});

/* ---------- REQ-9, 45: layout ---------- */

// Dial sizes of plan "Chosen (T006)" (D in px, from "Measured, option (c)"); the compact ones come from min(140px, 100cqi - 16px).
const sizes = [
  { width: 1440, height: 900, dial: 76 },
  { width: 1440, height: 780, dial: 73 },
  { width: 1280, height: 768, dial: 61 },
  { width: 1920, height: 1080, dial: 153 },
  { width: 1920, height: 800, dial: 93 },
  { width: 390, height: 844, dial: 113 },
  { width: 360, height: 800, dial: 98 },
  { width: 937, height: 800, dial: 140 }
];
const DIAL_TOLERANCE = 4;
const FONT_TOLERANCE = 1.5;

test("REQ-9: three equal dials at the planned sizes, each number inside its knob at the planned font, never below 10px", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  // The longest unitless readout of each dial: "100%", "≈ " + target, "≈ " + target.
  const longest: Record<Dial, number> = { Adherencia: 4, Calorías: `≈ ${whole(KCAL)}`.length, Proteína: `≈ ${whole(PROTEIN_GOAL)}`.length };
  for (const size of sizes) {
    await open(page, size);
    const at = `${size.width}×${size.height}`;
    const dials = await Promise.all(DIALS.map(async (name) => ({ name, box: await box(tileOf(page, name).locator(".nt-dial-box")) })));
    for (const dial of dials) {
      expect(dial.box.width, `${dial.name} is square at ${at}`).toBeCloseTo(dial.box.height, 0);
      expect(Math.abs(dial.box.width - size.dial), `${dial.name} dial size at ${at} (plan: ${size.dial}px)`).toBeLessThanOrEqual(DIAL_TOLERANCE);
      expect(dial.box.width, `${dial.name} equals Adherencia at ${at}`).toBeCloseTo(dials[0].box.width, 0);
      const readout = meter(page, dial.name).locator(".nt-dial-readout");
      const font = Number((await readout.evaluate((node) => getComputedStyle(node).fontSize)).replace("px", ""));
      expect(font, `${dial.name} font at ${at}`).toBeGreaterThanOrEqual(F_MIN);
      expect(Math.abs(font - inKnobFont(dial.box.width, longest[dial.name])), `${dial.name} font follows the plan's rule at ${at}`).toBeLessThanOrEqual(FONT_TOLERANCE);
      const [knob, number] = [await box(meter(page, dial.name)), await box(readout.locator(".nt-dial-digits"))];
      expect(number.x, `${dial.name} number inside the knob at ${at}`).toBeGreaterThanOrEqual(knob.x);
      expect(number.x + number.width, `${dial.name} number inside the knob at ${at}`).toBeLessThanOrEqual(knob.x + knob.width);
    }
  }
});

const noScroll = (page: Page) => page.evaluate(() => ({ vertical: document.documentElement.scrollHeight - innerHeight, horizontal: document.documentElement.scrollWidth - innerWidth }));

test("REQ-9: with data the page does not scroll and no card is clipped at the five window sizes", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  for (const size of sizes.slice(0, 5)) {
    await open(page, size);
    await tab(page, "all").click();
    const at = `${size.width}×${size.height}`;
    const scroll = await noScroll(page);
    expect(scroll.vertical, `vertical page scroll at ${at}`).toBeLessThanOrEqual(0);
    expect(scroll.horizontal, `horizontal page scroll at ${at}`).toBeLessThanOrEqual(0);
    const clipped = await page.locator(".nt-kpi, .nt-metrics, .nt-gauges > *, .nt-cal, .nt-comp, .nt-prep").evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).map((node) => `${node.className}: ${node.scrollHeight} > ${node.clientHeight}`)
    );
    expect(clipped, `cards whose content is cut at ${at}`).toEqual([]);
  }
});

const columnsAndRows = (page: Page) =>
  tiles(page).evaluateAll((nodes) => {
    const rects = nodes.map((node) => node.getBoundingClientRect());
    return { count: nodes.length, columns: new Set(rects.map((rect) => Math.round(rect.x))).size, rows: new Set(rects.map((rect) => Math.round(rect.y))).size };
  });

test("REQ-9, 45: 937px and below is a 2×2 grid, 938px is four across, 360px does not scroll sideways", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  for (const [size, layout] of [
    [{ width: 390, height: 844 }, { count: 4, columns: 2, rows: 2 }],
    [{ width: 937, height: 800 }, { count: 4, columns: 2, rows: 2 }],
    [{ width: 938, height: 780 }, { count: 4, columns: 4, rows: 1 }],
    [{ width: 1024, height: 900 }, { count: 4, columns: 4, rows: 1 }],
    [{ width: 360, height: 800 }, { count: 4, columns: 2, rows: 2 }]
  ] as const) {
    await open(page, size);
    const at = `${size.width}×${size.height}`;
    expect(await columnsAndRows(page), `tile grid at ${at}`).toEqual(layout);
    expect((await noScroll(page)).horizontal, `horizontal page scroll at ${at}`).toBeLessThanOrEqual(0);
  }
});

test("REQ-45: 720×450 and 844×390 reflow into the compact grid and scroll only vertically", async ({ page }) => {
  scenario({ slots: 2, done: DONE_25_OF_32, kcal: KCAL });
  for (const size of [{ width: 720, height: 450 }, { width: 844, height: 390 }]) {
    await open(page, size);
    const at = `${size.width}×${size.height}`;
    expect(await columnsAndRows(page), `tile grid at ${at}`).toEqual({ count: 4, columns: 2, rows: 2 });
    expect((await noScroll(page)).horizontal, `horizontal page scroll at ${at}`).toBeLessThanOrEqual(0);
    await expect(card(page).getByRole("meter")).toHaveCount(3);
  }
});

test("REQ-45: \"≈ 12,345 kcal\" shows in full, without clipping or overlap, at 360px and at 938px", async ({ page }) => {
  // Every meal done on every day, so the estimate equals the target: readout "≈ 12,345", line "meta 12,345 kcal".
  scenario({ slots: 2, done: Array.from({ length: 16 }, () => 2), kcal: 12_345 });
  for (const size of [{ width: 360, height: 800 }, { width: 938, height: 780 }, { width: 1280, height: 768 }]) {
    await open(page, size);
    await tab(page, "all").click();
    const at = `${size.width}×${size.height}`;
    await expectDial(page, "Calorías", { readout: "≈ 12,345", line: "meta 12,345 kcal", valueText: "≈ 12,345 kcal, meta 12,345 kcal" });
    const tile = tileOf(page, "Calorías");
    const [tileBox, dialBox, knob, number, line] = [await box(tile), await box(tile.locator(".nt-dial-box")), await box(meter(page, "Calorías")), await box(meter(page, "Calorías").locator(".nt-dial-digits")), await box(tile.getByText("meta 12,345 kcal", { exact: true }))];
    // The number fits its knob and is not squeezed below 10px.
    expect(number.x, `number left of the knob at ${at}`).toBeGreaterThanOrEqual(knob.x);
    expect(number.x + number.width, `number right of the knob at ${at}`).toBeLessThanOrEqual(knob.x + knob.width);
    const font = Number((await meter(page, "Calorías").locator(".nt-dial-readout").evaluate((node) => getComputedStyle(node).fontSize)).replace("px", ""));
    expect(font, `font at ${at}`).toBeGreaterThanOrEqual(F_MIN);
    // The line is whole (not cut by its box), inside the tile, and clear of the dial.
    expect(await tile.getByText("meta 12,345 kcal", { exact: true }).evaluate((node) => node.scrollWidth <= node.clientWidth + 1), `line not truncated at ${at}`).toBe(true);
    expect(line.x, `line inside the tile (left) at ${at}`).toBeGreaterThanOrEqual(tileBox.x);
    expect(line.x + line.width, `line inside the tile (right) at ${at}`).toBeLessThanOrEqual(tileBox.x + tileBox.width);
    expect(line.y, `line clear of the dial at ${at}`).toBeGreaterThanOrEqual(dialBox.y + dialBox.height - 1);
    expect(dialBox.x, `dial inside the tile at ${at}`).toBeGreaterThanOrEqual(tileBox.x);
    expect(dialBox.x + dialBox.width, `dial inside the tile at ${at}`).toBeLessThanOrEqual(tileBox.x + tileBox.width);
    expect((await noScroll(page)).horizontal, `horizontal page scroll at ${at}`).toBeLessThanOrEqual(0);
  }
});
