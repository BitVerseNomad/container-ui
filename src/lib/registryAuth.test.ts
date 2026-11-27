import test from "node:test";
import assert from "node:assert/strict";
import { detectRegistryAuth, detectRegistryDenied } from "./registryAuth.ts";

const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";

test("Given a pull denied on an ECR image, when detected, then it gives the registry and region", () => {
  const text = `Error response from daemon: failed to resolve reference "${HOST}/shop/api:latest": pull access denied, repository does not exist or may require authorization: authorization failed: no basic auth credentials`;
  assert.deepEqual(detectRegistryAuth(text), { registry: HOST, region: "us-west-2" });
});

test("Given a FIPS host and a denied message, when detected, then the region is the fourth label", () => {
  const fips = "123456789012.dkr.ecr-fips.us-gov-west-1.amazonaws.com";
  assert.deepEqual(detectRegistryAuth(`${fips}/x:1: denied: Your authorization token has expired`), { registry: fips, region: "us-gov-west-1" });
});

test("Given a denied pull on another registry, when detected, then it is null", () => {
  assert.equal(detectRegistryAuth('failed to resolve reference "ghcr.io/acme/api:1": pull access denied, no basic auth credentials'), null);
});

test("Given an ECR host with no sign-in problem, when detected, then it is null", () => {
  assert.equal(detectRegistryAuth(`${HOST}/shop/api:latest: manifest unknown`), null);
});

test("Given an ECR host that is only a suffix of another domain, when detected, then it is null", () => {
  assert.equal(detectRegistryAuth(`${HOST}.evil.com/x: pull access denied`), null);
});

test("Given an unrelated error, when detected, then it is null", () => {
  assert.equal(detectRegistryAuth("Bind for 0.0.0.0:8080 failed: port is already allocated"), null);
});

test("Given an ECR 'not authorized to perform' denial, when checked, then it is a wrong-profile denial, and a plain missing login is not", () => {
  assert.equal(detectRegistryDenied(`denied: User: arn:aws:sts::123456789012:assumed-role/sandbox/me is not authorized to perform: ecr:BatchGetImage on resource: x`), true);
  assert.equal(detectRegistryDenied("pull access denied, no basic auth credentials"), false);
});
