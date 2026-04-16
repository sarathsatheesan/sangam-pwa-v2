import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { MiniBarChart } from './MiniBarChart';

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color,
  chartData,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color: string;
  chartData?: number[];
}) {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              trend === 'up'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : trend === 'down'
                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--aurora-text)] mb-0.5">{value}</p>
      <p className="text-xs text-[var(--aurora-text-secondary)]">{label}</p>
      {chartData && (
        <div className="mt-3 -mx-1">
          <MiniBarChart data={chartData} color={color} />
        </div>
      )}
    </div>
  );
}
