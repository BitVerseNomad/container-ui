import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import OutputLog from "./ui/OutputLog";

// A brew install the user triggers with a click; the exact command is shown first.
export default function InstallTool({ title, name, hasBrew, onDone }: { title: string; name: string; hasBrew: boolean; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function install() {
    setBusy(true);
    setFailure(null);
    try {
      await invoke("install_tools", { names: [name] });
      await onDone();
    } catch (e) {
      setFailure(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="step">
      <h4>{title}</h4>
      <p className="hint">This will run:</p>
      <pre className="cmd">brew install {name}</pre>
      {hasBrew ? (
        <button className="primary" disabled={busy} onClick={install}>{busy ? "Installing…" : "Install with Homebrew"}</button>
      ) : (
        <p className="hint">Homebrew isn't installed yet. The Overview page explains how to install it.</p>
      )}
      <OutputLog event="brew-progress" active={busy} failure={failure} />
    </div>
  );
}
