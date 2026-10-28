import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile } from "./api";
import { usePoll } from "./hooks";
import { PlanStep, SetupFinding, SetupReport, fixAllPlan, setupFindings, sortFindings } from "./lib/setup";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import { useConfirm } from "./ui";

const FIX_ALL = "Runs every setup fix in order and stops if one fails. ~/.docker/config.json is backed up first.";
const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export function useSetup(profile: Profile | null) {
  const { data, error, reload } = usePoll(() => invoke<SetupReport>("setup_report"), [], 60_000);
  const vm = profile?.status === "Running" ? { cpus: profile.cpus, memory: profile.memory } : null;
  const name = profile?.name ?? "default";
  const findings = data ? sortFindings(setupFindings(data, vm, name)) : null;
  return { findings, error, reload, profile: name };
}

// Runs the setup fixes. Each fix shows its command and runs only on a click; the Doctor page places the rows.
type Opts = { reload: () => void | Promise<unknown>; profile: string; onProfiles: () => void };
export function useSetupActions({ reload, profile, onProfiles }: Opts) {
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
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
    try {
      for (const step of steps) {
        if (step.kind === "install") {
          setInstalling(true);
          await invoke("install_tools", { names: step.names });
        } else await invoke("setup_fix", { id: step.id, profile });
      }
    } catch (e) {
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
          <span className="hint">{f.detail}</span>
          {how && (
            <details className="how">
              <summary>{copy ? "Show the steps" : "What it does"}</summary>
              {f.steps && <ul className="steps hint">{f.steps.map((t) => <li key={t}>{t}</li>)}</ul>}
              {f.command && <pre className="cmd">{f.command}</pre>}
            </details>
          )}
        </div>
        {/* The empty slot is where a container problem has its "…", so every button ends on one edge. */}
        {fix && <span className="finding-actions">
          <button className={primary && !copy ? "small primary" : "small"} title={f.command && !copy ? `Runs: ${f.command}` : undefined} disabled={busy !== null} onClick={() => act(f)}>
            {busy === f.id ? "Working…" : copied === f.id ? "Copied" : fix.label}
          </button>
          <span className="more-slot" aria-hidden="true" />
        </span>}
      </li>
    );
  };
  // It installs software and edits ~/.docker/config.json, so it says what it will do before it starts.
  const fixAll = (plan: PlanStep[], covers: SetupFinding[]) => {
    if (plan.length < 2 || covers.length < 2) return null;
    const go = async () => (await confirm([`Fix ${covers.length} problems?`, ...covers.map((f) => `• ${f.title}`), "", FIX_ALL].join("\n"), "Fix them")) && run("all", plan);
    return <button className="small primary" aria-label="Fix all setup problems" title={FIX_ALL} disabled={busy !== null} onClick={go}>{busy === "all" ? "Fixing…" : `Fix ${covers.length} problems`}</button>;
  };
  const log = <OutputLog event="brew-progress" active={installing} failure={failure} />;

  // One button per setup problem, for the VM row's note. The note doesn't show the command, so a change asks first.
  const quick = (f: SetupFinding) => {
    const fix = f.fix;
    // A copy fix needs the steps beside it to make sense, so the panel sends you to the Doctor for it.
    if (!fix || fix.kind === "copy") return null;
    const changes = fix.kind === "fix" || fix.kind === "install";
    const what = [f.title, ...(f.steps ?? []), f.command].filter(Boolean).join("\n");
    const go = async () => (!changes || (await confirm(what, fix.label))) && act(f);
    return <button disabled={busy !== null} onClick={go}>{busy === f.id ? "Working…" : copied === f.id ? "Copied" : fix.label}</button>;
  };
  const quickAll = (plan: PlanStep[], covers: SetupFinding[]) => {
    const go = async () => (await confirm(["Fix all fixes:", ...covers.map((f) => `• ${f.title}`), "", FIX_ALL].join("\n"), "Fix all")) && run("all", plan);
    return <button disabled={busy !== null} onClick={go}>{busy === "all" ? "Fixing…" : "Fix all"}</button>;
  };
  return { row, fixAll, log, quick, quickAll };
}

