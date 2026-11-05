// Reads the few settings of a Colima profile (~/.colima/<profile>/colima.yaml) the Doctor needs: how folders are
// shared, the VM type, the VM's environment and its DNS. The file is only read, never written (Colima itself saves
// it when the VM starts). It is plain, flat YAML written by Colima, so a small reader is enough; anything it does
// not understand comes back empty, and the checks that need it are skipped.
// Facts: Colima's colima.yaml comments. `mounts: []` means "$HOME, writable"; mountType and vmType cannot change
// after the VM is created.

export type Mount = { location: string; writable: boolean; mountPoint?: string };
// mounts and env are null when the file holds them in a shape the reader doesn't understand (a flow list like
// `mounts: [{location: ~/a}]`, a bare `-`, an odd line). Null means unknown: never an empty list, because an empty
// `mounts` means "the home folder" to Colima and a change built on it would drop the user's folders.
export type ColimaConfig = { vmType: string; mountType: string; mounts: Mount[] | null; env: Record<string, string> | null; dns: string[] };
export const UNREADABLE_MOUNTS = "The app can't read your shared folders in `colima.yaml`, so it won't change them.";

const unquote = (v: string) => {
  const t = v.trim();
  return /^(".*"|'.*')$/.test(t) && t.length >= 2 ? t.slice(1, -1) : t;
};
// A comment starts at " #" outside quotes; Colima's own values never hold one.
const noComment = (l: string) => l.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, "");
const indentOf = (l: string) => l.length - l.trimStart().length;

// The indented lines under a top-level key (indent 0), without comments or blanks. YAML also allows a list at the
// key's own indent (`mounts:\n- location: /a`): those "- " lines belong to the key too.
function block(lines: string[], key: string): string[] {
  const at = lines.findIndex((l) => new RegExp(`^${key}:\\s*(#.*)?$`).test(l));
  if (at < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (!l.trim()) continue;
    if (indentOf(l) === 0 && !/^-(\s|$)/.test(l)) break;
    out.push(l);
  }
  return out;
}
const scalar = (lines: string[], key: string) => {
  const m = lines.map((l) => new RegExp(`^${key}:\\s*(.*)$`).exec(l)).find(Boolean);
  return m ? unquote(m[1]) : "";
};
const flowList = (v: string) => v.replace(/^\[|\]$/g, "").split(",").map((x) => unquote(x)).filter(Boolean);
const falsy = (v: string) => v === "" || v === "null" || v === "~" || v === "[]" || v === "{}";

export function parseColimaConfig(text: string): ColimaConfig {
  const lines = text.split("\n").map((l) => noComment(l.replace(/\r$/, ""))).filter((l) => l.trim());
  const mountsHead = lines.find((l) => /^mounts:/.test(l))?.replace(/^mounts:\s*/, "").trim();
  let mounts: Mount[] | null = [];
  if (mountsHead === undefined) mounts = [];
  else if (!(mountsHead === "[]" || falsy(mountsHead))) mounts = null;
  else {
    let cur: Mount | null = null;
    for (const l of block(lines, "mounts")) {
      const item = /^\s*-\s*(\w+):\s*(.*)$/.exec(l);
      const field = /^\s+(\w+):\s*(.*)$/.exec(l);
      const [, k, v] = item ?? field ?? [];
      // A line that is neither an item nor one of its fields (a bare "-", a nested map) can't be read safely.
      if (!k || !["location", "writable", "mountPoint"].includes(k)) { mounts = null; break; }
      if (item) { cur = { location: "", writable: false }; mounts.push(cur); }
      if (!cur) { mounts = null; break; }
      if (k === "location") cur.location = unquote(v);
      else if (k === "writable") {
        // Any spelling of true or false (True, TRUE); anything else is a value the app does not know.
        const w = unquote(v).toLowerCase();
        if (w !== "true" && w !== "false") { mounts = null; break; }
        cur.writable = w === "true";
      }
      else if (unquote(v)) cur.mountPoint = unquote(v);
    }
    // A location that starts with $ is an environment variable the app does not expand: unknown, never guessed.
    if (mounts?.some((m) => !m.location || m.location.startsWith("$"))) mounts = null;
  }
  let env: Record<string, string> | null = {};
  const envHead = lines.find((l) => /^env:/.test(l))?.replace(/^env:\s*/, "").trim();
  if (envHead !== undefined && !(envHead === "{}" || falsy(envHead))) env = null;
  else if (envHead !== undefined) for (const l of block(lines, "env")) {
    const m = /^\s+([^:\s]+):\s*(.*)$/.exec(l);
    if (!m) { env = null; break; }
    env[m[1]] = unquote(m[2]);
  }
  const net = block(lines, "network");
  const dnsAt = net.findIndex((l) => /^\s+dns:/.test(l));
  let dns: string[] = [];
  if (dnsAt >= 0) {
    const v = net[dnsAt].replace(/^\s+dns:\s*/, "").trim();
    if (v.startsWith("[")) dns = flowList(v);
    else if (falsy(v)) for (const l of net.slice(dnsAt + 1)) {
      const m = /^\s+-\s*(.+)$/.exec(l);
      if (!m || indentOf(l) <= indentOf(net[dnsAt])) break;
      dns.push(unquote(m[1]));
    }
  }
  return { vmType: scalar(lines, "vmType"), mountType: scalar(lines, "mountType"), mounts, env, dns };
}
