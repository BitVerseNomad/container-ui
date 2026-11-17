// Docker prints one line per layer while it pulls. The sheet shows them as one meter: how many layers are
// finished out of how many it has started. A layer counts once, however many lines it prints.
const STARTED = /^(\S+): Pulling fs layer$/;
const FINISHED = /^(\S+): (?:Pull complete|Already exists)$/;

const layerIds = (lines: string[], pattern: RegExp): Set<string> => {
  const ids = new Set<string>();
  for (const line of lines) {
    const id = pattern.exec(line.trim())?.[1];
    if (id) ids.add(id);
  }
  return ids;
};

export function pullProgress(lines: string[]): { done: number; total: number } {
  return {
    done: layerIds(lines, FINISHED).size,
    total: layerIds(lines, STARTED).size,
  };
}
