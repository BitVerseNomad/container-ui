import test from "node:test";
import assert from "node:assert/strict";
import { rank, score } from "./fuzzy.ts";

const names = ["service-search-service", "search-service", "service-metadata-service", "services-service", "kafka-ui", "shop"];
const top = (q: string) => rank(names, q, (n) => n).map((n) => n);

test("Given words separated by spaces, when searched, then a name joined by hyphens matches", () => {
  assert.deepEqual(top("search service").slice(0, 2), ["search-service", "service-search-service"]);
  assert.ok(top("SEARCH_service").includes("search-service"));
});

test("Given the initials of a name, when searched, then it matches and comes first", () => {
  assert.equal(top("sss")[0], "service-search-service");
  assert.equal(top("SMS")[0], "service-metadata-service");
});

test("Given letters typed in order with some left out, when searched, then the name still matches", () => {
  assert.ok(top("srchsvc").includes("search-service"));
  assert.ok(top("kfk").includes("kafka-ui"));
});

test("Given an exact name or a prefix, when ranked, then it beats a match further inside a longer name", () => {
  assert.equal(top("search-service")[0], "search-service");
  assert.equal(top("serv")[0].startsWith("serv"), true);
  assert.equal(top("shop")[0], "shop");
});

test("Given letters that are not in the name in that order, when searched, then it doesn't match", () => {
  assert.equal(score("kafka-ui", "xyz"), 0);
  assert.equal(score("shop", "pohs"), 0);
  assert.deepEqual(top("zzz"), []);
});

test("Given an empty search, when ranked, then the list keeps its own order", () => {
  assert.deepEqual(top("  "), names);
});

test("Given a folder path as well as the name, when searched, then a word from the path also finds it", () => {
  const ps = [{ name: "api", dir: "/Users/me/Dev/payments/api" }, { name: "web", dir: "/Users/me/Dev/shop/web" }];
  assert.deepEqual(rank(ps, "payments", (p) => p.name, (p) => p.dir).map((p) => p.name), ["api"]);
  assert.deepEqual(rank(ps, "web", (p) => p.name, (p) => p.dir).map((p) => p.name), ["web"]);
});

test("Given the two search projects on a real Mac, when searched by words or initials, then both are found", () => {
  const real = ["permissions_client", "global-search-service", "terraform-aws-opensearch", "service-search-service", "kafka-ui"];
  const hits = (q: string) => rank(real, q, (n) => n);
  assert.deepEqual(hits("search service").slice(0, 2).sort(), ["global-search-service", "service-search-service"]);
  assert.equal(hits("sss")[0], "service-search-service");
  assert.equal(hits("gss")[0], "global-search-service");
});
