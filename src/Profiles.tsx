import { useEffect, useRef, useState } from "react";
import Status from "./ui/Status";
import { Header } from "./Header";
import { useHostSize } from "./useHostSize";
import { useConfirm } from "./ui";
import { invoke } from "@tauri-apps/api/core";
import { Profile, StartOpts, gbOf } from "./api";
import EditPanel from "./EditPanel";
import { Empty } from "./ui";
import { Button as OpButton, Checkbox, Field, FormRow, Menu, MenuItem, MoreButton, Select } from "./ui/op";
import OutputLog from "./ui/OutputLog";
import { useFixRuns } from "./FixIt";
import { ranVm } from "./lib/activity";

const gb = (bytes: number) => `${gbOf(bytes)} GiB`;
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Props = {
  profiles: Profile[];
  reload: () => void;
  openNew?: boolean;
  // whether a profile runs Kubernetes; null while that is not known yet
  kubeOn?: (name: string) => boolean | null;
  onKubeAsked?: (name: string, on: boolean) => void;
};

const RUNTIMES = ["docker", "containerd", "incus"].map((value) => ({ value, label: value }));

export default function Profiles({ profiles, reload, openNew = false, kubeOn = () => null, onKubeAsked }: Props) {
  const size = useHostSize();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [newKube, setNewKube] = useState(false);
  // Which machine the running action is on and its word ("Starting…"), so only that row shows it.
  const [working, setWorking] = useState<{ name: string; word: string } | null>(null);
  // A container fix in the middle of a VM stop or restart is left half done, so the VM waits for it.
  const fixing = useFixRuns().some((r) => r.step != null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // While the New profile dialog is open, the empty card behind it stays hidden.
  const [dialogOpen, setDialogOpen] = useState(false);
  // "Customize first" on the first-run card lands here with the form already open.
  useEffect(() => {
    if (openNew) openForm();
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // The form opens on a name that is free, so it never starts with an error showing. The free name follows the list of
  // profiles (it may still be arriving when the form opens) until the user types their own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [runtime, setRuntime] = useState("docker");
  const newName = typedName ?? (["default", "dev", "work", "test"].find((n) => !profiles.some((p) => p.name === n)) ?? "machine2");
  function openForm() {
    setTypedName(null);
    setDialogOpen(true);
    dialog.current?.showModal();
  }
  const taken = profiles.some((p) => p.name === newName.trim());


  async function act(name: string, label: string, cmd: string, args: Record<string, unknown>): Promise<boolean> {
    setBusy(`${sentence(label)} ${name}…`);
    setWorking({ name, word: `${sentence(label)}…` });
    setError(null);
    try {
      await ranVm(cmd, args, () => invoke(cmd, args));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(null);
      setWorking(null);
      reload();
    }
  }

  // The same action the Kubernetes page offers: start the VM with Kubernetes on (a running VM restarts first).
  async function turnOnKubernetes(p: Profile) {
    const warn = p.status === "Running" ? " The VM restarts, so running containers stop for a minute and start again." : "";
    if (!(await confirm(`Turn on Kubernetes for "${p.name}"?${warn}`, "Turn on", { safe: true }))) return;
    if (await act(p.name, "turning on Kubernetes for", "apply_resources", { opts: { name: p.name, kubernetes: true } as StartOpts, restart: p.status === "Running" })) onKubeAsked?.(p.name, true);
  }

  // Mirrors turnOnKubernetes: the VM restarts without Kubernetes, so running containers stop and start again.
  async function turnOffKubernetes(p: Profile) {
    const warn = p.status === "Running" ? " The machine restarts, so running containers stop for a minute and start again." : "";
    if (!(await confirm(`Turn off Kubernetes for "${p.name}"?${warn} You can turn Kubernetes on again any time.`, "Turn off", { safe: true }))) return;
    if (await act(p.name, "turning off Kubernetes for", "apply_resources", { opts: { name: p.name, kubernetes: false } as StartOpts, restart: p.status === "Running" })) onKubeAsked?.(p.name, false);
  }

  return (
    <>
      <Header title="Machines">
        <OpButton variant="primary" size="sm" onClick={openForm}>New machine</OpButton>
      </Header>
      <p className="hint lead">A machine is a separate Colima VM with its own containers, images and volumes. Most people only need <b>default</b>.</p>
      <OutputLog event="colima-progress" active={!!busy} status={busy ?? undefined} failure={error} onClear={() => setError(null)} />
      {profiles.length === 0 && !dialogOpen && <Empty title="No Colima machines yet">Create one to start a container runtime on this machine.</Empty>}
      {profiles.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Machine</th><th scope="col">Status</th><th scope="col">CPUs</th><th scope="col">Memory</th><th scope="col">Disk</th><th scope="col">Runtime</th><th scope="col">Kubernetes</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const up = p.status === "Running";
              return (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{working?.name === p.name ? <Status level="busy">{working.word}</Status> : <Status level={up ? "on" : "off"}>{p.status}</Status>}</td>
                  <td className="font-mono">{p.cpus}</td>
                  <td className="font-mono">{gb(p.memory)}</td>
                  <td className="font-mono whitespace-nowrap">{gb(p.disk)}</td>
                  <td>{p.runtime}</td>
                  <td>
                    {kubeOn(p.name) === true ? (
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Status level="on">On</Status>
                        <OpButton size="xs" disabled={!!busy} aria-label={`Turn off Kubernetes for ${p.name}`} onClick={() => turnOffKubernetes(p)}>Turn off</OpButton>
                      </span>
                    ) : kubeOn(p.name) === false ? <OpButton size="xs" className="whitespace-nowrap" disabled={!!busy} onClick={() => turnOnKubernetes(p)}>Turn on Kubernetes</OpButton> : <span className="hint">–</span>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {up ? (
                      <OpButton variant="default" size="sm" icon="stop" aria-label={`Stop ${p.name}`} disabled={!!busy || fixing} onClick={() => act(p.name, "stopping", "stop_profile", { name: p.name })}>Stop</OpButton>
                    ) : (
                      <OpButton variant="default" size="sm" icon="play" aria-label={`Start ${p.name}`} disabled={!!busy} onClick={() => act(p.name, "starting", "start_profile", { opts: { name: p.name } as StartOpts })}>Start</OpButton>
                    )}
                    <Menu label={`More actions for ${p.name}`} align="end" trigger={<MoreButton name={p.name} disabled={!!busy} />}>
                      {up && <MenuItem label="Restart" why="Stops the machine and starts it again" icon="restart" disabled={!!busy || fixing} onSelect={() => act(p.name, "restarting", "restart_profile", { name: p.name })} />}
                      <MenuItem label="Edit" why="Change CPUs, memory or disk" disabled={!!busy || fixing} onSelect={() => setEditing(p)} />
                      <MenuItem label="Delete" why="Removes the machine with its containers and images" danger disabled={!!busy || fixing} onSelect={async () => { if (await confirm(`Delete machine "${p.name}" and its VM? All its containers and images are removed.`, "Delete")) void act(p.name, "deleting", "delete_profile", { name: p.name }); }} />
                    </Menu>
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

      <dialog ref={dialog} onClose={() => setDialogOpen(false)}>
        <form
          className="flex flex-col gap-3"
          method="dialog"
          onSubmit={(e) => {
            const f = new FormData(e.currentTarget);
            const opts: StartOpts = {
              name: String(newName.trim() || f.get("name") || "default"),
              cpus: Number(f.get("cpus")),
              memory: Number(f.get("memory")),
              disk: Number(f.get("disk")),
              runtime,
              kubernetes: newKube,
            };
            act(opts.name, "starting", "start_profile", { opts });
          }}
        >
          <h3>New machine</h3>
          <FormRow label="Name" htmlFor="new-machine-name">
            <Field id="new-machine-name" name="name" value={newName} onChange={(e) => setTypedName(e.target.value)} required pattern="[a-zA-Z0-9_-]+" />
          </FormRow>
          {taken && <p className="hint text-bad">A machine named "{newName}" already exists. Use Edit on it instead.</p>}
          <FormRow label="CPUs" htmlFor="new-machine-cpus">
            <Field id="new-machine-cpus" key={size?.cpus} name="cpus" type="number" min={1} defaultValue={size?.cpus ?? 2} />
          </FormRow>
          <FormRow label="Memory (GiB)" htmlFor="new-machine-memory">
            <Field id="new-machine-memory" key={size?.memory} name="memory" type="number" min={1} defaultValue={size?.memory ?? 4} />
          </FormRow>
          <FormRow label="Disk (GiB)" htmlFor="new-machine-disk">
            <Field id="new-machine-disk" name="disk" type="number" min={10} defaultValue={60} />
          </FormRow>
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium text-fg-muted">Runtime</span>
            <Select aria-label="Runtime" value={runtime} onChange={setRuntime} options={RUNTIMES} container={dialog.current} />
          </div>
          <Checkbox checked={newKube} onChange={setNewKube}>Enable Kubernetes</Checkbox>
          <div className="actions">
            <OpButton variant="default" onClick={() => dialog.current?.close()}>Cancel</OpButton>
            <OpButton variant="primary" disabled={taken} onClick={(e) => e.currentTarget.form?.requestSubmit()}>Create and start</OpButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
