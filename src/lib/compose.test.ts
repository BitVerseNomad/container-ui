import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLabels, groupByProject, isKubeOwned, kubeName } from "./compose.ts";

test("given a label value with commas, when parsed, then the commas stay in that value", () => {
  const l = parseLabels("com.docker.compose.project=shop,com.docker.compose.project.config_files=/a/compose.yml,/a/override.yml,com.docker.compose.service=web");
  assert.equal(l.get("com.docker.compose.project"), "shop");
  assert.equal(l.get("com.docker.compose.project.config_files"), "/a/compose.yml,/a/override.yml");
  assert.equal(l.get("com.docker.compose.service"), "web");
});

test("given no labels, when parsed, then the map is empty", () => {
  assert.equal(parseLabels("").size, 0);
});

const c = (Names: string, Labels = "") => ({ Names, Labels });

test("given containers from two projects and loose ones, when grouped, then projects come first by name and loose ones last", () => {
  const g = groupByProject([c("solo"), c("shop-web-1", "com.docker.compose.project=shop"), c("blog-db-1", "com.docker.compose.project=blog"), c("shop-db-1", "com.docker.compose.project=shop")]);
  assert.deepEqual(g.map((x) => [x.project, x.rows.map((r) => r.Names)]), [["blog", ["blog-db-1"]], ["shop", ["shop-web-1", "shop-db-1"]], [null, ["solo"]]]);
});

test("given no compose containers, when grouped, then there is one ungrouped group", () => {
  const g = groupByProject([c("a"), c("b")]);
  assert.equal(g.length, 1);
  assert.equal(g[0].project, null);
});

test("given a compose container, when grouped, then its working dir is kept for display", () => {
  const g = groupByProject([c("shop-web-1", "com.docker.compose.project=shop,com.docker.compose.project.working_dir=/Users/me/shop")]);
  assert.equal(g[0].dir, "/Users/me/shop");
});

const pod = (Names: string) => c(Names, "io.kubernetes.pod.name=coredns-6799fbcd5-xk2p8,io.kubernetes.pod.namespace=kube-system");

test("given a container with Kubernetes pod labels, when checked, then it is Kubernetes-owned", () => {
  assert.equal(isKubeOwned(pod("k8s_coredns_coredns-6799fbcd5-xk2p8_kube-system_1")), true);
});

test("given a k8s_ name without labels, when checked, then it is still Kubernetes-owned", () => {
  assert.equal(isKubeOwned(c("k8s_POD_coredns-6799fbcd5-xk2p8_kube-system_0")), true);
});

test("given a normal or compose container, when checked, then it is not Kubernetes-owned", () => {
  assert.equal(isKubeOwned(c("web")), false);
  assert.equal(isKubeOwned(c("k8s-tools", "com.docker.compose.project=k8s")), false);
});

test("given Kubernetes, compose and loose containers, when grouped, then Kubernetes comes last in its own group", () => {
  const g = groupByProject([pod("k8s_coredns_x"), c("solo"), c("shop-web-1", "com.docker.compose.project=shop")]);
  assert.deepEqual(g.map((x) => [x.kind, x.project, x.rows.map((r) => r.Names)]), [["compose", "shop", ["shop-web-1"]], ["loose", null, ["solo"]], ["kubernetes", null, ["k8s_coredns_x"]]]);
});

test("given a Kubernetes container with pod labels, when named for people, then it reads container · pod · namespace", () => {
  const r = { Names: "k8s_coredns_coredns-6799fbcd5-x7q2k_kube-system_8a1b_0", Labels: "io.kubernetes.container.name=coredns,io.kubernetes.pod.name=coredns-6799fbcd5-x7q2k,io.kubernetes.pod.namespace=kube-system" };
  assert.equal(kubeName(r), "coredns · coredns-6799fbcd5-x7q2k · kube-system");
});

test("given a Kubernetes container with no labels, when named for people, then the parts come from its k8s_ name", () => {
  assert.equal(kubeName({ Names: "k8s_POD_coredns-6799fbcd5-x7q2k_kube-system_8a1b_0" }), "pause · coredns-6799fbcd5-x7q2k · kube-system");
});
