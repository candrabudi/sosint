import type { ReactNode } from 'react';
import { Cell, Pie, PieChart } from 'recharts';

/** Donut progress beranimasi (Recharts). ratio 0–1. */
export function Ring({
  ratio, size, thickness = 3, color = 'var(--accent)', track = 'var(--line)', children, delay = 300,
}: {
  ratio: number;
  size: number;
  thickness?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  delay?: number;
}) {
  const r = size / 2;
  const data = [{ v: ratio }, { v: 1 - ratio }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        {/* track */}
        <Pie data={[{ v: 1 }]} dataKey="v" cx={r - 0.5} cy={r - 0.5} innerRadius={r - thickness - 2} outerRadius={r - 2}
          stroke="none" fill={track} isAnimationActive={false} />
        <Pie data={data} dataKey="v" cx={r - 0.5} cy={r - 0.5} innerRadius={r - thickness - 2} outerRadius={r - 2}
          startAngle={90} endAngle={-270} stroke="none" cornerRadius={thickness}
          animationBegin={delay} animationDuration={1300} animationEasing="ease-out">
          <Cell fill={color} />
          <Cell fill="transparent" />
        </Pie>
      </PieChart>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>}
    </div>
  );
}
