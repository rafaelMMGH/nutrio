import { sql } from "./database";
import type { Locator } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { dynamicMasks, inScopePages, lightLockedPages, seedTheme } from "./theme-helpers";

// REQ-11, REQ-14: the light theme looks like the baseline captured before the theme work. The snapshots are
// local only (tests/e2e/*-snapshots is gitignored: they contain personal data). The "a-" prefix runs this file
// before dashboard.spec.ts changes the data.

// The baseline PNGs are macOS renders and gitignored, so CI (Linux, no snapshots) cannot compare against them.
test.skip(!!process.env.CI, "visual baselines exist only on the local macOS machine");

const shot = { maxDiffPixelRatio: 0.01, stylePath: "./tests/e2e/screenshot.css", fullPage: true } as const;
const slug = (name: string) => name.replace(/\s+/g, "-");

// The cart snapshot must not depend on the cloned real cart, so its items are replaced by fixed ones for the shot.
const fixedCartItems = [
  ["Jitomate", 6, "pieza"],
  ["Pechuga de pollo", 500, "g"],
  ["Aguacate", 3, "pieza"],
  ["Avena", 400, "g"],
  ["Huevo", 12, "pieza"],
  ["Leche descremada", 1, "l"]
] as const;

async function withFixedCart(shoot: () => Promise<void>) {
  const userId = sql("select id from users order by seq limit 1");
  const cartId = sql(`select id from carts where user_id = '${userId}' and status = 'active' and deleted_at is null order by seq limit 1`);
  if (!cartId) throw new Error("The e2e database has no active cart to seed");
  const live = sql(`select coalesce(string_agg(id, ','), '') from cart_items where cart_id = '${cartId}' and deleted_at is null`);
  const liveIds = live ? live.split(",") : [];
  const liveList = `array[${liveIds.map((id) => `'${id}'`).join(",")}]::text[]`;
  let failure: unknown;
  try {
    sql(`update cart_items set deleted_at = now() where id = any(${liveList})`);
    fixedCartItems.forEach(([name, quantity, unit], index) => {
      sql(
        `insert into cart_items (id, cart_id, source_type, quantity_multiplier, period_days, training_days, selected_alternatives, include_add_ons, include_supplements, manual_name, manual_quantity, manual_unit, created_at, updated_at) ` +
          `values ('e2e-cart-item-${String(index + 1).padStart(2, "0")}', '${cartId}', 'manual', 1, 0, 0, '{}'::json, false, false, '${name}', ${quantity}, '${unit}', now(), now())`
      );
    });
    await shoot();
  } catch (error) {
    failure = error;
  }
  // A failing restore must not hide the test's own failure, so both are reported together.
  try {
    sql(`delete from cart_items where id like 'e2e-cart-item-%'`);
    sql(`update cart_items set deleted_at = null where id = any(${liveList})`);
    const restored = Number(sql(`select count(*) from cart_items where cart_id = '${cartId}' and deleted_at is null`));
    if (restored !== liveIds.length) throw new Error(`Cart restore mismatch: expected ${liveIds.length} live items, found ${restored}`);
  } catch (restoreError) {
    if (failure === undefined) throw restoreError;
    const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
    throw new Error(`${message(failure)}\n\nAlso, the cart restore failed: ${message(restoreError)}`, { cause: failure });
  }
  if (failure !== undefined) throw failure;
}

test.describe("signed in, light", () => {
  test.use({ colorScheme: "light" });

  for (const { name, path } of inScopePages) {
    test(`${name} looks as it did`, async ({ page }) => {
      const look = async (extraMasks: Locator[] = []) => {
        await page.goto(path());
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${slug(name)}.png`, { ...shot, mask: [...dynamicMasks(page), ...extraMasks] });
      };
      if (name === "cart") {
        // Today's date changes between runs; the whole title block is masked because the date text sets its width.
        await withFixedCart(() => look([page.locator(".groceries-stack > .order-card").first().locator(".order-head > div").first()]));
      } else {
        await look();
      }
    });
  }
});

// REQ-14: the locked pages are the same pixels whether nothing is stored (light OS), dark is stored, or the OS is dark.
const lockScenarios = [
  { label: "light OS, nothing stored", os: "light", stored: null },
  { label: "stored dark, light OS", os: "light", stored: "dark" },
  { label: "nothing stored, dark OS", os: "dark", stored: null }
] as const;

test.describe("signed out, light", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const { label, os, stored } of lockScenarios) {
    for (const { name, path } of lightLockedPages) {
      test.describe(`${name}, ${label}`, () => {
        // An unmatched URL answers 404, which the browser logs as a console error.
        test.use({ colorScheme: os, expectedIssues: expectIssues(...(path === "/no-existe" ? [/Failed to load resource.*404/] : [])) });

        test("looks as it did", async ({ page }) => {
          await seedTheme(page, stored);
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot(`public-${slug(name)}.png`, shot);
        });
      });
    }
  }

  // /login follows the theme (REQ-15), so it is not a locked page; its light look is what must not change (REQ-11).
  test.describe("login, light OS, nothing stored", () => {
    test.use({ colorScheme: "light" });

    test("looks as it did", async ({ page }) => {
      await seedTheme(page, null);
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      // The pointer stays at 0,0 so the floaters' parallax does not move.
      await expect(page).toHaveScreenshot("public-login.png", shot);
    });
  });
});
