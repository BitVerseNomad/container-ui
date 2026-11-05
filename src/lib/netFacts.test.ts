import test from "node:test";
import assert from "node:assert/strict";
import { dnsDone, parseProxy, proxyChange, vmHasProxy, vpnInterfaces } from "./netFacts.ts";

const scutil = (rows: Record<string, string>) => `<dictionary> {\n${Object.entries(rows).map(([k, v]) => `  ${k} : ${v}`).join("\n")}\n  ExceptionsList : <array> {\n    0 : *.local\n  }\n}\n`;

test("Given scutil shows no proxy, when read, then nothing is set", () => {
  assert.deepEqual(parseProxy("<dictionary> {\n}\n"), { http: null, https: null, auto: false });
});

test("Given an HTTP and HTTPS proxy, when read, then each is a URL with its port", () => {
  const p = parseProxy(scutil({ HTTPEnable: "1", HTTPProxy: "proxy.corp", HTTPPort: "8080", HTTPSEnable: "1", HTTPSProxy: "proxy.corp", HTTPSPort: "8443" }));
  assert.deepEqual(p, { http: "http://proxy.corp:8080", https: "http://proxy.corp:8443", auto: false });
});

test("Given a proxy that is switched off or an automatic file, when read, then the off one is ignored and auto is noted", () => {
  const p = parseProxy(scutil({ HTTPEnable: "0", HTTPProxy: "old.corp", HTTPPort: "1", ProxyAutoConfigEnable: "1" }));
  assert.deepEqual(p, { http: null, https: null, auto: true });
});

test("Given ifconfig output, when read, then only a tunnel with an IPv4 address counts as a VPN", () => {
  const out = "lo0: flags=8049<UP> mtu 16384\n\tinet 127.0.0.1 netmask 0xff000000\nutun0: flags=8051<UP> mtu 1500\n\tinet6 fe80::1%utun0 prefixlen 64\nutun1: flags=8051<UP> mtu 1300\n\tinet 100.96.0.87 --> 100.96.0.87 netmask 0xffffffff\n\tinet6 fe80::2%utun1 prefixlen 64\nen0: flags=8863<UP> mtu 1500\n\tinet 192.168.1.20 netmask 0xffffff00\n";
  assert.deepEqual(vpnInterfaces(out), ["utun1"]);
  assert.deepEqual(vpnInterfaces("utun0: flags=8051<UP>\n\tinet6 fe80::1%utun0 prefixlen 64\n"), []);
});

test("Given a Mac proxy and a saved VM env, when planned, then the saved settings are kept and both name styles carry the proxy", () => {
  const r = proxyChange({ http: "http://proxy.corp:8080", https: null, auto: false }, { TZ: "UTC", http_proxy: "http://old:1" });
  assert.ok(r && "change" in r);
  assert.deepEqual(r.change, { kind: "proxy", env: [["TZ", "UTC"], ["HTTP_PROXY", "http://proxy.corp:8080"], ["http_proxy", "http://proxy.corp:8080"]], before: [["TZ", "UTC"], ["http_proxy", "http://old:1"]], summary: "proxy.corp:8080" });
});

test("Given a proxy on localhost or a saved value with a comma, when planned, then it says why it can't be passed", () => {
  const local = proxyChange({ http: "http://127.0.0.1:3128", https: null, auto: false }, {});
  assert.ok(local && "why" in local && /localhost/.test(local.why));
  const comma = proxyChange({ http: "http://p:1", https: null, auto: false }, { NO_PROXY: "a,b" });
  assert.ok(comma && "why" in comma && /comma/.test(comma.why));
  assert.equal(proxyChange({ http: null, https: null, auto: false }, {}), null);
});

test("Given a saved env, when asked whether it has a proxy, then either name style counts", () => {
  assert.equal(vmHasProxy({ https_proxy: "x" }), true);
  assert.equal(vmHasProxy({ TZ: "UTC" }), false);
  assert.equal(vmHasProxy(null), false, "an environment the app could not read is not claimed either way");
});

test("Given an environment the app could not read, when a proxy is planned, then nothing is changed and the reason says so", () => {
  const r = proxyChange({ http: "http://p:1", https: null, auto: false }, null);
  assert.ok(r && "why" in r && /can't read the environment/.test(r.why));
});

test("Given the three answers of the name lookup after a restart, when worded, then each says what is true", () => {
  assert.equal(dnsDone("resolved"), "The VM can look up names again.");
  assert.match(dnsDone("failed"), /still can't look up names/);
  assert.match(dnsDone("unknown"), /couldn't check names/);
  for (const v of ["resolved", "failed", "unknown"] as const) assert.ok(!/[—–]|--/.test(dnsDone(v)));
});
