// When one fix replaces this problem's containers and more (Kafka UI's fix also replaces its broker), the bigger
// fix wins, so a pair of problems gets one button. Undefined when this problem's own fix is the one to use.
type Steps = { steps?: { name: string }[] } | undefined;

export function biggerFix<F extends Steps>(own: F, all: F[]): F | undefined {
  const mine = own?.steps;
  if (!mine) return undefined;
  return all
    .filter((f) => (f?.steps?.length ?? 0) > mine.length && mine.every((s) => f!.steps!.some((x) => x.name === s.name)))
    .sort((a, b) => b!.steps!.length - a!.steps!.length)[0];
}
