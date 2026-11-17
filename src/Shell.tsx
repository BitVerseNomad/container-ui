import React, { ReactNode, useState, useEffect, useMemo, useCallback } from "react";
import { Profile, openUrl } from "./api";
import { Icon, IconName } from "./ui/op";
import { Menu, MenuItem, MenuSeparator, MenuCaption, MoreButton } from "./ui/op";
import { NavItem, Button, Dot } from "./ui/op";
import { PortalProvider, ToastProvider } from "./ui/op";
import { ConfirmProvider as OpConfirmProvider } from "./ui/op";

const FOLD_KEY = "openpier:sidebar-folded";
const readFolded = () => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } };
const saveFolded = (v: boolean) => { try { localStorage.setItem(FOLD_KEY, v ? "1" : "0"); } catch { /* not remembered */ } };

export type Tab = "Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles" | "Doctor";

const BOTTOM: Tab = "Doctor";
const PATH_OF: Record<Tab, string> = {
  Containers: "#/containers",
  Images: "#/images",
  Volumes: "#/volumes",
  Networks: "#/networks",
  Kubernetes: "#/kubernetes/pods",
  Doctor: "#/doctor",
  Profiles: "#/settings/machines",
};

type ShellProps = {
  nav: Tab;
  onNav: (t: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
  counts?: { containers?: number };
  hidden?: Tab[];
  engine: React.ReactNode;
  onSettings: () => void;
  settingsActive: boolean;
  onActivity: () => void;
  onHelp: () => void;
  children: React.ReactNode;
};

export default function Shell({ nav, onNav, badges = {}, hidden = [], counts = {}, engine, onSettings, settingsActive, onActivity, onHelp, children }: ShellProps) {
  const [folded, setFolded] = useState(readFolded);
  const fold = () => setFolded((f) => { saveFolded(!f); return !f; });
  useEffect(() => {
    const onFold = () => fold();
    window.addEventListener("openpier:fold", onFold);
    return () => window.removeEventListener("openpier:fold", onFold);
  }, [fold]);
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);

  const handleNavClick = useCallback(
    (event: React.MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a.nav-item");
      if (!anchor) return;
      event.preventDefault();
      const tab = Object.entries(PATH_OF).find(([, path]) => anchor.getAttribute("href") === path)?.[0] as Tab | undefined;
      if (tab) onNav(tab);
    },
    [onNav],
  );

  const navItems = useMemo(() => {
    const main: { tab: Tab; label: string; icon: IconName }[] = [
      { tab: "Containers", label: "Containers", icon: "box" },
      { tab: "Images", label: "Images", icon: "image" },
      { tab: "Volumes", label: "Volumes", icon: "database" },
      { tab: "Networks", label: "Networks", icon: "network" },
      { tab: "Kubernetes", label: "Kubernetes", icon: "cluster" },
    ];
    const health: { tab: Tab; label: string; icon: IconName }[] = [
      { tab: "Doctor", label: "Doctor", icon: "doctor" },
    ];
    return { main, health };
  }, []);

  return (
    <div className={`app ${folded ? "folded" : ""}`}>
      <aside className="sidebar">
        <div className="titlebar" data-tauri-drag-region />
        <div>{engine}</div>
        <nav className="nav" aria-label="Main" onClick={handleNavClick}>
          {navItems.main.map(({ tab, label, icon }) => {
            if (tab === "Kubernetes" && hidden.includes(tab)) return null;
            const count = (tab === "Containers" ? counts.containers : badges[tab]) || undefined;
            return (
              <NavItem
                key={tab}
                href={PATH_OF[tab]}
                icon={icon}
                label={label}
                current={nav === tab}
                count={count}
                countBad={tab === "Doctor" && !!badges[tab]}
                countLabel={count !== undefined ? `${count} need action` : undefined}
              />
            );
          })}
        </nav>
        <div className="flex-1" />
        <nav className="nav" aria-label="Health" onClick={handleNavClick}>
          {navItems.health.map(({ tab, label, icon }) => (
            <NavItem
              key={tab}
              href={PATH_OF[tab]}
              icon={icon}
              label={label}
              current={nav === tab}
              count={badges[tab] || undefined}
              countBad={!!badges[tab]}
              countLabel={`${badges[tab] ?? 0} need action`}
            />
          ))}
        </nav>
        <div className="sidebar-foot">
          <Button variant="ghost" iconOnly icon="settings" aria-label="Settings" aria-current={settingsActive ? "page" : undefined} onClick={onSettings} />
          <Button variant="ghost" iconOnly icon="activity" aria-label="Activity: commands the app ran" onClick={onActivity} />
          <Button variant="ghost" iconOnly icon="help" aria-label="Help and shortcuts" onClick={onHelp} />
          <span className="grow" />
          <Button variant="ghost" iconOnly icon="sidebar" aria-label={folded ? "Show the sidebar" : "Fold sidebar"} onClick={fold} />
        </div>
      </aside>
      <main className="main content" ref={setMainEl}>
        <PortalProvider container={mainEl}>
          <ToastProvider>
            <OpConfirmProvider>{children}</OpConfirmProvider>
          </ToastProvider>
        </PortalProvider>
      </main>
    </div>
  );
}
