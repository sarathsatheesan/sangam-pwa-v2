export function MiniBarChart({ data, color = '#FF3008', height = 48 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((v, i) => {
        const h = (v / max) * height * 0.9;
        return (
          <rect
            key={i}
            x={i * barW + barW * 0.15}
            y={height - h}
            width={barW * 0.7}
            height={h}
            rx={2}
            fill={color}
            opacity={0.15 + (i / data.length) * 0.85}
          />
        );
      })}
    </svg>
  );
}
