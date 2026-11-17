export default function Meter({ label, value, fraction }: { label: string; value: string; fraction: number }) {
  const pct = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-meta text-fg-muted">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-tile [&>i]:block [&>i]:h-full [&>i]:rounded-full [&>i]:bg-accent" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
