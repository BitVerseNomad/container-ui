import test from "node:test";
import assert from "node:assert/strict";
import { isWebPort } from "./webPort.ts";

test("given common web ports inside the container when checked then they are web", () => {
  for (const p of [80, 443, 3000, 3999, 4200, 5000, 5173, 8000, 8080, 8999, 9000, 9090]) assert.equal(isWebPort(p, p), true, String(p));
});

test("given database and broker ports when checked then they are not web, even where the web ranges overlap", () => {
  for (const p of [3306, 5432, 6379, 27017, 9092, 5672, 11211, 1433, 3389, 22]) assert.equal(isWebPort(p, p), false, String(p));
});

test("given a web port inside the container published on an odd host port when checked then it is web", () => {
  assert.equal(isWebPort(80, 3306), true);
  assert.equal(isWebPort(8080, 49153), true);
});

test("given a database port inside the container published on a web-looking host port when checked then it is not web", () => {
  assert.equal(isWebPort(5432, 8080), false);
  assert.equal(isWebPort(3306, 3000), false);
});

test("given an unknown container port when checked then the host port decides", () => {
  assert.equal(isWebPort(1234, 8081), true);
  assert.equal(isWebPort(1234, 1234), false);
  assert.equal(isWebPort(null, 8081), true);
  assert.equal(isWebPort(null, 6379), false);
});

test("given a port outside any list when checked then it is not web", () => {
  assert.equal(isWebPort(2222, 2222), false);
  assert.equal(isWebPort(0, 0), false);
});
