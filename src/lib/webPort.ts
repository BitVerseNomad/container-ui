// Which published ports are worth opening in a browser. A guess from the port number, so it errs on the side
// of not linking: a wrong link opens an error page, a missing one is a copy chip away.
// The port inside the container is the main signal (the host port is often arbitrary); the host port only
// decides when the container port says nothing.
const NOT_WEB = new Set([
  21, 22, 23, 25, 53, 110, 143, 389, 445, 465, 587, 636, 993, 995, 1433, 1521, 1883, 2181, 2376, 3306, 3307, 3389,
  4222, 4369, 5432, 5433, 5672, 5900, 6379, 6380, 7687, 8009, 8883, 9042, 9092, 9300, 11211, 27017, 27018,
]);
const WEB_RANGES: [number, number][] = [[3000, 3999], [8000, 8999]];
const WEB_PORTS = new Set([80, 81, 443, 591, 4000, 4200, 4321, 4443, 5000, 5001, 5173, 5174, 5601, 6006, 7474, 9000, 9001, 9090, 9091, 9093, 9200, 9443, 15672, 19006]);

// true = web, false = not web, null = no opinion
function verdict(port: number | null): boolean | null {
  if (port === null || !Number.isInteger(port) || port <= 0) return null;
  if (NOT_WEB.has(port)) return false;
  if (WEB_PORTS.has(port) || WEB_RANGES.some(([lo, hi]) => port >= lo && port <= hi)) return true;
  return null;
}

export function isWebPort(containerPort: number | null, hostPort: number): boolean {
  return verdict(containerPort) ?? verdict(hostPort) ?? false;
}
