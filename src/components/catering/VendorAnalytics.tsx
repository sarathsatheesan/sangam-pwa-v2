// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR ANALYTICS DASHBOARD
// Charts, metrics, and trend data for catering business owners.
// Phase 3: Polish & Admin
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, Star,
  BarChart3, Loader2, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import type { CateringOrder, CateringQuoteResponse } from '@/services/cateringService';
import {
  subscribeToBusinessOrders,
  subscribeToBusinessQuoteResponses,
  formatPrice,
} from '@/services/cateringService';

interface VendorAnalyticsProps {
  businessId: string;
  businessName: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function VendorAnalytics({ businessId, businessName }: VendorAnalyticsProps) {
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [quoteResponses, setQuoteResponses] = useState<CateringQuoteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    let orderLoaded = false;
    let quoteLoaded = false;
    const checkDone = () => { if (orderLoaded && quoteLoaded) setLoading(false); };

    const unsubOrders = subscribeToBusinessOrders(businessId, (o) => {
      setOrders(o);
      orderLoaded = true;
      checkDone();
    });
    const unsubQuotes = subscribeToBusinessQuoteResponses(businessId, (q) => {
      setQuoteResponses(q);
      quoteLoaded = true;
      checkDone();
    });
    return () => { unsubOrders(); unsubQuotes(); };
  }, [businessId]);

  // Filter by time range
  const filteredOrders = useMemo(() => {
    if (timeRange === 'all') return orders;
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = now - days * 86400000;
    return orders.filter((o) => {
      const t = o.createdAt?.toMillis?.() || o.createdAt?.seconds * 1000 || 0;
      return t >= cutoff;
    });
  }, [orders, timeRange]);

  const filteredQuotes = useMemo(() => {
    if (timeRange === 'all') return quoteResponses;
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = now - days * 86400000;
    return quoteResponses.filter((q) => {
      const t = q.createdAt?.toMillis?.() || q.createdAt?.seconds * 1000 || 0;
      return t >= cutoff;
    });
  }, [quoteResponses, timeRange]);

  // ── Compute metrics ──
  const metrics = useMemo(() => {
    const completed = filteredOrders.filter(o => o.status === 'delivered');
    const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    const totalGuests = completed.reduce((sum, o) => sum + (o.headcount || 0), 0);
    const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
    const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;
    const acceptRate = filteredOrders.length > 0
      ? ((filteredOrders.length - cancelledCount) / filteredOrders.length * 100)
      : 0;

    // Quote metrics
    const quotesSubmitted = filteredQuotes.length;
    const quotesAccepted = filteredQuotes.filter(q => q.status === 'accepted' || q.status === 'partially_accepted').length;
    const quoteConversion = quotesSubmitted > 0 ? (quotesAccepted / quotesSubmitted * 100) : 0;

    return {
      totalOrders: filteredOrders.length,
      completedOrders: completed.length,
      totalRevenue,
      avgOrderValue,
      totalGuests,
      pendingCount,
      cancelledCount,
      acceptRate,
      quotesSubmitted,
      quotesAccepted,
      quoteConversion,
    };
  }, [filteredOrders, filteredQuotes]);

  // ── Revenue by day (bar chart) ──
  const revenueByDay = useMemo(() => {
    const dayMap = new Map<string, number>();
    const completed = filteredOrders.filter(o => o.status === 'delivered');
    completed.forEach((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dayMap.set(key, (dayMap.get(key) || 0) + o.total);
    });
    return Array.from(dayMap.entries())
      .map(([day, revenue]) => ({ day, revenue: revenue / 100 }))
      .slice(-14); // last 14 data points
  }, [filteredOrders]);

  // ── Order status distribution (pie chart) ──
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const label = o.status.charAt(0).toUpperCase() + o.status.slice(1);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} style={{ color: '#6366F1' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--aurora-text)' }}>Analytics</h3>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: timeRange === range ? '#6366F1' : 'transparent',
                color: timeRange === range ? '#fff' : 'var(--aurora-text-secondary)',
              }}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<DollarSign size={16} />}
          label="Revenue"
          value={formatPrice(metrics.totalRevenue)}
          color="#059669"
        />
        <MetricCard
          icon={<Package size={16} />}
          label="Orders"
          value={String(metrics.totalOrders)}
          sub={`${metrics.completedOrders} completed`}
          color="#6366F1"
        />
        <MetricCard
          icon={<DollarSign size={16} />}
          label="Avg Order"
          value={formatPrice(metrics.avgOrderValue)}
          color="#8B5CF6"
        />
        <MetricCard
          icon={<Users size={16} />}
          label="Guests Served"
          value={String(metrics.totalGuests)}
          color="#F59E0B"
        />
        <MetricCard
          icon={<TrendingUp size={16} />}
          label="Accept Rate"
          value={`${metrics.acceptRate.toFixed(0)}%`}
          color={metrics.acceptRate >= 80 ? '#059669' : '#F59E0B'}
        />
        <MetricCard
          icon={<Star size={16} />}
          label="Quote Conv."
          value={`${metrics.quoteConversion.toFixed(0)}%`}
          sub={`${metrics.quotesAccepted}/${metrics.quotesSubmitted}`}
          color={metrics.quoteConversion >= 50 ? '#059669' : '#F59E0B'}
        />
      </div>

      {/* Revenue chart */}
      {revenueByDay.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--aurora-text)' }}>
            Revenue Trend
          </h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueByDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--aurora-text-muted, #9CA3AF)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--aurora-text-muted, #9CA3AF)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid var(--aurora-border)',
                  backgroundColor: 'var(--aurora-surface)',
                }}
              />
              <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Order status pie chart */}
      {statusDistribution.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--aurora-text)' }}>
            Order Status Breakdown
          </h4>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  dataKey="value"
                  stroke="none"
                >
                  {statusDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1">
              {statusDistribution.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="flex-1" style={{ color: 'var(--aurora-text-secondary)' }}>{entry.name}</span>
                  <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredOrders.length === 0 && filteredQuotes.length === 0 && (
        <div className="text-center py-8">
          <BarChart3 size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
            No data for the selected period
          </p>
        </div>
      )}
    </div>
  );
}

// ── Metric Card ──
function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--aurora-text-muted)' }}>
          {label}
        </span>
      </div>
      <p className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>{value}</p>
      {sub && (
        <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>{sub}</p>
      )}
    </div>
  );
}
