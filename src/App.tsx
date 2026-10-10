import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import Shell, { Tab } from "./Shell";
import PageHeader from "./ui/PageHeader";
import StatusPill, { PillState } from "./ui/StatusPill";
import Containers from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Networks from "./Networks";
import Profiles from "./Profiles";
import Overview, { VmState } from "./Overview";
import InstallCard from "./InstallCard";
import { useEnv } from "./useEnv";

export default function App() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [active, setActive] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pullOnOpen, setPullOnOpen] = useState(false);
  const [vm, setVm] = useState<VmState>({ op: null, failure: null });
  const { env, recheck } = useEnv();
  const { data, error, reload } = usePoll(() => invoke<Profile[]>("list_profiles"), []);
  const profiles = data ?? [];

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
  const derived: PillState = !current ? "stopped" : current.status === "Running" ? "running" : current.status === "Stopped" ? "stopped" : "error";
  const pill: PillState = vm.op ?? (vm.failure ? "error" : derived);
  const toolsMissing = !!env && (!env.colima || !env.docker);

  const page =
    tab === "Overview" ? (
      env && toolsMissing ? (
        <InstallCard env={env} onDone={recheck} />
      ) : (
        <Overview
          profile={current}
          ctx={ctx}
          vm={vm}
          onVm={setVm}
          reload={reload}
          onOpen={(id) => { setDetailId(id); setTab("Containers"); }}
          onPull={() => { setPullOnOpen(true); setTab("Images"); }}
          onReview={(to) => { setDetailId(null); setTab(to); }}
          onProfiles={() => setTab("Profiles")}
        />
      )
    ) : tab === "Profiles" ? (
      <Profiles profiles={profiles} reload={reload} />
    ) : !ctx ? (
      <Empty title="Colima isn't running">Start a profile in Profiles to see its containers, images and volumes.</Empty>
    ) : tab === "Containers" ? (
      <Containers key={ctx} ctx={ctx} detailId={detailId} setDetailId={setDetailId} />
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
    ) : (
      <Networks key={ctx} ctx={ctx} />
    );

  return (
    <Shell nav={tab} onNav={(t) => { setDetailId(null); setPullOnOpen(false); setTab(t); }} profiles={profiles} active={active} onSelect={setActive}>
      <PageHeader breadcrumb={`Colima / ${current?.name ?? "no profile"}`} title={tab} status={<StatusPill state={pill} />} />
      <Banner error={error} />
      {page}
    </Shell>
  );
}
