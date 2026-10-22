import { ReactNode } from "react";
import { Profile } from "./api";
import { Icon, IconName } from "./ui/icons";

export type Tab = "Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles";

const NAV: { tab: Tab; icon: IconName }[] = [
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
          <b>Colima</b>
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
        </div>
      </div>
      <main className="content">{children}</main>
    </div>
  );
}
