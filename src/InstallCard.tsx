import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EnvReport } from "./useEnv";
import Card from "./ui/Card";
import OutputLog from "./ui/OutputLog";
import { Icon } from "./ui/icons";

const BOOTSTRAP = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

export default function InstallCard({ env, onDone }: { env: EnvReport; onDone: () => Promise<void> }) {
  // Homebrew's docker formula is only the CLI; compose and buildx came with Docker Desktop, so add them too.
  const missing = [...(["colima", "docker"] as const).filter((n) => !env[n]), ...(env.docker ? [] : ["docker-compose", "docker-buildx"])];
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const command = `brew install ${missing.join(" ")}`;

  async function install() {
    setBusy(true);
    setFailure(null);
    setNote(null);
    try {
      await invoke("install_tools", { names: missing });
      // Point docker at Homebrew's plugin folder so `docker compose` works straight away.
      if (missing.includes("docker-compose")) {
        try {
          await invoke("setup_fix", { id: "plugins" });
          setNote("Linked docker compose and docker buildx so the docker command can find them.");
        } catch (e) {
          setFailure(`Installed, but linking the plugins failed. Open Setup to try again.\n${String(e)}`);
        }
      }
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
      <h2>{missing.length === 1 ? `${missing[0][0].toUpperCase() + missing[0].slice(1)} isn't installed yet` : `${missing.length} tools are missing: ${missing.join(", ")}`}</h2>
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
      {note && <p className="hint">{note}</p>}
      <OutputLog event="brew-progress" active={busy} failure={failure} />
    </Card>
  );
}
