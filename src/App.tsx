import { useEffect, useRef, useState } from "react";
import { CommandLog, CommandToast } from "./Commands";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import { Icon } from "./ui/icons";
import Shell, { Tab } from "./Shell";
import PageHeader from "./ui/PageHeader";
import Containers, { VmState } from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Networks from "./Networks";
import Kubernetes from "./Kubernetes";
import Profiles from "./Profiles";
import InstallCard from "./InstallCard";
import { useSetup } from "./Setup";
import Doctor, { groups, useDoctor, useMuted } from "./Doctor";
import { useFixRuns } from "./FixIt";
import { useEnv } from "./useEnv";
import { useComposeScan } from "./useComposeScan";
import { contextNames, kubernetesOn } from "./lib/kubeNav";
import { ranVm } from "./lib/activity";
import { useComposeRun } from "./ComposeProjects";
import { ResizeAnnouncer, ResizeProvider, RunVm, resizing, useHeld, useResize } from "./Resize";
import { useHost } from "./useHostSize";

// The profile a VM operation runs on: start takes { opts: { name } }, the others { name }.
const opName = (vm: VmState) => { const a = vm.last?.args as { name?: string; opts?: { name?: string } } | undefined; return a?.opts?.name ?? a?.name; };

// Written out by hand: "its kubernetes" reads wrong.
const NOUN: Record<string, string> = { Images: "images", Volumes: "volumes", Networks: "networks", Kubernetes: "cluster" };

export default function App() {
  const [tab, setTab] = useState<Tab>("Containers");
  const [appError, setAppError] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setAppError((e as CustomEvent<string>).detail);
    window.addEventListener("app-error", on);
    return () => window.removeEventListener("app-error", on);
  }, []);
  const [active, setActive] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pullOnOpen, setPullOnOpen] = useState(false);
  const [newProfileOnOpen, setNewProfileOnOpen] = useState(false);
  const [vm, setVm] = useState<VmState>({ op: null, failure: null });
  const { env, recheck } = useEnv();
  const compose = useComposeScan();
  const { data, error, reload } = usePoll(() => invoke<Profile[]>("list_profiles"), []);
  const profiles = data ?? [];
  // Which profiles run Kubernetes. Without kubectl there is no way to ask, so the answer stays "not known".
  const kube = usePoll<string[]>(async () => (env?.kubectl ? contextNames(await invoke<string>("kubectl", { context: null, args: ["config", "get-contexts", "-o", "name"] })) : []), [env?.kubectl], 10000, !!env);
  // Profiles switched Kubernetes on this session; the tab shows up even if kubectl still has to be installed.
  const [kubeAsked, setKubeAsked] = useState<string[]>([]);

  useEffect(() => {
    if (!profiles.some((p) => p.name === active)) {
      setActive((profiles.find((p) => p.status === "Running") ?? profiles[0])?.name ?? null);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setDetailId(null), [active]);

  // A failure goes stale when the VM comes up some other way (for example from Profiles).
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const now = profiles.find((p) => p.name === active)?.status;
    if (prevStatus.current !== "Running" && now === "Running" && vm.op === null) setVm({ op: null, failure: null });
    prevStatus.current = now;
  }, [data, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = profiles.find((p) => p.name === active) ?? null;
  const ctx = current?.status === "Running" ? ctxFor(current.name) : null;
  // A container page from a VM that has stopped is gone; show the list when the VM comes back.
  useEffect(() => {
    if (!ctx) setDetailId(null);
  }, [ctx]);
  const kubeOn = !!current && (kubernetesOn(ctxFor(current.name), kube.data) === true || kubeAsked.includes(current.name));
  // The Kubernetes page goes away with its nav item once the active profile has no cluster.
  useEffect(() => {
    if (tab === "Kubernetes" && !kubeOn && (kube.data !== null || !current)) setTab("Containers");
  }, [tab, kubeOn, kube.data, current]);
  const setup = useSetup(current);
  const doc = useDoctor(ctx, current);
  const [logOpen, setLogOpen] = useState(false);
  const mutedKeys = useMuted();
  // Held while the VM restarts for a new size, so the badge doesn't drop and come back.
  const doctorTodo = useHeld(groups(setup.findings ?? [], doc.report, mutedKeys).todo);
  const toolsMissing = !!env && (!env.colima || !env.docker);

  // Starts or stops a VM from any tab (Empty states, the sidebar switcher). It switches to that profile and
  // shows the progress on Containers, where the VM strip lives.
  // A Fix renames and recreates containers; stopping the VM halfway would leave a NAME-old behind.
  const fixing = useFixRuns().some((r) => r.step != null);
  // A Compose run talks to Docker inside the VM; stopping the VM under it leaves the project half started.
  const composeBusy = !!useComposeRun().busy;
  // A resize runs from the click until its containers run again; after its VM part, vm.op is free but Docker is not.
  const resizeBusy = resizing(useResize());
  const vmLocked = vm.op !== null || fixing || composeBusy || resizeBusy;
  async function vmFromAnywhere(name: string, op: "starting" | "stopping", restart = false) {
    if (fixing || composeBusy || resizeBusy) return;
    setActive(name);
    setDetailId(null);
    setTab("Containers");
    const last = restart ? { op, cmd: "restart_profile", args: { name } } : op === "starting" ? { op, cmd: "start_profile", args: { opts: { name } } } : { op, cmd: "stop_profile", args: { name } };
    setVm({ op, failure: null, last });
    try {
      await ranVm(last.cmd, last.args, () => invoke(last.cmd, last.args));
      setVm({ op: null, failure: null, last });
    } catch (e) {
      setVm({ op: null, failure: String(e), last });
    }
    reload();
  }
  // The VM size fix's runner (src/Resize.tsx): the same VM state as every other VM button, so the sidebar, the VM
  // strip and container actions lock and show it, wherever the user goes meanwhile. Its failure is shown where it
  // was started, with a smaller size to try, so it isn't also a start-failure card here.
  const runVm: RunVm = async (op, cmd, args) => {
    const last = { op, cmd, args };
    setVm({ op, failure: null, last });
    try {
      await ranVm(cmd, args, () => invoke(cmd, args), true);
      return null;
    } catch (e) {
      return String(e);
    } finally {
      // Read the VM's new status before letting go of the lock, so no screen flashes "stopped" in between.
      await reload().catch(() => {});
      setVm({ op: null, failure: null, last });
    }
  };
  const { host, pick } = useHost();
  const startFromAnywhere = () => (current ? vmFromAnywhere(current.name, "starting") : setTab("Containers"));
  // A failure card belongs to the profile it happened on; switching away clears it (unless an operation is still running).
  const switchTo = (name: string) => {
    if (name !== active && vm.op === null) setVm({ op: null, failure: null });
    setActive(name);
  };

  const page =
    tab === "Containers" ? (
      env && toolsMissing ? (
        <InstallCard env={env} onDone={recheck} />
      ) : (
        <Containers
          key={ctx ?? "none"}
          profile={current}
          ctx={ctx}
          vm={vm}
          onVm={setVm}
          reload={reload}
          detailId={detailId}
          setDetailId={setDetailId}
          onPull={() => { setPullOnOpen(true); setTab("Images"); }}
          onProfiles={() => { setNewProfileOnOpen(true); setTab("Profiles"); }}
          compose={compose}
          onImages={() => setTab("Images")}
          onKubernetes={kubeOn ? () => setTab("Kubernetes") : undefined}
          report={doc.report}
          onReport={doc.reload}
        />
      )
    ) : tab === "Doctor" ? (
      // Until the tool check answers, an empty Doctor could read as an all-clear on a Mac with nothing installed.
      !env ? null : toolsMissing ? (
        <div className="blank">
          <span className="blank-icon"><Icon name="download" size={28} /></span>
          <h2>Install Colima and Docker first</h2>
          <p className="hint">The checks need both.</p>
          <span className="actions-inline"><button className="primary" onClick={() => setTab("Containers")}>Install them</button></span>
        </div>
      ) : (
        <Doctor ctx={ctx} setup={setup} doc={doc} onProfiles={() => setTab("Profiles")} onGo={(page) => setTab(page)} onOpen={(name) => { setDetailId(name); setTab("Containers"); }} />
      )
    ) : tab === "Profiles" ? (
      <Profiles
        profiles={profiles}
        reload={() => { reload(); kube.reload(); }}
        openNew={newProfileOnOpen}
        kubeOn={(name) => (kubeAsked.includes(name) ? true : kubernetesOn(ctxFor(name), kube.data))}
        onKubeAsked={(name) => setKubeAsked((l) => (l.includes(name) ? l : [...l, name]))}
      />
    ) : !ctx ? (
      toolsMissing ? (
        <Empty title="Colima isn't installed yet" action={<button className="primary" onClick={() => setTab("Containers")}>Install it</button>}>
          Containers installs Colima and Docker with one click.
        </Empty>
      ) : current ? (
        <Empty title={`${current.name} is stopped`} action={<button className="primary" disabled={vm.op !== null} onClick={startFromAnywhere}>{`Start ${current.name}`}</button>}>
          Start the VM to see its {NOUN[tab] ?? "contents"}.
        </Empty>
      ) : (
        <Empty title="No VM yet" action={<button className="primary" onClick={() => setTab("Containers")}>Create your first VM</button>}>
          Colima needs one small Linux VM. Containers sets it up for you.
        </Empty>
      )
    ) : tab === "Images" ? (
      <Images
        key={`${ctx}-${pullOnOpen}`}
        ctx={ctx}
        startPull={pullOnOpen}
        arch={current?.arch}
        onRan={(id) => {
          setDetailId(id);
          setTab("Containers");
        }}
      />
    ) : tab === "Volumes" ? (
      <Volumes key={ctx} ctx={ctx} />
    ) : tab === "Networks" ? (
      <Networks key={ctx} ctx={ctx} />
    ) : (
      <Kubernetes key={ctx} profile={current!} ctx={ctx} />
    );

  return (
    <ResizeProvider value={{ profile: current, host, pick, runVm, containers: doc.containers, locked: vmLocked, vmBusy: vm.op !== null, onProfiles: () => setTab("Profiles") }}>
    <Shell onCommands={() => setLogOpen(true)} badges={{ Doctor: doctorTodo }} hidden={kubeOn ? [] : ["Kubernetes"]} nav={tab} onNav={(t) => { setDetailId(null); setPullOnOpen(false); setNewProfileOnOpen(false); setTab(t); }} profiles={profiles} active={active} onSelect={switchTo} onVm={vmFromAnywhere} onRestart={(name) => vmFromAnywhere(name, "starting", true)} vmBusy={vmLocked} vmOp={vm.op && opName(vm) ? { name: opName(vm)!, op: vm.op } : null} onNewProfile={() => { setDetailId(null); setNewProfileOnOpen(true); setTab("Profiles"); }}>
      {!(tab === "Containers" && detailId) && <PageHeader title={tab} />}
      <Banner error={error} />
      <Banner error={appError} onClose={() => setAppError(null)} />
      {page}
      <CommandToast onOpenLog={() => setLogOpen(true)} />
      <ResizeAnnouncer />
      {logOpen && <CommandLog onClose={() => setLogOpen(false)} />}
    </Shell>
    </ResizeProvider>
  );
}
