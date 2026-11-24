// A start that fails because the registry needs a sign-in offers the fix, asks first, and says it worked.
// Uses the preview's fake backend (?ecrfail=1, a made-up account); no real aws or docker login runs.
import { createRequire } from "node:module";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");
const require = createRequire(import.meta.url);
const engine = require("playwright")[process.env.PW_ENGINE || "chromium"];
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await engine.launch();
const p = await browser.newPage({ viewport: { width: 980, height: 700 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${HOST}/?scenario=running&ecrfail=1#/containers`);
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
const drawer = p.getByRole("dialog", { name: "Start a Compose project" });
await drawer.waitFor({ timeout: 3000 });

await drawer.getByRole("button", { name: "Start orders-api" }).click();
const sign = drawer.getByRole("button", { name: "Sign in to AWS registry" });
await sign.waitFor({ timeout: 5000 }).catch(() => {});
check(await sign.count() === 1, "a failed start offers Sign in to AWS registry");
check(/needs a sign-in to 123456789012\.dkr\.ecr\.us-west-2\.amazonaws\.com/.test(await drawer.innerText()), "it says which registry needs the sign-in");
const signLine = await drawer.getByText(/needs a sign-in to/).first().boundingBox({ timeout: 1000 }).catch(() => null);
const banner = await drawer.getByText(/Docker couldn't start orders-api/).first().boundingBox({ timeout: 1000 }).catch(() => null);
check(signLine && banner && signLine.y < banner.y, "the sign-in line sits directly above the failure banner");

await sign.click();
const ask = p.getByRole("alertdialog");
await ask.waitFor({ timeout: 3000 }).catch(() => {});
const words = await ask.innerText().catch(() => "");
check(/aws ecr get-login-password --region us-west-2 .*\| docker login --username AWS --password-stdin 123456789012/.test(words), "the dialog shows the exact command it will run");
check(/about 12 hours/.test(words), "the dialog says Docker keeps the login for about 12 hours");
check(await p.evaluate(() => !(window.__calls ?? []).includes("registry_login")), "nothing ran before the answer");

await ask.getByRole("button", { name: "Sign in" }).click();
await p.getByText("Signed in. Start it again.").waitFor({ timeout: 5000 }).catch(() => {});
check(await p.getByText("Signed in. Start it again.").count() === 1, "after the sign-in it says: Signed in. Start it again.");
check(await p.evaluate(() => (window.__calls ?? []).includes("registry_login")), "registry_login ran once confirmed");

await drawer.getByRole("button", { name: "Start orders-api" }).click();
await p.waitForTimeout(1200);
check(await drawer.getByRole("button", { name: "Sign in to AWS registry" }).count() === 0, "starting again no longer asks for a sign-in");
check(errors.length === 0, `no page errors ${errors.join("; ")}`);

await browser.close();
console.log(failed ? `${failed} FAIL` : "all ok");
process.exit(failed ? 1 : 0);
