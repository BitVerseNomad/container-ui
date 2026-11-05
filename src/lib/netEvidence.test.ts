import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeNetwork, notePullFailure, notePullOk, recentPullFailure, subscribePull } from "./netEvidence.ts";

test("Given pull errors, when sorted, then timeouts and refused connections look like the network and wrong names and logins do not", () => {
  for (const e of ["Get \"https://registry-1.docker.io/v2/\": dial tcp 1.2.3.4:443: i/o timeout", "connection refused", "net/http: TLS handshake timeout", "proxyconnect tcp: dial tcp: lookup proxy.corp: no such host", "no route to host"]) assert.equal(looksLikeNetwork(e), true, e);
  for (const e of ["pull access denied for nope, repository does not exist", "manifest for x:9 not found", "unauthorized: authentication required"]) assert.equal(looksLikeNetwork(e), false, e);
});

test("Given a failed pull, when read back, then it is there for half an hour, and a pull that worked clears it", () => {
  notePullFailure("i/o timeout", 1_000);
  assert.equal(recentPullFailure(1_000 + 29 * 60_000), "i/o timeout");
  assert.equal(recentPullFailure(1_000 + 31 * 60_000), null);
  notePullFailure("i/o timeout", 5_000);
  notePullOk();
  assert.equal(recentPullFailure(5_001), null);
  notePullFailure("manifest not found", 6_000);
  assert.equal(recentPullFailure(6_001), null, "a failure that is not the network is not kept");
});

test("Given the Doctor is listening, when a pull fails or works, then it is told, so the line shows without waiting for a poll", () => {
  let told = 0;
  const off = subscribePull(() => { told++; });
  notePullFailure("i/o timeout");
  notePullOk();
  off();
  notePullFailure("i/o timeout");
  assert.equal(told, 2);
  notePullOk();
});
