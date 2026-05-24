'use client';

interface DayRevenue {
  date: string; // 'YYYY-MM-DD'
  revenue: number;
}

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function RevenueChart({ days }: { days: DayRevenue[] }) {
  if (days.length === 0) {
    return (
      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No revenue data yet
      </div>
    );
  }

  // Layout in viewBox units. A left gutter holds the y-axis scale and a
  // bottom gutter holds the date labels — both kept clear of the plot so
  // nothing overlaps however wide the card renders.
  const PAD_L = 42, PAD_R = 10, PAD_T = 14, PAD_B = 24;
  const W = 680, H = 220;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(...days.map(d => d.revenue), 1);
  const slot = plotW / days.length;
  const barW = Math.max(2, slot * 0.68);

  // X-axis ticks: first, last and a few evenly spaced interior points,
  // chosen far enough apart that the date labels can never collide.
  const tickCount = Math.min(days.length, 5);
  const ticks = new Set(
    Array.from({ length: tickCount }, (_, k) =>
      Math.round((k / Math.max(tickCount - 1, 1)) * (days.length - 1)),
    ),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Daily revenue"
    >
      {/* Y gridlines + scale */}
      {[0, 0.5, 1].map(f => {
        const y = PAD_T + plotH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#9ca3af">
              {fmtK(max * f)}
            </text>
          </g>
        );
      })}

      {/* Bars — the most recent day is highlighted in brand pink */}
      {days.map((d, i) => {
        const cx = PAD_L + slot * i + slot / 2;
        const barH = Math.max(1, (d.revenue / max) * plotH);
        const y = PAD_T + plotH - barH;
        const isLast = i === days.length - 1;
        const labelAnchor = i === 0 ? 'start' : isLast ? 'end' : 'middle';
        const labelX = i === 0 ? PAD_L : isLast ? W - PAD_R : cx;
        return (
          <g key={d.date}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={isLast ? '#4A1A6B' : '#f6bcd5'}
            >
              <title>{`${fmtDate(d.date)} — £${Math.round(d.revenue).toLocaleString()}`}</title>
            </rect>
            {ticks.has(i) && (
              <text x={labelX} y={H - 7} textAnchor={labelAnchor} fontSize="10" fill="#9ca3af">
                {fmtDate(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
