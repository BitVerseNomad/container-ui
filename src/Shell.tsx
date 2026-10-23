import { ReactNode, useState } from "react";
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

const FOLD_KEY = "colima-ui:sidebar-folded";
// Storage can be blocked; the sidebar then simply starts open.
const readFolded = () => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } };
const saveFolded = (v: boolean) => { try { localStorage.setItem(FOLD_KEY, v ? "1" : "0"); } catch { /* not remembered */ } };

export default function Shell({ nav, onNav, profiles, active, onSelect, children, badges = {}, hidden = [] }: Props) {
  const current = profiles.find((p) => p.name === active);
  const [folded, setFolded] = useState(readFolded);
  const fold = () => setFolded((f) => { saveFolded(!f); return !f; });
  return (
    <div className={folded ? "shell folded" : "shell"}>
      <div className="sidebar">
        <div className="brand">
          <span className="logo"><Icon name="box" size={18} /></span>
          <b>Colima</b>
          <button className="icon-btn fold-btn" aria-label={folded ? "Show the sidebar" : "Hide the sidebar"} title={folded ? "Show the sidebar" : "Hide the sidebar"} aria-expanded={!folded} onClick={fold}>
            <Icon name="sidebar" size={15} />
          </button>
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
