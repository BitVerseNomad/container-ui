// Pull panel checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await p.goto(`file://${root}/preview/index.html`);
await p.waitForSelector("table.list tbody tr:not(.group-row)");
await p.locator(".sidebar").getByRole("button", { name: "Images", exact: true }).click();
await p.waitForSelector("tbody tr:not(.group-row)");
await p.getByRole("button", { name: "Pull image" }).click();
await p.waitForSelector(".drawer");

check(await p.getByLabel("Search Docker Hub").count() === 1 && await p.getByLabel("Image to pull").count() === 1, "pull: finding and pulling are two separate fields");
check(/nothing is downloaded/i.test(await p.locator(".drawer").innerText()), "pull: says plainly that searching downloads nothing");

await p.getByLabel("Search Docker Hub").fill("mysql");
await p.getByRole("button", { name: "Search", exact: true }).click();
await p.waitForSelector(".hit");
const names = () => p.locator(".hit .hit-name").allInnerTexts().then((a) => a.map((s) => s.replace(/Official/, "").trim()));
let order = await names();
check(order[0] === "mysql" && order.includes("bitnami/mysql"), `pull: results default to most stars first (${order.join(", ")})`);
check(await p.locator(".hit .tag", { hasText: "Official" }).count() === 1, "pull: the official image carries an Official tag");

await p.getByLabel("Sort by").selectOption("name");
order = await names();
check(order[0] === "bitnami/mysql", `pull: sorting by name puts A first (${order.join(", ")})`);

await p.locator(".hit", { hasText: "bitnami/mysql" }).click();
check(await p.locator('.hit[aria-selected="true"]').count() === 1, "pull: the chosen result is highlighted");
check(await p.getByLabel("Image to pull").inputValue() === "bitnami/mysql", "pull: choosing a result fills the image to pull");
check(await p.getByRole("button", { name: "Pull bitnami/mysql" }).count() === 1, "pull: the Pull button names what it will download");
check(await p.locator(".drawer .primary").count() === 1, "pull: only one primary button");

await p.getByRole("button", { name: "Pull bitnami/mysql" }).click();
await p.waitForSelector(".drawer .out-log", { timeout: 5000 }).catch(() => {});
check(await p.locator(".drawer .out-log").count() === 1, "pull: progress is shown");
await p.waitForSelector("text=Pulled bitnami/mysql", { timeout: 8000 }).catch(() => {});
check(await p.locator(".drawer").getByRole("button", { name: /^Run bitnami\/mysql/ }).count() === 1, "pull: Run is offered once pulled");
await p.screenshot({ path: "/tmp/pull-after.png" });

// Private registry mode
const drawer = p.locator(".drawer");
const mode = (n) => drawer.locator(".seg").getByRole("button", { name: n, exact: true });
check(await mode("Docker Hub").getAttribute("aria-pressed") === "true" && await mode("Other registry").getAttribute("aria-pressed") === "false", "private: Docker Hub is the mode you start in");
await mode("Other registry").click();
check(await mode("Other registry").getAttribute("aria-pressed") === "true", "private: switching modes marks the new mode");
check(await p.getByLabel("Registry host").count() === 1 && await p.getByLabel("Image path").count() === 1 && await p.getByLabel("Tag").count() === 1, "private: shows host, path and tag fields");
check(await p.getByLabel("Search Docker Hub").count() === 0 && await p.getByLabel("Image to pull").count() === 0, "private: Docker Hub search is hidden in this mode");
check(await p.getByLabel("Tag").inputValue() === "latest", "private: the tag starts as latest");
check(await drawer.locator(".primary").count() === 1 && await drawer.locator(".primary").isDisabled(), "private: one primary button, off until the reference is valid");
check(/docker login <registry>/.test(await drawer.locator("pre.cmd").innerText()) && /sign in first/i.test(await drawer.innerText()), "private: says up front that private images need docker login");

await drawer.getByRole("button", { name: "GitHub (ghcr.io)" }).click();
check(await p.getByLabel("Registry host").inputValue() === "ghcr.io", "private: the GitHub preset fills the host");
check(/docker login ghcr\.io$/.test(await drawer.locator("pre.cmd").innerText()), "private: the login command uses the chosen host");
await drawer.getByRole("button", { name: "AWS ECR" }).click();
check(/Replace <account> and <region>/.test(await drawer.innerText()) && await drawer.locator(".primary").isDisabled(), "private: an unfilled ECR host is refused with a reason");
await p.getByLabel("Registry host").fill("ghcr.io");
await p.getByLabel("Image path").fill("acme/api");
await p.getByLabel("Tag").fill("1.4");
check(await drawer.locator("code", { hasText: "ghcr.io/acme/api:1.4" }).count() === 1, "private: shows the full reference it will pull");
check(await p.getByRole("button", { name: "Pull ghcr.io/acme/api:1.4" }).count() === 1, "private: the Pull button names the reference");

await p.getByRole("button", { name: "Pull ghcr.io/acme/api:1.4" }).click();
await p.waitForSelector("text=Pulled ghcr.io/acme/api:1.4", { timeout: 8000 }).catch(() => {});
check(await drawer.locator(".ok", { hasText: "Pulled ghcr.io/acme/api:1.4" }).count() === 1, "private: a successful private pull is reported");
check(await drawer.getByRole("button", { name: /^Run ghcr\.io\/acme\/api:1\.4/ }).count() === 1, "private: Run is offered after a private pull");

await p.getByLabel("Image path").fill("acme/private");
await p.getByLabel("Tag").fill("1");
await p.getByRole("button", { name: "Pull ghcr.io/acme/private:1" }).click();
await p.waitForSelector(".problem-line", { timeout: 8000 }).catch(() => {});
const hintText = await drawer.locator(".problem-line").innerText().catch(() => "");
check(/Sign in to ghcr\.io first/.test(hintText), "private: an unauthorized pull says to sign in to that host");
check(/docker login ghcr\.io$/.test(await drawer.locator(".problem-line pre.cmd").innerText().catch(() => "")), "private: the hint shows the login command");
check(await drawer.getByRole("button", { name: "Copy command" }).count() >= 1, "private: the login command can be copied");
check(await drawer.locator(".out-more summary", { hasText: "Show output" }).count() === 1 && await drawer.locator("details.out-more[open]").count() === 0, "private: the raw output is folded under Show output");
check(await drawer.locator(".out-fail").count() === 0, "private: the raw error is not the headline");

await mode("Docker Hub").click();
check(await p.getByLabel("Image to pull").count() === 1 && await drawer.locator(".problem-line").count() === 0, "private: going back to Docker Hub clears the sign-in hint");
await p.screenshot({ path: "/tmp/pull-private.png" });
await browser.close();
process.exit(failed ? 1 : 0);
