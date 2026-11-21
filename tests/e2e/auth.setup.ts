import { expect, test as setup } from "@playwright/test";
import { authStatePath, workerBaseUrl, workerCount } from "./database";

// Signs in with the demo account (the login form comes prefilled) once per worker, against that worker's own server and
// database, and saves one session file per worker for the other tests (fixtures.ts picks the file by parallelIndex).
// Sessions live in the database and cookies are not port-scoped, so a shared file would sign in only one worker.
// Never log out in tests: logout deletes the session.
for (let index = 0; index < workerCount(); index++) {
  setup(`sign in with the demo account on worker ${index}`, async ({ page }) => {
    // The first visit compiles /login, /api/auth/login and / from cold; on CI that alone can exceed the 60s default.
    setup.setTimeout(180_000);
    const origin = workerBaseUrl(index);
    await page.goto(`${origin}/login`);
    // The form has no action: clicking before React hydrates submits it natively as a GET to /login?email=...
    // A cold `next dev` (CI) hydrates late, so wait until React has attached its props to the form.
    await page.waitForFunction(() => {
      const form = document.querySelector(".login-form");
      return !!form && Object.keys(form).some((key) => key.startsWith("__reactProps"));
    }, undefined, { timeout: 90_000 });
    await page.locator(".login-submit").click();
    await page.waitForURL(`${origin}/`, { timeout: 90_000 });
    await expect(page.locator(".nt-dash h1")).toHaveText("Dashboard");
    await page.context().storageState({ path: authStatePath(index) });
  });
}
