// What the Mac says about its network, read-only: `scutil --proxy` (the system proxy settings) and `ifconfig` (the
// interfaces). Pure parsers. Facts: Lima passes a proxy to the VM only from the environment of the process that
// starts it, never from the system proxy settings; a VPN adds a utun interface with an IPv4 address, while the
// utun interfaces macOS keeps for itself carry only IPv6 link-local addresses.
import type { VmChange } from "./vmChange.ts";

export type Proxy = { http: string | null; https: string | null; auto: boolean };

// `scutil --proxy` prints "  HTTPEnable : 1", "  HTTPProxy : proxy.corp", "  HTTPPort : 8080" and so on.
export function parseProxy(out: string): Proxy {
  const v = new Map<string, string>();
  for (const l of out.split("\n")) {
    const m = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(l);
    if (m) v.set(m[1], m[2]);
  }
  const one = (p: "HTTP" | "HTTPS") => {
    const host = v.get(`${p}Proxy`);
    if (v.get(`${p}Enable`) !== "1" || !host || !/^[\w.-]+$/.test(host)) return null;
    const port = v.get(`${p}Port`);
    return port && /^\d{1,5}$/.test(port) ? `http://${host}:${port}` : `http://${host}`;
  };
  return { http: one("HTTP"), https: one("HTTPS"), auto: v.get("ProxyAutoConfigEnable") === "1" };
}

// A tunnel with an IPv4 address: a VPN client. The ones macOS makes for itself have none.
export function vpnInterfaces(out: string): string[] {
  const names: string[] = [];
  let cur: string | null = null;
  for (const l of out.split("\n")) {
    const head = /^(utun\d+):/.exec(l);
    if (head) cur = head[1];
    else if (/^\S/.test(l)) cur = null;
    else if (cur && /^\s+inet \d/.test(l) && !names.includes(cur)) names.push(cur);
  }
  return names;
}

// The VM variables that carry the proxy. The same value goes in the lower-case names programs in the VM read.
const NAMES = (kind: "HTTP" | "HTTPS") => (kind === "HTTP" ? ["HTTP_PROXY", "http_proxy"] : ["HTTPS_PROXY", "https_proxy"]);
const isProxyName = (k: string) => /^(http|https)_proxy$/i.test(k);

// The profile's saved environment is replaced by `--env`, so it is passed along with the proxy. Null when a saved
// value holds a comma or quote (Colima reads the flag as CSV) or the Mac has nothing a VM can use. saved null: the
// environment could not be read, so nothing is changed.
export function proxyChange(p: Proxy, saved: Record<string, string> | null): { change: VmChange } | { why: string } | null {
  const pairs: [string, string][] = [
    ...(p.http ? NAMES("HTTP").map((k): [string, string] => [k, p.http!]) : []),
    ...(p.https ? NAMES("HTTPS").map((k): [string, string] => [k, p.https!]) : []),
  ];
  if (!pairs.length) return null;
  // Inside the VM, localhost is the VM itself, so a proxy on the Mac's own loopback can't be reached by that name.
  if (pairs.some(([, v]) => /^http:\/\/(localhost|127\.|\[?::1)/i.test(v))) return { why: "The Mac's proxy runs on localhost, which the VM reaches under another name." };
  if (!saved) return { why: "The app can't read the environment saved in `colima.yaml`, so it won't change it." };
  const kept = Object.entries(saved).filter(([k]) => !isProxyName(k));
  if ([...kept, ...pairs].some(([k, v]) => !/^[A-Za-z_]\w*$/.test(k) || /[,"\n]/.test(v))) return { why: "A setting saved in this VM has a comma or quote in it, which the app can't pass along." };
  return { change: { kind: "proxy", env: [...kept, ...pairs], before: Object.entries(saved), summary: (p.http ?? p.https)!.replace(/^http:\/\//, "") } };
}

// Is the proxy already in the VM's saved environment?
export const vmHasProxy = (env: Record<string, string> | null) => !!env && Object.keys(env).some(isProxyName);

// The line after a restart for the network, from the name lookup run inside the VM once it was up.
export const dnsDone = (verdict: "resolved" | "failed" | "unknown") =>
  verdict === "resolved" ? "The VM can look up names again." : verdict === "failed" ? "The VM restarted, but it still can't look up names. Check the Mac's network, or your VPN's DNS." : "The VM restarted. The app couldn't check names from inside it, so run the checks again.";
