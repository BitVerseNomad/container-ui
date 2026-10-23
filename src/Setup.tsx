import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile } from "./api";
import { usePoll } from "./hooks";
import { PlanStep, SetupFinding, SetupReport, fixAllPlan, needsAttention, setupFindings, sortFindings } from "./lib/setup";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";

const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export function useSetup(profile: Profile | null) {
  const { data, error, reload } = usePoll(() => invoke<SetupReport>("setup_report"), [], 60_000);
  const vm = profile?.status === "Running" ? { cpus: profile.cpus, memory: profile.memory } : null;
  const name = profile?.name ?? "default";
  const findings = data ? sortFindings(setupFindings(data, vm, name)) : null;
  return { findings, error, reload, profile: name };
}

// Checks what removing Docker Desktop leaves behind. Each fix shows its command and runs only on a click.
type Props = ReturnType<typeof useSetup> & { onProfiles: () => void };
export default function Setup({ findings, error, reload, profile, onProfiles }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  if (!findings) return <Banner error={error} />;
  const todo = needsAttention(findings);
  const plan = fixAllPlan(findings);
  const problems = findings.filter((f) => f.status !== "ok");
  const passing = findings.filter((f) => f.status === "ok");
  const row = (f: SetupFinding) => (
    <li key={f.id} className={`finding ${f.status}`}>
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
          <button className={f.status === "fail" && plan.length <= 1 ? "primary" : ""} disabled={busy !== null} onClick={() => act(f)}>
            {busy === f.id ? "Working…" : copied === f.id ? "Copied" : f.fix.label}
          </button>
        )}
      </div>
    </li>
  );
  return (
    <div className="setup">
      <p className="hint">
        {todo === 0 ? "Everything Docker Desktop used to handle is in place." : `${todo} thing${todo === 1 ? "" : "s"} need${todo === 1 ? "s" : ""} attention before your terminal and tests work like they did with Docker Desktop.`}{" "}
        {todo > 0 && "Nothing changes until you click a fix, and ~/.docker/config.json is backed up first."}
      </p>
      {plan.length > 1 && (
        <div className="fix-all">
          <button className="primary" disabled={busy !== null} onClick={() => run("all", plan)}>{busy === "all" ? "Fixing…" : "Fix all"}</button>
          <span className="hint">Runs every fix below in order and stops if one fails.</span>
        </div>
      )}
      <Banner error={error} />
      <ul className="findings">{problems.map(row)}</ul>
      {passing.length > 0 && (
        <details className="passing">
          <summary>{passing.length} check{passing.length === 1 ? "" : "s"} pass</summary>
          <ul className="findings">{passing.map(row)}</ul>
        </details>
      )}
      <OutputLog event="brew-progress" active={installing} failure={failure} />
    </div>
  );
}
