// Evidence that a failure was the network, kept in memory: the app records the error of a failed image pull, and the
// Doctor reads it back for a while. Nothing is stored on disk, and a pull that failed for another reason (a wrong
// name, no login) never counts.
// A blocked or proxied network fails by timing out or refusing the connection; "not found" and "denied" do not.
const NETWORK = /i\/o timeout|timed out|timeout|connection refused|connection reset|no route to host|proxyconnect|TLS handshake/i;
export const looksLikeNetwork = (error: string) => NETWORK.test(error);

const WITHIN = 30 * 60_000;
let last: { error: string; at: number } | null = null;
// The Doctor re-reads when this changes, so a pull that just failed shows without waiting for its next poll.
const listeners = new Set<() => void>();
export const subscribePull = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const changed = () => listeners.forEach((l) => l());
export function notePullFailure(error: string, at = Date.now()) {
  last = looksLikeNetwork(error) ? { error, at } : null;
  changed();
}
// A pull that worked clears it: the network is fine now.
export const notePullOk = () => { last = null; changed(); };
export const recentPullFailure = (now = Date.now()): string | null => (last && now - last.at <= WITHIN ? last.error : null);
