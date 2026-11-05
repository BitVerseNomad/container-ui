// Polls cost a docker or colima process each. While the window sits behind others, nobody is looking,
// so a poll runs at most every BACKGROUND_MS; focusing the window refreshes at once.
export const BACKGROUND_MS = 30_000;

export function shouldTick(s: { hidden: boolean; focused: boolean; inFlight: boolean; sinceLast: number }): boolean {
  if (s.hidden || s.inFlight) return false;
  return s.focused || s.sinceLast >= BACKGROUND_MS;
}

// Tells whether a request is still running. Each load takes a ticket; only the newest ticket's end frees it,
// so an old load that finishes late cannot hide a newer one that is still running.
export function flightTracker() {
  let newest = 0;
  let live = false;
  return {
    begin(): number {
      live = true;
      return ++newest;
    },
    end(ticket: number): void {
      if (ticket === newest) live = false;
    },
    busy: () => live,
  };
}
