import { useSyncExternalStore } from "react";
import { DEFAULT_PATH, Route, buildPath, parseRoute } from "./routes.ts";

export { buildPath, parseRoute } from "./routes.ts";
export type { Page, Route } from "./routes.ts";

const LAST_ROUTE_KEY = "openpier:last-route";

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const snapshot = () => window.location.hash;

// Go to a path like "#/images". Setting location.hash keeps the query string (?scenario=design).
export function go(path: string) {
  window.location.hash = path;
}

// Same, without a new history entry (used to fix an unknown address).
export function replace(path: string) {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}${path}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function rememberRoute(route: Route) {
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, buildPath(route));
  } catch {
    // Storage can be blocked; the app works without it.
  }
}

function lastRoutePath(): string {
  try {
    const saved = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (saved && parseRoute(saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_PATH;
}

export type RouteState = { route: Route };

// The current route. An empty or unknown address is replaced by the last route you had, else Containers.
// The gallery (#/dev/gallery) never gets here: src/main.tsx renders it instead of <App/>.
export function useRoute(): RouteState {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const route = parseRoute(hash);
  if (route) rememberRoute(route);
  else queueMicrotask(() => replace(lastRoutePath()));
  return { route: route ?? { page: "containers" } };
}
