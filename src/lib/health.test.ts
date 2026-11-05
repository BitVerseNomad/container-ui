import test from "node:test";
import assert from "node:assert/strict";
import { exitCodeMeaning, parseState, problemsFor, healthFromStatus } from "./health.ts";

test("exit codes get plain meanings", () => {
  assert.match(exitCodeMeaning(0), /normally/);
  assert.match(exitCodeMeaning(1), /error/i);
  assert.match(exitCodeMeaning(125), /Docker couldn't start/i);
  assert.match(exitCodeMeaning(126), /can't be run|not executable/i);
  assert.match(exitCodeMeaning(127), /not found/i);
  assert.match(exitCodeMeaning(137), /killed/i);
  assert.match(exitCodeMeaning(143), /asked to stop|termination/i);
  assert.match(exitCodeMeaning(139), /crash/i);
  assert.match(exitCodeMeaning(130), /signal 2/);
  assert.match(exitCodeMeaning(128), /application/i);
  assert.match(exitCodeMeaning(42), /code 42/);
  assert.match(exitCodeMeaning(255), /out of range|unknown/i);
});

test("137 alone never claims an out-of-memory kill", () => {
  assert.doesNotMatch(exitCodeMeaning(137), /memory/i);
});

const insp = (state: object, extra: object = {}) => JSON.stringify([{ Name: "/api", RestartCount: 0, State: { Running: true, Status: "running", ExitCode: 0, OOMKilled: false, StartedAt: "2026-10-09T10:00:00Z", ...state }, ...extra }]);

test("parseState reads health, restarts, exit code and OOM", () => {
  const s = parseState(insp({ Health: { Status: "unhealthy", FailingStreak: 4, Log: [{ ExitCode: 1, Output: "old" }, { ExitCode: 1, Output: "curl: (7) refused" }] } }, { RestartCount: 5 }))!;
  assert.equal(s.name, "api");
  assert.deepEqual(s.health, { status: "unhealthy", streak: 4, lastOutput: "curl: (7) refused", lastExit: 1 });
  assert.equal(s.restartCount, 5);
  assert.equal(s.running, true);
  const none = parseState(insp({}))!;
  assert.equal(none.health, null);
  assert.equal(parseState("nope"), null);
  assert.equal(parseState(insp({ Health: { Status: "starting", FailingStreak: 0, Log: null } }))!.health!.lastOutput, "");
});

test("a healthy running container has no problems", () => {
  assert.deepEqual(problemsFor(parseState(insp({ Health: { Status: "healthy", FailingStreak: 0, Log: [] } }))!), []);
  assert.deepEqual(problemsFor(parseState(insp({}))!), []);
});

test("an unhealthy container shows what the last check said", () => {
  const p = problemsFor(parseState(insp({ Health: { Status: "unhealthy", FailingStreak: 3, Log: [{ ExitCode: 1, Output: "curl: (7) Failed to connect" }] } }))!);
  assert.equal(p[0].id, "unhealthy");
  assert.equal(p[0].level, "bad");
  assert.match(p[0].detail, /3 checks in a row/);
  assert.match(p[0].detail, /Failed to connect/);
});

test("a container that keeps restarting is flagged from three restarts", () => {
  assert.deepEqual(problemsFor(parseState(insp({}, { RestartCount: 2 }))!), []);
  const p = problemsFor(parseState(insp({}, { RestartCount: 7 }))!);
  assert.equal(p[0].id, "restarting");
  assert.match(p[0].detail, /restarted 7 times/);
});

test("an out-of-memory kill is reported as such, and only when Docker says so", () => {
  const oom = problemsFor(parseState(insp({ Running: false, Status: "exited", ExitCode: 137, OOMKilled: true }))!);
  assert.equal(oom[0].id, "oom");
  assert.match(oom[0].detail, /memory/i);
  assert.equal(oom[0].fix?.resize, true);
  assert.doesNotMatch(oom[0].detail, /Profiles, Edit/);
  assert.equal(oom.some((x) => x.id === "crashed"), false);
  const killed = problemsFor(parseState(insp({ Running: false, Status: "exited", ExitCode: 137, OOMKilled: false }))!);
  assert.equal(killed[0].id, "crashed");
  assert.doesNotMatch(killed[0].detail, /out of memory/i);
});

test("an error exit explains the code; a clean or graceful exit is not a problem", () => {
  const p = problemsFor(parseState(insp({ Running: false, Status: "exited", ExitCode: 127 }))!);
  assert.equal(p[0].id, "crashed");
  assert.match(p[0].detail, /not found/i);
  assert.deepEqual(problemsFor(parseState(insp({ Running: false, Status: "exited", ExitCode: 0 }))!), []);
  assert.deepEqual(problemsFor(parseState(insp({ Running: false, Status: "exited", ExitCode: 143 }))!), []);
});

test("healthFromStatus reads the badge from docker ps text", () => {
  assert.equal(healthFromStatus("Up 2 hours (healthy)"), "healthy");
  assert.equal(healthFromStatus("Up 2 hours (unhealthy)"), "unhealthy");
  assert.equal(healthFromStatus("Up 10 seconds (health: starting)"), "starting");
  assert.equal(healthFromStatus("Up 2 hours"), null);
  assert.equal(healthFromStatus("Exited (0) 3 hours ago"), null);
});

const GIB = 1024 ** 3;
const dead = { Running: false, Status: "exited", ExitCode: 137, OOMKilled: true };
const from = (files: string, memory: number) => ({ Config: { Labels: { "com.docker.compose.project.config_files": files, "com.docker.compose.service": "report-job" } }, HostConfig: { Memory: memory } });

test("given a job OOM-killed at its own 256 MiB limit on a 2 GiB VM, when checked, then the line names the limit and its Compose file, offers Apply and start, and no bigger VM", () => {
  const [p] = problemsFor(parseState(insp(dead, from("/Users/me/code/shop/compose.yaml", 256 * 1024 ** 2)))!, 2 * GIB);
  assert.equal(p.title, "It hit its own 256 MiB memory limit (set in `compose.yaml`)");
  assert.match(p.detail, /raise its memory limit in `compose\.yaml`, then press Apply and start\.$/);
  assert.doesNotMatch(p.title + p.detail, /mem_limit/, "the key that set it isn't known, so none is named");
  assert.equal(p.fix?.resize, undefined);
  assert.deepEqual(p.fix?.apply, { file: "/Users/me/code/shop/compose.yaml", service: "report-job", limit: 256 * 1024 ** 2, where: "`compose.yaml`" });
  assert.equal(p.fix?.reveal, "/Users/me/code/shop/compose.yaml");
  // Not from Compose: nothing to apply or show, so no fix (the line offers See why).
  assert.equal(problemsFor(parseState(insp(dead, { HostConfig: { Memory: 256 * 1024 ** 2 } }))!, 2 * GIB)[0].fix, undefined);
});

test("given a compose.yaml and an override, when the limit is named, then no one file is called the place it is set", () => {
  const [p] = problemsFor(parseState(insp(dead, from("/Users/me/code/shop/compose.yaml,/Users/me/code/shop/compose.override.yaml", 256 * 1024 ** 2)))!, 2 * GIB);
  assert.equal(p.title, "It hit its own 256 MiB memory limit (set in the project's Compose files)");
  assert.match(p.detail, /in the project's Compose files, then press Apply and start/);
  assert.equal(p.fix?.reveal, "/Users/me/code/shop/compose.yaml", "Show in Finder still opens the first file");
});

test("given an OOM kill with no limit, a limit near the VM's memory, or no VM size known, when checked, then the fix is a bigger VM", () => {
  assert.equal(problemsFor(parseState(insp(dead))!, 2 * GIB)[0].fix?.resize, true);
  const near = problemsFor(parseState(insp(dead, from("/Users/me/code/shop/compose.yaml", 1.9 * GIB)))!, 2 * GIB)[0];
  assert.equal(near.fix?.resize, true, "1.9 GiB on a 2 GiB VM: the VM may be what ran out");
  assert.match(near.detail, /It also has its own 1\.9 GiB memory limit/);
  assert.equal(problemsFor(parseState(insp(dead, from("/Users/me/code/shop/compose.yaml", 256 * 1024 ** 2)))!)[0].fix?.resize, true, "VM memory unknown: keep the resize offer");
});
