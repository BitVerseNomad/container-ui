import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Host, firstVmSize } from "./lib/vmSize";

// The VM size this Mac should start with; null until the backend answers.
export function useHostSize() {
  const [size, setSize] = useState<{ cpus: number; memory: number } | null>(null);
  useEffect(() => {
    invoke<Host>("host_resources").then((h) => setSize(firstVmSize(h))).catch(() => setSize(null));
  }, []);
  return size;
}
