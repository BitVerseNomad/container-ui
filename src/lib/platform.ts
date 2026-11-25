// Which OS the app runs on, asked once from the backend. Colima, Homebrew, Terminal.app and Finder only exist on a Mac;
// on Windows the engine is the docker inside WSL2, always running.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type Platform = { os: "macos" | "windows" | "linux"; wsl: boolean; distro?: string | null };
const MAC: Platform = { os: "macos", wsl: false };

// The one engine on Windows. Its name is what the engine button shows.
export const WSL_ENGINE = "Docker (WSL)";

let asked: Promise<Platform> | null = null;
const ask = () => (asked ??= invoke<Platform>("platform_info").then((p) => p ?? MAC, () => MAC));

// macOS until the backend answers; `known` says whether it has.
export function usePlatform(): Platform & { known: boolean } {
  const [p, setP] = useState<Platform | null>(null);
  useEffect(() => { let on = true; void ask().then((v) => on && setP(v)); return () => { on = false; }; }, []);
  return { ...(p ?? MAC), known: p !== null };
}
