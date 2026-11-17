// Pull sheet checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");
const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const SHEET = '[role=dialog]';
const RESULTS = '[aria-label="Search results"] [role=row]';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await p.goto(`${HOST}/`);
await p.getByRole("button", { name: "New" }).waitFor();
await p.locator(".sidebar").getByRole("link", { name: "Images", exact: true }).click();
await p.waitForSelector("tbody tr:not(.group-row)");
await p.getByRole("button", { name: "Pull image" }).click();
await p.waitForSelector(SHEET);
const drawer = p.locator(SHEET);

check(await drawer.getByRole("heading", { name: "Pull an image" }).count() + await p.getByRole("dialog", { name: "Pull an image" }).count() >= 1, "pull: the sheet is named Pull an image");
check(await p.getByLabel("Search Docker Hub").count() === 1 && await p.getByLabel("Image to pull").count() === 1, "pull: finding and pulling are two separate fields");
check(/nothing is downloaded/i.test(await drawer.innerText()), "pull: says plainly that searching downloads nothing");

await p.getByLabel("Search Docker Hub").fill("mysql");
await p.getByRole("button", { name: "Search", exact: true }).click();
await p.waitForSelector(RESULTS);
const names = () => p.locator(`${RESULTS} .name`).allInnerTexts();
let order = await names();
check(order[0] === "mysql" && order.includes("bitnami/mysql"), `pull: results default to most stars first (${order.join(", ")})`);
check(await drawer.locator(".chip", { hasText: "Official" }).count() === 1, "pull: the official image carries an Official tag, once");

await drawer.getByRole("button", { name: "Name", exact: true }).click();
order = await names();
check(order[0] === "bitnami/mysql", `pull: sorting by name puts A first (${order.join(", ")})`);

await p.locator(RESULTS, { hasText: "bitnami/mysql" }).click();
check(await p.locator(`${SHEET} [role=row][aria-selected="true"]`).count() === 1, "pull: the chosen result is highlighted");
check(await p.getByLabel("Image to pull").inputValue() === "bitnami/mysql", "pull: choosing a result fills the image to pull");
check(await p.getByRole("button", { name: "Pull bitnami/mysql" }).count() === 1, "pull: the Pull button names what it will download");
check(await drawer.locator("button.bg-accent").count() === 1, "pull: only one primary button");

await p.getByRole("button", { name: "Pull bitnami/mysql" }).click();
await p.waitForSelector(`${SHEET} progress`, { timeout: 5000 }).catch(() => {});
check(await drawer.locator('progress[aria-label="Pull progress"]').count() === 1, "pull: progress is shown in a progress element");
await p.waitForSelector("text=Pulled bitnami/mysql", { timeout: 8000 }).catch(() => {});
check(await drawer.getByRole("button", { name: /^Run bitnami\/mysql/ }).count() === 1, "pull: Run is offered once pulled");
await p.screenshot({ path: "/tmp/pull-after.png" });

// Private registry mode
const mode = (n) => drawer.getByRole("button", { name: n, exact: true });
check(await mode("Docker Hub").getAttribute("aria-pressed") === "true" && await mode("Other registry").getAttribute("aria-pressed") === "false", "private: Docker Hub is the mode you start in");
await mode("Other registry").click();
check(await mode("Other registry").getAttribute("aria-pressed") === "true", "private: switching modes marks the new mode");
check(await p.getByLabel("Registry host").count() === 1 && await p.getByLabel("Image path").count() === 1 && await p.getByLabel("Tag").count() === 1, "private: shows host, path and tag fields");
check(await p.getByLabel("Search Docker Hub").count() === 0 && await p.getByLabel("Image to pull").count() === 0, "private: Docker Hub search is hidden in this mode");
check(await p.getByLabel("Tag").inputValue() === "latest", "private: the tag starts as latest");
check(await drawer.locator("button.bg-accent").count() === 1 && await drawer.locator("button.bg-accent").isDisabled(), "private: one primary button, off until the reference is valid");
check(/docker login <registry>/.test(await drawer.locator(".cmd code").innerText()) && /sign in first/i.test(await drawer.innerText()), "private: says up front that private images need docker login");

await drawer.getByRole("button", { name: "GitHub (ghcr.io)" }).click();
check(await p.getByLabel("Registry host").inputValue() === "ghcr.io", "private: the GitHub preset fills the host");
check(/docker login ghcr\.io$/.test(await drawer.locator(".cmd code").innerText()), "private: the login command uses the chosen host");
await drawer.getByRole("button", { name: "AWS ECR" }).click();
check(/Replace <account> and <region>/.test(await drawer.innerText()) && await drawer.locator("button.bg-accent").isDisabled(), "private: an unfilled ECR host is refused with a reason");
await p.getByLabel("Registry host").fill("ghcr.io");
await p.getByLabel("Image path").fill("acme/api");
await p.getByLabel("Tag").fill("1.4");
check(await drawer.locator("code", { hasText: "ghcr.io/acme/api:1.4" }).count() === 1, "private: shows the full reference it will pull");
check(await p.getByRole("button", { name: "Pull ghcr.io/acme/api:1.4" }).count() === 1, "private: the Pull button names the reference");

await p.getByRole("button", { name: "Pull ghcr.io/acme/api:1.4" }).click();
await p.waitForSelector("text=Pulled ghcr.io/acme/api:1.4", { timeout: 8000 }).catch(() => {});
check(await drawer.locator("p.hint", { hasText: "Pulled ghcr.io/acme/api:1.4" }).count() === 1, "private: a successful private pull is reported");
check(await drawer.getByRole("button", { name: /^Run ghcr\.io\/acme\/api:1\.4/ }).count() === 1, "private: Run is offered after a private pull");

await p.getByLabel("Image path").fill("acme/private");
await p.getByLabel("Tag").fill("1");
await p.getByRole("button", { name: "Pull ghcr.io/acme/private:1" }).click();
await p.waitForSelector("text=Sign in to ghcr.io first", { timeout: 8000 }).catch(() => {});
check(await drawer.getByText("Sign in to ghcr.io first", { exact: true }).count() === 1, "private: an unauthorized pull says to sign in to that host, and the raw error is not the headline");
check(await drawer.locator(".cmd code", { hasText: /^docker login ghcr\.io$/ }).count() === 1, "private: the hint shows the login command");
check(await drawer.getByRole("button", { name: "Copy the command" }).count() >= 1, "private: the login command can be copied");
check(await drawer.getByRole("button", { name: "Show output" }).count() === 1 && await drawer.locator('pre[aria-label="Pull output"]').count() === 0, "private: the raw output is folded under Show output");

await mode("Docker Hub").click();
check(await p.getByLabel("Image to pull").count() === 1 && await drawer.getByText("Sign in to ghcr.io first", { exact: true }).count() === 0, "private: going back to Docker Hub clears the sign-in hint");
await p.screenshot({ path: "/tmp/pull-private.png" });

await p.keyboard.press("Escape");
check(await p.locator(SHEET).count() === 0, "pull: Escape closes the sheet when idle");
await browser.close();
process.exit(failed ? 1 : 0);
