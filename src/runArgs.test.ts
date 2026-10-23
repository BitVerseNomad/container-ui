import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRunArgs, folderProblem, isHostFolder, parseEnv, parseExposedPorts, presetEnv, defaultName, shouldCleanup, hintFor,
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

test("a network adds --network after the name; no network adds nothing", () => {
  assert.deepEqual(buildRunArgs({ ...base, network: "devnet" }), { ok: true, args: ["run", "-d", "--name", "web", "--network", "devnet", "nginx"] });
  assert.deepEqual(buildRunArgs({ ...base, network: "" }), { ok: true, args: ["run", "-d", "--name", "web", "nginx"] });
});

test("bad or flag-like network names are rejected", () => {
  for (const network of ["-x", "bad name", "host\n"]) assert.equal(buildRunArgs({ ...base, network }).ok, false, network);
});

test("host networking is refused", () => {
  assert.equal(buildRunArgs({ ...base, network: "host" }).ok, false);
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
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-v", "data:/var/lib/mysql", "-v", "/Users/me/app:/app:ro", "nginx"] });
});

test("volumes reject relative targets, colons and flag-like sources", () => {
  for (const volumes of [
    [{ source: "data", target: "var/lib" }],
    [{ source: "da:ta", target: "/x" }],
    [{ source: "-v", target: "/x" }],
    [{ source: "", target: "/x" }],
    [{ source: "/", target: "/host" }],
    [{ source: "/var/run", target: "/r" }],
    [{ source: "/Users/me", target: "/h" }],
    [{ source: "/Users/me/.ssh", target: "/k" }],
    [{ source: "/Users/me/code/../.aws", target: "/k" }],
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

test("given a host folder and no choice when built then it is mounted read-only", () => {
  const r = buildRunArgs({ ...base, volumes: [{ source: "/Users/me/code/app", target: "/app" }] });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-v", "/Users/me/code/app:/app:ro", "nginx"] });
});

test("given a host folder the container may change when built then it has no :ro", () => {
  const r = buildRunArgs({ ...base, volumes: [{ source: "/Users/me/code/app", target: "/app", writable: true }] });
  assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-v", "/Users/me/code/app:/app", "nginx"] });
});

test("given a named volume when built then it is never read-only, whatever the flag says", () => {
  for (const writable of [undefined, false, true]) {
    const r = buildRunArgs({ ...base, volumes: [{ source: "pgdata", target: "/var/lib/postgresql/data", writable }] });
    assert.deepEqual(r, { ok: true, args: ["run", "-d", "--name", "web", "-v", "pgdata:/var/lib/postgresql/data", "nginx"] });
  }
});

test("given a folder inside Library or a hidden folder when built then it is refused with the plain reason", () => {
  for (const source of ["/Users/me/Library", "/Users/me/Library/Keychains", "/Users/me/library/Mail", "/Users/me/library/x", "/Users/me/LIBRARY", "/Users/me/.ssh", "/Users/me/code/.git", "/Users/me/code/../.aws"]) {
    const r = buildRunArgs({ ...base, volumes: [{ source, target: "/x" }] });
    assert.equal(r.ok, false, source);
    assert.match(r.ok ? "" : r.errors.join(" "), /Library or hidden folders can't be shared/, source);
    assert.match(folderProblem(source) ?? "", /Library or hidden folders can't be shared/, source);
  }
});

test("given an ordinary folder or a volume name when checked then there is no folder problem", () => {
  assert.equal(folderProblem("/Users/me/code/app"), null);
  assert.equal(folderProblem("/Users/me/LibraryOfCode/app"), null);
  assert.equal(folderProblem("pgdata"), null);
  assert.equal(folderProblem(""), null);
});

test("given a source when asked then only a path is a host folder", () => {
  assert.equal(isHostFolder("/Users/me/code/app"), true);
  assert.equal(isHostFolder("pgdata"), false);
  assert.equal(isHostFolder(""), false);
});
