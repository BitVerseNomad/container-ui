import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Host, firstVmSize } from "./lib/vmSize";

// The Mac's cores and memory, and the VM size it should start with; null until the backend answers.
export function useHost() {
  const [host, setHost] = useState<Host | null>(null);
  useEffect(() => {
    invoke<Host>("host_resources").then(setHost).catch(() => setHost(null));
  }, []);
  return { host, pick: host ? firstVmSize(host) : null };
}

// The VM size this Mac should start with; null until the backend answers.
export const useHostSize = () => useHost().pick;
