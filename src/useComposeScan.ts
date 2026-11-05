import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Folders you added by hand, because Spotlight skips some (not indexed, or just created). Kept on this Mac only.
const ADDED = "colima-ui:compose-folders";
const readAdded = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(ADDED) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const saveAdded = (dirs: string[]) => {
  try {
    localStorage.setItem(ADDED, JSON.stringify(dirs));
  } catch {
    // the list still works for this session
  }
};

// Only these mean the folder itself is gone or no longer qualifies; any other error (Docker, the app) keeps it.
const GONE = /No compose\.yaml|Choose a folder inside|dependency folder/;

// Runs the Spotlight search for Compose files once when the app opens; Scan again repeats it. Added folders are
// checked again on every scan, so one that was moved or emptied drops out.
export function useComposeScan() {
  const [paths, setPaths] = useState<string[] | null>(null);
  // Files from added folders, listed before the 300-file cut so an added project always shows.
  const [pinned, setPinned] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const found = await invoke<string[]>("find_compose_files");
      const gone = new Set<string>();
      const extra: string[] = [];
      for (const dir of readAdded()) {
        try {
          extra.push(...(await invoke<string[]>("compose_in_folder", { dir })));
        } catch (e) {
          if (GONE.test(String(e))) gone.add(dir);
        }
      }
      // Read again: a folder added while this scan was waiting must not be lost.
      saveAdded(readAdded().filter((d) => !gone.has(d)));
      setPinned((p) => [...new Set([...extra, ...p.filter((f) => !gone.has(f.slice(0, f.lastIndexOf("/"))))])]);
      setPaths((p) => [...new Set([...found, ...extra, ...(p ?? []).filter((f) => readAdded().includes(f.slice(0, f.lastIndexOf("/"))))])].sort());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);
  // Returns the project folder added, or null when the chooser was cancelled. Throws why a folder can't be added.
  const add = useCallback(async () => {
    const dir = await invoke<string | null>("pick_folder", { purpose: "compose" });
    if (!dir) return null;
    const files = await invoke<string[]>("compose_in_folder", { dir });
    const clean = dir.replace(/\/+$/, "");
    saveAdded([...new Set([...readAdded(), clean])]);
    setPaths((p) => [...new Set([...(p ?? []), ...files])].sort());
    setPinned((p) => [...new Set([...files, ...p])]);
    return clean;
  }, []);
  useEffect(() => void scan(), [scan]);
  return { paths, pinned, scanning, error, scan, add };
}
export type ComposeScan = ReturnType<typeof useComposeScan>;
