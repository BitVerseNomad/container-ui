import { useCallback, useEffect, useRef, useState } from "react";
import { latest } from "./lib/latest";
import { flightTracker, shouldTick } from "./lib/pollPace";

// `enabled` lets a panel load only while it is visible, without resetting its data when it opens.
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], ms = 3000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A slow older answer must never overwrite a newer one (for example right after the inputs changed).
  const run = useRef(latest());
  // A hung docker socket (common after sleep) must not stack up one new process per tick.
  const flight = useRef(flightTracker());
  const lastRun = useRef(0);
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
    // An error from the old inputs (for example the previous profile) must not stay on screen.
    setError(null);
    // The first load counts as in flight, so the first timer tick does not start a second request.
    const first = flight.current.begin();
    reload().finally(() => flight.current.end(first));
    lastRun.current = Date.now();
    const tick = () => {
      const now = Date.now();
      if (!shouldTick({ hidden: document.hidden, focused: document.hasFocus(), inFlight: flight.current.busy(), sinceLast: now - lastRun.current })) return;
      const mine = flight.current.begin();
      lastRun.current = now;
      reload().finally(() => flight.current.end(mine));
    };
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [reload, ms, enabled]);
  return { data, error, reload };
}
