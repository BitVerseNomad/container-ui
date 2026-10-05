import { useCallback, useEffect, useState } from "react";

export function usePoll<T>(load: () => Promise<T>, deps: unknown[], ms = 3000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, deps);
  useEffect(() => {
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
  }, [reload, ms]);
  return { data, error, reload };
}
