// Reads what of Docker Desktop's data is still not in Colima (src/desktopOffer.ts wires it to Tauri). Kept free of
// Tauri so the rules below are tested: only the newest read counts, and a focus re-read is rare and targeted.
import { homeGaps, inventory, sharedVolumes } from "./bringOver.ts";
import type { Gap, Item } from "./bringOver.ts";
import { latest } from "./latest.ts";

// items: null while not known (Docker Desktop closed or removed, or not read yet for this VM).
export type DesktopOffer = { ctx: string | null; items: Item[] | null; gaps: Gap[] };
export const NOTHING: DesktopOffer = { ctx: null, items: null, gaps: [] };
// colimaInspect: `docker inspect --type volume` of those names in Colima, so a folder on the Mac is never offered.
export type Ask = { running: () => Promise<boolean>; desktopDf: () => Promise<string>; colimaDf: (ctx: string) => Promise<string>; colimaPs: (ctx: string) => Promise<string>; colimaInspect: (ctx: string, names: string[]) => Promise<string> };

// `system df -v` walks every volume on both sides, so a focus re-read waits this long after the last read.
const REFOCUS_MS = 10 * 60_000;

export function desktopReader(ask: Ask, publish: (s: DesktopOffer) => void, now = () => Date.now()) {
  // The VM-open read, the read after a copy and a profile switch can overlap; a slow older answer must not win.
  const run = latest();
  let lastAt = -Infinity;
  let last = NOTHING;
  async function read(ctx: string | null) {
    lastAt = now();
    const r = await run<DesktopOffer>(async () => {
      if (!ctx) return NOTHING;
      if (!(await ask.running())) return { ctx, items: null, gaps: [] };
      const [desktopDf, colimaDf, colimaPs] = await Promise.all([ask.desktopDf(), ask.colimaDf(ctx), ask.colimaPs(ctx)]);
      // Volumes only: images are never picked by default, so they don't decide whether anything is left to bring.
      const both = sharedVolumes(desktopDf, colimaDf);
      const colimaInspect = both.length ? await ask.colimaInspect(ctx, both).catch(() => "") : "";
      const items = inventory({ desktopDf, desktopImages: "", colimaDf, colimaInspect, colimaImages: [] }).items;
      return { ctx, items, gaps: homeGaps(items, colimaPs) };
    });
    if (!r.current) return;
    // Not known on an error: the offer falls back to whether a copy was finished before.
    last = r.ok ? r.value! : { ctx, items: null, gaps: [] };
    publish(last);
  }
  // The Bring over panel's own read is the freshest answer there is: home's line, the badge and Doctor's row follow
  // it the moment it lands, not when the panel closes. It counts as the newest read, so an older one can't win.
  async function adopt(ctx: string, items: Item[], colimaPs: string) {
    lastAt = now();
    const r = await run(async () => ({ ctx, items, gaps: homeGaps(items, colimaPs) }));
    if (!r.current || !r.ok) return;
    last = r.value!;
    publish(last);
  }
  // Docker Desktop may have opened since, or a volume filled up. Only while something is unknown or showing.
  function onFocus(ctx: string | null) {
    if (now() - lastAt < REFOCUS_MS) return;
    if (last.items !== null && last.gaps.length === 0) return;
    return read(ctx);
  }
  return { read, adopt, onFocus };
}
