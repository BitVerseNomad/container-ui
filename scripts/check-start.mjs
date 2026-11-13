// The app opens on Containers, with no Projects item yet, and without page errors.
import { open, check, done } from "./lib/check.mjs";
const p = await open("/?scenario=running");
await p.waitForSelector(".content");
check((await p.locator("h1").first().innerText()) === "Containers", "start: the app opens on Containers");
const nav = await p.locator(".sidebar nav button").allInnerTexts();
check(!nav.some((t) => /Projects/.test(t)), "start: there is no Projects item in the sidebar yet");
check(nav.some((t) => /Containers/.test(t)) && nav.some((t) => /Doctor/.test(t)), "start: the sidebar lists Containers and Doctor");
await done();