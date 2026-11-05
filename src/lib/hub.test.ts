import test from "node:test";
import assert from "node:assert/strict";
import { isOfficial, sortHits, type Hit } from "./hub.ts";

const hit = (Name: string, StarCount: string, IsOfficial = ""): Hit => ({ Name, Description: "", StarCount, IsOfficial });

test("isOfficial accepts every form docker prints", () => {
  for (const yes of ["OK", "[OK]", "true", "TRUE", true]) assert.equal(isOfficial(yes as never), true, String(yes));
  for (const no of ["", "false", "no", undefined, false]) assert.equal(isOfficial(no as never), false, String(no));
});

const hits = [hit("bitnami/mysql", "120"), hit("mysql", "15700", "[OK]"), hit("zeta/db", "15700"), hit("acme/mysql", "9")];

test("stars sorts most first and breaks ties by name", () => {
  assert.deepEqual(sortHits(hits, "stars").map((h) => h.Name), ["mysql", "zeta/db", "bitnami/mysql", "acme/mysql"]);
});

test("name sorts A to Z, ignoring case", () => {
  assert.deepEqual(sortHits([hit("Zed", "1"), hit("alpha", "2")], "name").map((h) => h.Name), ["alpha", "Zed"]);
  assert.deepEqual(sortHits(hits, "name").map((h) => h.Name), ["acme/mysql", "bitnami/mysql", "mysql", "zeta/db"]);
});

test("official first keeps official images on top, then stars", () => {
  assert.deepEqual(sortHits(hits, "official").map((h) => h.Name), ["mysql", "zeta/db", "bitnami/mysql", "acme/mysql"]);
  assert.equal(sortHits([hit("a", "1"), hit("b", "1", "OK")], "official")[0].Name, "b");
});

test("sorting never mutates the input and tolerates bad star counts", () => {
  const input = [hit("b", "x"), hit("a", "5")];
  const out = sortHits(input, "stars");
  assert.deepEqual(input.map((h) => h.Name), ["b", "a"]);
  assert.deepEqual(out.map((h) => h.Name), ["a", "b"]);
});
