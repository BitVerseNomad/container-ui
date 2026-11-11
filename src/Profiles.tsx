import { useEffect, useRef, useState } from "react";
import Status from "./ui/Status";
import { useHostSize } from "./useHostSize";
import { useConfirm } from "./ui";
import { invoke } from "@tauri-apps/api/core";
import { Profile, StartOpts, gbOf } from "./api";
import EditPanel from "./EditPanel";
import { Empty } from "./ui";
import { Button } from "@ui/components/Button";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import { useFixRuns } from "./FixIt";
import { ranVm } from "./lib/activity";

const gb = (bytes: number) => `${gbOf(bytes)} GiB`;

type Props = {
  profiles: Profile[];
  reload: () => void;
  openNew?: boolean;
  // whether a profile runs Kubernetes; null while that is not known yet
  kubeOn?: (name: string) => boolean | null;
  onKubeAsked?: (name: string) => void;
};

export default function Profiles({ profiles, reload, openNew = false, kubeOn = () => null, onKubeAsked }: Props) {
  const size = useHostSize();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  // A container fix in the middle of a VM stop or restart is left half done, so the VM waits for it.
  const fixing = useFixRuns().some((r) => r.step != null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // "Customize first" on the first-run card lands here with the form already open.
  useEffect(() => {
    if (openNew) openForm();
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // The form opens on a name that is free, so it never starts with an error showing. The free name follows the list of
  // profiles (it may still be arriving when the form opens) until the user types their own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const newName = typedName ?? (["default", "dev", "work", "test"].find((n) => !profiles.some((p) => p.name === n)) ?? "profile2");
  function openForm() {
    setTypedName(null);
    dialog.current?.showModal();
  }
  const taken = profiles.some((p) => p.name === newName.trim());


  async function act(name: string, label: string, cmd: string, args: Record<string, unknown>): Promise<boolean> {
    setBusy(`${name}: ${label}`);
    setError(null);
    try {
      await ranVm(cmd, args, () => invoke(cmd, args));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(null);
      reload();
    }
  }

  // The same action the Kubernetes page offers: start the VM with Kubernetes on (a running VM restarts first).
  async function turnOnKubernetes(p: Profile) {
    const warn = p.status === "Running" ? " The VM restarts, so running containers stop for a minute and start again." : "";
    if (!(await confirm(`Turn on Kubernetes for "${p.name}"?${warn}`, "Turn on", { safe: true }))) return;
    if (await act(p.name, "turning on Kubernetes", "apply_resources", { opts: { name: p.name, kubernetes: true } as StartOpts, restart: p.status === "Running" })) onKubeAsked?.(p.name);
  }

  return (
    <section>
      <header>
        <button
          className="primary"
          onClick={openForm}
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
            <tr><th scope="col">Profile</th><th scope="col">Status</th><th scope="col">CPUs</th><th scope="col">Memory</th><th scope="col">Disk</th><th scope="col">Runtime</th><th scope="col">Kubernetes</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const up = p.status === "Running";
              return (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td><Status level={up ? "on" : "off"}>{p.status}</Status></td>
                  <td className="mono">{p.cpus}</td>
                  <td className="mono">{gb(p.memory)}</td>
                  <td className="mono">{gb(p.disk)}</td>
                  <td>{p.runtime}</td>
                  <td>
                    {kubeOn(p.name) === true ? <Status level="on">On</Status> : kubeOn(p.name) === false ? <button disabled={!!busy} onClick={() => turnOnKubernetes(p)}>Turn on Kubernetes</button> : <span className="hint">–</span>}
                  </td>
                  <td className="row-actions">
                    {up ? (
                      <>
                        <Button variant="default" size="sm" icon={<Icon name="stop" size={13} />} aria-label={`Stop ${p.name}`} disabled={!!busy || fixing} onClick={() => act(p.name, "stopping", "stop_profile", { name: p.name })}>Stop</Button>
                        <Button variant="ghost" size="sm" icon={<Icon name="restart" size={13} />} aria-label={`Restart ${p.name}`} disabled={!!busy || fixing} onClick={() => act(p.name, "restarting", "restart_profile", { name: p.name })}>Restart</Button>
                      </>
                    ) : (
                      <Button variant="default" size="sm" icon={<Icon name="play" size={13} />} aria-label={`Start ${p.name}`} disabled={!!busy} onClick={() => act(p.name, "starting", "start_profile", { opts: { name: p.name } as StartOpts })}>Start</Button>
                    )}
                    <Button variant="ghost" size="sm" icon={<Icon name="sliders" size={13} />} aria-label={`Edit ${p.name}`} disabled={!!busy || fixing} onClick={() => setEditing(p)}>Edit</Button>
                    <Button variant="destructive" size="sm" icon={<Icon name="trash" size={13} />} aria-label={`Delete ${p.name}`} disabled={!!busy || fixing} onClick={async () => (await confirm(`Delete profile "${p.name}" and its VM? All its containers and images are removed.`, "Delete")) && act(p.name, "deleting", "delete_profile", { name: p.name })}>Delete</Button>
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
              name: String(newName.trim() || f.get("name") || "default"),
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
          <label>Name<input name="name" value={newName} onChange={(e) => setTypedName(e.target.value)} required pattern="[a-zA-Z0-9_-]+" /></label>
          {taken && <p className="hint err">A profile named "{newName}" already exists. Use Edit on it instead.</p>}
          <label>CPUs<input key={size?.cpus} name="cpus" type="number" min={1} defaultValue={size?.cpus ?? 2} /></label>
          <label>Memory (GiB)<input key={size?.memory} name="memory" type="number" min={1} defaultValue={size?.memory ?? 4} /></label>
          <label>Disk (GiB)<input name="disk" type="number" min={10} defaultValue={60} /></label>
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
