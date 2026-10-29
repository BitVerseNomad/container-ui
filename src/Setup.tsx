import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile } from "./api";
import { usePoll } from "./hooks";
import { PlanStep, SetupFinding, SetupReport, fixAllPlan, setupFindings, sortFindings } from "./lib/setup";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import { useConfirm } from "./ui";
import Ticks, { plain } from "./ui/Ticks";

const FIX_ALL = "Runs every setup fix in order and stops if one fails. Each file it edits is backed up first.";

// Paths and settings in a fix's own message, in the code font, with ~ for the home folder.
const home = (t: string) => <Ticks text={t.replace(/(\/Users\/[^/\s]+|\/home\/[^/\s]+)/g, "~").replace(/((?:~|\/opt)\/[^\s"]+?|TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE|credsStore)(?=\.?(\s|$|"))/g, "`$1`")} />;

// What each step does, in the words the confirm lists, and the file it backs up first, if any.
const STEP: Record<string, { says: string; backs?: string }> = {
  plugins: { says: "Relink docker's plugins", backs: "~/.docker/config.json" },
  creds_store: { says: "Remove credsStore from ~/.docker/config.json", backs: "~/.docker/config.json" },
  use_colima_context: { says: "Switch the docker command to Colima" },
  testcontainers: { says: "Point Testcontainers to Colima, and add its socket setting to your shell profile", backs: "~/.testcontainers.properties, your shell profile" },
  autostart_on: { says: "Start Colima at login" },
  autostart_restart: { says: "Restart Colima's login service" },
};
const says = (s: PlanStep, rc: string) => (s.kind === "install" ? `Install ${s.names.join(" and ")} with Homebrew` : (STEP[s.id]?.says ?? s.id).replace("your shell profile", rc));
// The one line after a fix: how many steps worked, and the one thing left for you when a shell setting changed.
// A Gradle daemon keeps the environment it started with, so it needs stopping too.
function doneLine(done: string[]) {
  const shell = done.some((t) => /TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE to /.test(t)) ? " For Testcontainers, open a new terminal tab and restart your IDE (and run `./gradlew --stop` if you use Gradle)." : "";
  return `${done.length === 1 ? "Done." : `${done.length} fixes done.`}${shell}`;
}

export function planText(plan: PlanStep[], rc = "your shell profile") {
  const files = [...new Set(plan.flatMap((s) => (s.kind === "fix" && STEP[s.id]?.backs ? STEP[s.id].backs!.replace("your shell profile", rc).split(", ") : [])))];
  const list = files.length > 1 ? `${files.slice(0, -1).join(", ")} and ${files[files.length - 1]}` : files[0];
  return [...plan.map((s) => `• ${says(s, rc)}`), ...(files.length ? ["", `A backup is kept of ${list}.`] : [])].join("\n");
}
const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export function useSetup(profile: Profile | null) {
  const { data, error, reload } = usePoll(() => invoke<SetupReport>("setup_report"), [], 60_000);
  const vm = profile?.status === "Running" ? { cpus: profile.cpus, memory: profile.memory } : null;
  const name = profile?.name ?? "default";
  const findings = data ? sortFindings(setupFindings(data, vm, name)) : null;
  return { findings, error, reload, profile: name, rc: data?.shell_profile };
}

// Runs the setup fixes. Each fix shows its command and runs only on a click; the Doctor page places the rows.
type Opts = { reload: () => void | Promise<unknown>; profile: string; onProfiles: () => void; rc?: string };
export function useSetupActions({ reload, profile, onProfiles, rc = "your shell profile" }: Opts) {
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // What the last fix did, in the backend's words (where each backup went), until the next fix or Dismiss.
  // One entry per step, in the backend's words (where each backup went), until the next fix or Dismiss.
  const [done, setDone] = useState<string[] | null>(null);
  // How many steps the last run had, so a run that stopped says "2 of 4", never "Done".
  const [planned, setPlanned] = useState(0);
  const confirm = useConfirm();

  async function act(f: SetupFinding) {
    const fix = f.fix;
    if (!fix) return;
    if (fix.kind === "profiles") return onProfiles();
    if (fix.kind === "copy") {
      await navigator.clipboard.writeText(fix.text);
      return setCopied(f.id);
    }
    await run(f.id, fix.kind === "install" ? [{ kind: "install", names: fix.names }, { kind: "fix", id: fix.then }] : [{ kind: "fix", id: fix.id }]);
  }

  // Runs the steps in order and stops at the first failure, so nothing later builds on a half-done change.
  async function run(key: string, steps: PlanStep[]) {
    setBusy(key);
    setFailure(null);
    setDone(null);
    setPlanned(steps.length);
    const said: string[] = [];
    try {
      for (const step of steps) {
        if (step.kind === "install") {
          setInstalling(true);
          await invoke("install_tools", { names: step.names });
          said.push(`Installed ${step.names.join(" and ")}.`);
        } else said.push((await invoke<string | null>("setup_fix", { id: step.id, profile })) ?? "");
      }
      setDone(said.filter(Boolean));
    } catch (e) {
      setDone(said.filter(Boolean).length ? said.filter(Boolean) : null);
      setFailure(String(e));
    } finally {
      setBusy(null);
      setInstalling(false);
      await reload();
    }
  }

  // One line per problem, like a home row: what is wrong, and one button that does it. The command it runs is
  // behind "What it does", for those who want it; nobody has to copy anything to fix a problem.
  const row = (f: SetupFinding, primary: boolean) => {
    const open = f.status !== "ok";
    const fix = open ? f.fix : undefined;
    const copy = fix?.kind === "copy";
    const how = open && (f.steps?.length || f.command);
    return (
      <li key={f.id} className={`finding ${f.status}`} data-setup={f.id}>
        <Icon name={ICON[f.status]} />
        <div>
          <b>{f.title}</b>
          <span className="hint"><Ticks text={f.detail} /></span>
          {how && (
            <details className="how">
              <summary><Icon name="chevron" size={12} />{copy ? "Show the steps" : "What it does"}<span className="sr-only">: {f.title}</span></summary>
              {f.steps && <ul className="steps hint" role="list">{f.steps.map((t) => <li key={t}><Ticks text={t} /></li>)}</ul>}
              {f.command && <pre className="cmd">{f.command}</pre>}
            </details>
          )}
        </div>
        {/* The empty slot is where a container problem has its "…", so every button ends on one edge. */}
        {fix && <span className="finding-actions">
          {/* aria-disabled keeps focus on the button while it works, so VoiceOver stays where you were. */}
          <button className={primary && !copy ? "small primary" : "small"} title={f.command && !copy ? `Runs: ${f.command}` : undefined} aria-label={`${busy === f.id ? "Working…" : copied === f.id ? "Copied" : fix.label}: ${f.title}`} aria-disabled={busy !== null || undefined} onClick={() => busy === null && act(f)}>
            {busy === f.id ? "Working…" : copied === f.id ? "Copied" : fix.label}
          </button>
          <span className="more-slot" aria-hidden="true" />
        </span>}
      </li>
    );
  };
  // It installs software and edits ~/.docker/config.json, so it says what it will do before it starts.
  // total: how many problems the page counts, so "Fix 3 of 5" says that two are left for you.
  const fixAll = (plan: PlanStep[], covers: SetupFinding[], total = covers.length) => {
    if (plan.length < 2 || covers.length < 2) return null;
    const go = async () => busy === null && (await confirm([`Fix ${covers.length} problems?`, planText(plan, rc)].join("\n"), "Fix them", { safe: true })) && run("all", plan);
    const label = total > covers.length ? `Fix ${covers.length} of ${total} problems` : `Fix ${covers.length} problems`;
    return <button className="small primary" title={FIX_ALL} aria-disabled={busy !== null || undefined} onClick={go}>{busy === "all" ? "Fixing…" : label}</button>;
  };
  const log = (
    <>
      {/* One status line that is always there, so VoiceOver hears "Fixing…" and then what was done. */}
      {/* Success goes to the status line; a stop goes only to the alert, so VoiceOver hears one of them. */}
      <p className="sr-only" role="status" aria-live="polite">{busy ? "Fixing…" : done && !failure ? plain(doneLine(done)) : ""}</p>
      <p className="sr-only" role="alert">{failure ? `${done ? `${done.length} of ${planned} fixes done. ` : ""}Fix stopped: ${failure.split("\n")[0]}` : ""}</p>
      {done && !busy && !failure && (
        <div className="fix-result ok">
          <p><Icon name="check" size={14} /> <Ticks text={doneLine(done)} /> <button className="small fix-dismiss" onClick={() => setDone(null)}>Dismiss</button></p>
          <details className="how">
            <summary><Icon name="chevron" size={12} />Details</summary>
            <ul className="steps hint" role="list">{done.map((t) => <li key={t}>{home(t)}</li>)}</ul>
            <OutputLog event="brew-progress" collapsed />
          </details>
        </div>
      )}
      {done && !busy && failure && <p className="hint">{done.length} of {planned} fixes done before it stopped: {done.map(home).join(" ")}</p>}
      {(busy || failure || !done) && <OutputLog event="brew-progress" active={installing} failure={failure} />}
    </>
  );

  // One button per setup problem, for the VM row's note. The note doesn't show the command, so a change asks first.
  const quick = (f: SetupFinding) => {
    const fix = f.fix;
    // A copy fix needs the steps beside it to make sense, so the panel sends you to the Doctor for it.
    if (!fix || fix.kind === "copy") return null;
    const changes = fix.kind === "fix" || fix.kind === "install";
    const what = [f.title, ...(f.steps ?? []), f.command].filter(Boolean).join("\n");
    const go = async () => (!changes || (await confirm(what, fix.label, { safe: true }))) && act(f);
    return <button aria-disabled={busy !== null || undefined} onClick={() => busy === null && go()}>{busy === f.id ? "Working…" : copied === f.id ? "Copied" : fix.label}</button>;
  };
  const quickAll = (plan: PlanStep[], covers: SetupFinding[]) => {
    const go = async () => (await confirm([`Fix ${covers.length} problems?`, planText(plan, rc)].join("\n"), "Fix all", { safe: true })) && run("all", plan);
    return <button aria-disabled={busy !== null || undefined} onClick={() => busy === null && go()}>{busy === "all" ? "Fixing…" : "Fix all"}</button>;
  };
  return { row, fixAll, log, quick, quickAll };
}

