import { useRef, useState } from "react";
import { useConfirm } from "./ui";
import { invoke } from "@tauri-apps/api/core";
import { Profile, StartOpts, gbOf } from "./api";
import EditPanel from "./EditPanel";
import { Empty } from "./ui";
import IconButton from "./ui/IconButton";
import OutputLog from "./ui/OutputLog";

const gb = (bytes: number) => `${gbOf(bytes)} GB`;

export default function Profiles({ profiles, reload }: { profiles: Profile[]; reload: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [newName, setNewName] = useState("default");
  const taken = profiles.some((p) => p.name === newName.trim());


  async function act(name: string, label: string, cmd: string, args: Record<string, unknown>) {
    setBusy(`${name}: ${label}`);
    setError(null);
    try {
      await invoke(cmd, args);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
      reload();
    }
  }

  return (
    <section>
      <header>
        <button
          className="primary"
          onClick={() => {
            setNewName(["default", "dev", "work", "test"].find((n) => !profiles.some((p) => p.name === n)) ?? "profile2");
            dialog.current?.showModal();
          }}
        >
          New profile
        </button>
        {busy && <span className="state">{busy}</span>}
      </header>
      <p className="hint lead">A profile is a separate Colima VM with its own containers, images and volumes. Most people only need <b>default</b>.</p>
      <OutputLog event="colima-progress" active={!!busy} failure={error} onClear={() => setError(null)} />
      {profiles.length === 0 && <Empty title="No Colima profiles yet">Create one to start a container runtime on this machine.</Empty>}
      {profiles.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Profile</th><th scope="col">Status</th><th scope="col">CPUs</th><th scope="col">Memory</th><th scope="col">Disk</th><th scope="col">Runtime</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const up = p.status === "Running";
              return (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td><span className={up ? "badge on" : "badge"}>{p.status}</span></td>
                  <td className="mono">{p.cpus}</td>
                  <td className="mono">{gb(p.memory)}</td>
                  <td className="mono">{gb(p.disk)}</td>
                  <td>{p.runtime}</td>
                  <td className="row-actions">
                    {up ? (
                      <>
                        <IconButton label={`Stop ${p.name}`} icon="stop" disabled={!!busy} onClick={() => act(p.name, "stopping", "stop_profile", { name: p.name })} />
                        <IconButton label={`Restart ${p.name}`} icon="restart" disabled={!!busy} onClick={() => act(p.name, "restarting", "restart_profile", { name: p.name })} />
                      </>
                    ) : (
                      <IconButton label={`Start ${p.name}`} icon="play" disabled={!!busy} onClick={() => act(p.name, "starting", "start_profile", { opts: { name: p.name } as StartOpts })} />
                    )}
                    <IconButton label={`Edit ${p.name}`} icon="sliders" disabled={!!busy} onClick={() => setEditing(p)} />
                    <IconButton label={`Delete ${p.name}`} icon="trash" danger disabled={!!busy} onClick={async () => (await confirm(`Delete profile "${p.name}" and its VM? All its containers and images are removed.`, "Delete")) && act(p.name, "deleting", "delete_profile", { name: p.name })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <EditPanel
          profile={editing}
          onClose={() => setEditing(null)}
          onApplied={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      <dialog ref={dialog}>
        <form
          method="dialog"
          onSubmit={(e) => {
            const f = new FormData(e.currentTarget);
            const opts: StartOpts = {
              name: String(f.get("name") || "default"),
              cpus: Number(f.get("cpus")),
              memory: Number(f.get("memory")),
              disk: Number(f.get("disk")),
              runtime: String(f.get("runtime")),
              kubernetes: f.get("kubernetes") === "on",
            };
            act(opts.name, "starting", "start_profile", { opts });
          }}
        >
          <h3>New profile</h3>
          <label>Name<input name="name" value={newName} onChange={(e) => setNewName(e.target.value)} required pattern="[a-zA-Z0-9_-]+" /></label>
          {taken && <p className="hint err">A profile named "{newName}" already exists. Use Edit on it instead.</p>}
          <label>CPUs<input name="cpus" type="number" min={1} defaultValue={2} /></label>
          <label>Memory (GB)<input name="memory" type="number" min={1} defaultValue={4} /></label>
          <label>Disk (GB)<input name="disk" type="number" min={10} defaultValue={60} /></label>
          <label>Runtime
            <select name="runtime" defaultValue="docker">
              <option>docker</option>
              <option>containerd</option>
              <option>incus</option>
            </select>
          </label>
          <label className="check"><input name="kubernetes" type="checkbox" /> Enable Kubernetes</label>
          <div className="actions">
            <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="primary" type="submit" disabled={taken}>Create and start</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
