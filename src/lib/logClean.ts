// Turns raw Colima / Lima / Docker output frames into clean, levelled lines.

export type Level = "info" | "warn" | "error" | "plain";
export type LogLine = { level: Level; text: string; raw: string };

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const LEVELS: Record<string, Level> = {
  info: "info", warn: "warn", warning: "warn", erro: "error", error: "error", fata: "error", fatal: "error", panic: "error",
};

const unquote = (v: string) => (v.startsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, "$1") : v);

export function cleanFrame(raw: string): LogLine {
  const s = raw.replace(ANSI, "").trim();

  // logfmt: time="…" level=info msg="…" key=value
  const lvl = /(?:^|\s)level=(\w+)/.exec(s);
  const msg = /(?:^|\s)msg=("(?:[^"\\]|\\.)*"|\S+)/.exec(s);
  if (lvl && msg) return { level: LEVELS[lvl[1].toLowerCase()] ?? "plain", text: unquote(msg[1]), raw };

  // logrus text: INFO[0000] message    key=value
  const lr = /^([A-Z]{4})\[\d+\]\s+(.*)$/.exec(s);
  if (lr) {
    return { level: LEVELS[lr[1].toLowerCase()] ?? "plain", text: lr[2].replace(/\s{2,}(?:[\w.]+=\S+\s*)+$/, "").trim(), raw };
  }

  // Lima prefixes its lines with "> "
  return { level: "plain", text: s.replace(/^>\s?/, ""), raw };
}

// A payload starting with "\r" overwrites the previous line (a progress redraw).
export function applyFrame(lines: LogLine[], payload: string): LogLine[] {
  const replace = payload.startsWith("\r");
  const line = cleanFrame(replace ? payload.slice(1) : payload);
  if (!line.text) return lines;
  const head = replace && lines.length ? lines.slice(0, -1) : lines;
  const last = head[head.length - 1];
  if (last && last.text === line.text && last.level === line.level) return head;
  return [...head, line];
}

export function summarizeFailure(lines: LogLine[]): string {
  const errors = lines.filter((l) => l.level === "error");
  if (errors.length) return errors[errors.length - 1].text;
  const spoken = lines.filter((l) => l.text.trim());
  return spoken.length ? spoken[spoken.length - 1].text : "";
}
