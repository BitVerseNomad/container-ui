import { ReactNode, useState } from "react";
import { Profile } from "./api";
import { Icon, IconName } from "./ui/icons";
import Menu from "./ui/Menu";

export type Tab = "Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles" | "Doctor";

// Doctor and Profiles are for when something is off, so they sit at the bottom; daily work stays at the top.
const BOTTOM: Tab = "Doctor";
const NAV: { tab: Tab; icon: IconName }[] = [
  { tab: "Containers", icon: "box" },
  { tab: "Images", icon: "image" },
  { tab: "Volumes", icon: "database" },
  { tab: "Networks", icon: "network" },
  { tab: "Kubernetes", icon: "cluster" },
  { tab: "Doctor", icon: "check" },
  { tab: "Profiles", icon: "sliders" },
];

type Props = {
  nav: Tab;
  onNav: (t: Tab) => void;
  profiles: Profile[];
  active: string | null;
  onSelect: (name: string) => void;
  onNewProfile: () => void;
  // Start or stop a profile from the switcher; the app switches to it first. Off while a VM operation runs.
  onVm: (name: string, op: "starting" | "stopping") => void;
  onRestart?: (name: string) => void;
  vmBusy: boolean;
  // the VM operation in flight, so the switcher says "Starting…" instead of the last known state
  vmOp?: { name: string; op: "starting" | "stopping" | "restarting" } | null;
  children: ReactNode;
  // a count shown next to a nav item, e.g. problems that need action
  badges?: Partial<Record<Tab, number>>;
  // nav items left out for now, e.g. Kubernetes while the active profile has it turned off
  hidden?: Tab[];
  // Opens the list of commands the app ran; not a page, so it isn't one of the tabs.
  onCommands?: () => void;
};

const FOLD_KEY = "colima-ui:sidebar-folded";
// Storage can be blocked; the sidebar then simply starts open.
const readFolded = () => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } };
const saveFolded = (v: boolean) => { try { localStorage.setItem(FOLD_KEY, v ? "1" : "0"); } catch { /* not remembered */ } };

export default function Shell({ nav, onNav, profiles, active, onSelect, onNewProfile, onVm, onRestart, vmBusy, vmOp, children, badges = {}, hidden = [], onCommands }: Props) {
  const current = profiles.find((p) => p.name === active);
  const [folded, setFolded] = useState(readFolded);
  const fold = () => setFolded((f) => { saveFolded(!f); return !f; });
  // While a start or stop runs, say so instead of the last state Colima reported.
  const shown = (p: Profile) => (vmOp?.name === p.name ? (vmOp.op === "starting" ? "Starting…" : vmOp.op === "restarting" ? "Restarting…" : "Stopping…") : p.status);
  return (
    <div className={folded ? "shell folded" : "shell"}>
      <div className="sidebar">
        <div className="brand">
          <Menu
            label="Switch profile"
            title={current ? `${current.name}, ${shown(current)}. Switch profile` : "Switch profile"}
            className="profile-switch"
            align="left"
            items={[
              ...profiles.map((p) => ({ label: p.name, hint: shown(p), checked: p.name === active, icon: <span className={p.status === "Running" ? "sdot on" : "sdot"} aria-hidden="true" />, onSelect: () => onSelect(p.name),
                side: p.status === "Running"
                  ? { label: "Stop VM", ariaLabel: `Stop the VM ${p.name}`, disabled: vmBusy, onSelect: () => onVm(p.name, "stopping") }
                  : { label: "Start VM", ariaLabel: `Start the VM ${p.name}`, disabled: vmBusy, onSelect: () => onVm(p.name, "starting") } })),
              // The VM's own Restart, which used to sit in the strip on the Containers screen.
              ...(current?.status === "Running" && onRestart ? [{ label: "Restart VM", ariaLabel: `Restart the VM ${current.name}`, icon: <Icon name="restart" size={13} />, divider: true, disabled: vmBusy, onSelect: () => onRestart(current.name) }] : []),
              { label: "New profile", icon: <Icon name="plus" size={13} />, divider: profiles.length > 0, onSelect: onNewProfile },
              { label: "Manage profiles", icon: <Icon name="sliders" size={13} />, onSelect: () => onNav("Profiles") },
            ]}
          >
            <span className="logo">
              <Icon name="box" size={18} />
              {current && <span className={current.status === "Running" ? "sdot on" : "sdot"} aria-hidden="true" />}
            </span>
            <span className="switch-text">
              <b>{current?.name ?? "No VM"}</b>
              {current && <span className="hint">{shown(current)}</span>}
            </span>
            <span className="switch-chev"><Icon name="chevron" size={13} /></span>
          </Menu>
          <button className="icon-btn fold-btn" aria-label={folded ? "Show the sidebar" : "Hide the sidebar"} title={folded ? "Show the sidebar" : "Hide the sidebar"} aria-expanded={!folded} onClick={fold}>
            <Icon name="sidebar" size={15} />
          </button>
        </div>
        <nav aria-label="Main">
          {NAV.filter(({ tab }) => !hidden.includes(tab)).map(({ tab, icon }) => (
            <button key={tab} className={`nav-item${tab === nav ? " active" : ""}${tab === BOTTOM ? " nav-bottom" : ""}`} aria-label={badges[tab] ? `${tab}, ${badges[tab]} problem${badges[tab] === 1 ? "" : "s"}` : tab} title={tab} aria-current={tab === nav ? "page" : undefined} onClick={() => onNav(tab)}>
              <Icon name={icon} />
              <span className="nav-label">{tab}</span>
              {!!badges[tab] && <span className="nav-badge" aria-hidden="true">{badges[tab]}</span>}
            </button>
          ))}
          {onCommands && (
            <button className="nav-item nav-tool" aria-label="Commands" title="Every docker command the app ran" onClick={onCommands}>
              <Icon name="terminal" />
              <span className="nav-label">Commands</span>
            </button>
          )}
        </nav>
      </div>
      <main className="content">{children}</main>
    </div>
  );
}
