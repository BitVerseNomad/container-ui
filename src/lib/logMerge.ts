// `docker logs --timestamps` lines start with an RFC3339Nano time. Docker trims trailing zeros from the
// fraction, so times are padded to 9 digits before comparing them as strings.
const TS = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z (.*)$/;

export type LogLine = { key: string; iso: string; text: string };

export function parseLine(raw: string): LogLine {
  const m = TS.exec(raw);
  if (!m) return { key: "", iso: "", text: raw };
  return { key: `${m[1]}.${(m[2] ?? "").padEnd(9, "0")}Z`, iso: `${m[1]}.${m[2] ?? "0"}Z`, text: m[3] };
}

// Appends only lines newer than the last one we have: `--since` includes lines at exactly that time.
export function mergeLogs(prev: LogLine[], chunk: string, cap = 5000): LogLine[] {
  const fresh = chunk.split("\n").filter((l, i, all) => l !== "" || i < all.length - 1).map(parseLine);
  const last = [...prev].reverse().find((l) => l.key)?.key ?? "";
  const next = last ? fresh.filter((l) => l.key > last) : fresh;
  return next.length ? [...prev, ...next].slice(-cap) : prev;
}

// The value for the next `--since`, or null to start from the tail.
export const sinceOf = (lines: LogLine[]) => [...lines].reverse().find((l) => l.iso)?.iso ?? null;
