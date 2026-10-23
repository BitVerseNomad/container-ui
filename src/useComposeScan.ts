import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Runs the Spotlight search for Compose files once when the app opens; Scan again repeats it.
export function useComposeScan() {
  const [paths, setPaths] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = useCallback(async () => {
    setScanning(true);
    try {
      setPaths(await invoke<string[]>("find_compose_files"));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);
  useEffect(() => void scan(), [scan]);
  return { paths, scanning, error, scan };
}
export type ComposeScan = ReturnType<typeof useComposeScan>;
