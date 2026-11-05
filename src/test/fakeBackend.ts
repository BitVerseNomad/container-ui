// A tiny stand-in for the Tauri backend: each test says what `docker` answers and records what was asked.
import { vi } from "vitest";

export type Answer = (args: string[]) => string | Promise<string>;

export function fakeBackend(answers: Record<string, Answer>) {
  const calls: { cmd: string; args?: string[] }[] = [];
  const invoke = vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => {
    const args = a.args as string[] | undefined;
    calls.push({ cmd, args });
    if (cmd !== "docker") return answers[cmd]?.([]) ?? null;
    const key = args![0] === "system" ? "system df" : args![0];
    const answer = answers[key];
    return answer ? answer(args!) : "";
  });
  return { invoke, calls, dockerCalls: () => calls.filter((c) => c.cmd === "docker").map((c) => c.args!) };
}

export const jsonLines = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n");
