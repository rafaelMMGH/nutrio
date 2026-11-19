import { expect, test as setup } from "@playwright/test";
import { authStatePath, workerBaseUrl, workerCount } from "./database";

// Signs in with the demo account (the login form comes prefilled) once per worker, against that worker's own server and
// database, and saves one session file per worker for the other tests (fixtures.ts picks the file by parallelIndex).
// Sessions live in the database and cookies are not port-scoped, so a shared file would sign in only one worker.
// Never log out in tests: logout deletes the session.
for (let index = 0; index < workerCount(); index++) {
  setup(`sign in with the demo account on worker ${index}`, async ({ page }) => {
    const origin = workerBaseUrl(index);
    await page.goto(`${origin}/login`);
    await page.locator(".login-submit").click();
    await page.waitForURL(`${origin}/`);
    await expect(page.locator(".nt-dash h1")).toHaveText("Dashboard");
    await page.context().storageState({ path: authStatePath(index) });
  });
}
