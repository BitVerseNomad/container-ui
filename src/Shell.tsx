import { ReactNode } from "react";
import { Profile, gbOf } from "./api";
import { Icon, IconName } from "./ui/icons";

export type Tab = "Overview" | "Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles";

const NAV: { tab: Tab; icon: IconName }[] = [
  { tab: "Overview", icon: "gauge" },
  { tab: "Containers", icon: "box" },
  { tab: "Images", icon: "image" },
  { tab: "Volumes", icon: "database" },
  { tab: "Networks", icon: "network" },
  { tab: "Kubernetes", icon: "cluster" },
  { tab: "Profiles", icon: "sliders" },
];

type Props = {
  nav: Tab;
  onNav: (t: Tab) => void;
  profiles: Profile[];
  active: string | null;
  onSelect: (name: string) => void;
  children: ReactNode;
};

export default function Shell({ nav, onNav, profiles, active, onSelect, children }: Props) {
  const current = profiles.find((p) => p.name === active);
  return (
    <div className="shell">
      <div className="sidebar">
        <div className="brand">
          <span className="logo"><Icon name="box" size={18} /></span>
          <div>
            <b>Colima</b>
            <small>Local runtimes</small>
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map(({ tab, icon }) => (
            <button key={tab} className={tab === nav ? "nav-item active" : "nav-item"} aria-label={tab} title={tab} aria-current={tab === nav ? "page" : undefined} onClick={() => onNav(tab)}>
              <Icon name={icon} />
              <span className="nav-label">{tab}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className="foot-label">Active profile</span>
          {profiles.length >= 2 ? (
            <select aria-label="Active profile" value={active ?? ""} onChange={(e) => onSelect(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          ) : (
            <b>{current?.name ?? "none"}</b>
          )}
          <span className="foot-sub">{current ? `${current.runtime} · ${current.cpus} CPU · ${gbOf(current.memory)} GB` : "No VM yet"}</span>
        </div>
      </div>
      <main className="content">{children}</main>
    </div>
  );
}
