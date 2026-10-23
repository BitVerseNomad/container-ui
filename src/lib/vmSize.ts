// Colima's own default (2 CPUs, 2 GiB) is too small for most local stacks, and the Setup check
// would warn about it right away. Half the cores and a quarter of the memory leave the Mac usable.
export type Host = { cpus: number; memory: number };
const GiB = 1024 ** 3;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function firstVmSize(h: Host): { cpus: number; memory: number } {
  return { cpus: clamp(Math.floor(h.cpus / 2), 2, 8), memory: clamp(Math.floor(h.memory / GiB / 4), 2, 16) };
}
