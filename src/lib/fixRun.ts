// Runs a Fix: each container is replaced in turn, and put back as it was if its replacement doesn't stay up.
import type { Connect, Replace } from "./health.ts";

type Docker = (args: string[]) => Promise<string>;
// untouched: the failed container was never changed. restored: it was, and is back as it was ("no-policy": back and
// running, but its restart policy could not be set again).
// leftover: old containers that could not be removed after their replacement started.
export type FixResult =
  | { ok: true; replaced: string[]; leftover: string[]; message?: string }
  | { ok: false; replaced: string[]; leftover: string[]; failed: string; reason: string; logs: string; untouched: boolean; restored: boolean | "no-policy"; unknown?: boolean; message?: string };

// Long enough for Kafka to start or fail on its settings, short enough to wait for.
export const SETTLE_MS = 12_000;
// A health check that is still starting gets this many more looks, 5 seconds apart.
const HEALTH_TRIES = 10;

const message = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/^Error: /, "").trim();

// `--type container`, so a volume or image that happens to be called kafka-old doesn't count.
const exists = (docker: Docker, name: string) =>
  docker(["inspect", "--type", "container", "--format", "{{.Name}}", name]).then(() => true, () => false);

// Settings the replacement can't carry. The run uses the image's own command, user and folder, so a container that
// overrides them, or whose tag now points at another version, would come back different.
async function differs(docker: Docker, r: Replace): Promise<string | null> {
  if (!r.keep) return null;
  let img: { Id?: string; Config?: Record<string, unknown> } | undefined;
  try {
    img = JSON.parse(await docker(["image", "inspect", r.keep.image]))[0];
  } catch {
    return `The image ${r.keep.image} is no longer on this Mac, so the new ${r.name} would download whatever it points at now.`;
  }
  if (r.keep.imageId && img?.Id && img.Id !== r.keep.imageId) return `${r.keep.image} now points at a different version than the one ${r.name} runs.`;
  const cfg = img?.Config ?? {};
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null) || (!a && !b);
  const changed = (["Cmd", "Entrypoint", "User", "WorkingDir", "Healthcheck"] as const).filter((k) => !same(r.keep![k], cfg[k]));
  const words: Record<string, string> = { Cmd: "command", Entrypoint: "entrypoint", User: "user", WorkingDir: "working folder", Healthcheck: "health check" };
  return changed.length ? `${r.name} was started with its own ${changed.map((k) => words[k]).join(", ")}, which Fix can't carry over.` : null;
}

// null when it stays up; otherwise why not. With a health check, it must also pass it. Some images restart once on
// first boot (write their config, then start again), so one restart is fine if the next look finds it still up.
async function staysUp(docker: Docker, name: string, wait: (ms: number) => Promise<void>): Promise<string | null> {
  await wait(SETTLE_MS);
  let seen = false;
  let before = 0;
  // Ending on a look that was still settling proves nothing, so the last look must be a calm one.
  let settling = "";
  for (let i = 0; i < HEALTH_TRIES; i++) {
    const out = await docker(["inspect", "--type", "container", "--format", "{{.State.Running}} {{.RestartCount}} {{if .State.Health}}{{.State.Health.Status}}{{end}}", name]).catch(() => null);
    if (out !== null) {
      seen = true;
      const [up, restarts, health = ""] = out.trim().split(/\s+/);
      const count = Number(restarts) || 0;
      if (up !== "true") return `The new ${name} stopped after starting.`;
      if (count > 1) return `The new ${name} keeps restarting.`;
      const justRestarted = count !== before;
      before = count;
      if (health === "unhealthy") return `The new ${name} is running, but its health check fails.`;
      if (health !== "starting" && !justRestarted) return null;
      settling = justRestarted ? `The new ${name} restarted and didn't settle in time.` : `The new ${name}'s health check was still starting after a minute.`;
    }
    await wait(5000);
  }
  return seen ? settling || null : `Couldn't check that the new ${name} is running.`;
}

// allowed: the backend's own check of a command, so a run it would refuse stops the fix before anything changes.
export async function runFix(steps: Replace[], docker: Docker, onStep: (text: string) => void, wait: (ms: number) => Promise<void>, allowed?: (args: string[]) => Promise<void>): Promise<FixResult> {
  const replaced: string[] = [];
  const leftover: string[] = [];
  const stop = (failed: string, reason: string, more: Partial<FixResult> = {}): FixResult => ({ ok: false, replaced, leftover, failed, reason, logs: "", untouched: true, restored: true, ...more }) as FixResult;

  // Everything that can be known up front is checked for every container before the first one is touched.
  onStep("Checking…");
  for (const r of steps) {
    if (await exists(docker, `${r.name}-old`)) return stop(r.name, `A container named ${r.name}-old already exists. Remove or rename it, then try again.`);
    if (allowed) {
      try {
        await allowed(r.run);
      } catch (e) {
        return stop(r.name, `The app can't start the new ${r.name} itself (${message(e)}). The commands below do the same by hand.`);
      }
    }
    const why = await differs(docker, r);
    if (why) return stop(r.name, `${why} The commands below show the change; adjust them by hand.`);
  }

  for (const r of steps) {
    const old = `${r.name}-old`;
    let renamed = false;
    try {
      if (r.createNetwork) {
        onStep(`Creating the ${r.createNetwork} network…`);
        await docker(["network", "create", r.createNetwork]).catch((e) => {
          if (!/already exists/i.test(String(e))) throw e;
        });
      }
      onStep(`Stopping ${r.name}…`);
      await docker(["rename", r.name, old]);
      renamed = true;
      // Otherwise an old copy that can't be removed starts again with the VM and takes the new one's ports.
      if (autoRestarts(r)) await docker(["update", "--restart", "no", old]);
      await docker(["stop", old]);
      onStep(`Starting the new ${r.name}…`);
      await docker(r.run);
      for (const net of r.connect) await docker(["network", "connect", net, r.name]);
      onStep(`Checking that ${r.name} stays up…`);
      const why = await staysUp(docker, r.name, wait);
      if (why) throw new Error(why);
    } catch (e) {
      // A rename can time out after Docker has done it; ask Docker rather than trust the error.
      if (!renamed) renamed = await exists(docker, old);
      if (!renamed) return stop(r.name, message(e));
      const logs = await docker(["logs", "--tail", "40", r.name]).catch(() => "");
      onStep(`Putting the old ${r.name} back…`);
      const restored = await restore(docker, r, old);
      return stop(r.name, message(e), { logs, untouched: false, restored });
    }
    replaced.push(r.name);
    // The new one works; an old one that won't go away is a leftover to mention, not a failure.
    await docker(["rm", old]).catch(() => leftover.push(old));
  }
  return { ok: true, replaced, leftover };
}

const autoRestarts = (r: Replace) => !!r.restart && r.restart !== "no";

// Remove the new one if it exists, give the old one its name and restart policy back, and start it.
async function restore(docker: Docker, r: Replace, old: string): Promise<boolean | "no-policy"> {
  const name = r.name;
  await docker(["rm", "-f", name]).catch(() => "");
  try {
    await docker(["rename", old, name]);
    // Running again without its policy is still better than not running, so it starts either way and says so.
    const policy = autoRestarts(r) ? await docker(["update", "--restart", r.restart!, name]).then(() => true, () => false) : true;
    await docker(["start", name]);
    return policy || "no-policy";
  } catch {
    return false;
  }
}

// What to tell the user about a finished fix, in one paragraph.
export function describe(r: FixResult): string {
  const were = (n: string[]) => (n.length > 1 ? "were" : "was");
  const left = r.leftover.length ? ` ${r.leftover.join(" and ")} couldn't be removed; remove ${r.leftover.length > 1 ? "them" : "it"} from the Containers list.` : "";
  if (r.message) return r.message;
  if (!r.ok && r.unknown) return r.reason;
  if (r.ok) return `Fixed. ${r.replaced.join(" and ")} ${were(r.replaced)} replaced and ${r.replaced.length > 1 ? "are" : "is"} running.${left}`;
  const done = r.replaced.length ? `${r.replaced.join(" and ")} ${were(r.replaced)} replaced, but ` : "";
  const after = r.untouched
    ? r.replaced.length ? ` ${r.failed} wasn't changed.` : " Nothing was changed."
    : r.restored === "no-policy" ? ` The old ${r.failed} is back and running, but without its restart policy, so it won't start with the VM.`
    : r.restored ? ` The old ${r.failed} is back as it was.` : ` Putting the old one back also failed: it is stopped and named ${r.failed}-old. Start it from the Containers list.`;
  const reason = /[.!?)]$/.test(r.reason) ? r.reason : `${r.reason}.`;
  return `${done}${r.failed} couldn't be fixed. ${reason}${after}${left}`;
}

const ALREADY = /already exists|already attached|endpoint with name .* already/i;

// Joins containers to one network so they find each other by name. It only adds, so there is nothing to put back:
// a failure says which ones are connected already, and those connections do no harm.
export async function runConnect(c: Connect, docker: Docker, onStep: (s: string) => void): Promise<FixResult> {
  const done: string[] = [];
  const fail = (who: string, e: unknown, what = `connect ${who} to ${c.network}`): FixResult => {
    const kept = done.length ? ` ${done.join(" and ")} ${done.length > 1 ? "are" : "is"} on ${c.network} now, which does no harm.` : " Nothing was changed.";
    return { ok: false, replaced: [], leftover: [], failed: who, reason: String(e), logs: "", untouched: !done.length, restored: true, message: `Couldn't ${what}: ${String(e).trim().replace(/\.?$/, ".")}${kept}` };
  };
  if (c.create) {
    onStep(`Creating the network ${c.network}…`);
    try {
      await docker(["network", "create", c.network]);
    } catch (e) {
      if (!ALREADY.test(String(e))) return fail(c.containers[0], e, `create the network ${c.network}`);
    }
  }
  for (const name of c.containers) {
    onStep(`Connecting ${name} to ${c.network}…`);
    try {
      await docker(["network", "connect", c.network, name]);
    } catch (e) {
      if (!ALREADY.test(String(e))) return fail(name, e);
    }
    done.push(name);
  }
  return { ok: true, replaced: [], leftover: [], message: `Connected. ${c.containers.join(" and ")} ${c.containers.length > 1 ? "are" : "is"} on ${c.network} and can be reached by name. If an app gave up while it couldn't connect, restart it.` };
}
