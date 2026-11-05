import test from "node:test";
import assert from "node:assert/strict";
import { buildRef, checkRef, isAuthError, loginCommand, needsLogin, presetFor, PRESETS } from "./registry.ts";

const check = (host: string, path: string, tag = "latest") => checkRef({ host, path, tag });
const reasonOf = (r: ReturnType<typeof checkRef>) => (r.ok ? "" : r.reason);

test("Given a host, path and tag, when building the reference, then it reads host/path:tag", () => {
  assert.equal(buildRef({ host: "ghcr.io", path: "acme/api", tag: "1.4" }), "ghcr.io/acme/api:1.4");
});

test("Given an empty tag, when building the reference, then it falls back to latest", () => {
  assert.equal(buildRef({ host: "ghcr.io", path: "acme/api", tag: "  " }), "ghcr.io/acme/api:latest");
});

test("Given stray spaces and slashes, when building the reference, then they are trimmed", () => {
  assert.equal(buildRef({ host: " ghcr.io ", path: " /acme/api/ ", tag: " 2 " }), "ghcr.io/acme/api:2");
});

test("Given a valid reference, when checking it, then it is ok and carries the full reference", () => {
  assert.deepEqual(check("ghcr.io", "acme/api", "1.4"), { ok: true, ref: "ghcr.io/acme/api:1.4" });
});

test("Given each style of host, when checking, then all are accepted", () => {
  for (const host of ["ghcr.io", "public.ecr.aws", "123456789012.dkr.ecr.eu-west-1.amazonaws.com", "europe-west1-docker.pkg.dev", "harbor.corp.example:8443", "localhost:5000"])
    assert.equal(check(host, "team/app").ok, true, host);
});

test("Given a Google Artifact Registry path with three parts, when checking, then it is accepted", () => {
  assert.equal(check("us-docker.pkg.dev", "my-project/my-repo/api", "v1").ok, true);
});

test("Given a missing host or path, when checking, then it asks for the missing part", () => {
  assert.deepEqual(check("", "acme/api"), { ok: false, reason: "Enter the registry host, like ghcr.io." });
  assert.deepEqual(check("ghcr.io", ""), { ok: false, reason: "Enter the image path, like acme/api." });
});

test("Given a host with a scheme or a slash, when checking, then it is refused", () => {
  assert.match(reasonOf(check("https://ghcr.io", "acme/api")), /without https:\/\//);
  assert.equal(check("ghcr.io/acme", "api").ok, false);
});

test("Given an unfilled preset template, when checking, then it says to replace the placeholders", () => {
  assert.match(reasonOf(check("<account>.dkr.ecr.<region>.amazonaws.com", "app")), /Replace <account> and <region>/);
  assert.match(reasonOf(check("<region>-docker.pkg.dev", "app")), /Replace <region>/);
});

test("Given a version typed into the path, when checking, then it points at the Tag box", () => {
  for (const path of ["acme/api:1.4", "acme/api@sha256:abc"]) assert.match(reasonOf(check("ghcr.io", path)), /Tag box/, path);
});

test("Given an uppercase or odd path, when checking, then it is refused", () => {
  for (const path of ["Acme/Api", "acme//api", "-acme/api", "acme/api name"]) assert.equal(check("ghcr.io", path).ok, false, path);
});

test("Given a bad tag, when checking, then it is refused, and a 128 character tag is still fine", () => {
  assert.equal(check("ghcr.io", "acme/api", "bad tag").ok, false);
  assert.equal(check("ghcr.io", "acme/api", "-x").ok, false);
  assert.equal(check("ghcr.io", "acme/api", "x".repeat(129)).ok, false);
  assert.equal(check("ghcr.io", "acme/api", "x".repeat(128)).ok, true);
});

test("Given a host that could pass as a flag, when checking, then it is never ok", () => {
  assert.equal(check("-v", "acme/api").ok, false);
});

test("Given docker auth failures, when classifying, then they are auth errors", () => {
  for (const msg of [
    'Error response from daemon: Head "https://ghcr.io/v2/acme/api/manifests/1": unauthorized',
    "pull access denied for acme/api, repository does not exist or may require 'docker login': denied: requested access to the resource is denied",
    "Error: no basic auth credentials",
    'Error response from daemon: Get "https://x/v2/": authentication required',
    "UNAUTHORIZED: authentication required",
  ])
    assert.equal(isAuthError(msg), true, msg);
});

test("Given other pull failures, when classifying, then they are not auth errors", () => {
  for (const msg of ["Error response from daemon: manifest unknown", "dial tcp: lookup ghcr.io: no such host", "context deadline exceeded", ""])
    assert.equal(isAuthError(msg), false, msg);
});

test("Given a host, when asking for the login command, then it is docker login with that host", () => {
  assert.equal(loginCommand("ghcr.io"), "docker login ghcr.io");
  assert.equal(loginCommand("  harbor.corp.example:8443 "), "docker login harbor.corp.example:8443");
});

test("Given the presets, when listing them, then each has a label, a host and an example path", () => {
  assert.deepEqual(PRESETS.map((p) => p.label), ["GitHub (ghcr.io)", "AWS public (public.ecr.aws)", "AWS ECR", "Google Artifact Registry"]);
  for (const p of PRESETS) assert.ok(p.host && p.pathExample);
});

test("Given a host, when finding its preset, then known hosts match and others do not", () => {
  assert.equal(presetFor("ghcr.io")?.id, "ghcr");
  assert.equal(presetFor("123456789012.dkr.ecr.us-east-1.amazonaws.com")?.id, "ecr");
  assert.equal(presetFor("<account>.dkr.ecr.<region>.amazonaws.com")?.id, "ecr");
  assert.equal(presetFor("europe-west1-docker.pkg.dev")?.id, "gar");
  assert.equal(presetFor("harbor.corp.example"), undefined);
});

test("given a private AWS ECR host, when the login command is built, then it signs in through the AWS CLI for that region", () => {
  assert.equal(loginCommand("123456789012.dkr.ecr.eu-west-1.amazonaws.com"), "aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.eu-west-1.amazonaws.com");
});

test("given the public ECR gallery, when the login command is built, then it uses the public ECR sign-in", () => {
  assert.equal(loginCommand("public.ecr.aws"), "aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws");
});

test("given a host with no dot, port or localhost, when checking, then it is refused because docker would pull it from Docker Hub", () => {
  assert.equal(check("harbor", "acme/api").ok, false);
  assert.match(reasonOf(check("harbor", "acme/api")), /Docker Hub/);
  assert.equal(check("harbor:5000", "acme/api").ok, true);
  assert.equal(check("localhost", "acme/api").ok, true);
});

test("given the docker socket permission error, when classifying, then it is not a sign-in problem", () => {
  assert.equal(isAuthError("permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock"), false);
});

test("given a host that is not a registry name, when asking for the login command, then there is none to copy", () => {
  assert.equal(loginCommand("ghcr.io; curl x|sh"), null);
  assert.equal(loginCommand(""), null);
});

test("given the public ECR gallery or Docker Hub style public hosts, when asking whether sign-in is needed, then public.ecr.aws needs none", () => {
  assert.equal(needsLogin("public.ecr.aws"), false);
  assert.equal(needsLogin("ghcr.io"), true);
});
