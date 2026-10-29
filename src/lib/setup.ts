// Turns the raw setup report from the backend into plain findings for the Setup screen.
// The backend only reads; every change runs through `setup_fix` after a click.

export type Plugin = { name: string; target: string; broken: boolean };
export type SetupReport = {
  plugins: Plugin[];
  brew_plugin_dir: string | null;
  brew_plugins: string[];
  extra_dirs: string[];
  creds_store: string | null;
  creds_helper_found: boolean;
  contexts: { name: string; current: boolean }[];
  autostart: string | null;
  testcontainers_host: string | null;
  testcontainers_override: boolean;
  shell_profile: string;
  docker_desktop_installed: boolean;
  docker_desktop_data: boolean;
};
export type FixId = "plugins" | "creds_store" | "autostart_on" | "autostart_restart" | "autostart_off" | "use_colima_context" | "testcontainers";
export type SetupFix =
  | { kind: "fix"; id: FixId; label: string }
  | { kind: "install"; names: string[]; label: string; then: FixId }
  | { kind: "profiles"; label: string }
  | { kind: "copy"; text: string; label: string }
  | { kind: "bring"; label: string };
export type SetupFinding = {
  id: "compose" | "buildx" | "leftovers" | "creds" | "context" | "autostart" | "resources" | "testcontainers" | "desktop_data";
  status: "ok" | "warn" | "fail" | "info";
  title: string;
  detail: string;
  // Only real shell commands, exact, shown in the monospace box.
  command?: string;
  // Plain English lines (config edits and the like), shown as a short list above the box.
  steps?: string[];
  fix?: SetupFix;
};
export type VmSize = { cpus: number; memory: number } | null;

const DESKTOP_APP = "/Applications/Docker.app/";
const GIB = 1024 ** 3;
const USER_PLUGINS = "~/.docker/cli-plugins";

const deadDesktopLinks = (r: SetupReport) => r.plugins.filter((p) => p.broken && p.target.startsWith(DESKTOP_APP));

// What "Fix plugin links" will do, shown before the click: a command for the links, a step for the config edit.
function pluginParts(r: SetupReport): { command?: string; steps: string[] } {
  const dead = deadDesktopLinks(r);
  const steps: string[] = [];
  if (r.brew_plugin_dir && !r.extra_dirs.includes(r.brew_plugin_dir)) steps.push(`Add \`${r.brew_plugin_dir}\` to \`cliPluginsExtraDirs\` in \`~/.docker/config.json\` (a backup is kept).`);
  return { command: dead.length ? `rm ${dead.map((p) => `${USER_PLUGINS}/${p.name}`).join(" ")}` : undefined, steps };
}

function pluginFinding(r: SetupReport, plugin: "docker-compose" | "docker-buildx"): SetupFinding {
  const id = plugin === "docker-compose" ? "compose" : "buildx";
  const verb = plugin === "docker-compose" ? "docker compose" : "docker buildx";
  const link = r.plugins.find((p) => p.name === plugin);
  const inBrew = r.brew_plugins.includes(plugin);
  const brewVisible = inBrew && !!r.brew_plugin_dir && r.extra_dirs.includes(r.brew_plugin_dir);
  // A user-dir link shadows the Homebrew copy, so a dead one breaks the command even when Homebrew has it.
  const works = link ? !link.broken : brewVisible;
  if (works) return { id, status: "ok", title: `${verb} works`, detail: link ? `Found in ${USER_PLUGINS}.` : `Found in ${r.brew_plugin_dir}.` };
  if (inBrew)
    return {
      id,
      status: "fail",
      title: `${verb} doesn't work`,
      detail: link?.broken
        ? `Homebrew has ${plugin}, but a leftover Docker Desktop link hides it.`
        : `Homebrew has ${plugin}, but Docker doesn't look in Homebrew's plugin folder yet.`,
      ...pluginParts(r),
      fix: { kind: "fix", id: "plugins", label: "Fix plugin links" },
    };
  return {
    id,
    status: "fail",
    title: `${verb} isn't installed`,
    detail: `Docker Desktop shipped ${plugin}. Install it with Homebrew, then link it.`,
    command: [`brew install ${plugin}`, pluginParts(r).command].filter(Boolean).join("\n"),
    steps: pluginParts(r).steps,
    fix: { kind: "install", names: [plugin], label: `Install ${plugin}`, then: "plugins" },
  };
}

export const contextFor = (profile: string) => (profile === "default" ? "colima" : `colima-${profile}`);

// brought: the user already brought Docker Desktop volumes over with the app, so the row turns to a pass.
export function setupFindings(r: SetupReport, vm: VmSize, profile = "default", brought = false): SetupFinding[] {
  const want = contextFor(profile);
  const out = [pluginFinding(r, "docker-compose"), pluginFinding(r, "docker-buildx")];
  // Both plugins share one link fix: show it on the first card, point to it from the second.
  const [compose, buildx] = out;
  if (compose.status === "fail" && buildx.status === "fail") {
    const installs = buildx.fix?.kind === "install";
    out[1] = { ...buildx, command: installs ? "brew install docker-buildx" : undefined, steps: [installs ? "Then the same link fix as above." : "Same fix as above."] };
  }

  const leftovers = deadDesktopLinks(r).filter((p) => p.name !== "docker-compose" && p.name !== "docker-buildx");
  if (leftovers.length && out.every((f) => f.status === "ok"))
    out.push({
      id: "leftovers",
      status: "info",
      title: `${leftovers.length} dead Docker Desktop plugin link${leftovers.length === 1 ? "" : "s"}`,
      detail: `${leftovers.map((p) => p.name).join(", ")} point into Docker.app, which is gone. They do no harm, but docker prints warnings.`,
      ...pluginParts(r),
      fix: { kind: "fix", id: "plugins", label: "Remove them" },
    });

  if (r.creds_store && !r.creds_helper_found)
    out.push({
      id: "creds",
      status: "fail",
      title: "Pulls and logins will fail",
      detail: `\`~/.docker/config.json\` says \`credsStore: ${r.creds_store}\`, but \`docker-credential-${r.creds_store}\` isn't installed.`,
      steps: [`Remove \`credsStore\` from \`~/.docker/config.json\` (a backup is kept).`],
      fix: { kind: "fix", id: "creds_store", label: "Remove the setting" },
    });
  else out.push({ id: "creds", status: "ok", title: "Registry logins are set up", detail: r.creds_store ? `Using docker-credential-${r.creds_store}.` : "No credential helper is required." });

  const current = r.contexts.find((c) => c.current)?.name ?? "default";
  const fixCtx: SetupFix = { kind: "fix", id: "use_colima_context", label: `Switch to ${want === "colima" ? "Colima" : want}` };
  if (current === want) out.push({ id: "context", status: "ok", title: "The docker command uses Colima", detail: `Current context: ${current}.` });
  else if (current.startsWith("colima"))
    out.push({ id: "context", status: "warn", title: "Your terminal and this app see different VMs", detail: `docker in your terminal talks to "${current}"; this app shows ${profile} (${want}).`, command: `docker context use ${want}`, fix: fixCtx });
  else
    out.push({
      id: "context",
      status: "fail",
      title: "The docker command isn't using Colima",
      detail: `Your terminal's docker talks to "${current}". Switch it to Colima so it sees the same containers as this app.`,
      command: `docker context use ${want}`,
      fix: fixCtx,
    });

  if (r.autostart === "started") out.push({ id: "autostart", status: "ok", title: "Colima starts at login", detail: "Managed by brew services." });
  else if (r.autostart === "error")
    out.push({ id: "autostart", status: "warn", title: "Colima's login service failed", detail: "brew services reports an error. Check `brew services info colima`.", command: "brew services restart colima", fix: { kind: "fix", id: "autostart_restart", label: "Restart the service" } });
  else
    out.push({ id: "autostart", status: "info", title: "Colima doesn't start at login", detail: "Docker Desktop started on its own. Colima can too.", command: "brew services start colima", fix: { kind: "fix", id: "autostart_on", label: "Start at login" } });

  if (vm) {
    const gib = Math.round(vm.memory / GIB);
    if (vm.cpus <= 2 || vm.memory <= 2 * GIB)
      out.push({ id: "resources", status: "warn", title: `The VM has ${vm.cpus} CPUs and ${gib} GiB`, detail: "That is Colima's default. Builds and databases often need 4 CPUs and 8 GiB.", fix: { kind: "profiles", label: "Change in Profiles" } });
    else out.push({ id: "resources", status: "ok", title: `The VM has ${vm.cpus} CPUs and ${gib} GiB`, detail: "Enough for most local stacks." });
  }

  // Only this profile's socket counts: a file left pointing at another profile reaches the wrong VM.
  const tcHost = r.testcontainers_host;
  const ownSocket = (h: string) => h.endsWith(`/.colima/${profile}/docker.sock`) || (profile === "default" && h.endsWith("/.colima/docker.sock"));
  const rc = r.shell_profile || "your shell profile";
  const overrideStep = `Add \`export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock\` to \`${rc}\` (a backup is kept), so Testcontainers' cleanup container finds Docker inside the VM. Restart your IDE afterwards.`;
  const pointStep = `Set \`docker.host\` to \`~/.colima/${profile}/docker.sock\` in \`~/.testcontainers.properties\`, and \`docker.client.strategy\` to the one that reads it. A backup is kept; other lines stay.`;
  const tcFix: SetupFix = { kind: "fix", id: "testcontainers", label: "Point to Colima" };
  if (tcHost && !ownSocket(tcHost))
    out.push({
      id: "testcontainers",
      status: "warn",
      title: "Testcontainers points somewhere else",
      detail: `\`~/.testcontainers.properties\` has \`docker.host=${tcHost}\`, so tests won't find Docker.`,
      steps: r.testcontainers_override ? [pointStep] : [pointStep, overrideStep],
      fix: tcFix,
    });
  // Used from the file alone, Testcontainers reaches Colima but its cleanup container (Ryuk) can't, and tests stop at startup.
  else if (tcHost && !r.testcontainers_override)
    out.push({
      id: "testcontainers",
      status: "warn",
      title: "Testcontainers can't start its cleanup container",
      detail: "Colima needs `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` set, or tests stop at startup.",
      steps: [overrideStep],
      fix: tcFix,
    });

  // The app copies them (src/BringOver.tsx); Docker Desktop keeps its copy. The disk outlives the app and its context.
  if (r.contexts.some((c) => c.name === "desktop-linux") || r.docker_desktop_data)
    out.push(brought
      ? { id: "desktop_data", status: "ok", title: "Docker Desktop volumes are in Colima", detail: "Docker Desktop still has its copy." }
      : {
          id: "desktop_data",
          status: "info",
          title: "Your Docker Desktop volumes and images stay behind",
          detail: "Colima starts empty. Bring your volumes over before the first `docker compose up`, or Compose makes new empty ones.",
          fix: { kind: "bring", label: "Bring them over" },
        });
  return out;
}

const RANK = { fail: 0, warn: 1, info: 2, ok: 3 } as const;
export const sortFindings = (f: SetupFinding[]) => [...f].sort((a, b) => RANK[a.status] - RANK[b.status]);
export const blocking = (f: SetupFinding[]) => f.filter((x) => x.status === "fail").length;
// The one count the badge, the home banner and the Setup intro all show.
export const needsAttention = (f: SetupFinding[]) => f.filter((x) => x.status === "fail" || x.status === "warn").length;

export type PlanStep = { kind: "fix"; id: FixId } | { kind: "install"; names: string[] };
// Fix all: every failing or warning row's fix (never an info row, which is only a suggestion), once each, with installs first so the plugin fix can link them.
export function fixAllPlan(findings: SetupFinding[]): PlanStep[] {
  const todo = findings.filter((f) => (f.status === "fail" || f.status === "warn") && (f.fix?.kind === "fix" || f.fix?.kind === "install"));
  const names = [...new Set(todo.flatMap((f) => (f.fix?.kind === "install" ? f.fix.names : [])))];
  const ids = new Set<FixId>();
  for (const f of todo) {
    if (f.fix?.kind === "install") ids.add(f.fix.then);
    if (f.fix?.kind === "fix") ids.add(f.fix.id);
  }
  const order: FixId[] = ["plugins", "creds_store", "use_colima_context", "testcontainers", "autostart_on", "autostart_restart"];
  return [...(names.length ? [{ kind: "install" as const, names }] : []), ...order.filter((id) => ids.has(id)).map((id) => ({ kind: "fix" as const, id }))];
}
