import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type Tool = { path: string; version: string };
export type EnvReport = { brew: Tool | null; colima: Tool | null; docker: Tool | null; kubectl?: Tool | null; k9s?: Tool | null };

// If the backend can't answer (an older build), assume everything is installed rather than block the app.
const ASSUME_OK: EnvReport = { brew: { path: "", version: "" }, colima: { path: "", version: "" }, docker: { path: "", version: "" }, kubectl: { path: "", version: "" }, k9s: { path: "", version: "" } };

export function useEnv() {
  const [env, setEnv] = useState<EnvReport | null>(null);
  const recheck = useCallback(async () => {
    try {
      setEnv(await invoke<EnvReport>("env_check"));
    } catch {
      setEnv(ASSUME_OK);
    }
  }, []);
  useEffect(() => {
    recheck();
  }, [recheck]);
  return { env, recheck };
}
