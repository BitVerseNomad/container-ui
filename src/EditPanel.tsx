import { useState } from "react";
import Drawer from "./ui/Drawer";
import { invoke } from "@tauri-apps/api/core";
import { Profile, StartOpts, gbOf } from "./api";
import { Banner } from "./ui";

type Props = { profile: Profile; onClose: () => void; onApplied: () => void };

export default function EditPanel({ profile, onClose, onApplied }: Props) {
  const was = { cpus: profile.cpus, memory: gbOf(profile.memory), disk: gbOf(profile.disk) };
  const running = profile.status === "Running";
  const [cpus, setCpus] = useState(was.cpus);
  const [memory, setMemory] = useState(was.memory);
  const [disk, setDisk] = useState(was.disk);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = cpus !== was.cpus || memory !== was.memory || disk !== was.disk;
  const valid = Number.isInteger(cpus) && cpus >= 1 && Number.isInteger(memory) && memory >= 1 && Number.isInteger(disk) && disk >= was.disk;

  async function apply() {
    setBusy(true);
    setError(null);
    const opts: StartOpts = {
      name: profile.name,
      cpus: cpus !== was.cpus ? cpus : undefined,
      memory: memory !== was.memory ? memory : undefined,
      disk: disk !== was.disk ? disk : undefined,
    };
    try {
      await invoke("apply_resources", { opts, restart: running });
      onApplied();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  const field = (id: string, label: string, value: number, set: (n: number) => void, prev: number, unit: string, min: number) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={min} value={value || ""} disabled={busy} onChange={(e) => set(Number(e.target.value))} />
      <span className={value !== prev ? "delta changed" : "delta"}>
        {value !== prev ? `${prev}${unit} → ${value || "?"}${unit}` : "Current"}
      </span>
    </div>
  );

  return (
    <Drawer label={`Edit profile ${profile.name}`} title={<>Edit profile: {profile.name}</>} onClose={onClose} closeDisabled={busy}>

        {field("cpus", "CPUs", cpus, setCpus, was.cpus, "", 1)}
        {field("memory", "Memory (GiB)", memory, setMemory, was.memory, " GiB", 1)}
        {field("disk", "Disk (GiB)", disk, setDisk, was.disk, " GiB", was.disk)}
        <p className="hint">Disk can only grow. CPU and memory can go up or down.</p>

        <p className="note">
          {running
            ? "Containers in this profile will stop while the VM restarts."
            : "This profile is stopped. It will start with these values."}
        </p>

        <Banner error={error} />
        {busy && <p className="hint">{running ? "Stopping and restarting the VM. This can take a minute or two." : "Starting the VM…"}</p>}

        <div className="actions">
          <button disabled={busy} onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !changed || !valid} onClick={apply}>
            {busy ? "Applying…" : running ? "Stop and apply" : "Apply and start"}
          </button>
        </div>
    </Drawer>
  );
}
