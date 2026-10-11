import test from "node:test";
import assert from "node:assert/strict";
import { parsePods, podProblems, parseDeployments, parseServices, parseNodes, parseK8sEvents, type Pod } from "./k8s.ts";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const pod = (name: string, status: object, spec: object = {}, meta: object = {}) =>
  ({ metadata: { name, namespace: "shop", creationTimestamp: "2026-10-10T11:00:00Z", ...meta }, spec: { nodeName: "colima", containers: [{ name: "app", image: "acme/app:1" }], ...spec }, status });
const list = (...items: object[]) => JSON.stringify({ items });

test("a running, ready pod shows Running with 1/1 and its age", () => {
  const [p] = parsePods(list(pod("web", { phase: "Running", containerStatuses: [{ name: "app", ready: true, restartCount: 0, state: { running: {} } }] })), NOW);
  assert.deepEqual([p.namespace, p.name, p.status, p.ready, p.restarts, p.node], ["shop", "web", "Running", "1/1", 0, "colima"]);
  assert.equal(p.ageMs, 3_600_000);
});

test("the status column follows kubectl: waiting reason, then terminated reason, then phase", () => {
  const status = (s: object) => parsePods(list(pod("x", s)), NOW)[0].status;
  assert.equal(status({ phase: "Running", containerStatuses: [{ name: "app", ready: false, restartCount: 9, state: { waiting: { reason: "CrashLoopBackOff" } } }] }), "CrashLoopBackOff");
  assert.equal(status({ phase: "Pending", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { waiting: { reason: "ImagePullBackOff" } } }] }), "ImagePullBackOff");
  assert.equal(status({ phase: "Failed", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { terminated: { reason: "OOMKilled", exitCode: 137 } } }] }), "OOMKilled");
  assert.equal(status({ phase: "Succeeded" }), "Succeeded");
  assert.equal(status({ phase: "Pending" }), "Pending");
});

test("a pod being deleted is Terminating, and restarts add up across containers", () => {
  const p = parsePods(list(pod("x", { phase: "Running", containerStatuses: [{ name: "a", ready: true, restartCount: 2, state: { running: {} } }, { name: "b", ready: true, restartCount: 3, state: { running: {} } }] }, { containers: [{ name: "a" }, { name: "b" }] }, { deletionTimestamp: "2026-10-10T11:59:00Z" })), NOW)[0];
  assert.equal(p.status, "Terminating");
  assert.equal(p.restarts, 5);
  assert.equal(p.ready, "2/2");
});

test("bad input gives no pods", () => {
  assert.deepEqual(parsePods("nope", NOW), []);
  assert.deepEqual(parsePods("{}", NOW), []);
});

const first = (s: object, spec: object = {}) => parsePods(list(pod("x", s, spec)), NOW)[0];
const ids = (p: Pod) => podProblems(p, NOW).map((x) => x.id);

test("healthy pods have no problems", () => {
  assert.deepEqual(ids(first({ phase: "Running", containerStatuses: [{ name: "app", ready: true, restartCount: 0, state: { running: {} } }] })), []);
  assert.deepEqual(ids(first({ phase: "Succeeded" })), []);
});

test("CrashLoopBackOff says to read the logs and mentions the backoff", () => {
  const p = podProblems(first({ phase: "Running", containerStatuses: [{ name: "app", ready: false, restartCount: 6, state: { waiting: { reason: "CrashLoopBackOff" } }, lastState: { terminated: { reason: "Error", exitCode: 1 } } }] }), NOW)[0];
  assert.equal(p.id, "crashloop");
  assert.match(p.detail, /logs/i);
  assert.match(p.detail, /exit code 1/);
});

test("image pull failures point at the image name and registry access", () => {
  for (const reason of ["ImagePullBackOff", "ErrImagePull", "InvalidImageName"]) {
    const p = podProblems(first({ phase: "Pending", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { waiting: { reason } } }] }), NOW)[0];
    assert.equal(p.id, "image", reason);
    assert.match(p.detail, /image name/i);
    assert.match(p.detail, /registry/i);
  }
});

test("an out-of-memory kill is recognised from the current or the previous termination", () => {
  const now = podProblems(first({ phase: "Failed", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { terminated: { reason: "OOMKilled", exitCode: 137 } } }] }), NOW);
  assert.equal(now[0].id, "oom");
  const prev = podProblems(first({ phase: "Running", containerStatuses: [{ name: "app", ready: true, restartCount: 2, state: { running: {} }, lastState: { terminated: { reason: "OOMKilled", exitCode: 137 } } }] }), NOW);
  assert.equal(prev[0].id, "oom");
  assert.match(prev[0].detail, /memory limit/i);
});

test("an unschedulable pod explains where to look", () => {
  const p = podProblems(first({ phase: "Pending", conditions: [{ type: "PodScheduled", status: "False", reason: "Unschedulable", message: "0/1 nodes are available: 1 Insufficient memory." }] }), NOW)[0];
  assert.equal(p.id, "unschedulable");
  assert.match(p.detail, /Insufficient memory/);
  assert.match(p.detail, /taints|node selectors/i);
});

test("config errors, stuck starting and not-ready are each called out", () => {
  assert.deepEqual(ids(first({ phase: "Pending", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { waiting: { reason: "CreateContainerConfigError" } } }] })), ["config"]);
  const stuck = parsePods(list(pod("x", { phase: "Pending", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { waiting: { reason: "ContainerCreating" } } }] }, {}, { creationTimestamp: "2026-10-10T11:00:00Z" })), NOW)[0];
  assert.deepEqual(ids(stuck), ["stuck"]);
  const fresh = parsePods(list(pod("x", { phase: "Pending", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { waiting: { reason: "ContainerCreating" } } }] }, {}, { creationTimestamp: "2026-10-10T11:59:00Z" })), NOW)[0];
  assert.deepEqual(ids(fresh), []);
  assert.deepEqual(ids(first({ phase: "Running", containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { running: {} } }] })), ["notready"]);
});

test("deployments show ready over desired and flag shortfalls", () => {
  const d = parseDeployments(JSON.stringify({ items: [
    { metadata: { name: "web", namespace: "shop" }, spec: { replicas: 3 }, status: { readyReplicas: 3, updatedReplicas: 3, availableReplicas: 3 } },
    { metadata: { name: "api", namespace: "shop" }, spec: { replicas: 2 }, status: { updatedReplicas: 2 } },
  ] }));
  assert.deepEqual(d.map((x) => [x.name, x.ready, x.healthy]), [["web", "3/3", true], ["api", "0/2", false]]);
});

test("services show type, address and ports", () => {
  const s = parseServices(JSON.stringify({ items: [
    { metadata: { name: "web", namespace: "shop" }, spec: { type: "ClusterIP", clusterIP: "10.43.0.5", ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }] } },
    { metadata: { name: "db", namespace: "shop" }, spec: { type: "NodePort", clusterIP: "10.43.0.6", ports: [{ port: 5432, targetPort: "pg", protocol: "TCP", nodePort: 30432 }] } },
  ] }));
  assert.equal(s[0].ports, "80→8080/TCP");
  assert.equal(s[1].ports, "5432→pg/TCP (node port 30432)");
  assert.equal(s[0].address, "10.43.0.5");
});

test("nodes show readiness and version", () => {
  const n = parseNodes(JSON.stringify({ items: [{ metadata: { name: "colima" }, status: { nodeInfo: { kubeletVersion: "v1.30.2+k3s1" }, conditions: [{ type: "Ready", status: "True" }] } }] }));
  assert.deepEqual(n, [{ name: "colima", ready: true, version: "v1.30.2+k3s1" }]);
});

test("events keep warnings first-class and newest first", () => {
  const ev = parseK8sEvents(JSON.stringify({ items: [
    { type: "Normal", reason: "Pulled", message: "ok", involvedObject: { kind: "Pod", name: "web", namespace: "shop" }, count: 1, lastTimestamp: "2026-10-10T11:00:00Z" },
    { type: "Warning", reason: "BackOff", message: "Back-off restarting failed container", involvedObject: { kind: "Pod", name: "api", namespace: "shop" }, count: 12, lastTimestamp: "2026-10-10T11:30:00Z" },
  ] }));
  assert.deepEqual(ev.map((e) => e.reason), ["BackOff", "Pulled"]);
  assert.equal(ev[0].object, "pod/api");
  assert.equal(ev[0].warning, true);
  assert.equal(ev[0].count, 12);
});

import { parseNamespaces } from "./k8s.ts";

test("namespaces are listed by name", () => {
  assert.deepEqual(parseNamespaces(JSON.stringify({ items: [{ metadata: { name: "shop" } }, { metadata: { name: "default" } }] })), ["default", "shop"]);
  assert.deepEqual(parseNamespaces("nope"), []);
});
