import { DEFAULT_MEALS } from "../shared/assistant-fixture";
import { parityLogs } from "../shared/progress-fixture";
import { ask, chatUserId, createChatUser, deleteChatUser, expect, seedLogs, seedPlan, setGoals, test } from "./assistant-helpers";

// REQ-16: the weekly numbers of the chat and the dashboard are the same. This file starts with the dashboard baseline
// (T066): the tiles must show the hand-computed numbers of tests/shared/progress-fixture.ts, before and after the
// dashboard moves to src/lib/progress.ts (T038). The chat side is added to this file by later tasks.

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  createChatUser("parity");
});
test.afterAll(() => deleteChatUser());

// The dashboard reads "today" from the browser clock in the browser's time zone while the server renders the real date,
// so the clock is not pinned (the strip would differ between server and client and fail hydration). The fixture is
// relative to the Monday of the current week in this zone instead: every log sits on Monday, never after today.
const TIMEZONE = "America/Mexico_City";
test.use({ timezoneId: TIMEZONE });

const mexicoCityToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
const dayIndex = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const mondayOf = (key: string) => new Date(Date.parse(`${key}T00:00:00Z`) - dayIndex(key) * 86_400_000).toISOString().slice(0, 10);

// The fixture names meals by position (m1 is the first slot); the dashboard knows them by their meal type ids.
const seededId = (id: string) => {
  const position = DEFAULT_MEALS.findIndex((_, index) => id === `m${index + 1}`);
  return position === -1 ? id : `${chatUserId()}-plan-v1-meal-${position}`;
};

// The dashboard's own formats (DashboardView.tsx liters() and kg()).
const liters = (value: number) => value.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const kg = (value: number) => value.toLocaleString("es-MX", { maximumFractionDigits: 1 });

test("dashboard tiles show the REQ-16 fixture numbers on the current week", async ({ chat }) => {
  const today = mexicoCityToday();
  const { logs, weightGoal, exerciseGoalDays, expected } = parityLogs(mondayOf(today));
  seedPlan({ times: "all", fixture: true });
  seedLogs(logs.map((log) => ({ ...log, meals_done: log.meals_done?.map(seededId) })));
  setGoals({ weight: weightGoal, days: exerciseGoalDays });

  await chat.goto("/");
  await expect(chat.locator(".home-strip.is-ready")).toBeVisible();

  await expect(chat.locator(".tone-water .home-tile-value b")).toHaveText(`${liters(expected.weekWaterLiters)} L`);
  await expect(chat.locator(".tone-water .home-tile-value small")).toHaveText(`Meta ${liters(expected.weekWaterGoalLiters)} L`);
  await expect(chat.locator(".tone-meals .home-tile-value b")).toHaveText(`${expected.weekMeals} de ${expected.weekMealsGoal}`);
  await expect(chat.locator(".tone-activity .home-tile-value b")).toHaveText(`${expected.weekExerciseDays} de ${exerciseGoalDays} días`);
  await expect(chat.locator(".tone-activity li.is-today")).toHaveCount(1);
  await expect(chat.locator(".tone-activity li.is-future")).toHaveCount(6 - dayIndex(today));
  await expect(chat.locator(".tone-weight .home-tile-value b")).toHaveText(`${kg(expected.weight.latest)} kg`);
  await expect(chat.locator(".tone-weight .home-tile-value small")).toHaveText(`Meta ${kg(weightGoal)} kg`);
  // The change is -0.4, shown as an absolute value after a minus sign (U+2212).
  await expect(chat.locator(".tone-weight .home-tile-badge")).toHaveText(`−${kg(Math.abs(expected.weight.change))} kg esta semana`);
});

test("the chat's week water line equals the dashboard tile under the same today", async ({ chatContext }) => {
  const today = mexicoCityToday();
  const { logs, expected } = parityLogs(mondayOf(today));
  seedPlan({ times: "all", fixture: true });
  seedLogs(logs.map((log) => ({ ...log, meals_done: log.meals_done?.map(seededId) })));

  const { body } = await ask(chatContext.request, "¿Cuánta agua llevo?", { today });
  // The chat shows at most one decimal (spec Copy, Numbers); the tile shows up to two.
  const week = Math.round(expected.weekWaterLiters * 10) / 10;
  expect(body.answer).toContain(`: ${week} ${week === 1 ? "litro" : "litros"}.`);
});
