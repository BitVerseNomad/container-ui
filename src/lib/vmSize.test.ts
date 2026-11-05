import { test } from "node:test";
import assert from "node:assert/strict";
import { KUBE_BACK, confirmText, dependsOn, doneText, explainResize, firstVmSize, notStarted, planRestart, resizeTo, startReason, stepDown, withoutKube, failLine, planWith, holdAfterResize, stepUp } from "./vmSize.ts";

const GiB = 1024 ** 3;

test("given a 12-core 32 GiB Mac, when sizing the first VM, then it gets half the cores and a quarter of the memory", () => {
  assert.deepEqual(firstVmSize({ cpus: 12, memory: 32 * GiB }), { cpus: 6, memory: 8 });
});

test("given a small 8 GiB Mac, when sizing, then it never goes below Colima's 2 CPU and 2 GiB", () => {
  assert.deepEqual(firstVmSize({ cpus: 2, memory: 8 * GiB }), { cpus: 2, memory: 2 });
});

test("given a very large Mac, when sizing, then it caps at 8 CPUs and 16 GiB", () => {
  assert.deepEqual(firstVmSize({ cpus: 32, memory: 128 * GiB }), { cpus: 8, memory: 16 });
});

test("given the default 2 CPU, 2 GiB VM on a 12-core 32 GiB Mac, when picking a bigger size, then it gets the size this Mac starts with", () => {
  assert.deepEqual(resizeTo({ cpus: 2, memory: 2 * GiB }, firstVmSize({ cpus: 12, memory: 32 * GiB }), 32 * GiB), { cpus: 6, memory: 8 });
});

test("given a VM with 2 CPUs but 16 GiB, when picking a bigger size, then the memory is never shrunk", () => {
  assert.deepEqual(resizeTo({ cpus: 2, memory: 16 * GiB }, { cpus: 6, memory: 8 }, 32 * GiB), { cpus: 6, memory: 16 });
});

test("given a pick bigger than half the Mac's memory, when picking, then it is capped at half", () => {
  assert.deepEqual(resizeTo({ cpus: 2, memory: 2 * GiB }, { cpus: 4, memory: 12 }, 16 * GiB), { cpus: 4, memory: 8 });
});

test("given an 8 GiB Mac whose pick is still 2 CPUs and 2 GiB, when picking, then there is no one-click size", () => {
  assert.equal(resizeTo({ cpus: 2, memory: 2 * GiB }, firstVmSize({ cpus: 4, memory: 8 * GiB }), 8 * GiB), null);
});

test("given the host size is not known yet, when picking, then there is no one-click size", () => {
  assert.equal(resizeTo({ cpus: 2, memory: 2 * GiB }, null), null);
});

test("given 8 GiB didn't fit, when stepping down, then it tries 6 GiB with the same CPUs, and stops above the old size", () => {
  assert.deepEqual(stepDown({ cpus: 6, memory: 8 }, { cpus: 2, memory: 2 }), { cpus: 6, memory: 6 });
  assert.deepEqual(stepDown({ cpus: 6, memory: 4 }, { cpus: 2, memory: 2 }), { cpus: 6, memory: 3 });
  assert.equal(stepDown({ cpus: 6, memory: 3 }, { cpus: 2, memory: 2 }), null);
});

test("given 7 running containers, when the confirm is worded, then it says they stop and start again, with no restart-policy words", () => {
  const t = confirmText({ cpus: 6, memory: 8 }, 7);
  assert.match(t, /^Give the VM 6 CPUs and 8 GiB\?\n/);
  assert.match(t, /Your 7 running containers stop and start again after \(about a minute\)\./);
  assert.doesNotMatch(t, /on-failure|unless-stopped|restart setting/);
  assert.match(confirmText({ cpus: 6, memory: 8 }, 0), /Nothing is running, so nothing stops/);
  assert.match(confirmText({ cpus: 6, memory: 8 }, null), /Running containers stop and start again after/);
  assert.match(confirmText({ cpus: 2, memory: 8 }, 1, { cpus: 2, memory: 2 }), /^Give the VM 8 GiB of memory\?/);
});

test("given every container started again, when done, then one line says the size and that they run", () => {
  assert.equal(doneText({ cpus: 6, memory: 8 }, 7, 0), "The VM has 6 CPUs and 8 GiB now. Everything that was running is running again.");
  assert.equal(doneText({ cpus: 6, memory: 8 }, 0, 0), "The VM has 6 CPUs and 8 GiB now.");
  assert.equal(doneText({ cpus: 6, memory: 8 }, 7, 1), "The VM has 6 CPUs and 8 GiB now. Everything else that was running is running again.");
  assert.equal(doneText({ cpus: 6, memory: 8 }, 1, 1), "The VM has 6 CPUs and 8 GiB now.");
  // Only what changed: from a memory line the CPUs stay as they were.
  assert.equal(doneText({ cpus: 2, memory: 8 }, 5, 0, { cpus: 2, memory: 2 }), "The VM has 8 GiB now. Everything that was running is running again.");
  assert.equal(doneText({ cpus: 6, memory: 8 }, 5, 0, { cpus: 2, memory: 2 }), "The VM has 6 CPUs and 8 GiB now. Everything that was running is running again.");
});

test("given docker start lists the ones it couldn't start, when read, then only those are named", () => {
  assert.deepEqual(notStarted("Error response from daemon: boom\nError: failed to start containers: web, api", ["db", "web", "api"]), ["web", "api"]);
  assert.deepEqual(notStarted("connection refused", ["db", "web"]), ["db", "web"]);
});

test("given the Mac had too little free memory, when a resize fails, then it says so in plain words", () => {
  assert.deepEqual(explainResize("FATA[0009] error starting vm: not enough memory", "default"), { text: "The Mac couldn't give the VM that much memory right now.", memory: true });
});

test("given another VM operation was running, when a resize fails, then the backend's own sentence is kept", () => {
  assert.equal(explainResize("Another VM operation is still running. Wait for it to finish, or cancel it.", "default").text, "Another VM operation is still running. Wait for it to finish, or cancel it.");
});

test("given an unknown error, when a resize fails, then it points at the VM log", () => {
  assert.match(explainResize("FATA[0009] error starting vm: exit status 1", "work").text, /^Colima couldn't start the VM with the new size\. The VM log is ~\/\.colima\/_lima\/colima-work\/ha\.stderr\.log/);
});

const svc = (project: string, service: string, deps = "") => ({ "com.docker.compose.project": project, "com.docker.compose.service": service, ...(deps ? { "com.docker.compose.depends_on": deps } : {}) });

test("given a chain db then api then web, when planning the restart, then each starts in its own wave and api waits for a healthy db", () => {
  const plan = planRestart([{ name: "web", labels: svc("shop", "web", "api:service_started:false") }, { name: "api", labels: svc("shop", "api", "db:service_healthy:false") }, { name: "db", labels: svc("shop", "db") }]);
  assert.deepEqual(plan, { waves: [["db"], ["api"], ["web"]], healthy: ["db"] });
});

test("given a diamond, when planning the restart, then the two middle services share a wave and the top waits for both", () => {
  const plan = planRestart([{ name: "top", labels: svc("p", "top", "b:service_started:false,c:service_completed_successfully:false") }, { name: "b", labels: svc("p", "b", "a:service_started:false") }, { name: "c", labels: svc("p", "c", "a:service_started:false") }, { name: "a", labels: svc("p", "a") }]);
  assert.deepEqual(plan.waves, [["a"], ["b", "c"], ["top"]]);
  assert.deepEqual(plan.healthy, []);
});

test("given a cycle, when planning the restart, then that project starts in one wave", () => {
  const plan = planRestart([{ name: "x", labels: svc("p", "x", "y:service_started:false") }, { name: "y", labels: svc("p", "y", "x:service_started:false") }]);
  assert.deepEqual(plan.waves, [["x", "y"]]);
});

test("given a dependency that isn't running and loose containers, when planning, then the dependency is ignored and the loose ones go in the last wave", () => {
  const plan = planRestart([{ name: "kafka", labels: {} }, { name: "api", labels: svc("shop", "api", "db:service_healthy:false") }]);
  assert.deepEqual(plan, { waves: [["api", "kafka"]], healthy: [] });
});

test("given a depends_on label in an unknown format, when read, then the unknown parts are ignored", () => {
  assert.deepEqual(dependsOn("db:service_healthy:false,junk,cache:sometimes:true,queue:service_started"), [{ service: "db", healthy: true }, { service: "queue", healthy: false }]);
  assert.deepEqual(planRestart([{ name: "a", labels: svc("p", "a", "???") }]).waves, [["a"]]);
});

test("given only loose containers, when planning, then they start together in one wave", () => {
  assert.deepEqual(planRestart([{ name: "kafka", labels: {} }, { name: "kafka-ui", labels: {} }]), { waves: [["kafka", "kafka-ui"]], healthy: [] });
});

test("given a taken port, when explaining a start failure, then the short reason names the port and the help names the real button", () => {
  assert.deepEqual(startReason("Error response from daemon: driver failed programming external connectivity on endpoint shop-web-1: Bind for 0.0.0.0:8080 failed: port is already allocated", "web"), { short: "port 8080 is in use on your Mac", long: "Something on your Mac already uses port 8080. Stop it, then press Start web." });
  assert.deepEqual(startReason("Error response from daemon: No such container: web", "web"), { short: "No such container: web", long: null });
});

test("given two clones both called shop, when planning the restart, then each orders its own services", () => {
  const at = (dir: string, service: string, deps = "") => ({ ...svc("shop", service, deps), "com.docker.compose.project.working_dir": dir });
  const plan = planRestart([{ name: "a-api", labels: at("/Users/me/a/shop", "api", "db:service_healthy:false") }, { name: "a-db", labels: at("/Users/me/a/shop", "db") }, { name: "b-api", labels: at("/Users/me/b/shop", "api") }]);
  assert.deepEqual(plan, { waves: [["a-db", "b-api"], ["a-api"]], healthy: ["a-db"] });
});

test("given Kubernetes pods among the running containers, when planning, then they are left out and counted apart", () => {
  const split = withoutKube([{ name: "k8s_coredns_coredns-1_kube-system_x_0", labels: {} }, { name: "nginx", labels: { "io.kubernetes.pod.name": "web-1" } }, { name: "kafka", labels: {} }]);
  assert.deepEqual(split, { rows: [{ name: "kafka", labels: {} }], kube: 2 });
  assert.match(confirmText({ cpus: 6, memory: 8 }, 1, { cpus: 2, memory: 2 }, 2), new RegExp(`Your 1 running container stops and starts again after \\(about a minute\\)\\. ${KUBE_BACK}`));
});

test("given a resize started from report-job's out-of-memory line, when it ends, then report-job is said by name once it started", () => {
  assert.equal(doneText({ cpus: 2, memory: 8 }, 5, 0, { cpus: 2, memory: 2 }, ["report-job"]), "The VM has 8 GiB now. Everything that was running is running again, and report-job started again.");
  assert.equal(doneText({ cpus: 6, memory: 8 }, 0, 0, null, ["report-job"]), "The VM has 6 CPUs and 8 GiB now. report-job started again.");
  assert.equal(doneText({ cpus: 2, memory: 8 }, 5, 0, { cpus: 2, memory: 2 }, []), "The VM has 8 GiB now. Everything that was running is running again.", "one that didn't start has its own line");
});

test("given a start that failed, when its line is written, then Docker's reason is said in plain words, or See why is named", () => {
  const oom = startReason("Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: cannot allocate memory", "report-job", 8);
  assert.equal(failLine({ name: "report-job", ...oom }), "report-job didn't start: 8 GiB still isn't enough for it. Give the VM more memory, or make report-job use less.");
  assert.equal(oom.memory, true, "marked, so the result offers more memory, not Start");
  assert.equal(startReason("Error response from daemon: Bind for 0.0.0.0:8080 failed: port is already allocated", "web", 8).memory, undefined, "a port in use is something Start can fix");
  assert.ok(oom.long?.includes("cannot allocate memory"));
  const odd = startReason(`Error response from daemon: ${"x".repeat(120)}`, "report-job");
  assert.equal(failLine({ name: "report-job", ...odd }), "report-job didn't start. See why shows Docker's message.");
});

test("given db killed for memory and api depending on it, when the bigger VM's restart is planned, then db starts before api and isn't counted as running", () => {
  const running = [{ name: "api", labels: svc("shop", "api", "db:service_started:false") }, { name: "web", labels: svc("shop", "web", "api:service_started:false") }];
  const r = planWith(running, ["db"], [{ name: "db", labels: svc("shop", "db") }]);
  assert.deepEqual(r.plan.waves, [["db"], ["api"], ["web"]]);
  assert.equal(r.count, 2);
  assert.deepEqual(r.late, []);
  // Labels not read: started after the waves, as before.
  assert.deepEqual(planWith(running, ["db"], null).late, ["db"]);
});

test("given a resize that ended, when Doctor's reads come back, then only a kept read started after the end releases the held report", () => {
  const end = 1_000;
  assert.equal(holdAfterResize(true, null, 0), true, "while resizing: held");
  assert.equal(holdAfterResize(false, end, 900), true, "the reload failed or was older: the data is from before the end, still held");
  assert.equal(holdAfterResize(false, end, 1_050), false, "a read that started after the end was kept: released");
  assert.equal(holdAfterResize(false, null, 0), false, "no resize: nothing held");
});

test("given 8 GiB still wasn't enough, when the next size is picked, then it is the next step that fits in half the Mac", () => {
  assert.deepEqual(stepUp({ cpus: 6, memory: 8 }, 32 * GiB), { cpus: 6, memory: 12 });
  assert.equal(stepUp({ cpus: 6, memory: 8 }, 16 * GiB), null, "a 16 GB Mac: nothing bigger fits, so Profiles is offered");
  assert.equal(stepUp({ cpus: 6, memory: 16 }, 64 * GiB), null, "16 GiB is the last step");
});
