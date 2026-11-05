// "It keeps restarting, the logs usually say why" leaves the user to dig. This reads the last log lines, picks the
// last one that looks like the error, and when it can, says what to do about it.
const ERRORISH = /\b(error|fatal|panic|exception|traceback|failed|refused|denied|cannot|can't)\b|no such file/i;
const NO_FILE = /(\/[\w.@/-]+): no such file or directory/i;
const REFUSED = /(?:dial tcp |connect(?:ion)? to |ECONNREFUSED )([\w.-]+):(\d+)[^\n]*(?:connection refused|ECONNREFUSED)|ECONNREFUSED ([\w.-]+):(\d+)/i;

export type Lead = { line: string; hint: string | null };
type Mount = { Destination: string };

const dirOf = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/";

// A line whose cause we know (a missing file, a refused connection), with what to do about it.
function explain(line: string, mounts: Mount[]): string | null {
  const file = NO_FILE.exec(line)?.[1];
  if (file) {
    const covered = mounts.some((m) => file === m.Destination || file.startsWith(m.Destination.replace(/\/$/, "") + "/"));
    if (covered) return `${file} is missing from the folder mounted there. Check the file exists on your Mac.`;
    const dir = dirOf(file);
    return `Nothing is mounted at ${dir}, so ${file} isn't there. Mount the folder that has it at ${dir}: under volumes: in its compose.yaml, or with -v when you run it.`;
  }
  const r = REFUSED.exec(line);
  if (!r) return null;
  const [host, port] = [r[1] ?? r[3], r[2] ?? r[4]];
  return host === "localhost" || host === "127.0.0.1"
    ? `Inside a container, localhost is the container itself, not your Mac or another container. Use the other container's name instead of ${host}.`
    : `Nothing answered at ${host}:${port}. Check that ${host} is running and listens on ${port}.`;
}

// The last line we can explain wins over the last error line: "fatal: too many failed jobs" is the effect, the
// missing file a few lines up is the cause.
export function crashLead(logs: string, mounts: Mount[]): Lead | null {
  // docker logs --timestamps puts a time first; the error reads better without it.
  const lines = logs.split("\n").map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, "").trim()).filter(Boolean).reverse();
  for (const line of lines) {
    const hint = explain(line, mounts);
    if (hint) return { line, hint };
  }
  const line = lines.find((l) => ERRORISH.test(l));
  return line ? { line, hint: null } : null;
}
