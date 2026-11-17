// A fresh load of any page stays on that page (regression: every page bounced to #/containers on startup).
// Run: npm run preview, then node scripts/check-routes.mjs
import { open, check, done } from "./lib/check.mjs";

// Kubernetes is checked in a scenario where it is on; with it off the app moves to Containers on purpose.
for (const [scenario, route] of [["running", "#/images"], ["running", "#/volumes"], ["running", "#/networks"], ["k8spods", "#/kubernetes"], ["running", "#/doctor"], ["running", "#/settings"]]) {
  const page = await open(`/?scenario=${scenario}${route}`);
  await page.waitForTimeout(1500);
  const hash = new URL(page.url()).hash;
  check(hash.startsWith(route), `a fresh load of ${route} stays there (ended at ${hash})`);
  await page.close();
}
await done();
