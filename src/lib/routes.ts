// Routes of the app. Pure functions only: no React, no window. The hook is in router.ts.
export type Page = "containers" | "images" | "volumes" | "networks" | "registries" | "kubernetes" | "doctor" | "projects" | "settings" | "setup";

export type Route = { page: Page; id?: string; tab?: string };

// Pages with an item in the path ("#/containers/<id>/<tab>") and the tabs of each page.
export const DETAIL_TABS = {
  containers: ["logs", "stats", "settings", "folders", "network", "history"],
  images: ["overview", "layers", "files", "settings"],
  projects: ["services", "logs", "ports", "settings"],
} as const;

// Pages whose first path segment is the tab ("#/settings/engines").
export const PAGE_TABS = {
  kubernetes: ["pods", "deployments", "services", "events"],
  settings: ["general", "machines", "engines", "registries", "updates", "about"],
} as const;

const PLAIN: Page[] = ["volumes", "networks", "registries", "doctor", "setup"];

export const DEFAULT_PATH = "#/containers";

// "#/containers/abc/stats" -> { page: "containers", id: "abc", tab: "stats" }. Unknown paths give null.
export function parseRoute(hash: string): Route | null {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = segments[0] as Page | undefined;
  if (!page) return null;
  const rest = segments.slice(1);
  if (PLAIN.includes(page)) return rest.length === 0 ? { page } : null;
  if (page in PAGE_TABS) {
    const tabs = PAGE_TABS[page as keyof typeof PAGE_TABS] as readonly string[];
    if (rest.length > 1) return null;
    if (rest.length === 0) return { page, tab: tabs[0] };
    return tabs.includes(rest[0]) ? { page, tab: rest[0] } : null;
  }
  if (page in DETAIL_TABS) {
    const tabs = DETAIL_TABS[page as keyof typeof DETAIL_TABS] as readonly string[];
    if (rest.length === 0) return { page };
    if (rest.length > 2) return null;
    const id = decodeURIComponent(rest[0]);
    if (rest.length === 1) return { page, id, tab: tabs[0] };
    return tabs.includes(rest[1]) ? { page, id, tab: rest[1] } : null;
  }
  return null;
}

// The reverse of parseRoute. An id is encoded, because image names contain ":" and "/".
export function buildPath(route: Route): string {
  const parts: string[] = [route.page];
  if (route.id !== undefined) parts.push(encodeURIComponent(route.id));
  if (route.tab !== undefined) parts.push(route.tab);
  return `#/${parts.join("/")}`;
}
