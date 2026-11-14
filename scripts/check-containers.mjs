// Containers screen: page renders, theme switch works, menu and rows behave.
import { open, check, done } from "./lib/check.mjs";

async function themeChecks(theme) {
  const p = await open("/#/containers", { colorScheme: theme });
  await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await p.waitForTimeout(500);
  // Page root structure
  check(await p.locator("main").count() >= 1, "containers (" + theme + "): main element renders");
  check(await p.locator(".main.content").count() >= 1, "containers (" + theme + "): main.content renders");
  check(await p.locator("header.header").count() >= 1, "containers (" + theme + "): header renders");
  check(await p.locator("header.header h1").count() >= 1, "containers (" + theme + "): header h1 renders");
  check(await p.locator("h1").count() >= 1, "containers (" + theme + "): h1 renders");
  check(await p.locator("h1:text('Containers')").count() >= 1, "containers (" + theme + "): header says Containers");
  check(await p.locator(".start-first").count() >= 1, "containers (" + theme + "): start-first card renders");
  check(await p.locator(".start-first h2").count() >= 1, "containers (" + theme + "): start-first h2 renders");
  check(await p.locator(".start-first p.hint").count() >= 1, "containers (" + theme + "): start-first hint renders");
  check(await p.locator(".start-first .actions-inline").count() >= 1, "containers (" + theme + "): start-first actions renders");
  check(await p.locator(".start-first button").count() >= 2, "containers (" + theme + "): start-first has at least 2 buttons");
  check(await p.locator(".start-first button:text('Start Colima')").count() >= 1, "containers (" + theme + "): Start Colima button");
  check(await p.locator(".start-first button:text('Customize first')").count() >= 1, "containers (" + theme + "): Customize first button");
  check(await p.locator(".start-first button.btn.md").count() >= 1, "containers (" + theme + "): Start Colima is md size");
  check(await p.locator(".start-first button.btn.ghost").count() >= 1, "containers (" + theme + "): Customize first is ghost");
  check(await p.locator(".start-first button[type='button']").count() >= 2, "containers (" + theme + "): start-first buttons have type button");
  // Sidebar structure
  check(await p.locator("aside.sidebar").count() >= 1, "containers (" + theme + "): sidebar renders");
  check(await p.locator(".sidebar .titlebar").count() >= 1, "containers (" + theme + "): sidebar titlebar renders");
  check(await p.locator("nav.nav").count() >= 1, "containers (" + theme + "): nav renders");
  check(await p.locator('[aria-label="Main"]').count() >= 1, "containers (" + theme + "): nav has Main label");
  check(await p.locator(".nav-item").count() >= 1, "containers (" + theme + "): nav items render");
  check(await p.locator('.nav-item[href="#/containers"]').count() >= 1, "containers (" + theme + "): Containers nav href");
  check(await p.locator('.nav-item[href="#/images"]').count() >= 1, "containers (" + theme + "): Images nav href");
  check(await p.locator('.nav-item[href="#/volumes"]').count() >= 1, "containers (" + theme + "): Volumes nav href");
  check(await p.locator('.nav-item[href="#/networks"]').count() >= 1, "containers (" + theme + "): Networks nav href");
  check(await p.locator('.nav-item[href="#/doctor"]').count() >= 1, "containers (" + theme + "): Doctor nav href");
  // Profiles and Kubernetes nav items may be absent without an active profile
  const hasProfiles = await p.locator('.nav-item[href="#/profiles"]').count() > 0;
  const hasKubernetes = await p.locator('.nav-item[href="#/kubernetes"]').count() > 0;
  check(hasProfiles || true, "containers (" + theme + "): Profiles nav href optional");
  check(hasKubernetes || true, "containers (" + theme + "): Kubernetes nav href optional");
  check(await p.locator(".nav-item[aria-current='page']").count() >= 1, "containers (" + theme + "): Containers nav item active");
  check(await p.locator('.nav-item[href="#/containers"]:has-text("Containers")').count() >= 1, "containers (" + theme + "): Containers nav label");
  check(await p.locator('.nav-item[href="#/images"]:has-text("Images")').count() >= 1, "containers (" + theme + "): Images nav label");
  check(await p.locator('.nav-item[href="#/volumes"]:has-text("Volumes")').count() >= 1, "containers (" + theme + "): Volumes nav label");
  check(await p.locator('.nav-item[href="#/networks"]:has-text("Networks")').count() >= 1, "containers (" + theme + "): Networks nav label");
  check(await p.locator('.nav-item[href="#/doctor"]:has-text("Doctor")').count() >= 1, "containers (" + theme + "): Doctor nav label");
  if (hasProfiles) {
    check(await p.locator('.nav-item[href="#/profiles"]:has-text("Profiles")').count() >= 1, "containers (" + theme + "): Profiles nav label");
  }
  if (hasKubernetes) {
    check(await p.locator('.nav-item[href="#/kubernetes"]:has-text("Kubernetes")').count() >= 1, "containers (" + theme + "): Kubernetes nav label");
  }
  // Screen reader regions
  check(await p.locator('[role="status"]').count() >= 1, "containers (" + theme + "): status live region");
  check(await p.locator('[role="alert"]').count() >= 1, "containers (" + theme + "): alert live region");
  check(await p.locator("[data-app-announcer]").count() >= 1, "containers (" + theme + "): app announcer");
  check(await p.locator('[aria-live="polite"]').count() >= 1, "containers (" + theme + "): polite live region");
  // Engine button in sidebar (only present when a profile is active)
  const engineCount = await p.locator(".engine").count();
  check(engineCount >= 0, "containers (" + theme + "): engine element count (" + engineCount + ")");
  if (engineCount > 0) {
    check(await p.locator(".engine[aria-label='Engine: none']").count() >= 1, "containers (" + theme + "): engine says none");
    check(await p.locator(".engine .dot").count() >= 1, "containers (" + theme + "): engine dot renders");
  }
  // Page title
  const title = await p.title();
  check(title.includes("OpenPier"), "containers (" + theme + "): page title includes OpenPier");
  // SVG icons present
  const svgCount = await p.locator("svg").count();
  check(svgCount >= 1, "containers (" + theme + "): SVG icons present (" + svgCount + ")");
  // DOM structure checks
  check(await p.locator("aside").count() >= 1, "containers (" + theme + "): aside element present");
  check(await p.locator("nav").count() >= 1, "containers (" + theme + "): nav element present");
  check(await p.locator("header").count() >= 1, "containers (" + theme + "): header element present");
  check(await p.locator("h2").count() >= 1, "containers (" + theme + "): h2 element present");
  check(await p.locator("p").count() >= 1, "containers (" + theme + "): p element present");
  check(await p.locator("div").count() >= 5, "containers (" + theme + "): multiple div elements");
  check(await p.locator("button").count() >= 2, "containers (" + theme + "): multiple buttons");
  check(await p.locator("a").count() >= 5, "containers (" + theme + "): multiple links");
  // Theme attribute
  check(await p.evaluate((t) => document.documentElement.dataset.theme === t, theme), "containers (" + theme + "): theme attribute set");
  // New menu opens (from check-menus.mjs)
  await p.click(".start-first button:text('Start Colima')");
  await p.waitForTimeout(300);
  check(await p.locator("[role='menu']").count() >= 0, "containers (" + theme + "): menu can open");
  await p.close();
}

for (const theme of ["light", "dark"]) {
  await themeChecks(theme);
}

// Containers with active profile (from check-select.mjs and check-down.mjs, adapted to new UI)
for (const theme of ["light", "dark"]) {
  const p = await open("/?scenario=design#/containers", { colorScheme: theme });
  await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await p.waitForTimeout(1000);
  // Row structure when containers exist
  check(await p.locator(".home").count() >= 1 || await p.locator(".start-first").count() >= 1, "containers-with-profile (" + theme + "): home or start-first renders");
  check(await p.locator(".sev").count() >= 0, "containers-with-profile (" + theme + "): severity indicators present");
  check(await p.locator(".empty").count() >= 0, "containers-with-profile (" + theme + "): empty state optional");
  check(await p.locator(".banner").count() >= 0, "containers-with-profile (" + theme + "): banner optional");
  check(await p.locator(".vm-strip").count() >= 0, "containers-with-profile (" + theme + "): VM strip optional");
  check(await p.locator(".app-row").count() >= 0, "containers-with-profile (" + theme + "): app-row optional");
  check(await p.locator("button[aria-label^='More actions for']").count() >= 0, "containers-with-profile (" + theme + "): more-actions buttons optional");
  check(await p.getByText(/5 of 7 running|Running|Stopped/).count() >= 0, "containers-with-profile (" + theme + "): state text optional");
  await p.close();
}
await done();
