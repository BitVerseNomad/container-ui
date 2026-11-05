import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_MS, flightTracker, shouldTick } from "./pollPace.ts";

const base = { hidden: false, focused: true, inFlight: false, sinceLast: 3000 };

test("given a focused window when a tick comes then it polls", () => {
  assert.equal(shouldTick(base), true);
});

test("given a call still in flight when a tick comes then it skips", () => {
  assert.equal(shouldTick({ ...base, inFlight: true }), false);
});

test("given a minimized window when a tick comes then it skips", () => {
  assert.equal(shouldTick({ ...base, hidden: true, sinceLast: BACKGROUND_MS * 2 }), false);
});

test("given a window behind others when less than the background pace passed then it skips", () => {
  assert.equal(shouldTick({ ...base, focused: false, sinceLast: BACKGROUND_MS - 1 }), false);
});

test("given a window behind others when the background pace passed then it polls", () => {
  assert.equal(shouldTick({ ...base, focused: false, sinceLast: BACKGROUND_MS }), true);
});

test("given a first load still running when a tick checks then the tracker says busy", () => {
  const f = flightTracker();
  f.begin();
  assert.equal(f.busy(), true);
});

test("given a load that finished when a tick checks then the tracker is free", () => {
  const f = flightTracker();
  f.end(f.begin());
  assert.equal(f.busy(), false);
});

test("given the inputs changed while an old load ran when the old load ends then the new load still counts as in flight", () => {
  const f = flightTracker();
  const old = f.begin();
  const fresh = f.begin();
  f.end(old);
  assert.equal(f.busy(), true);
  f.end(fresh);
  assert.equal(f.busy(), false);
});
