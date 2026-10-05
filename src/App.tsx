import { useEffect, useState } from "react";
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
import Profiles from "./Profiles";

export default function App() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [active, setActive] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, error, reload } = usePoll(() => invoke<Profile[]>("list_profiles"), []);
  const profiles = data ?? [];

  useEffect(() => {
    if (!profiles.some((p) => p.name === active)) {
      setActive((profiles.find((p) => p.status === "Running") ?? profiles[0])?.name ?? null);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setDetailId(null), [active]);

  const current = profiles.find((p) => p.name === active) ?? null;
  const ctx = current?.status === "Running" ? ctxFor(current.name) : null;
  const pill: PillState = !current ? "stopped" : current.status === "Running" ? "running" : current.status === "Stopped" ? "stopped" : "error";

  const page =
    tab === "Overview" ? (
      <Empty title="Nothing here yet">The Overview arrives in the next step.</Empty>
    ) : tab === "Profiles" ? (
      <Profiles profiles={profiles} reload={reload} />
    ) : !ctx ? (
      <Empty title="Colima isn't running">Start a profile in Profiles to see its containers, images and volumes.</Empty>
    ) : tab === "Containers" ? (
      <Containers key={ctx} ctx={ctx} detailId={detailId} setDetailId={setDetailId} />
    ) : tab === "Images" ? (
      <Images
        key={ctx}
        ctx={ctx}
        onRan={(id) => {
          setDetailId(id);
          setTab("Containers");
        }}
      />
    ) : (
      <Volumes key={ctx} ctx={ctx} />
    );

  return (
    <Shell nav={tab} onNav={(t) => { setDetailId(null); setTab(t); }} profiles={profiles} active={active} onSelect={setActive}>
      <PageHeader breadcrumb={`Colima / ${current?.name ?? "no profile"}`} title={tab} status={<StatusPill state={pill} />} />
      <Banner error={error} />
      {page}
    </Shell>
  );
}
