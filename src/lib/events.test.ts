import test from "node:test";
import assert from "node:assert/strict";
import { parseEvents, describeEvent, timeline, eventWindow, parseVolumeSizes, heaviest } from "./events.ts";

const ev = (action: string, name: string, attrs: object = {}, t = 1700000000) =>
  JSON.stringify({ Type: "container", Action: action, Actor: { ID: "abc", Attributes: { name, image: "img:1", ...attrs } }, time: t, timeNano: t * 1e9 });

test("parseEvents reads container events from JSON lines and skips everything else", () => {
  const out = parseEvents([ev("start", "web"), "not json", JSON.stringify({ Type: "network", Action: "connect", Actor: { Attributes: {} }, time: 1 }), ev("die", "db", { exitCode: "137" })].join("\n"));
  assert.deepEqual(out.map((e) => `${e.action}:${e.name}`), ["start:web", "die:db"]);
  assert.equal(out[1].exitCode, 137);
  assert.equal(out[0].time, 1700000000 * 1000);
  assert.deepEqual(parseEvents(""), []);
});

test("describeEvent says what happened in plain words", () => {
  const d = (a: string, attrs: object = {}) => describeEvent(parseEvents(ev(a, "kafka", attrs))[0]);
  assert.deepEqual([d("start")!.text, d("start")!.level], ["kafka started", "good"]);
  assert.equal(d("oom")!.text, "kafka ran out of memory");
  assert.equal(d("oom")!.level, "bad");
  assert.equal(d("die", { exitCode: "0" })!.text, "kafka finished");
  assert.equal(d("die", { exitCode: "143" })!.text, "kafka was stopped");
  assert.match(d("die", { exitCode: "137" })!.text, /kafka was killed \(exit 137\)/);
  assert.equal(d("die", { exitCode: "137" })!.level, "warn");
  assert.match(d("die", { exitCode: "1" })!.text, /kafka stopped with an error \(exit 1\)/);
  assert.equal(d("die", { exitCode: "1" })!.level, "bad");
  assert.equal(d("health_status: unhealthy")!.text, "kafka became unhealthy");
  assert.equal(d("health_status: healthy")!.text, "kafka became healthy");
  assert.equal(d("restart")!.text, "kafka restarted");
});

test("noise events are dropped", () => {
  for (const a of ["create", "attach", "stop", "kill", "resize", "exec_start: sh", "health_status: starting"]) {
    assert.equal(describeEvent(parseEvents(ev(a, "x"))[0]), null, a);
  }
});

test("timeline is newest first, can be limited, and can be narrowed to one container", () => {
  const evs = parseEvents([ev("start", "a", {}, 100), ev("die", "b", { exitCode: "1" }, 300), ev("start", "b", {}, 200), ev("create", "a", {}, 400)].join("\n"));
  assert.deepEqual(timeline(evs).map((l) => l.text), ["b stopped with an error (exit 1)", "b started", "a started"]);
  assert.deepEqual(timeline(evs, 2).map((l) => l.text).length, 2);
  assert.deepEqual(timeline(evs, 10, "a").map((l) => l.text), ["a started"]);
});

test("eventWindow always ends the stream (an until time is required)", () => {
  assert.deepEqual(eventWindow(1700000000500, 3600_000), ["--since", "1699996400", "--until", "1700000000"]);
});

test("parseVolumeSizes reads sizes from docker system df -v JSON, in any of the shapes it may take", () => {
  const a = parseVolumeSizes(JSON.stringify({ Volumes: [{ Name: "data", Links: 1, Size: "1.5GB" }, { Name: "tiny", Links: 0, Size: "36B" }] }));
  assert.equal(a.get("data"), 1.5e9);
  assert.equal(a.get("tiny"), 36);
  assert.equal(parseVolumeSizes(JSON.stringify([{ Name: "v", Size: 2048 }])).get("v"), 2048);
  assert.equal(parseVolumeSizes("not json").size, 0);
  assert.equal(parseVolumeSizes("{}").size, 0);
});

test("heaviest lists the biggest memory users first with their CPU", () => {
  const rows = [{ Name: "a", CPUPerc: "1.0%", MemUsage: "10MiB / 2GiB" }, { Name: "b", CPUPerc: "30%", MemUsage: "512MiB / 2GiB" }, { Name: "c", CPUPerc: "--", MemUsage: "--" }];
  const out = heaviest(rows, 2);
  assert.deepEqual(out.map((r) => r.name), ["b", "a"]);
  assert.equal(out[0].cpu, 30);
  assert.deepEqual(heaviest([], 3), []);
});
