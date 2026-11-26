import { test, expect } from "@playwright/test";
import { opener } from "./helpers";

test("A fresh load of any page stays on that page (regression: every page bounced to #/containers on startup)", async ({ context }) => {
  const open = opener(context);
  for (const [scenario, route] of [["running", "#/images"], ["running", "#/volumes"], ["running", "#/networks"], ["k8spods", "#/kubernetes"], ["running", "#/doctor"], ["running", "#/settings"]]) {
    const page = await open(`/?scenario=${scenario}${route}`);
    await page.waitForTimeout(1500);
    const hash = new URL(page.url()).hash;
    expect.soft(hash.startsWith(route), `a fresh load of ${route} stays there (ended at ${hash})`).toBeTruthy();
    await page.close();
  }
});
