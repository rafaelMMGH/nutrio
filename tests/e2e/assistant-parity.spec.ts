import { DEFAULT_MEALS } from "../shared/assistant-fixture";
import { PARITY_EXPECTED as expected, PARITY_LOGS, PARITY_TODAY, PARITY_WEIGHT_GOAL } from "../shared/progress-fixture";
import { chatUserId, createChatUser, deleteChatUser, expect, seedLogs, seedPlan, setGoals, test } from "./assistant-helpers";

// REQ-16: the weekly numbers of the chat and the dashboard are the same. This file starts with the dashboard baseline
// (T066): the tiles must show the hand-computed numbers of tests/shared/progress-fixture.ts, before and after the
// dashboard moves to src/lib/progress.ts (T038). The chat side is added to this file by later tasks.

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  createChatUser("parity");
});
test.afterAll(() => deleteChatUser());

// The dashboard reads "today" from the browser clock in the browser's time zone (x-e2e-today only reaches the chat).
// Noon in Mexico City keeps the same calendar day in any time zone close to it.
const TIMEZONE = "America/Mexico_City";
test.use({ timezoneId: TIMEZONE });

// The fixture names meals by position (m1 is the first slot); the dashboard knows them by their meal type ids.
const seededId = (id: string) => {
  const position = DEFAULT_MEALS.findIndex((_, index) => id === `m${index + 1}`);
  return position === -1 ? id : `${chatUserId()}-plan-v1-meal-${position}`;
};

// The dashboard's own formats (DashboardView.tsx liters() and kg()).
const liters = (value: number) => value.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const kg = (value: number) => value.toLocaleString("es-MX", { maximumFractionDigits: 1 });

test("dashboard tiles show the REQ-16 fixture numbers on the pinned day", async ({ chat }) => {
  seedPlan({ times: "all", fixture: true });
  seedLogs(PARITY_LOGS.map((log) => ({ ...log, meals_done: log.meals_done?.map(seededId) })));
  setGoals({ weight: PARITY_WEIGHT_GOAL, days: 3 });

  await chat.clock.setFixedTime(new Date(`${PARITY_TODAY}T12:00:00-06:00`));
  await chat.goto("/");
  await expect(chat.locator(".home-strip.is-ready")).toBeVisible();

  await expect(chat.locator(".tone-water .home-tile-value b")).toHaveText(`${liters(expected.weekWaterLiters)} L`);
  await expect(chat.locator(".tone-water .home-tile-value small")).toHaveText(`Meta ${liters(expected.weekWaterGoalLiters)} L`);
  await expect(chat.locator(".tone-meals .home-tile-value b")).toHaveText(`${expected.weekMeals} de ${expected.weekMealsGoal}`);
  await expect(chat.locator(".tone-activity .home-tile-value b")).toHaveText(`${expected.weekExerciseDays} de 3 días`);
  await expect(chat.locator(".tone-weight .home-tile-value b")).toHaveText(`${kg(expected.weight.latest)} kg`);
  await expect(chat.locator(".tone-weight .home-tile-value small")).toHaveText(`Meta ${kg(PARITY_WEIGHT_GOAL)} kg`);
  // The change is -0.4, shown as an absolute value after a minus sign (U+2212).
  await expect(chat.locator(".tone-weight .home-tile-badge")).toHaveText(`−${kg(Math.abs(expected.weight.change))} kg esta semana`);
});
