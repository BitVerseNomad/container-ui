import { ReactNode } from "react";
import { Profile } from "./api";
import { Icon, IconName } from "./ui/icons";

export type Tab = "Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles" | "Setup";

const NAV: { tab: Tab; icon: IconName }[] = [
  { tab: "Containers", icon: "box" },
  { tab: "Images", icon: "image" },
  { tab: "Volumes", icon: "database" },
  { tab: "Networks", icon: "network" },
  { tab: "Kubernetes", icon: "cluster" },
  { tab: "Setup", icon: "check" },
  { tab: "Profiles", icon: "sliders" },
];

type Props = {
  nav: Tab;
  onNav: (t: Tab) => void;
  profiles: Profile[];
  active: string | null;
  onSelect: (name: string) => void;
  children: ReactNode;
  // a count shown next to a nav item, e.g. setup problems left
  badges?: Partial<Record<Tab, number>>;
  // nav items left out for now, e.g. Kubernetes while the active profile has it turned off
  hidden?: Tab[];
};

export default function Shell({ nav, onNav, profiles, active, onSelect, children, badges = {}, hidden = [] }: Props) {
  const current = profiles.find((p) => p.name === active);
  return (
    <div className="shell">
      <div className="sidebar">
        <div className="brand">
          <span className="logo"><Icon name="box" size={18} /></span>
          <b>Colima</b>
        </div>
        <nav aria-label="Main">
          {NAV.filter(({ tab }) => !hidden.includes(tab)).map(({ tab, icon }) => (
            <button key={tab} className={tab === nav ? "nav-item active" : "nav-item"} aria-label={tab} title={tab} aria-current={tab === nav ? "page" : undefined} onClick={() => onNav(tab)}>
              <Icon name={icon} />
              <span className="nav-label">{tab}</span>
              {!!badges[tab] && <span className="nav-badge" aria-hidden="true">{badges[tab]}</span>}
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
          {current && <span className="foot-sub hint">{current.runtime} · {current.cpus} CPU · {Math.round(current.memory / 1024 ** 3)} GiB</span>}
        </div>
      </div>
      <main className="content">{children}</main>
    </div>
  );
}
