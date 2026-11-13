import test from "node:test";
import assert from "node:assert/strict";
import { engineOfProfile, stateLine, factsLine, dotOf, buttonLabel, chooseEngine, busyOf } from "./engineModel.ts";
import type { Profile } from "../api";

const GB = 1024 ** 3;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "default",
    status: "Running",
    arch: "aarch64",
    cpus: 4,
    memory: 8 * GB,
    disk: 60 * GB,
    runtime: "docker",
    address: "192.168.5.2",
    ...overrides,
  } as Profile;
}

test("Given a running profile with 4 CPU and memory 8 GiB, when engineOfProfile runs, then label is 'Colima · default' and stateLine is 'Running · 4 CPU · 8 GB'", () => {
  const p = profile({ name: "default", cpus: 4, memory: 8 * GB });
  const e = engineOfProfile(p);
  assert.strictEqual(e.label, "Colima · default");
  assert.strictEqual(e.state, "running");
  assert.strictEqual(stateLine(e), "Running · 4 CPU · 8 GB");
});

test("Given a stopped profile, when stateLine runs, then it is 'Stopped'", () => {
  const p = profile({ status: "Stopped" });
  const e = engineOfProfile(p);
  assert.strictEqual(stateLine(e), "Stopped");
});

test("Given busy 'starting', when engineOfProfile runs on a stopped profile, then state is 'starting' and stateLine is 'Starting…'", () => {
  const p = profile({ status: "Stopped" });
  const e = engineOfProfile(p, { busy: "starting" });
  assert.strictEqual(e.state, "starting");
  assert.strictEqual(stateLine(e), "Starting…");
});

test("Given unreachable true, when engineOfProfile runs, then stateLine is 'Not reachable' and dotOf is 'bad'", () => {
  const p = profile({ status: "Stopped" });
  const e = engineOfProfile(p, { unreachable: true });
  assert.strictEqual(stateLine(e), "Not reachable");
  assert.strictEqual(dotOf(e), "bad");
});

test("Given a running engine with Kubernetes, when factsLine runs, then it is '4 CPU · 8 GB · Kubernetes'", () => {
  const p = profile({ name: "default", cpus: 4, memory: 8 * GB });
  const e = engineOfProfile(p, { kubernetes: true });
  assert.strictEqual(factsLine(e), "4 CPU · 8 GB · Kubernetes");
});

test("Given the profile 'dev', when engineOfProfile runs, then context is 'colima-dev'", () => {
  const p = profile({ name: "dev" });
  const e = engineOfProfile(p);
  assert.strictEqual(e.context, "colima-dev");
});

test("Given engines default and dev and stored 'dev', when chooseEngine runs, then dev is chosen", () => {
  const defaultProfile = profile({ name: "default" });
  const devProfile = profile({ name: "dev", status: "Stopped" });
  const engines = [engineOfProfile(defaultProfile), engineOfProfile(devProfile)];
  const chosen = chooseEngine(engines, "dev");
  assert.strictEqual(chosen?.id, "dev");
});

test("Given a stored name that no longer exists, when chooseEngine runs, then the first running engine is chosen", () => {
  const defaultProfile = profile({ name: "default", status: "Running" });
  const devProfile = profile({ name: "dev", status: "Stopped" });
  const engines = [engineOfProfile(defaultProfile), engineOfProfile(devProfile)];
  const chosen = chooseEngine(engines, "nonexistent");
  assert.strictEqual(chosen?.id, "default");
});

test("Given no engines, when chooseEngine runs, then it returns null", () => {
  const chosen = chooseEngine([], "default");
  assert.strictEqual(chosen, null);
});

test("Given a running default, when buttonLabel runs, then it is 'Engine: Colima, default. Running'", () => {
  const p = profile({ name: "default", cpus: 4, memory: 8 * GB });
  const e = engineOfProfile(p);
  assert.strictEqual(buttonLabel(e), "Engine: Colima, default. Running");
});

test("Given op 'restarting' for 'dev', when busyOf runs for 'dev', then it is 'starting'; for 'default', then null; given op null, then null; given op 'stopping' for 'dev', then 'stopping'", () => {
  assert.strictEqual(busyOf({ op: "restarting", name: "dev" }, "dev"), "starting");
  assert.strictEqual(busyOf({ op: "restarting", name: "dev" }, "default"), null);
  assert.strictEqual(busyOf({ op: null, name: "dev" }, "dev"), null);
  assert.strictEqual(busyOf({ op: "stopping", name: "dev" }, "dev"), "stopping");
});
