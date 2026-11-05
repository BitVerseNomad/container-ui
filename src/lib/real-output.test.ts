// Fixtures captured from a real Colima 0.10.1 VM (Docker 29.3.1, arm64) on 2026-10-22.
// They pin the parsers to what Docker actually prints, not to what we expected it to print.
import test from "node:test";
import assert from "node:assert/strict";
import { parseProbe } from "./network.ts";
import { parseEvents, timeline, parseVolumeSizes } from "./events.ts";
import { parseState, problemsFor, healthFromStatus } from "./health.ts";

const PROBE_NO_SHARED_NETWORK = `Server:\t\t192.168.5.1
Address:\t192.168.5.1#53

** server can't find cui-test-b: NXDOMAIN

::dns-exit=1
nc: getaddrinfo for host "cui-test-b" port 80: Name does not resolve
::tcp-exit=1
`;

const PROBE_SHARED_NETWORK = `Server:\t\t127.0.0.11
Address:\t127.0.0.11#53

Non-authoritative answer:
Name:\tcui-test-b
Address: 172.18.0.2

::dns-exit=0
Connection to cui-test-b (172.18.0.2) 80 port [tcp/http] succeeded!
::tcp-exit=0
`;

test("given real netshoot output, when the containers share no network, then name lookup and port both fail", () => {
  assert.deepEqual(parseProbe(PROBE_NO_SHARED_NETWORK), { dns: { ok: false, ip: null }, tcp: { ok: false } });
});

test("given real netshoot output, when the containers share a network, then the address and port are read", () => {
  assert.deepEqual(parseProbe(PROBE_SHARED_NETWORK), { dns: { ok: true, ip: "172.18.0.2" }, tcp: { ok: true } });
});

const EVENTS = [
  `{"Type":"network","Action":"connect","Actor":{"ID":"1110a925","Attributes":{"container":"9db74994","name":"bridge","type":"bridge"}},"scope":"local","time":1792687832,"timeNano":1792687832410040290}`,
  `{"Type":"container","Action":"start","Actor":{"ID":"9db74994","Attributes":{"image":"alpine:latest","name":"docker-ui-test"}},"scope":"local","time":1792687832,"timeNano":1792687832418292499}`,
  `{"Type":"container","Action":"health_status: unhealthy","Actor":{"ID":"6bf5675d","Attributes":{"image":"nginx:alpine","maintainer":"NGINX Docker Maintainers <docker-maint@nginx.com>","name":"cui-test-b"}},"scope":"local","time":1792689444,"timeNano":1792689444871533601}`,
].join("\n");

test("given real docker events, when parsed, then network events are skipped and health changes read despite the space after the colon", () => {
  const ev = parseEvents(EVENTS);
  assert.equal(ev.length, 2);
  assert.deepEqual(timeline(ev).map((l) => l.text), ["cui-test-b became unhealthy", "docker-ui-test started"]);
});

test("given real docker system df -v json, when parsed, then volume sizes come from the Volumes array", () => {
  const df = JSON.stringify({ Images: [], Containers: [], BuildCache: [], Volumes: [{ Availability: "N/A", Driver: "local", Group: "N/A", Labels: "", Links: "1", Mountpoint: "/var/lib/docker/volumes/cui-test-vol/_data", Name: "cui-test-vol", Scope: "local", Size: "3MB", Status: "N/A" }] });
  assert.deepEqual([...parseVolumeSizes(df)], [["cui-test-vol", 3e6]]);
});

test("given real docker ps status text, when a health check fails, then it reads as unhealthy", () => {
  assert.equal(healthFromStatus("Up 10 seconds (unhealthy)"), "unhealthy");
  assert.equal(healthFromStatus("Up 16 seconds"), null);
});

const SILENT_FAILING_CHECK = JSON.stringify([{ Name: "/cui-test-b", RestartCount: 0, State: { Status: "running", Running: true, OOMKilled: false, ExitCode: 0, StartedAt: "2026-10-22T17:17:18.699010857Z", Health: { Status: "unhealthy", FailingStreak: 41, Log: [{ Start: "2026-10-22T18:18:42.153916247+01:00", End: "2026-10-22T18:18:42.172506579+01:00", ExitCode: 1, Output: "" }] } } }]);

test("given a real inspect of a health check that fails silently, when explained, then the exit code is said instead of empty output", () => {
  const [p] = problemsFor(parseState(SILENT_FAILING_CHECK)!);
  assert.equal(p.id, "unhealthy");
  assert.equal(p.detail, "41 checks in a row have failed. The check exited with code 1 and printed nothing.");
});
