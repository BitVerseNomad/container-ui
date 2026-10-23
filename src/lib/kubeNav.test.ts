import test from "node:test";
import assert from "node:assert/strict";
import { contextNames, kubernetesOn } from "./kubeNav.ts";

test("given kubectl's context list when read then each name is one entry and blank lines are dropped", () => {
  assert.deepEqual(contextNames("colima\ncolima-work\n\n  minikube  \n"), ["colima", "colima-work", "minikube"]);
  assert.deepEqual(contextNames(""), []);
});

test("given the contexts when a profile's own context is there then Kubernetes is on for it", () => {
  assert.equal(kubernetesOn("colima", ["colima", "minikube"]), true);
  assert.equal(kubernetesOn("colima-work", ["colima"]), false);
});

test("given the contexts are not known yet when asked then the answer is unknown, not off", () => {
  assert.equal(kubernetesOn("colima", null), null);
});
