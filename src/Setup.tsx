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

  const row = (f: SetupFinding, primary: boolean) => (
    <li key={f.id} className={`finding ${f.status}`} data-setup={f.id}>
      <Icon name={ICON[f.status]} />
      <div>
        <b>{f.title}</b>
        <span className="hint">{f.detail}</span>
        {f.steps && f.status !== "ok" && (
          <ul className="steps hint">
            {f.steps.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
        {f.command && f.status !== "ok" && <pre className="cmd">{f.command}</pre>}
        {f.fix && f.status !== "ok" && (
          <button className={primary ? "primary" : ""} disabled={busy !== null} onClick={() => act(f)}>
            {busy === f.id ? "Working…" : copied === f.id ? "Copied" : f.fix.label}
          </button>
        )}
      </div>
    </li>
  );
  const fixAll = (plan: PlanStep[]) =>
    plan.length > 1 && (
      <div className="fix-all">
        <button className="primary" disabled={busy !== null} onClick={() => run("all", plan)}>{busy === "all" ? "Fixing…" : "Fix all setup problems"}</button>
        <span className="hint">{FIX_ALL}</span>
      </div>
    );
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

