import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRunArgs, parseEnv, parseExposedPorts, presetEnv, defaultName, shouldCleanup, hintFor,
} from "./runArgs.ts";

const base = { image: "nginx", name: "web", ports: [], volumes: [], env: "" };

test("a minimal run is detached, named, and ends with the image", () => {
  assert.deepEqual(buildRunArgs(base), { ok: true, args: ["run", "-d", "--name", "web", "nginx"] });
});

test("ports bind to this Mac only (127.0.0.1) by default; an empty host publishes a random port", () => {
  const r = buildRunArgs({ ...base, ports: [{ host: "8080", container: "80" }, { host: "", container: "3306" }] });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-p", "127.0.0.1:8080:80", "-p", "127.0.0.1::3306", "nginx"] });
});

test("blank port, volume and env rows are ignored", () => {
  const r = buildRunArgs({ ...base, ports: [{ host: "", container: "" }], volumes: [{ source: "", target: "" }], env: "\n  \n" });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "nginx"] });
});

test("exposeAll lets other devices on the network connect (no 127.0.0.1 prefix)", () => {
  const r = buildRunArgs({ ...base, exposeAll: true, ports: [{ host: "8080", container: "80" }, { host: "", container: "3306" }] });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-p", "8080:80", "-p", "3306", "nginx"] });
});

test("bad port numbers are rejected", () => {
  for (const ports of [
    [{ host: "99999", container: "80" }],
    [{ host: "80", container: "abc" }],
    [{ host: "8080", container: "" }],
    [{ host: "0", container: "80" }],
  ]) {
    const r = buildRunArgs({ ...base, ports });
    assert.equal(r.ok, false);
  }
});

test("volumes accept a named volume or an absolute host path", () => {
  const r = buildRunArgs({ ...base, volumes: [{ source: "data", target: "/var/lib/mysql" }, { source: "/Users/me/app", target: "/app" }] });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-v", "data:/var/lib/mysql", "-v", "/Users/me/app:/app", "nginx"] });
});

test("volumes reject relative targets, colons and flag-like sources", () => {
  for (const volumes of [
    [{ source: "data", target: "var/lib" }],
    [{ source: "da:ta", target: "/x" }],
    [{ source: "-v", target: "/x" }],
    [{ source: "", target: "/x" }],
  ]) {
    assert.equal(buildRunArgs({ ...base, volumes }).ok, false);
  }
});

test("env lines become -e flags", () => {
  const r = buildRunArgs({ ...base, env: "A=1\nB=x=y z" });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-e", "A=1", "-e", "B=x=y z", "nginx"] });
});

test("parseEnv skips blanks and comments, and keeps = inside values", () => {
  assert.deepEqual(parseEnv("A=1\n\n# note\nB=x=y z"), { vars: ["A=1", "B=x=y z"], errors: [] });
});

test("parseEnv errors name the line", () => {
  const r = parseEnv("good=1\nbad line");
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /line 2/);
});

test("flag-like or invalid image and container names are rejected", () => {
  assert.equal(buildRunArgs({ ...base, image: "-v" }).ok, false);
  assert.equal(buildRunArgs({ ...base, image: "" }).ok, false);
  assert.equal(buildRunArgs({ ...base, name: "-x" }).ok, false);
  assert.equal(buildRunArgs({ ...base, name: "bad name" }).ok, false);
});

test("exposed ports are parsed from inspect JSON, tcp only, sorted", () => {
  assert.deepEqual(parseExposedPorts('{"33060/tcp":{},"3306/tcp":{}}'), ["3306", "33060"]);
  assert.deepEqual(parseExposedPorts('{"53/udp":{},"80/tcp":{}}'), ["80"]);
  assert.deepEqual(parseExposedPorts("null"), []);
  assert.deepEqual(parseExposedPorts(""), []);
  assert.deepEqual(parseExposedPorts("not json"), []);
});

test("known database images get the variable they need", () => {
  assert.equal(presetEnv("mysql:8"), "MYSQL_ROOT_PASSWORD=dev");
  assert.equal(presetEnv("docker.io/library/postgres"), "POSTGRES_PASSWORD=dev");
  assert.equal(presetEnv("mariadb:11"), "MARIADB_ROOT_PASSWORD=dev");
  assert.equal(presetEnv("nginx"), "");
});

test("defaultName is the repo name plus a suffix", () => {
  assert.equal(defaultName("ghcr.io/acme/my-app:1.2", "ab12"), "my-app-ab12");
  assert.equal(defaultName("nginx", "zz99"), "nginx-zz99");
  assert.equal(defaultName("nginx@sha256:abc", "q1"), "nginx-q1");
});

test("a failed run is cleaned up unless the name was already taken", () => {
  assert.equal(shouldCleanup("Bind for 0.0.0.0:80 failed: port is already allocated"), true);
  assert.equal(shouldCleanup('Conflict. The container name "/web" is already in use by container "abc"'), false);
});

test("hints explain the two most common run failures", () => {
  assert.match(hintFor("Bind for 0.0.0.0:80 failed: port is already allocated") ?? "", /host port/i);
  assert.match(hintFor("no matching manifest for linux/arm64/v8 in the manifest list entries") ?? "", /amd64/);
  assert.equal(hintFor("something else"), null);
});
