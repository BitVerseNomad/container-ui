import { sparkPoints } from "./containerInfo";

type Props = { values: number[]; max: number; label: string };

export default function Sparkline({ values, max, label }: Props) {
  const w = 240;
  const h = 44;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={sparkPoints(values, w, h - 2, max)} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
