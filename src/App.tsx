import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import Shell, { Tab } from "./Shell";
import PageHeader from "./ui/PageHeader";
import Containers, { VmState } from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Networks from "./Networks";
import Kubernetes from "./Kubernetes";
import Profiles from "./Profiles";
import InstallCard from "./InstallCard";
import { useEnv } from "./useEnv";

export default function App() {
  const [tab, setTab] = useState<Tab>("Containers");
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
  // A container page from a VM that has stopped is gone; show the list when the VM comes back.
  useEffect(() => {
    if (!ctx) setDetailId(null);
  }, [ctx]);
  const toolsMissing = !!env && (!env.colima || !env.docker);

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
          onProfiles={() => setTab("Profiles")}
        />
      )
    ) : tab === "Profiles" ? (
      <Profiles profiles={profiles} reload={reload} />
    ) : !ctx ? (
      <Empty title="Colima isn't running">Start the VM on the Containers screen, or a profile in Profiles.</Empty>
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
    <Shell nav={tab} onNav={(t) => { setDetailId(null); setPullOnOpen(false); setTab(t); }} profiles={profiles} active={active} onSelect={setActive}>
      {!(tab === "Containers" && detailId) && <PageHeader title={tab} />}
      <Banner error={error} />
      {page}
    </Shell>
  );
}
