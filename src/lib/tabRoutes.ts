import type { Tab } from "../Shell";
import type { Route } from "./routes.ts";

// Until the old pages are rebuilt, the app still thinks in Tab names. The page file decides what each route shows.
const PATH_OF: Record<Tab, string> = {
  Containers: "#/containers",
  Images: "#/images",
  Volumes: "#/volumes",
  Networks: "#/networks",
  Kubernetes: "#/kubernetes/pods",
  Doctor: "#/doctor",
  // Machines are in Settings (spec 7.8). Until WO-3.9 that route shows today's Profiles page.
  Profiles: "#/settings/machines",
};

export const pathOfTab = (tab: Tab): string => PATH_OF[tab];

export function tabOfRoute(route: Route): Tab {
  switch (route.page) {
    case "images": return "Images";
    case "volumes": return "Volumes";
    case "networks": return "Networks";
    case "kubernetes": return "Kubernetes";
    case "doctor": return "Doctor";
    case "settings": return "Profiles";
    // Projects and Setup have no page yet (iteration 5 and WO-3.10): they show Containers.
    default: return "Containers";
  }
}
