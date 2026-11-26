import test from "node:test";
import assert from "node:assert/strict";
import { ctxFor } from "../api.ts";
import { WSL_ENGINE } from "./platform.ts";
import { wslEngine, stateLine, factsLine, buttonLabel, groupEngines } from "./engineModel.ts";

const wsl = { name: WSL_ENGINE, status: "Running", arch: "", cpus: 0, memory: 0, disk: 0, runtime: "docker" };

test("Given a Colima profile When asked for its context Then it is the Colima context", () => {
  assert.equal(ctxFor("default"), "colima");
  assert.equal(ctxFor("work"), "colima-work");
});

test("Given the WSL engine When asked for its context Then it is docker's own default", () => {
  assert.equal(ctxFor(WSL_ENGINE), "default");
});

test("Given the WSL engine When shown Then it is one running engine with no VM facts", () => {
  const e = wslEngine(wsl);
  assert.equal(e.managed, false);
  assert.equal(stateLine(e), "Running");
  assert.equal(factsLine(e), "Running");
  assert.equal(buttonLabel(e), "Engine: Docker, WSL. Running");
  assert.equal(groupEngines([e])[0].caption, "Docker");
});
