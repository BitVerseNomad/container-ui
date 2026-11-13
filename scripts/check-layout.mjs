// Layout checks against the preview (WO-2.2). Runs in Chromium and WebKit.
// `npm run check` runs it in both engines; run one with `node scripts/check-layout.mjs` or `PW_ENGINE=webkit node scripts/check-layout.mjs`.
import { engine, open, check, done } from "./lib/check.mjs";

const SIZES = [
  { width: 1180, height: 760 },   // the new default window
  { width: 900, height: 600 },    // the new minimum window
];

for (const { width, height } of SIZES) {
  const page = await open("/?scenario=design#/containers", { width, height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. `.content` exists.
  check(await page.locator(".content").count() > 0, `[${width}x${height}] .content exists`);

  // 2. The last button in the sidebar foot is Fold sidebar; the foot holds Settings, Activity, Help.
  const footLabels = [];
  for (const b of await page.locator(".sidebar-foot button").all()) footLabels.push(await b.getAttribute("aria-label"));
  check(footLabels[footLabels.length - 1] === "Fold sidebar", `[${width}x${height}] the foot ends with Fold sidebar`);
  check(footLabels.includes("Settings") && footLabels.includes("Activity: commands the app ran") && footLabels.includes("Help and shortcuts"),
    `[${width}x${height}] the foot holds Settings, Activity, Help`);

  // 3. Nav order: Containers, Images, Volumes, Networks, Kubernetes, then Doctor in the second nav, no Profiles.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.nav[aria-label="Main"] .nav-item')).some((e) => e.textContent === "Kubernetes"), { timeout: 10000 });
  const mainLabels = (await page.locator('.nav[aria-label="Main"] .nav-item').allInnerTexts()).map((s) => s.trim());
  const healthLabels = (await page.locator('.nav[aria-label="Health"] .nav-item').allInnerTexts()).map((s) => s.trim());
  check(JSON.stringify(mainLabels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Kubernetes"]),
    `[${width}x${height}] main nav order is Containers, Images, Volumes, Networks, Kubernetes`);
  check(healthLabels.includes("Doctor") && !mainLabels.includes("Profiles") && !healthLabels.includes("Profiles"),
    `[${width}x${height}] Doctor is in the second nav and there is no Profiles item`);

  // 4. Clicking every nav item does not scroll the window.
  const allItems = await page.locator(".sidebar .nav-item").count();
  for (let i = 0; i < allItems; i++) {
    await page.locator(".sidebar .nav-item").nth(i).click();
    await page.waitForTimeout(150);
    const scrolled = await page.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
    check(!scrolled, `[${width}x${height}] clicking nav item ${i} does not scroll the window`);
  }

  // 5. At both sizes the Doctor item is inside the viewport and clicking it shows the Doctor page.
  const doctorBox = await page.locator('.nav[aria-label="Health"] .nav-item').boundingBox();
  const vp = await page.evaluate(() => ({ innerHeight: window.innerHeight }));
  check(doctorBox && doctorBox.y < vp.innerHeight && doctorBox.y + doctorBox.height > 0,
    `[${width}x${height}] the Doctor item is inside the viewport`);
  await page.locator('.nav[aria-label="Health"] .nav-item').click();
  await page.waitForTimeout(300);
  check((await page.locator("h1").first().innerText()) === "Doctor", `[${width}x${height}] clicking Doctor shows the Doctor page`);

  // 10. At 900x600 `.content` has no sideways scroll on every page.
  if (width === 900) {
    const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
    check(!sideways, `[${width}x${height}] .content does not scroll sideways`);
  }

  // 11. With ?k8s=off the nav has no Kubernetes item and no page scrolls the window.
  if (width === 1180) {
    const off = await open("/?scenario=design&k8s=off#/containers", { width, height });
    const offLabels = await off.locator(".sidebar .nav-item").allInnerTexts();
    check(!offLabels.includes("Kubernetes"), `[${width}x${height}] without Kubernetes the nav has no Kubernetes item`);
    const offItems = await off.locator(".sidebar .nav-item").count();
    for (let i = 0; i < offItems; i++) {
      await off.locator(".sidebar .nav-item").nth(i).click();
      await off.waitForTimeout(150);
      const scrolled = await off.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
      check(!scrolled, `[${width}x${height}] (k8s off) clicking nav item ${i} does not scroll the window`);
    }
    await off.close();
  }

  // 12. No page errors at either size.
  check(errors.length === 0, `[${width}x${height}] no page errors: ${errors.join(" | ")}`);

  await page.close();
}

await done();
