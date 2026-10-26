import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import Shell, { Tab } from "./Shell";
import PageHeader from "./ui/PageHeader";
import { Icon } from "./ui/icons";
import Containers, { VmState } from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Networks from "./Networks";
import Kubernetes from "./Kubernetes";
import Profiles from "./Profiles";
import InstallCard from "./InstallCard";
import { useSetup } from "./Setup";
import Doctor, { DoctorPanel, groups, useDoctor, useMuted } from "./Doctor";
import { blocking, needsAttention } from "./lib/setup";
import { useEnv } from "./useEnv";
import { useComposeScan } from "./useComposeScan";
import { contextNames, kubernetesOn } from "./lib/kubeNav";

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
  const setupFails = setup.findings ? blocking(setup.findings) : 0;
  const setupTodo = setup.findings ? needsAttention(setup.findings) : 0;
  const doc = useDoctor(ctx, current);
  const mutedKeys = useMuted();
  const doctorTodo = groups(setup.findings ?? [], doc.report, mutedKeys).todo;
  // Not blocking, but it's the "my terminal shows other containers" confusion, so it earns the strip too.
  const ctxMismatch = setup.findings?.find((f) => f.id === "context" && f.status === "warn");
  const toolsMissing = !!env && (!env.colima || !env.docker);
  const onList = tab === "Containers" && !detailId;

  // Starts or stops a VM from any tab (Empty states, the sidebar switcher). It switches to that profile and
  // shows the progress on Containers, where the VM strip lives.
  async function vmFromAnywhere(name: string, op: "starting" | "stopping") {
    setActive(name);
    setDetailId(null);
    setTab("Containers");
    const last = op === "starting" ? { op, cmd: "start_profile", args: { opts: { name } } } : { op, cmd: "stop_profile", args: { name } };
    setVm({ op, failure: null, last });
    try {
      await invoke(last.cmd, last.args);
      setVm({ op: null, failure: null, last });
    } catch (e) {
      setVm({ op: null, failure: String(e), last });
    }
    reload();
  }
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
        />
      )
    ) : tab === "Doctor" ? (
      // Until the tool check answers, an empty Doctor could read as an all-clear on a Mac with nothing installed.
      !env ? null : toolsMissing ? (
        <Empty title="Install Colima and Docker first">The checks need both. The Containers screen installs them with one click.</Empty>
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
    <Shell badges={{ Doctor: doctorTodo }} hidden={kubeOn ? [] : ["Kubernetes"]} nav={tab} onNav={(t) => { setDetailId(null); setPullOnOpen(false); setNewProfileOnOpen(false); setTab(t); }} profiles={profiles} active={active} onSelect={switchTo} onVm={vmFromAnywhere} vmBusy={vm.op !== null} vmOp={vm.op && opName(vm) ? { name: opName(vm)!, op: vm.op } : null} onNewProfile={() => { setDetailId(null); setNewProfileOnOpen(true); setTab("Profiles"); }}>
      {!(tab === "Containers" && detailId) && <PageHeader title={tab} />}
      <Banner error={error} />
      <Banner error={appError} onClose={() => setAppError(null)} />
      {/* The Containers list carries the Doctor panel; other pages keep a one-line strip. */}
      {onList && !toolsMissing && env && (
        <DoctorPanel ctx={ctx} setup={setup} doc={doc} onProfiles={() => setTab("Profiles")} onGo={(page) => setTab(page)} onOpen={(name) => setDetailId(name)} onDoctor={() => setTab("Doctor")} />
      )}
      {tab !== "Doctor" && !onList && !toolsMissing && setupFails > 0 && (
        <button className="setup-strip" onClick={() => setTab("Doctor")}>
          <Icon name="alert" size={14} /> {setupTodo} setup problem{setupTodo === 1 ? "" : "s"} will break docker in your terminal. Review in Doctor
        </button>
      )}
      {tab !== "Doctor" && !onList && !toolsMissing && setupFails === 0 && ctxMismatch && (
        <button className="setup-strip warn" onClick={() => setTab("Doctor")}>
          <Icon name="alert" size={14} /> {ctxMismatch.detail} Review in Doctor
        </button>
      )}
      {page}
    </Shell>
  );
}
