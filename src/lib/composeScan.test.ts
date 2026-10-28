import { test } from "node:test";
import assert from "node:assert/strict";
import { cdPath, projectName, projectsFrom, shellQuote, upCommand, whyFailed } from "./composeScan.ts";

const ctr = (Names: string, State: string, dir: string, project = dir.split("/").pop()!) => ({
  Names, State, Labels: `com.docker.compose.project=${project},com.docker.compose.project.working_dir=${dir}`,
});

test("given a folder name, when named like Compose does, then it is lowercased and stripped to letters, digits, dash and underscore", () => {
  assert.equal(projectName("My Shop.v2"), "myshopv2");
  assert.equal(projectName("orders-api_1"), "orders-api_1");
});

test("given two files in one folder, when grouped, then they are one project listing both files", () => {
  const p = projectsFrom(["/Users/me/code/shop/compose.yaml", "/Users/me/code/shop/docker-compose.yml"], []);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].files, ["compose.yaml", "docker-compose.yml"]);
});

test("given containers started from a folder, when matched, then the project counts them as running or stopped", () => {
  const p = projectsFrom(["/Users/me/code/shop/compose.yaml", "/Users/me/code/blog/compose.yml"], [ctr("shop-web-1", "running", "/Users/me/code/shop"), ctr("shop-db-1", "exited", "/Users/me/code/shop")]);
  const shop = p.find((x) => x.name === "shop")!;
  assert.deepEqual([shop.running, shop.total], [1, 2]);
  const blog = p.find((x) => x.name === "blog")!;
  assert.deepEqual([blog.running, blog.total], [0, 0]);
});

test("given projects with and without containers, when listed, then ones with containers come first, then by name", () => {
  const p = projectsFrom(["/Users/me/a/zeta/compose.yml", "/Users/me/a/alpha/compose.yml", "/Users/me/a/mid/compose.yml"], [ctr("zeta-x-1", "running", "/Users/me/a/zeta")]);
  assert.deepEqual(p.map((x) => x.name), ["zeta", "alpha", "mid"]);
});

test("given a container from a same-named folder elsewhere, when matched, then it does not count", () => {
  const p = projectsFrom(["/Users/me/code/shop/compose.yaml"], [ctr("shop-web-1", "running", "/Users/me/old/shop")]);
  assert.equal(p[0].total, 0);
});

test("given a path with spaces and a quote, when quoted for the shell, then it stays one safe word", () => {
  assert.equal(shellQuote("/Users/me/My Apps/it's"), `'/Users/me/My Apps/it'\\''s'`);
  assert.equal(upCommand("/Users/me/code/shop", "colima"), "cd '/Users/me/code/shop' && docker --context 'colima' compose up -d");
});

test("given a container started from the same folder written in another letter case, when matched, then it counts", () => {
  const p = projectsFrom(["/Users/me/Dev/shop/compose.yaml"], [ctr("shop-web-1", "running", "/Users/me/dev/shop")]);
  assert.equal(p[0].running, 1);
});

test("given a docker context, when the start command is built, then it targets that context so the project lands in the profile on screen", () => {
  assert.equal(upCommand("/Users/me/code/shop", "colima-work"), "cd '/Users/me/code/shop' && docker --context 'colima-work' compose up -d");
});

test("Given a folder, when written as a command, then it works in bash and zsh alike", () => {
  assert.equal(cdPath("/Users/me/code/shop"), "~/code/shop");
  assert.equal(cdPath("/Users/me/My Apps/orders-api"), "'/Users/me/My Apps/orders-api'");
});

test("Given a start that failed on a taken port, when explained, then it names the container holding it", () => {
  const err = "Error response from daemon: driver failed programming external connectivity on endpoint blog-web-1: Bind for 0.0.0.0:8080 failed: port is already allocated";
  const web = { Names: "web", Ports: "0.0.0.0:8080->80/tcp, :::8080->80/tcp", Labels: "com.docker.compose.project=shop" };
  assert.equal(whyFailed(err, [{ Names: "db", Ports: "3306/tcp" }, web]), "Port 8080 is already used by web (in shop), so a service that needs it couldn't start. Stop web, then Start again.");
  assert.match(whyFailed(err, [])!, /^Port 8080 is already in use on your Mac/);
  assert.equal(whyFailed("no such image", [web]), null);
});
