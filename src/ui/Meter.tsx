export default function Meter({ label, value, fraction }: { label: string; value: string; fraction: number }) {
  const pct = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
