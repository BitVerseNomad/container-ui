import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, buildPath, type Route, DEFAULT_PATH, DETAIL_TABS, PAGE_TABS } from "./routes.ts";

test("Given the hash '#/containers', when parsed, then the route is { page: 'containers' }", () => {
  assert.deepStrictEqual(parseRoute("#/containers"), { page: "containers" });
});

test("Given '#/containers/abc', when parsed, then the id is 'abc' and the tab is 'logs'", () => {
  assert.deepStrictEqual(parseRoute("#/containers/abc"), { page: "containers", id: "abc", tab: "logs" });
});

test("Given '#/containers/abc/stats', when parsed, then the tab is 'stats'", () => {
  assert.deepStrictEqual(parseRoute("#/containers/abc/stats"), { page: "containers", id: "abc", tab: "stats" });
});

test("Given '#/containers/abc/nope', when parsed, then the result is null", () => {
  assert.strictEqual(parseRoute("#/containers/abc/nope"), null);
});

test("Given '#/kubernetes', when parsed, then the tab is 'pods'", () => {
  assert.deepStrictEqual(parseRoute("#/kubernetes"), { page: "kubernetes", tab: "pods" });
});

test("Given '#/settings/engines', when parsed, then the page is 'settings' and the tab is 'engines'", () => {
  assert.deepStrictEqual(parseRoute("#/settings/engines"), { page: "settings", tab: "engines" });
});

test("Given '#/volumes/extra', when parsed, then the result is null", () => {
  assert.strictEqual(parseRoute("#/volumes/extra"), null);
});

test("Given '#/images/nginx%3A1.27/layers', when parsed, then the id is 'nginx:1.27'", () => {
  assert.deepStrictEqual(parseRoute("#/images/nginx%3A1.27/layers"), { page: "images", id: "nginx:1.27", tab: "layers" });
});

test("Given the empty hash, '#' and '#/', when parsed, then each result is null", () => {
  for (const hash of ["", "#", "#/"]) {
    assert.strictEqual(parseRoute(hash), null);
  }
});

test("Given a route with an id containing ':' and '/', when built and parsed again, then the same route comes back", () => {
  const route: Route = { page: "images", id: "nginx:1.27/sha", tab: "layers" };
  assert.deepStrictEqual(parseRoute(buildPath(route)), route);
});

test("Given every page and every tab in DETAIL_TABS and PAGE_TABS, when built and parsed, then each round-trips", () => {
  for (const [page, tabs] of Object.entries(DETAIL_TABS)) {
    for (const tab of tabs) {
      const route = { page, id: "abc", tab } as Route;
      assert.deepStrictEqual(parseRoute(buildPath(route)), route);
    }
  }
  for (const [page, tabs] of Object.entries(PAGE_TABS)) {
    for (const tab of tabs) {
      const route = { page, tab } as Route;
      assert.deepStrictEqual(parseRoute(buildPath(route)), route);
    }
  }
  for (const page of ["volumes", "networks", "registries", "doctor", "setup"]) {
    const route = { page } as Route;
    assert.deepStrictEqual(parseRoute(buildPath(route)), route);
  }
});

test("Given '#/dev/gallery', when parsed, then the result is null", () => {
  assert.strictEqual(parseRoute("#/dev/gallery"), null);
});
