import test from "node:test";
import assert from "node:assert/strict";
import { describe, runConnect, runFix } from "./fixRun.ts";
import type { Replace } from "./health.ts";

type Opts = {
  exists?: string[];
  failRun?: boolean;
  dies?: boolean;
  health?: string[];
  failConnect?: boolean;
  failRmOld?: boolean;
  failRename?: "before" | "after";
  failRestore?: boolean;
  image?: { Id?: string; Config?: Record<string, unknown> } | null;
};

// A fake docker that records every call and fails where a test says.
function fake(opts: Opts = {}) {
  const calls: string[] = [];
  const renamed = new Set<string>();
  let looks = 0;
  const docker = async (args: string[]) => {
    calls.push(args.join(" "));
    const last = args[args.length - 1];
    if (args[0] === "inspect" && args[4] === "{{.Name}}") {
      if (opts.exists?.includes(last) || renamed.has(last)) return `/${last}`;
      throw "Error: No such object";
    }
    if (args[0] === "inspect") return opts.health ? `true 0 ${opts.health[Math.min(looks++, opts.health.length - 1)]}` : opts.dies ? "false 0" : "true 0";
    if (args[0] === "image") {
      if (opts.image === null) throw "Error: No such image";
      return JSON.stringify([opts.image ?? { Id: "sha256:a", Config: { Cmd: ["run"] } }]);
    }
    if (args[0] === "rename") {
      if (opts.failRestore && args[1].endsWith("-old")) throw "rename failed";
      if (opts.failRename === "before" && !args[1].endsWith("-old")) throw "context deadline exceeded";
      renamed.add(args[2]);
      if (opts.failRename === "after" && !args[1].endsWith("-old")) throw "context deadline exceeded";
    }
    if (args[0] === "run" && opts.failRun) throw "docker: port is already allocated";
    if (args[0] === "network" && args[1] === "connect" && opts.failConnect) throw "network appnet not found";
    if (args[0] === "rm" && args[1].endsWith("-old") && opts.failRmOld) throw "removal in progress";
    if (args[0] === "logs") return "ERROR bad config";
    return "";
  };
  return { calls, docker };
}
const step = (name: string, extra: Partial<Replace> = {}): Replace => ({ name, run: ["run", "-d", "--name", name, "img"], connect: [], keep: { image: "img", imageId: "sha256:a", Cmd: ["run"] }, ...extra });
const noWait = async () => {};
const changes = (calls: string[]) => calls.filter((c) => !c.startsWith("inspect") && !c.startsWith("image"));

test("Given two steps that work, when Fix runs, then each is replaced in order and the old ones removed", async () => {
  const { calls, docker } = fake();
  const out = await runFix([step("kafka", { createNetwork: "kafka" }), step("ui", { connect: ["appnet"] })], docker, () => {}, noWait);
  assert.deepEqual(out, { ok: true, replaced: ["kafka", "ui"], leftover: [] });
  assert.deepEqual(changes(calls), ["network create kafka", "rename kafka kafka-old", "stop kafka-old", "run -d --name kafka img", "rm kafka-old", "rename ui ui-old", "stop ui-old", "run -d --name ui img", "network connect appnet ui", "rm ui-old"]);
});

test("Given the new container won't start, when Fix runs, then the old one is put back and nothing else is touched", async () => {
  const { calls, docker } = fake({ failRun: true });
  const out = await runFix([step("kafka"), step("ui")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.failed, "kafka");
  assert.equal(out.restored, true);
  assert.equal(out.untouched, false);
  assert.match(out.reason, /port is already allocated/);
  assert.ok(calls.includes("rm -f kafka") && calls.includes("rename kafka-old kafka") && calls.includes("start kafka"));
  assert.ok(!changes(calls).some((c) => c.includes("ui")), "the second step never runs");
  assert.match(describe(out), /The old kafka is back as it was\./);
});

test("Given the new container stops after starting, when Fix runs, then its logs are kept and the old one comes back", async () => {
  const { docker } = fake({ dies: true });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.match(out.reason, /stopped after starting/);
  assert.equal(out.logs, "ERROR bad config");
});

test("Given a health check, when it passes after starting, then Fix waits for it and succeeds", async () => {
  const { docker } = fake({ health: ["starting", "starting", "healthy"] });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, true);
});

test("Given a health check, when it fails, then Fix puts the old one back", async () => {
  const { docker } = fake({ health: ["starting", "unhealthy"] });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.match(out.reason, /health check fails/);
  assert.equal(out.restored, true);
});

test("Given the first step works and the second fails, when Fix runs, then the report says the first was replaced", async () => {
  const { docker } = fake({ failConnect: true });
  const out = await runFix([step("kafka"), step("ui", { connect: ["appnet"] })], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.deepEqual(out.replaced, ["kafka"]);
  assert.equal(out.failed, "ui");
  assert.match(describe(out), /^kafka was replaced, but ui couldn't be fixed/);
  assert.doesNotMatch(describe(out), /Nothing was changed/);
});

test("Given a leftover <name>-old for any step, when Fix runs, then it stops before changing anything", async () => {
  const { calls, docker } = fake({ exists: ["ui-old"] });
  const out = await runFix([step("kafka"), step("ui")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.failed, "ui");
  assert.equal(out.untouched, true);
  assert.deepEqual(changes(calls), [], "the broker is not touched either");
  assert.match(describe(out), /Nothing was changed\.$/);
});

test("Given the backend would refuse the second run, when Fix runs, then nothing is touched", async () => {
  const { calls, docker } = fake();
  const allowed = async (args: string[]) => {
    if (args.includes("ui")) throw "\"-e spring.config.x=1\" is not allowed";
  };
  const out = await runFix([step("kafka"), step("ui")], docker, () => {}, noWait, allowed);
  assert.equal(out.ok, false);
  assert.deepEqual(changes(calls), []);
});

test("Given a container started with its own command, when Fix runs, then it stops before changing anything", async () => {
  const { calls, docker } = fake({ image: { Id: "sha256:a", Config: { Cmd: ["default"] } } });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.match(out.reason, /its own command/);
  assert.deepEqual(changes(calls), []);
});

test("Given the image tag now points at another version, when Fix runs, then it stops before changing anything", async () => {
  const { docker } = fake({ image: { Id: "sha256:b", Config: { Cmd: ["run"] } } });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.match(out.reason, /different version/);
});

test("Given the old one can't be removed afterwards, when Fix runs, then it succeeds and names the leftover", async () => {
  const { docker } = fake({ failRmOld: true });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.deepEqual(out, { ok: true, replaced: ["kafka"], leftover: ["kafka-old"] });
  assert.match(describe(out), /kafka-old couldn't be removed/);
});

test("Given a rename that times out after Docker did it, when Fix runs, then the old one is still put back", async () => {
  const { calls, docker } = fake({ failRename: "after" });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.untouched, false);
  assert.ok(calls.includes("rename kafka-old kafka"));
});

test("Given a rename that fails before Docker did it, when Fix runs, then it reports that nothing changed", async () => {
  const { calls, docker } = fake({ failRename: "before" });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.untouched, true);
  assert.ok(!calls.includes("rename kafka-old kafka"));
});

test("Given putting the old one back fails, when Fix reports, then it says where the old one is", async () => {
  const { docker } = fake({ failRun: true, failRestore: true });
  const out = await runFix([step("kafka")], docker, () => {}, noWait);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.restored, false);
  assert.match(describe(out), /named kafka-old/);
});

test("Given a network to create and two containers, when Connect runs, then it creates it and connects both", async () => {
  const calls: string[] = [];
  const out = await runConnect({ network: "cache-net", create: true, containers: ["api", "cache"] }, async (a) => (calls.push(a.join(" ")), ""), () => {});
  assert.equal(out.ok, true);
  assert.deepEqual(calls, ["network create cache-net", "network connect cache-net api", "network connect cache-net cache"]);
  assert.match(describe(out), /^Connected\. api and cache are on cache-net/);
});

test("Given the network exists and one container is already on it, when Connect runs, then both count as done", async () => {
  const out = await runConnect({ network: "n", create: true, containers: ["a", "b"] }, async (a) => {
    if (a[1] === "create") throw "Error response from daemon: network with name n already exists";
    if (a[3] === "a") throw "Error response from daemon: endpoint with name a already exists in network n";
    return "";
  }, () => {});
  assert.equal(out.ok, true);
});

test("Given the second connect fails, when Connect runs, then it says the first is connected and harmless", async () => {
  const out = await runConnect({ network: "n", create: false, containers: ["a", "b"] }, async (a) => {
    if (a[3] === "b") throw "Error response from daemon: container b is not running";
    return "";
  }, () => {});
  assert.equal(out.ok, false);
  assert.match(describe(out), /^Couldn't connect b to n: Error response from daemon: container b is not running\. a is on n now, which does no harm\.$/);
});
