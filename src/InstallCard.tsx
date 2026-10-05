import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EnvReport } from "./useEnv";
import Card from "./ui/Card";
import OutputLog from "./ui/OutputLog";
import { Icon } from "./ui/icons";

const BOOTSTRAP = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

export default function InstallCard({ env, onDone }: { env: EnvReport; onDone: () => Promise<void> }) {
  const missing = (["colima", "docker"] as const).filter((n) => !env[n]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const command = `brew install ${missing.join(" ")}`;

  async function install() {
    setBusy(true);
    setFailure(null);
    try {
      await invoke("install_tools", { names: missing });
      setDone(true);
      await onDone();
    } catch (e) {
      setFailure(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={done ? "install-card done" : "install-card"}>
      <h2>{missing.map((n) => n[0].toUpperCase() + n.slice(1)).join(" and ")} {missing.length > 1 ? "aren't" : "isn't"} installed yet</h2>
      <p className="hint">Colima runs your containers in a small Linux VM, and Docker is the tool that talks to it. Both come from Homebrew.</p>
      {env.brew ? (
        <>
          <p className="hint">This will run:</p>
          <pre className="cmd">{command}</pre>
          <div className="actions-inline">
            <button className="primary" disabled={busy} onClick={install}>{busy ? "Installing…" : "Install with Homebrew"}</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">Homebrew isn't installed either. Its installer asks for your password, so run it yourself in Terminal:</p>
          <pre className="cmd">{BOOTSTRAP}</pre>
          <div className="actions-inline">
            <button className="primary" onClick={() => navigator.clipboard.writeText(BOOTSTRAP)}>
              <Icon name="copy" size={14} /> Copy command
            </button>
            <button onClick={onDone}>Check again</button>
          </div>
        </>
      )}
      <OutputLog event="brew-progress" active={busy} failure={failure} />
    </Card>
  );
}
