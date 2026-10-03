import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import Containers from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Profiles from "./Profiles";

const TABS = ["Containers", "Images", "Volumes", "Colima"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Containers");
  const [active, setActive] = useState<string | null>(null);
  const { data, error, reload } = usePoll(() => invoke<Profile[]>("list_profiles"), []);
  const profiles = data ?? [];
  const live = profiles.filter((p) => p.status === "Running");

  useEffect(() => {
    if (!live.some((p) => p.name === active)) setActive(live[0]?.name ?? null);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = active ? ctxFor(active) : null;

  return (
    <div className="app">
      <aside>
        <h1>Colima</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "row active" : "row"} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {live.length > 0 && (
          <label className="ctx">
            Running profile
            <select value={active ?? ""} onChange={(e) => setActive(e.target.value)}>
              {live.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
      </aside>

      <main>
        <Banner error={error} />
        {tab === "Colima" ? (
          <Profiles profiles={profiles} reload={reload} />
        ) : !ctx ? (
          <Empty title="Colima isn't running">Start a profile in the Colima tab to see its containers, images and volumes.</Empty>
        ) : tab === "Containers" ? (
          <Containers key={ctx} ctx={ctx} />
        ) : tab === "Images" ? (
          <Images key={ctx} ctx={ctx} onRan={() => setTab("Containers")} />
        ) : (
          <Volumes key={ctx} ctx={ctx} />
        )}
      </main>
    </div>
  );
}
