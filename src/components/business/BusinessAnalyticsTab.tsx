// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS ANALYTICS TAB
// Owner-only analytics dashboard showing views, contact clicks, shares, favorites.
// Renders inside BusinessDetailModal as a tab panel.
// Uses pure CSS bar charts (no chart library dependency).
// Cross-browser: Chrome, Safari, Firefox desktop + iOS Safari + Android Chrome.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo } from 'react';
import {
  Eye, MousePointerClick, Share2, Heart, TrendingUp,
  BarChart3, Loader2, Calendar,
} from 'lucide-react';
import type { BusinessAnalytics, AnalyticsEvent } from '@/reducers/businessReducer';
import { fetchBusinessAnalytics } from '@/services/businessAnalytics';

interface BusinessAnalyticsTabProps {
  businessId: string;
  analyticsData: BusinessAnalytics | null;
  analyticsLoading: boolean;
  dispatch: React.Dispatch<any>;
}

// ── Stat Card ──

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}> = ({ icon, label, value, color, bgColor }) => (
  <div className="bg-aurora-surface-variant rounded-xl p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-aurora-text">{value.toLocaleString()}</p>
      <p className="text-xs text-aurora-text-muted">{label}</p>
    </div>
  </div>
);

// ── Bar Chart (pure CSS) ──

const BarChart: React.FC<{
  data: AnalyticsEvent[];
  dataKey: keyof AnalyticsEvent;
  color: string;
  label: string;
}> = ({ data, dataKey, color, label }) => {
  const maxVal = useMemo(
    () => Math.max(...data.map((d) => (d[dataKey] as number) || 0), 1),
    [data, dataKey],
  );

  // Show last 14 days max
  const displayData = data.slice(-14);

  if (displayData.length === 0) {
    return (
      <div className="bg-aurora-surface-variant rounded-xl p-4 text-center text-sm text-aurora-text-muted">
        No data yet for {label.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="bg-aurora-surface-variant rounded-xl p-4">
      <h5 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        {label} — Last {displayData.length} days
      </h5>
      <div className="flex items-end gap-1 h-24" role="img" aria-label={`${label} bar chart`}>
        {displayData.map((d, i) => {
          const val = (d[dataKey] as number) || 0;
          const pct = (val / maxVal) * 100;
          const dateLabel = d.date.slice(5); // MM-DD

          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {val} on {dateLabel}
              </div>
              {/* Bar */}
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  backgroundColor: color,
                  opacity: pct > 0 ? 1 : 0.2,
                }}
              />
              {/* Date label (show every other for space) */}
              {i % 2 === 0 && (
                <span className="text-[9px] text-aurora-text-muted leading-none">{dateLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Component ──

const BusinessAnalyticsTab: React.FC<BusinessAnalyticsTabProps> = ({
  businessId,
  analyticsData,
  analyticsLoading,
  dispatch,
}) => {
  // Fetch analytics on mount
  useEffect(() => {
    if (!businessId) return;
    dispatch({ type: 'SET_ANALYTICS_LOADING', payload: true });
    fetchBusinessAnalytics(businessId).then((data) => {
      dispatch({ type: 'SET_ANALYTICS_DATA', payload: data });
    });
  }, [businessId, dispatch]);

  if (analyticsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-aurora-text-muted">Loading analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <BarChart3 className="w-10 h-10 text-aurora-text-muted" />
        <p className="text-sm text-aurora-text-muted">No analytics data available yet.</p>
        <p className="text-xs text-aurora-text-muted">Data will appear as users view your business.</p>
      </div>
    );
  }

  const { totalViews, totalContactClicks, totalShares, totalFavorites, dailyData } = analyticsData;

  return (
    <div className="space-y-4 pb-4">
      {/* Period label */}
      <div className="flex items-center gap-1.5 text-xs text-aurora-text-muted">
        <Calendar className="w-3.5 h-3.5" />
        Last 30 days
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Eye className="w-5 h-5 text-blue-600" />}
          label="Total Views"
          value={totalViews}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          icon={<MousePointerClick className="w-5 h-5 text-emerald-600" />}
          label="Contact Clicks"
          value={totalContactClicks}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
        />
        <StatCard
          icon={<Share2 className="w-5 h-5 text-violet-600" />}
          label="Shares"
          value={totalShares}
          color="text-violet-600"
          bgColor="bg-violet-100"
        />
        <StatCard
          icon={<Heart className="w-5 h-5 text-rose-600" />}
          label="Favorites"
          value={totalFavorites}
          color="text-rose-600"
          bgColor="bg-rose-100"
        />
      </div>

      {/* Trend indicator */}
      {dailyData.length >= 2 && (() => {
        const recent = dailyData.slice(-7);
        const prior = dailyData.slice(-14, -7);
        const recentViews = recent.reduce((s, d) => s + (d.views || 0), 0);
        const priorViews = prior.reduce((s, d) => s + (d.views || 0), 0);
        const pctChange = priorViews > 0
          ? Math.round(((recentViews - priorViews) / priorViews) * 100)
          : recentViews > 0 ? 100 : 0;

        if (pctChange === 0) return null;

        return (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            pctChange > 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}>
            <TrendingUp className={`w-4 h-4 ${pctChange < 0 ? 'rotate-180' : ''}`} />
            <span className="font-medium">{pctChange > 0 ? '+' : ''}{pctChange}%</span>
            <span className="text-xs opacity-75">views vs. previous week</span>
          </div>
        );
      })()}

      {/* Bar charts */}
      {dailyData.length > 0 && (
        <>
          <BarChart data={dailyData} dataKey="views" color="#3B82F6" label="Views" />
          <BarChart data={dailyData} dataKey="contactClicks" color="#10B981" label="Contact Clicks" />
        </>
      )}

      {/* Empty state for charts */}
      {dailyData.length === 0 && (
        <div className="bg-aurora-surface-variant rounded-xl p-6 text-center">
          <BarChart3 className="w-8 h-8 text-aurora-text-muted mx-auto mb-2" />
          <p className="text-sm text-aurora-text-secondary">Charts will appear once your business gets traffic.</p>
          <p className="text-xs text-aurora-text-muted mt-1">Share your business link to start getting views!</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(BusinessAnalyticsTab);
