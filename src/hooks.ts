import { useCallback, useEffect, useRef, useState } from "react";
import { latest } from "./lib/latest";

// `enabled` lets a panel load only while it is visible, without resetting its data when it opens.
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], ms = 3000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A slow older answer must never overwrite a newer one (for example right after the inputs changed).
  const run = useRef(latest());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const r = await run.current(load);
    if (!r.current) return;
    if (r.ok) {
      setData(r.value as T);
      setError(null);
    } else {
      setError(String(r.error));
    }
  }, deps);
  useEffect(() => {
    if (!enabled) return;
    setData(null);
    reload();
    const tick = () => {
      if (!document.hidden) reload();
    };
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reload, ms, enabled]);
  return { data, error, reload };
}
