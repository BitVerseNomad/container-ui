import { test } from "node:test";
import assert from "node:assert/strict";
import { fixAllPlan, needsAttention, setupFindings, type SetupReport } from "./setup.ts";

const BREW = "/opt/homebrew/lib/docker/cli-plugins";
const dead = (name: string) => ({ name, target: `/Applications/Docker.app/Contents/Resources/cli-plugins/${name}`, broken: true });

// What a Mac looks like right after Docker Desktop is removed (captured on a real one, 2026-10-23).
const AFTER_DESKTOP: SetupReport = {
  plugins: [dead("docker-buildx"), dead("docker-compose"), dead("docker-scout"), { name: "docker-mcp", target: "/Users/me/.docker/modules/cli-plugins/docker-mcp", broken: false }],
  brew_plugin_dir: BREW,
  brew_plugins: ["docker-compose"],
  extra_dirs: [],
  creds_store: null,
  creds_helper_found: true,
  contexts: [{ name: "colima", current: true }, { name: "desktop-linux", current: false }],
  autostart: "none",
  testcontainers_host: null,
  testcontainers_override: true,
  shell_profile: "~/.zshrc",
  docker_desktop_installed: false,
  docker_desktop_data: false,
};
const HEALTHY: SetupReport = { ...AFTER_DESKTOP, plugins: [], brew_plugins: ["docker-buildx", "docker-compose"], extra_dirs: [BREW], autostart: "started", contexts: [{ name: "colima", current: true }] };
const vm = { cpus: 4, memory: 8 * 1024 ** 3 };
const byId = (r: SetupReport, v = vm) => new Map(setupFindings(r, v).map((f) => [f.id, f]));

test("given compose installed by Homebrew but hidden by a dead Docker Desktop link, when checked, then compose fails with the plugin fix", () => {
  const f = byId(AFTER_DESKTOP).get("compose")!;
  assert.equal(f.status, "fail");
  assert.match(f.title, /docker compose doesn't work/);
  assert.deepEqual(f.fix, { kind: "fix", id: "plugins", label: "Fix plugin links" });
});

test("given buildx is not installed, when checked, then the fix installs it and then links plugins", () => {
  const f = byId(AFTER_DESKTOP).get("buildx")!;
  assert.equal(f.status, "fail");
  assert.deepEqual(f.fix, { kind: "install", names: ["docker-buildx"], label: "Install docker-buildx", then: "plugins" });
});

test("given the commands shown before a fix, when the plugin fix is offered, then it names exactly the links it removes", () => {
  const f = byId(AFTER_DESKTOP).get("compose")!;
  assert.match(f.command!, /rm ~\/\.docker\/cli-plugins\/docker-buildx ~\/\.docker\/cli-plugins\/docker-compose ~\/\.docker\/cli-plugins\/docker-scout/);
  assert.doesNotMatch(f.command!, /cliPluginsExtraDirs/);
  assert.match(f.steps!.join("\n"), /cliPluginsExtraDirs/);
  assert.doesNotMatch(f.command!, /docker-mcp/);
});

test("given a healthy machine, when checked, then every check passes", () => {
  const out = setupFindings(HEALTHY, vm);
  assert.deepEqual(out.filter((f) => f.status !== "ok").map((f) => f.id), []);
  assert.ok(out.length >= 5);
});

test("given a leftover desktop credsStore with no helper, when checked, then pulls are said to fail and the fix removes it", () => {
  const f = byId({ ...HEALTHY, creds_store: "desktop", creds_helper_found: false }).get("creds")!;
  assert.equal(f.status, "fail");
  assert.deepEqual(f.fix, { kind: "fix", id: "creds_store", label: "Remove the setting" });
});

test("given the docker CLI still points at Docker Desktop, when checked, then it fails with the context fix", () => {
  const f = byId({ ...HEALTHY, contexts: [{ name: "colima", current: false }, { name: "desktop-linux", current: true }] }).get("context")!;
  assert.equal(f.status, "fail");
  assert.match(f.detail, /desktop-linux/);
  assert.deepEqual(f.fix, { kind: "fix", id: "use_colima_context", label: "Switch to Colima" });
});

test("given the work profile and its own context, when checked, then the context passes", () => {
  assert.equal(new Map(setupFindings({ ...HEALTHY, contexts: [{ name: "colima-work", current: true }] }, vm, "work").map((f) => [f.id, f])).get("context")!.status, "ok");
});

test("given Colima does not start at login, when checked, then it is a suggestion, not a failure", () => {
  const f = byId(AFTER_DESKTOP).get("autostart")!;
  assert.equal(f.status, "info");
  assert.deepEqual(f.fix, { kind: "fix", id: "autostart_on", label: "Start at login" });
});

test("given the default 2 CPU, 2 GiB VM and no bigger size to offer, when checked, then it warns and points at Profiles", () => {
  const f = byId(HEALTHY, { cpus: 2, memory: 2 * 1024 ** 3 }).get("resources")!;
  assert.equal(f.status, "warn");
  assert.match(f.title, /2 CPUs and 2 GiB/);
  assert.deepEqual(f.fix, { kind: "profiles", label: "Change in Profiles" });
  assert.equal(f.more, undefined);
  assert.match(setupFindings(HEALTHY, { cpus: 2, memory: 2 * 1024 ** 3 }, "default", false, { cpus: 2, memory: 2 }, 8 * 1024 ** 3).find((x) => x.id === "resources")!.detail, /Your Mac has 8 GB, so a bigger VM would slow the Mac down/);
});

test("given the default 2 CPU, 2 GiB VM on a Mac that can give it 6 and 8, when checked, then one click resizes it and Profiles is the other way", () => {
  const f = setupFindings(HEALTHY, { cpus: 2, memory: 2 * 1024 ** 3 }, "work", false, { cpus: 6, memory: 8 }, 32 * 1024 ** 3).find((x) => x.id === "resources")!;
  assert.equal(f.status, "warn");
  assert.equal(f.detail, "That is Colima's default. Your Mac has 32 GB, so the VM can have 6 CPUs and 8 GiB and leave the rest for macOS.");
  assert.deepEqual(f.fix, { kind: "resize", cpus: 6, memory: 8, label: "Give it 6 CPUs and 8 GiB" });
  assert.deepEqual(f.more, { kind: "profiles", label: "Change in Profiles" });
  assert.equal(f.command, "colima stop work\ncolima start work --cpu 6 --memory 8");
});

test("given a resize is offered, when Fix all is planned, then it is left out because it restarts the VM", () => {
  const all = setupFindings(AFTER_DESKTOP, { cpus: 2, memory: 2 * 1024 ** 3 }, "default", false, { cpus: 6, memory: 8 });
  assert.ok(all.some((f) => f.fix?.kind === "resize"));
  assert.ok(fixAllPlan(all).every((s) => s.kind === "install" || s.id !== ("resize" as never)));
  assert.equal(fixAllPlan(all).length, fixAllPlan(setupFindings(AFTER_DESKTOP, { cpus: 2, memory: 2 * 1024 ** 3 })).length);
});

test("given the VM was resized to 6 CPUs and 8 GiB, when checked again, then the row passes with the new size", () => {
  const f = setupFindings(HEALTHY, { cpus: 6, memory: 8 * 1024 ** 3 }, "default", false, { cpus: 6, memory: 8 }).find((x) => x.id === "resources")!;
  assert.equal(f.status, "ok");
  assert.equal(f.title, "The VM has 6 CPUs and 8 GiB");
});

test("given Testcontainers is pinned to Docker Desktop's socket, when checked, then it warns with the Colima socket", () => {
  const f = byId({ ...HEALTHY, testcontainers_host: "unix:///Users/me/.docker/run/docker.sock" }).get("testcontainers")!;
  assert.equal(f.status, "warn");
  assert.deepEqual(f.fix, { kind: "fix", id: "testcontainers", label: "Point to Colima" });
});

test("given no VM yet, when checked, then the resource check is skipped", () => {
  assert.equal(new Map(setupFindings(HEALTHY, null).map((f) => [f.id, f])).has("resources"), false);
});

test("given the app shows the work profile but the terminal uses default's colima, when checked, then it says which VM each one sees", () => {
  const f = setupFindings(HEALTHY, vm, "work").find((x) => x.id === "context")!;
  assert.equal(f.status, "warn");
  assert.match(f.detail, /colima-work/);
  assert.equal(f.command, "docker context use colima-work");
});

test("given a non-default profile, when the Testcontainers fix is offered, then it uses that profile's socket", () => {
  const f = setupFindings({ ...HEALTHY, testcontainers_host: "unix:///x.sock" }, vm, "work").find((x) => x.id === "testcontainers")!;
  assert.match(f.steps!.join("\n"), /\.colima\/work\/docker\.sock/);
});

test("given several leftovers, when planning Fix all, then each fix runs once and installs come before the link fix", () => {
  const plan = fixAllPlan(setupFindings({ ...AFTER_DESKTOP, creds_store: "desktop", creds_helper_found: false }, vm));
  assert.deepEqual(plan.map((s) => (s.kind === "install" ? `install ${s.names.join(" ")}` : s.id)), ["install docker-buildx", "plugins", "creds_store"]);
});

test("given fails, a warning and an info when counting attention then fails and warnings count, info does not", () => {
  const f = [{ status: "fail" }, { status: "warn" }, { status: "info" }, { status: "ok" }] as Parameters<typeof needsAttention>[0];
  assert.equal(needsAttention(f), 2);
});

test("given Colima does not start at login, when planning Fix all, then the info row is left alone", () => {
  const findings = setupFindings(AFTER_DESKTOP, vm);
  assert.equal(findings.find((f) => f.id === "autostart")!.status, "info");
  assert.ok(!fixAllPlan(findings).some((s) => s.kind === "fix" && (s.id === "autostart_on" || s.id === "autostart_restart")));
});

test("given the login service failed, when checked, then the fix restarts it and Fix all runs it", () => {
  const findings = setupFindings({ ...HEALTHY, autostart: "error" }, vm);
  const f = findings.find((x) => x.id === "autostart")!;
  assert.equal(f.status, "warn");
  assert.equal(f.command, "brew services restart colima");
  assert.deepEqual(f.fix, { kind: "fix", id: "autostart_restart", label: "Restart the service" });
  assert.deepEqual(fixAllPlan(findings), [{ kind: "fix", id: "autostart_restart" }]);
});

test("given config edits are needed, when commands are shown, then boxes hold only shell commands and the edits are steps", () => {
  const out = setupFindings({ ...AFTER_DESKTOP, creds_store: "desktop", creds_helper_found: false }, vm);
  for (const f of out) assert.doesNotMatch(f.command ?? "", /backup is kept|^(add|remove) /im, f.id);
  const creds = out.find((f) => f.id === "creds")!;
  assert.equal(creds.command, undefined);
  assert.match(creds.steps!.join("\n"), /Remove `credsStore` from `~\/\.docker\/config\.json` \(a backup is kept\)/);
});

test("given compose and buildx need the same plugin fix, when checked, then the steps show once and the second card points to them", () => {
  const out = byId(AFTER_DESKTOP);
  const compose = out.get("compose")!;
  const buildx = out.get("buildx")!;
  assert.match(compose.command!, /^rm /);
  assert.match(compose.steps!.join("\n"), /cliPluginsExtraDirs/);
  assert.equal(buildx.command, "brew install docker-buildx");
  assert.deepEqual(buildx.steps, ["Then the same link fix as above."]);
});

test("given Docker Desktop's context is still listed, when checked, then an info note explains its volumes stay behind", () => {
  const findings = setupFindings({ ...HEALTHY, contexts: [{ name: "colima", current: true }, { name: "desktop-linux", current: false }] }, vm);
  const f = findings.find((x) => x.id === "desktop_data")!;
  assert.equal(f.status, "info");
  assert.equal(f.title, "Your Docker Desktop volumes and images stay behind");
  assert.match(f.detail, /Colima starts empty\. Bring your volumes over before the first `docker compose up`/);
  assert.equal(f.command, undefined);
  assert.deepEqual(f.fix, { kind: "bring", label: "Bring them over" });
  assert.equal(needsAttention(findings), 0);
  assert.deepEqual(fixAllPlan(findings), []);
});

test("given no Docker Desktop context, when checked, then there is no volumes note", () => {
  assert.equal(byId(HEALTHY).has("desktop_data"), false);
});

test("given Testcontainers points elsewhere, when the fix is offered, then the app runs it and there is nothing to copy", () => {
  const f = byId({ ...HEALTHY, testcontainers_host: "unix:///x.sock" }).get("testcontainers")!;
  assert.equal(f.command, undefined);
  assert.match(f.steps!.join("\n"), /backup is kept/);
});

test("given Testcontainers and the context both need fixing, when planning Fix all, then both run", () => {
  const plan = fixAllPlan(setupFindings({ ...HEALTHY, testcontainers_host: "unix:///x.sock", contexts: [{ name: "desktop-linux", current: true }] }, vm));
  assert.deepEqual(plan.map((s) => (s.kind === "fix" ? s.id : "install")), ["use_colima_context", "testcontainers"]);
});

test("given Testcontainers points at another profile's socket, when checked for this profile, then it warns", () => {
  const other = setupFindings({ ...HEALTHY, testcontainers_host: "unix:///Users/me/.colima/work/docker.sock" }, vm, "default");
  assert.equal(other.find((f) => f.id === "testcontainers")?.status, "warn");
  const own = setupFindings({ ...HEALTHY, testcontainers_host: "unix:///Users/me/.colima/work/docker.sock" }, vm, "work");
  assert.equal(own.some((f) => f.id === "testcontainers"), false);
  assert.equal(setupFindings({ ...HEALTHY, testcontainers_host: "unix:///Users/me/.colima/docker.sock" }, vm).some((f) => f.id === "testcontainers"), false);
});

test("given the file points at Colima but the socket override is missing, when checked, then it warns and the same fix adds it", () => {
  const f = setupFindings({ ...HEALTHY, testcontainers_host: "unix:///Users/me/.colima/default/docker.sock", testcontainers_override: false }, vm).find((x) => x.id === "testcontainers")!;
  assert.equal(f.status, "warn");
  assert.match(f.title, /cleanup container/);
  assert.deepEqual(f.fix, { kind: "fix", id: "testcontainers", label: "Point to Colima" });
  assert.match(f.steps!.join("\n"), /TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE/);
});

test("given nobody uses Testcontainers, when checked, then the missing override is not a problem", () => {
  assert.equal(setupFindings({ ...HEALTHY, testcontainers_override: false }, vm).some((x) => x.id === "testcontainers"), false);
});

test("given the file points elsewhere and the override is missing, when the fix is offered, then its steps name both changes", () => {
  const f = setupFindings({ ...HEALTHY, testcontainers_host: "unix:///x.sock", testcontainers_override: false }, vm).find((x) => x.id === "testcontainers")!;
  assert.equal(f.steps!.length, 2);
});

test("given Docker Desktop is removed but its disk is left, when checked, then the bring-over row still shows", () => {
  const f = setupFindings({ ...HEALTHY, docker_desktop_data: true }, vm).find((x) => x.id === "desktop_data");
  assert.equal(f?.fix?.kind, "bring");
});

test("given the volumes were brought over, when checked, then the row passes and offers nothing", () => {
  const f = setupFindings({ ...HEALTHY, docker_desktop_data: true }, vm, "default", true).find((x) => x.id === "desktop_data")!;
  assert.deepEqual([f.status, f.title, f.fix], ["ok", "Docker Desktop volumes are in Colima", undefined]);
});
