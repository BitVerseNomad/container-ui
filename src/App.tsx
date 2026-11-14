import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandToast } from "./Commands";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import { Icon } from "./ui/icons";
import Shell, { Tab } from "./Shell";
import EngineSwitcher from "./EngineSwitcher";
import { engineOfProfile, chooseEngine, busyOf, buttonLabel } from "./lib/engineModel";
import { ShortcutId, SHORTCUTS, activeShortcuts, showKeys, isTypingTarget } from "./lib/shortcuts";
import { MachineUsageProvider, Header } from "./Header";
import { useRoute, go } from "./lib/router";
import { tabOfRoute, pathOfTab } from "./lib/tabRoutes";
import Containers, { VmState } from "./Containers";
import Images from "./Images";
import Volumes from "./Volumes";
import Networks from "./Networks";
import Kubernetes from "./Kubernetes";
import Profiles from "./Profiles";
import InstallCard from "./InstallCard";
import { useSetup } from "./Setup";
import BringOver from "./BringOver";
import { bringOffered } from "./lib/setup";
import Doctor, { groups, useDoctor, useMuted } from "./Doctor";
import { owner, toApp, type Inspect } from "./lib/apps";
import { useFixRuns } from "./FixIt";
import { useEnv } from "./useEnv";
import { useComposeScan } from "./useComposeScan";
import { contextNames, kubernetesOn } from "./lib/kubeNav";
import { ranVm } from "./lib/activity";
import { useComposeRun } from "./ComposeProjects";
import { useLiveStats, setMachineProfile } from "./hooks/useLiveStats";
import { ResizeAnnouncer, ResizeProvider, RunVm, useHeld, useResize } from "./Resize";
import { bringBusy, useBringBusy } from "./bringBusy";
import { readDesktop, readDesktopOnFocus } from "./desktopOffer";
import { dockerLocked, setVmBusy } from "./dockerLock";
import { useHost } from "./useHostSize";
import { runtimeRegistry } from "./runtime";

import CommandPalette from "./CommandPalette";
import { useKeyboardShortcuts, KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import { ToastProvider } from "./ui/components/Toast";
import Activity from "./Activity";
import HelpModal from "./HelpModal";
import { score, rank, flat, type PaletteItem, type Section } from "./lib/paletteModel";
import { docker } from "./api";
import { useConfirm } from "./ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// The profile a VM operation runs on: start takes { opts: { name } }, the others { name }.
const opName = (vm: VmState) => { const a = vm.last?.args as { name?: string; opts?: { name?: string } } | undefined; return a?.opts?.name ?? a?.name; };

// Written out by hand: "its kubernetes" reads wrong.
const NOUN: Record<string, string> = { Images: "images", Volumes: "volumes", Networks: "networks", Kubernetes: "cluster" };

export default function App() {
  const { route } = useRoute();
  const tab: Tab = tabOfRoute(route);
  const setTab = useCallback((t: Tab) => go(pathOfTab(t)), []);
  const [appError, setAppError] = useState<string | null>(null);
  const [activeRuntimeId, setActiveRuntimeId] = useState<string | null>(null);

  useEffect(() => {
    const active = runtimeRegistry.getActive();
    if (active) setActiveRuntimeId(active.id);

    const onRuntimeChange = (e: CustomEvent) => {
      setActiveRuntimeId(e.detail.runtimeId);
      // Reload profiles and data for new runtime
      reloadProfiles();
    };
    window.addEventListener("runtime-changed", onRuntimeChange as EventListener);
    return () => window.removeEventListener("runtime-changed", onRuntimeChange as EventListener);
  }, []);
  useEffect(() => {
    const on = (e: Event) => setAppError((e as CustomEvent<string>).detail);
    window.addEventListener("app-error", on);
    return () => window.removeEventListener("app-error", on);
  }, []);
  const [active, setActive] = useState<string | null>(null);
  const [stored] = useState(() => { try { return localStorage.getItem("openpier:engine"); } catch { return null; } });
  const [engineOpen, setEngineOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pullOnOpen, setPullOnOpen] = useState(false);
  const [newProfileOnOpen, setNewProfileOnOpen] = useState(false);
  const confirm = useConfirm();
  const [vm, setVmState] = useState<VmState>({ op: null, failure: null });
  // Every change goes through here, so the lock store (dockerLock) always holds the same vm.op as the screen.
  const setVm = (next: VmState) => { setVmBusy(next.op !== null); setVmState(next); };
  const { env, recheck } = useEnv();
  const compose = useComposeScan();

  // Load profiles from active runtime adapter
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const reloadProfiles = useCallback(async () => {
    const adapter = runtimeRegistry.getActive() ?? (await runtimeRegistry.activateFirstAvailable());
    if (adapter) {
      try {
        const list = await adapter.listProfiles();
        setProfiles(list);
        setProfilesError(null);
      } catch (e) {
        setProfilesError(String(e));
        setProfiles([]);
      }
    }
  }, []);

  useEffect(() => {
    reloadProfiles();
    const interval = setInterval(reloadProfiles, 3000);
    return () => clearInterval(interval);
  }, [reloadProfiles, activeRuntimeId]);

  // Which profiles run Kubernetes. Without kubectl there is no way to ask, so the answer stays "not known".
  const kube = usePoll<string[]>(async () => (env?.kubectl ? contextNames(await invoke<string>("kubectl", { context: null, args: ["config", "get-contexts", "-o", "name"] })) : []), [env?.kubectl], 10000, !!env);
  // Profiles switched Kubernetes on this session; the tab shows up even if kubectl still has to be installed.
  const [kubeAsked, setKubeAsked] = useState<string[]>([]);

  const current = profiles.find((p) => p.name === active) ?? null;
  const kubeOn = !!current && (kubernetesOn(ctxFor(current.name), kube.data) === true || kubeAsked.includes(current.name));
  const engines = useMemo(() => profiles.map((p) => engineOfProfile(p, { busy: busyOf({ op: vm.op, name: opName(vm) }, p.name), kubernetes: p.name === active && kubeOn })), [profiles, vm, active, kubeOn]);

  useEffect(() => {
    if (!profiles.some((p) => p.name === active)) {
      setActive(chooseEngine(engines, stored)?.id ?? null);
    }
  }, [profiles, engines, stored, active]);

  useEffect(() => setDetailId(null), [active]);

  // A failure goes stale when the VM comes up some other way (for example from Profiles).
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const now = profiles.find((p) => p.name === active)?.status;
    if (prevStatus.current !== "Running" && now === "Running" && vm.op === null) setVm({ op: null, failure: null });
    prevStatus.current = now;
  }, [profiles, active]);

  const ctx = current?.status === "Running" ? ctxFor(current.name) : null;
  const { live, history, usage } = useLiveStats(ctx, current?.status === "Running");
  setMachineProfile(current ? { cpus: current.cpus, memory: current.memory, disk: current.disk } : null);
  // A container page from a VM that has stopped is gone; show the list when the VM comes back.
  useEffect(() => {
    if (!ctx) setDetailId(null);
  }, [ctx]);
  // The Kubernetes page goes away with its nav item once the active profile has no cluster.
  useEffect(() => {
    if (tab === "Kubernetes" && !kubeOn && (kube.data !== null || !current)) setTab("Containers");
  }, [tab, kubeOn, kube.data, current]);
  const setup = useSetup(current);
  const doc = useDoctor(ctx, current);
  const [logOpen, setLogOpen] = useState(false);
  const mutedKeys = useMuted();
  // Held while the VM restarts for a new size, so the badge doesn't drop and come back.
  const doctorTodo = useHeld(groups(setup.findings ?? [], doc.report, mutedKeys).todo);
  const containerCount = doc.containers?.filter((c) => owner(toApp(c as Inspect)) !== "kubernetes").length;
  // One Bring over panel, opened from Doctor's row, home's empty state, home's problem line or the New menu, so a copy
  // started in one is seen in all. It is pinned to the VM it opened on: every follow-up (Start in Colima, Try again)
  // runs there. Switching profile closes it, unless a copy is running; then it stays, saying which VM it is for.
  // returnTo: a selector for where focus goes if the opener is gone when the panel closes (a home row's name).
  const [bringing, setBringing] = useState<{ ctx: string; name: string; only?: string[]; returnTo?: string } | null>(null);
  const openBring = (only?: string[], returnTo?: string) => setBringing({ ctx: ctx ?? "", name: current?.name ?? "default", only, returnTo });
  const copied = useRef(false);
  const [bringSaid, setBringSaid] = useState("");
  const hasDesktopData = !!setup.findings?.some((f) => f.id === "desktop_data");
  // Read once when home opens (and for a new VM); after a copy the panel's onDone reads it again.
  useEffect(() => { if (hasDesktopData) void readDesktop(ctx); }, [ctx, hasDesktopData]);
  // Docker Desktop opened after the app, or a volume filled: looked at again on focus (rarely; see desktopRead).
  useEffect(() => {
    if (!hasDesktopData) return;
    const on = () => void readDesktopOnFocus(ctx);
    window.addEventListener("focus", on);
    return () => window.removeEventListener("focus", on);
  }, [ctx, hasDesktopData]);
  // Keyed on the profile, not its context: the panel's own "Restart the VM" makes the context go away for a while.
  useEffect(() => {
    if (bringing && current && bringing.name !== current.name && !bringBusy()) setBringing(null);
  }, [current?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeBring = () => {
    const returnTo = bringing?.returnTo;
    setBringing(null);
    // Said once, here, after the panel's own result was read with its Done button.
    if (copied.current) { setBringSaid(""); setTimeout(() => setBringSaid("Volumes are in the VM now."), 50); }
    copied.current = false;
    // After a copy the button that opened it may be gone (the offer ends), so focus would drop to the page.
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const doctorCheck = [...document.querySelectorAll<HTMLElement>(".doctor-head button")].find((b) => /Run checks again/.test(b.textContent ?? ""));
      const heading = document.querySelector<HTMLElement>("main h1");
      heading?.setAttribute("tabindex", "-1");
      const row = returnTo ? document.querySelector<HTMLElement>(returnTo) : null;
      (document.querySelector<HTMLElement>(".blank button.primary") ?? doctorCheck ?? row ?? heading)?.focus();
    });
  };

  const toolsMissing = !!env && (!env.colima || !env.docker);

  // Starts or stops a VM from any tab (Empty states, the sidebar switcher). It switches to that profile and
  // shows the progress on Containers, where the VM strip lives.
  // A Fix renames and recreates containers, a Compose run or a Bring over copy talks to Docker inside the VM, and a
  // resize holds Docker until its containers run again: stopping the VM under any of them leaves things half done.
  // These subscribe App to each; dockerLocked is the one rule that combines them.
  useFixRuns();
  useComposeRun();
  useResize();
  useBringBusy();
  const vmLocked = dockerLocked();
  async function vmFromAnywhere(name: string, op: "starting" | "stopping", restart = false) {
    if (dockerLocked()) return;
    setActive(name);
    setDetailId(null);
    setTab("Containers");
    const last = restart ? { op, cmd: "restart_profile", args: { name } } : op === "starting" ? { op, cmd: "start_profile", args: { opts: { name } } } : { op, cmd: "stop_profile", args: { name } };
    setVm({ op, failure: null, last });
    try {
      await ranVm(last.cmd, last.args, () => invoke(last.cmd, last.args));
      setVm({ op: null, failure: null, last });
    } catch (e) {
      setVm({ op: null, failure: String(e), last });
    }
    reloadProfiles();
  }
  // The VM size fix's runner (src/Resize.tsx): the same VM state as every other VM button, so the sidebar, the VM
  // strip and container actions lock and show it, wherever the user goes meanwhile. Its failure is shown where it
  // was started, with a smaller size to try, so it isn't also a start-failure card here.
  const runVm: RunVm = async (op, cmd, args) => {
    const last = { op, cmd, args };
    setVm({ op, failure: null, last });
    try {
      await ranVm(cmd, args, () => invoke(cmd, args), true);
      return null;
    } catch (e) {
      return String(e);
    } finally {
      // Read the VM's new status before letting go of the lock, so no screen flashes "stopped" in between.
      await reloadProfiles().catch(() => {});
      setVm({ op: null, failure: null, last });
    }
  };
  const { host, pick } = useHost();
  const startFromAnywhere = () => (current ? vmFromAnywhere(current.name, "starting") : setTab("Containers"));
  // A failure card belongs to the profile it happened on; switching away clears it (unless an operation is still running).
  const switchTo = (name: string) => {
    if (name !== active && vm.op === null) setVm({ op: null, failure: null });
    setActive(name);
    try { localStorage.setItem("openpier:engine", name); } catch { /* not remembered */ }
  };

  const page =
    tab === "Containers" ? (
      env && toolsMissing ? (
        <InstallCard env={env} onDone={recheck} />
      ) : (
        <Containers
          key={ctx ?? "none"}
          profile={current}
          ctx={ctx}
          live={live}
          history={history}
          vm={vm}
          onVm={setVm}
          reload={reloadProfiles}
          detailId={detailId}
          setDetailId={setDetailId}
          onPull={() => { setPullOnOpen(true); setTab("Images"); }}
          onProfiles={() => { setNewProfileOnOpen(true); setTab("Profiles"); }}
          compose={compose}
          onImages={() => setTab("Images")}
          onKubernetes={kubeOn ? () => setTab("Kubernetes") : undefined}
          report={doc.report}
          onReport={doc.reload}
          onBring={bringOffered(setup.findings) ? openBring : undefined}
          inspected={doc.containers}
        />
      )
    ) : tab === "Doctor" ? (
      // Until the tool check answers, an empty Doctor could read as an all-clear on a Mac with nothing installed.
      !env ? null : toolsMissing ? (
        <div className="blank">
          <span className="blank-icon"><Icon name="download" size={28} /></span>
          <h2>Install a container runtime and Docker first</h2>
          <p className="hint">The checks need both.</p>
          <span className="actions-inline"><button className="primary" onClick={() => setTab("Containers")}>Install them</button></span>
        </div>
      ) : (
        <Doctor ctx={ctx} composePaths={compose.paths ?? []} setup={setup} doc={doc} onProfiles={() => setTab("Profiles")} onBring={(only) => openBring(only)} onGo={(page) => setTab(page)} onOpen={(name) => { setDetailId(name); setTab("Containers"); }} />
      )
    ) : tab === "Profiles" ? (
      <Profiles
        profiles={profiles}
        reload={() => { reloadProfiles(); kube.reload(); }}
        openNew={newProfileOnOpen}
        kubeOn={(name) => (kubeAsked.includes(name) ? true : kubernetesOn(ctxFor(name), kube.data))}
        onKubeAsked={(name) => setKubeAsked((l) => (l.includes(name) ? l : [...l, name]))}
      />
    ) : !ctx ? (
      toolsMissing ? (
        <Empty title="No container runtime yet" action={<button className="primary" onClick={() => setTab("Containers")}>Install one</button>}>
          OpenPier installs Colima, OrbStack, Rancher Desktop, Podman Desktop, or Docker Desktop with one click.
        </Empty>
      ) : current ? (
        <Empty title={`${current.name} is stopped`} action={<button className="primary" disabled={vm.op !== null} onClick={startFromAnywhere}>{`Start ${current.name}`}</button>}>
          Start the VM to see its {NOUN[tab] ?? "contents"}.
        </Empty>
      ) : (
        <Empty title="No VM yet" action={<button className="primary" onClick={() => setTab("Containers")}>Create your first VM</button>}>
          OpenPier creates a small Linux VM for you.
        </Empty>
      )
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

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const focusPageSearch = () => document.querySelector<HTMLInputElement>("[data-page-search]")?.focus();

  const handlers: Partial<Record<ShortcutId, () => void>> = {
    palette: () => setCommandPaletteOpen(true),
    "go-containers": () => setTab("Containers"),
    "go-images": () => setTab("Images"),
    "go-volumes": () => setTab("Volumes"),
    "go-networks": () => setTab("Networks"),
    "go-kubernetes": () => { if (kubeOn) setTab("Kubernetes"); },
    "go-doctor": () => setTab("Doctor"),
    "go-settings": () => go("#/settings/general"),
    engine: () => setEngineOpen(true),
    fold: () => window.dispatchEvent(new Event("openpier:fold")),
    run: () => { setTab("Images"); },
    pull: () => { setPullOnOpen(true); setTab("Images"); },
    search: focusPageSearch,
    "search-slash": focusPageSearch,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.dispatchEvent(new Event("openpier:refresh")),
    help: () => setHelpOpen(true),
  };
  const keyboardShortcuts = useMemo(
    () => activeShortcuts().filter((s) => handlers[s.id]).map((s) => ({ key: s.key, meta: s.meta, shift: s.shift, description: s.label, action: handlers[s.id]! })),
    [kubeOn, setTab, setCommandPaletteOpen, setLogOpen, setPullOnOpen, setNewProfileOnOpen, setHelpOpen],
  );

  useKeyboardShortcuts(keyboardShortcuts);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hasLayer = !!document.querySelector("[role=dialog], [role=alertdialog], [role=menu]");
      if (!hasLayer) window.dispatchEvent(new Event("openpier:escape"));
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const [paletteItems, setPaletteItems] = useState<PaletteItem[]>([]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const build = async () => {
      if (!ctx) { setPaletteItems([]); return; }
      const containers: PaletteItem[] = [];
      try {
        const list = await dockerJson<{ ID: string; Names: string; Image: string; State: string }>(ctx, ["ps", "-a"]);
        for (const c of list) {
          const name = (c.Names ?? "").replace(/^\//, "");
          const dot: PaletteItem["dot"] = c.State === "running" ? "ok" : c.State === "restarting" ? "warn" : "off";
          containers.push({ id: c.ID, group: "Containers", label: name, hint: c.Image, dot, kbd: undefined, run: () => go(`#/containers/${c.ID}/logs`) });
          containers.push({ id: `logs-${c.ID}`, group: "Actions", label: `Logs of ${name}`, run: () => go(`#/containers/${c.ID}/logs`) });
          if (c.State === "running") {
            containers.push({ id: `restart-${c.ID}`, group: "Actions", label: `Restart ${name}`, run: () => { void docker(ctx, ["restart", c.ID]); void window.dispatchEvent(new Event("openpier:refresh")); } });
            containers.push({ id: `stop-${c.ID}`, group: "Actions", label: `Stop ${name}`, run: () => { void docker(ctx, ["stop", c.ID]); void window.dispatchEvent(new Event("openpier:refresh")); } });
          } else {
            containers.push({ id: `start-${c.ID}`, group: "Actions", label: `Start ${name}`, run: () => { void docker(ctx, ["start", c.ID]); void window.dispatchEvent(new Event("openpier:refresh")); } });
          }
          containers.push({ id: `remove-${c.ID}`, group: "Actions", label: `Remove ${name}…`, run: async () => {
            const ok = await confirm(`Remove ${name}?`, "Remove");
            if (ok) { void docker(ctx, ["rm", "-f", c.ID]); void window.dispatchEvent(new Event("openpier:refresh")); }
          } });
        }
      } catch { /* group stays empty */ }
      const general: PaletteItem[] = [
        { id: "run", group: "Actions", label: "Run an image", kbd: "⌘N", run: () => { setTab("Images"); } },
        { id: "pull", group: "Actions", label: "Pull an image", kbd: "⌘P", run: () => { setPullOnOpen(true); setTab("Images"); } },
        { id: "compose", group: "Actions", label: "Start a Compose project", run: () => { setTab("Containers"); } },
        { id: "doctor", group: "Actions", label: "Run Doctor", kbd: "⌘D", run: () => { setTab("Doctor"); } },
        { id: `engine-${active}`, group: "Actions", label: active ? `Stop ${active}` : `Start ${active ?? "engine"}`, run: () => { setTab("Containers"); } },
        { id: "machines", group: "Actions", label: "Machines…", run: () => { go("#/settings/machines"); } },
      ];
      const goTo: PaletteItem[] = [
        { id: "go-containers", group: "Go to", label: "Containers", kbd: showKeys({ key: "2", meta: true }), run: () => setTab("Containers") },
        { id: "go-images", group: "Go to", label: "Images", kbd: showKeys({ key: "3", meta: true }), run: () => setTab("Images") },
        { id: "go-volumes", group: "Go to", label: "Volumes", kbd: showKeys({ key: "4", meta: true }), run: () => setTab("Volumes") },
        { id: "go-networks", group: "Go to", label: "Networks", kbd: showKeys({ key: "5", meta: true }), run: () => setTab("Networks") },
      ];
      if (kubeOn) goTo.push({ id: "go-kubernetes", group: "Go to", label: "Kubernetes", kbd: showKeys({ key: "6", meta: true }), run: () => setTab("Kubernetes") });
      goTo.push({ id: "go-doctor", group: "Go to", label: "Doctor", kbd: showKeys({ key: "d", meta: true }), run: () => setTab("Doctor") });
      goTo.push({ id: "go-settings", group: "Go to", label: "Settings", kbd: showKeys({ key: ",", meta: true }), run: () => go("#/settings/general") });
      setPaletteItems([...containers, ...general, ...goTo]);
    };
    void build();
  }, [commandPaletteOpen, ctx, kubeOn, active]);

  return (
    <QueryClientProvider client={queryClient}>
      <ResizeProvider value={{ profile: current, host, pick, runVm, containers: doc.containers, locked: vmLocked, vmBusy: vm.op !== null, onProfiles: () => setTab("Profiles") }}>
        <ToastProvider position="top-right">
          <Shell
            nav={tab}
            onNav={(t) => setTab(t)}
            badges={{ Doctor: doctorTodo }}
            counts={{ containers: containerCount }}
            hidden={kubeOn ? [] : ["Kubernetes"]}
            engine={<div data-slot="engine"><EngineSwitcher engines={engines} selectedId={active} open={engineOpen} onOpenChange={setEngineOpen} onSelect={switchTo} onStart={(id) => { switchTo(id); setTab("Containers"); void vmFromAnywhere(id, "starting"); }} onStop={(id) => void vmFromAnywhere(id, "stopping")} onMachines={() => go("#/settings/machines")} /></div>}
            onSettings={() => go("#/settings/general")}
            settingsActive={tab === "Profiles"}
            onActivity={() => setLogOpen(true)}
            onHelp={() => setHelpOpen(true)}
          >
            <Banner error={profilesError} />
            <Banner error={appError} onClose={() => setAppError(null)} />
            <MachineUsageProvider value={usage}>
              {tab !== "Containers" ? (
                <Header title={tab === "Profiles" ? "Settings" : tab} />
              ) : null}
              {page}
            </MachineUsageProvider>
            <CommandToast onOpenLog={() => setLogOpen(true)} />
            <ResizeAnnouncer />
            {logOpen && <Activity open={logOpen} onClose={() => setLogOpen(false)} />}
            <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} items={paletteItems} />
            <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
            <div className="sr-only" data-app-announcer role="status" aria-live="polite">{bringSaid}</div>
            {bringing && (
              <BringOver
                ctx={bringing.ctx}
                only={bringing.only}
                forVm={current && bringing.name !== current.name ? bringing.name : undefined}
                onClose={closeBring}
                onDone={(ok) => { if (ok) copied.current = true; void Promise.all([setup.reload(), doc.reload(), readDesktop(bringing.ctx)]); }}
                onProfiles={() => { setBringing(null); setTab("Profiles"); }}
              />
            )}
          </Shell>
        </ToastProvider>
      </ResizeProvider>
    </QueryClientProvider>
  );
}
