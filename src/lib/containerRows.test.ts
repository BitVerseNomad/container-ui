import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stateView, statsText, memText, hostPorts, portCell,
  blockOfDot, blockOf, summary, sortEntries, isOpen, flatten,
  countNeedAttention,
} from "./containerRows.ts";
import { KUBE_KEY, type App } from "./homeRows.ts";

type Ctr = { Names: string; Id: string; Image: string; State: string };

function app(key: string, kind: App<Ctr>["kind"], name: string, rows: Ctr[] = [], hasProblem = false): App<Ctr> {
  return { key, kind, name, dir: null, files: [], rows } as App<Ctr>;
}

// State tests (spec 6.4)

test("stateView: running healthy no finding -> ok Running Stop", () => {
  const v = stateView({ state: "running" });
  assert.strictEqual(v.dot, "ok");
  assert.strictEqual(v.word, "Running");
  assert.strictEqual(v.action, "Stop");
  assert.strictEqual(v.busy, false);
});

test("stateView: running unhealthy -> bad Unhealthy Stop", () => {
  const v = stateView({ state: "running", unhealthy: true });
  assert.strictEqual(v.dot, "bad");
  assert.strictEqual(v.word, "Unhealthy");
  assert.strictEqual(v.action, "Stop");
});

test("stateView: running with warn finding -> warn Running Stop", () => {
  const v = stateView({ state: "running", finding: "warn" });
  assert.strictEqual(v.dot, "warn");
  assert.strictEqual(v.word, "Running");
});

test("stateView: running with bad finding healthy -> bad Running Stop", () => {
  const v = stateView({ state: "running", healthy: true, finding: "bad" });
  assert.strictEqual(v.dot, "bad");
  assert.strictEqual(v.word, "Running");
});

test("stateView: restarting -> warn Restarting Stop", () => {
  const v = stateView({ state: "restarting" });
  assert.strictEqual(v.dot, "warn");
  assert.strictEqual(v.word, "Restarting");
  assert.strictEqual(v.action, "Stop");
});

test("stateView: busy Starting… -> busy Starting… Stop", () => {
  const v = stateView({ state: "stopped", busy: "Starting…" });
  assert.strictEqual(v.dot, "busy");
  assert.strictEqual(v.word, "Starting…");
  assert.strictEqual(v.action, "Stop");
  assert.strictEqual(v.busy, true);
});

test("stateView: exited code 0 -> off Stopped Start", () => {
  const v = stateView({ state: "exited", exitCode: 0 });
  assert.strictEqual(v.dot, "off");
  assert.strictEqual(v.word, "Stopped");
  assert.strictEqual(v.action, "Start");
});

test("stateView: exited code 1 -> bad Stopped (error) Start", () => {
  const v = stateView({ state: "exited", exitCode: 1 });
  assert.strictEqual(v.dot, "bad");
  assert.strictEqual(v.word, "Stopped (error)");
  assert.strictEqual(v.action, "Start");
});

test("stateView: OOM killed -> bad Out of memory Start", () => {
  const v = stateView({ state: "exited", oomKilled: true });
  assert.strictEqual(v.dot, "bad");
  assert.strictEqual(v.word, "Out of memory");
  assert.strictEqual(v.action, "Start");
});

test("stateView: busy Stopping… -> busy Stopping… Start", () => {
  const v = stateView({ state: "running", busy: "Stopping…" });
  assert.strictEqual(v.action, "Start");
  assert.strictEqual(v.busy, true);
});

test("stateView: paused -> Paused", () => {
  const v = stateView({ state: "paused" });
  assert.strictEqual(v.word, "Paused");
});

// Stats and ports tests

test("statsText: 2.4 percent 512 MiB running -> 2% · 512 MB", () => {
  assert.strictEqual(statsText(2.4, 512 * 1024 * 1024, true), "2% · 512 MB");
});

test("statsText: stopped -> empty", () => {
  assert.strictEqual(statsText(50, 1024 * 1024 * 1024, false), "");
});

test("memText: 14 MiB 1.6 GiB 12 GiB -> 14 MB 1.6 GB 12 GB", () => {
  assert.strictEqual(memText(14 * 1024 * 1024), "14 MB");
  assert.strictEqual(memText(1.6 * 1024 * 1024 * 1024), "1.6 GB");
  assert.strictEqual(memText(12 * 1024 * 1024 * 1024), "12 GB");
});

test("hostPorts: 0.0.0.0:8080->80/tcp :::8080->80/tcp 5432/tcp -> [8080]", () => {
  assert.deepStrictEqual(hostPorts("0.0.0.0:8080->80/tcp, :::8080->80/tcp, 5432/tcp"), [8080]);
});

test("portCell: three ports -> shown [80, 443] more 1", () => {
  const r = portCell([80, 443, 9000]);
  assert.deepStrictEqual(r.shown, [80, 443]);
  assert.strictEqual(r.more, 1);
});

test("hostPorts: empty Ports text -> []", () => {
  assert.deepStrictEqual(hostPorts(""), []);
});

// Blocks and summary tests

test("blockOf: dot ok word Running for web -> {web, ok, Running}", () => {
  const b = blockOf("web", "ok", "Running");
  assert.deepStrictEqual(b, { name: "web", state: "ok", label: "Running" });
});

test("blockOf: dot busy -> state warn", () => {
  const b = blockOf("web", "busy", "Starting…");
  assert.strictEqual(b.state, "warn");
});

test("blockOf: dot off word Stopped for cache -> {cache, off, Stopped}", () => {
  const b = blockOf("cache", "off", "Stopped");
  assert.deepStrictEqual(b, { name: "cache", state: "off", label: "Stopped" });
});

test("summary: 10 and 3 -> 10 · 3 need attention; 10 and 0 -> 10", () => {
  assert.strictEqual(summary(10, 3), "10 · 3 need attention");
  assert.strictEqual(summary(10, 0), "10");
});

// Order and lines tests

test("sortEntries: problems first then running then stopped alpha inside", () => {
  const entries = [
    { key: "scratch", name: "scratch-postgres", hasProblem: false, running: true },
    { key: "cache", name: "cache", hasProblem: false, running: false },
    { key: "kafka", name: "kafka", hasProblem: true, running: true },
    { key: "shop", name: "shop", hasProblem: true, running: true },
  ];
  const sorted = sortEntries(entries);
  assert.deepStrictEqual(sorted.map((e) => e.name), ["kafka", "shop", "scratch-postgres", "cache"]);
});

test("sortEntries: two problems alphabetical", () => {
  const entries = [
    { key: "z", name: "zeta", hasProblem: true, running: true },
    { key: "a", name: "alpha", hasProblem: true, running: true },
  ];
  const sorted = sortEntries(entries);
  assert.deepStrictEqual(sorted.map((e) => e.name), ["alpha", "zeta"]);
});

test("sortEntries: Kubernetes last", () => {
  const entries = [
    { key: KUBE_KEY, name: "Kubernetes", hasProblem: false, running: true },
    { key: "c", name: "cache", hasProblem: false, running: false },
  ];
  const sorted = sortEntries(entries);
  assert.strictEqual(sorted[0].name, "cache");
  assert.strictEqual(sorted[1].name, "Kubernetes");
});

test("isOpen: no problem no saved -> false; problem -> true; saved false problem -> false", () => {
  assert.strictEqual(isOpen(false, undefined), false);
  assert.strictEqual(isOpen(true, undefined), true);
  assert.strictEqual(isOpen(false, false), false);
});

test("flatten: open project with problem in api -> entry child problem", () => {
  const project = app("shop", "compose", "shop", [
    { Names: "api", Id: "a1", Image: "api", State: "running" },
    { Names: "web", Id: "w1", Image: "web", State: "running" },
  ]);
  const lines = flatten([project], (e) => true, (c) => c.Names === "api");
  assert.strictEqual(lines[0].kind, "entry");
  assert.strictEqual(lines[1].kind, "child");
  assert.strictEqual((lines[1] as any).c.Names, "api");
  assert.strictEqual(lines[2].kind, "problem");
  assert.strictEqual((lines[2] as any).indent, true);
  assert.strictEqual((lines[2] as any).prefix, false);
});

test("flatten: folded project with problems api worker -> entry two problems prefix true no children", () => {
  const project = app("shop", "compose", "shop", [
    { Names: "api", Id: "a1", Image: "api", State: "exited" },
    { Names: "worker", Id: "w1", Image: "worker", State: "exited" },
  ]);
  const lines = flatten([project], () => false, () => true);
  assert.strictEqual(lines[0].kind, "entry");
  assert.strictEqual(lines[1].kind, "problem");
  assert.strictEqual((lines[1] as any).prefix, true);
  assert.strictEqual(lines[2].kind, "problem");
  assert.strictEqual((lines[2] as any).prefix, true);
  assert.strictEqual(lines.length, 3);
});

test("flatten: loose container with problem -> entry one problem prefix false", () => {
  const loose = app("web", "container", "web", [{ Names: "web", Id: "w1", Image: "web", State: "exited" }]);
  const lines = flatten([loose], () => false, () => true);
  assert.strictEqual(lines[0].kind, "entry");
  assert.strictEqual(lines[1].kind, "problem");
  assert.strictEqual((lines[1] as any).prefix, false);
  assert.strictEqual(lines.length, 2);
});

test("flatten: Kubernetes entry -> only entry line", () => {
  const kube = app(KUBE_KEY, "kubernetes", "Kubernetes", [
    { Names: "pod-1", Id: "p1", Image: "pause", State: "running" },
  ]);
  const lines = flatten([kube], () => false, () => false);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].kind, "entry");
});

test("countNeedAttention: mockup data -> 3", () => {
  const kafka = app("kafka", "container", "kafka", [{ Names: "kafka", Id: "k1", Image: "kafka", State: "exited" }]);
  const kafkaUi = app("kafka-ui", "container", "kafka-ui", [{ Names: "kafka-ui", Id: "k2", Image: "kafka-ui", State: "running" }]);
  const shop = app("shop", "compose", "shop", [
    { Names: "api", Id: "a1", Image: "api", State: "exited" },
    { Names: "worker", Id: "w1", Image: "worker", State: "exited" },
    { Names: "report-job", Id: "r1", Image: "report-job", State: "exited" },
  ]);
  const scratch = app("scratch-postgres", "container", "scratch-postgres", [{ Names: "scratch-postgres", Id: "s1", Image: "postgres", State: "running" }]);
  const entries = [kafka, kafkaUi, shop, scratch];
  assert.strictEqual(countNeedAttention(entries, (c) => c.Names !== "scratch-postgres"), 3);
});
