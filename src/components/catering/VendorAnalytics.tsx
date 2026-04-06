// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR ANALYTICS DASHBOARD
// Charts, metrics, and trend data for catering business owners.
// Phase 3: Polish & Admin
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, Star,
  BarChart3, Loader2, Calendar, Clock, Repeat, ChevronRight, X, ArrowUp, ArrowDown, Download,
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
import { useToast } from '@/contexts/ToastContext';

interface VendorAnalyticsProps {
  businessId: string;
  businessName: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function VendorAnalytics({ businessId, businessName }: VendorAnalyticsProps) {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [quoteResponses, setQuoteResponses] = useState<CateringQuoteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  // Feature #32: Drill-down state
  const [drillDownDay, setDrillDownDay] = useState<string | null>(null);
  const [drillDownStatus, setDrillDownStatus] = useState<string | null>(null);
  // Feature #35: Comparison mode state
  const [compareMode, setCompareMode] = useState(false);

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

  // Helper: get cutoff time for range
  const getCutoffTime = (range: TimeRange, offset = 0) => {
    const now = Date.now();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 10000;
    const cutoff = now - (days * 86400000) - (offset * days * 86400000);
    return cutoff;
  };

  // Filter by time range and status drill-down
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (timeRange !== 'all') {
      const cutoff = getCutoffTime(timeRange);
      result = result.filter((o) => {
        const t = o.createdAt?.toMillis?.() || o.createdAt?.seconds * 1000 || 0;
        return t >= cutoff;
      });
    }
    // Apply status filter if drill-down is active
    if (drillDownStatus) {
      result = result.filter((o) => o.status === drillDownStatus);
    }
    return result;
  }, [orders, timeRange, drillDownStatus]);

  // Comparison period (previous equivalent period)
  const comparisonOrders = useMemo(() => {
    if (!compareMode || timeRange === 'all') return [];
    const cutoff = getCutoffTime(timeRange, 1);
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const endTime = now - (days * 86400000);
    return orders.filter((o) => {
      const t = o.createdAt?.toMillis?.() || o.createdAt?.seconds * 1000 || 0;
      return t >= cutoff && t < endTime;
    });
  }, [orders, timeRange, compareMode]);

  const filteredQuotes = useMemo(() => {
    if (timeRange === 'all') return quoteResponses;
    const cutoff = getCutoffTime(timeRange);
    return quoteResponses.filter((q) => {
      const t = q.createdAt?.toMillis?.() || q.createdAt?.seconds * 1000 || 0;
      return t >= cutoff;
    });
  }, [quoteResponses, timeRange]);

  // Helper to compute metrics from order set
  const computeMetrics = (ordersSet: CateringOrder[], quotesSet: CateringQuoteResponse[]) => {
    const completed = ordersSet.filter(o => o.status === 'delivered');
    const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    const totalGuests = completed.reduce((sum, o) => sum + (o.headcount || 0), 0);
    const pendingCount = ordersSet.filter(o => o.status === 'pending').length;
    const cancelledCount = ordersSet.filter(o => o.status === 'cancelled').length;
    const acceptRate = ordersSet.length > 0
      ? ((ordersSet.length - cancelledCount) / ordersSet.length * 100)
      : 0;

    const quotesSubmitted = quotesSet.length;
    const quotesAccepted = quotesSet.filter(q => q.status === 'accepted' || q.status === 'partially_accepted').length;
    const quoteConversion = quotesSubmitted > 0 ? (quotesAccepted / quotesSubmitted * 100) : 0;

    return {
      totalOrders: ordersSet.length,
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
  };

  // ── Compute metrics ──
  const metrics = useMemo(() => computeMetrics(filteredOrders, filteredQuotes), [filteredOrders, filteredQuotes]);

  const comparisonMetrics = useMemo(() => {
    const compQuotes = timeRange === 'all' ? [] : quoteResponses.filter((q) => {
      const cutoff = getCutoffTime(timeRange, 1);
      const now = Date.now();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const endTime = now - (days * 86400000);
      const t = q.createdAt?.toMillis?.() || q.createdAt?.seconds * 1000 || 0;
      return t >= cutoff && t < endTime;
    });
    return computeMetrics(comparisonOrders, compQuotes);
  }, [comparisonOrders, quoteResponses, timeRange]);

  // ── Revenue by day (bar chart) - Feature #32 ──
  const revenueByDay = useMemo(() => {
    const dayMap = new Map<string, { date: string; revenue: number; orders: CateringOrder[] }>();
    const completed = filteredOrders.filter(o => o.status === 'delivered');
    completed.forEach((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = dayMap.get(key) || { date: key, revenue: 0, orders: [] as CateringOrder[] };
      existing.revenue += o.total;
      existing.orders.push(o);
      dayMap.set(key, existing);
    });
    return Array.from(dayMap.values())
      .map(({ date, revenue, orders: dayOrders }) => ({ day: date, revenue: revenue / 100, orders: dayOrders }))
      .slice(-14);
  }, [filteredOrders]);

  // ── Order status distribution (pie chart) - Feature #32 ──
  const statusDistribution = useMemo(() => {
    const counts: Record<string, { count: number; status: string }> = {};
    filteredOrders.forEach((o) => {
      const label = o.status.charAt(0).toUpperCase() + o.status.slice(1);
      counts[label] = { count: (counts[label]?.count || 0) + 1, status: o.status };
    });
    return Object.entries(counts).map(([name, { count, status }]) => ({ name, value: count, status }));
  }, [filteredOrders]);

  // Feature #33: Popular Items (Best Sellers) - V-11: Changed to sort by revenue
  const bestSellers = useMemo(() => {
    const revenueMap = new Map<string, { name: string; revenue: number; count: number }>();
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const existing = revenueMap.get(item.name) || { name: item.name, revenue: 0, count: 0 };
        existing.revenue += item.unitPrice * item.qty;
        existing.count += item.qty;
        revenueMap.set(item.name, existing);
      });
    });
    return Array.from(revenueMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredOrders]);

  // Feature #34: Peak Times Analysis
  const peakTimesData = useMemo(() => {
    const hourCounts = new Map<number, number>();
    const dayHourCounts = new Map<string, Map<number, number>>();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    filteredOrders.forEach((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      const hour = d.getHours();
      const dayOfWeek = days[d.getDay()];

      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

      if (!dayHourCounts.has(dayOfWeek)) dayHourCounts.set(dayOfWeek, new Map());
      const dayMap = dayHourCounts.get(dayOfWeek)!;
      dayMap.set(hour, (dayMap.get(hour) || 0) + 1);
    });

    // V-14: Format hours to 12-hour format
    const formatHour12 = (hour: number): string => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };

    const hourlyChart = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour: formatHour12(hour), count, sortKey: hour }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ hour, count }) => ({ hour, count }));

    return { hourlyChart, dayHourCounts };
  }, [filteredOrders]);

  // Feature #36: Customer Retention Metrics
  const customerMetrics = useMemo(() => {
    const delivered = filteredOrders.filter(o => o.status === 'delivered');
    const customerMap = new Map<string, { name: string; count: number; total: number }>();

    delivered.forEach((order) => {
      const customerId = order.customerId;
      const existing = customerMap.get(customerId) || { name: order.contactName || 'Unknown', count: 0, total: 0 };
      existing.count += 1;
      existing.total += order.total;
      customerMap.set(customerId, existing);
    });

    const customers = Array.from(customerMap.values());
    const uniqueCount = customers.length;
    const repeatCustomers = customers.filter(c => c.count > 1);
    const repeatRate = uniqueCount > 0 ? (repeatCustomers.length / uniqueCount * 100) : 0;
    const avgOrdersPerCustomer = uniqueCount > 0 ? delivered.length / uniqueCount : 0;

    const topCustomers = customers
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      uniqueCount,
      repeatCount: repeatCustomers.length,
      repeatRate,
      avgOrdersPerCustomer,
      topCustomers,
    };
  }, [filteredOrders]);

  // V-14: Format hour to 12-hour format
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

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
      {/* Header + time range selector + V-13: Export CSV button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} style={{ color: '#6366F1' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--aurora-text)' }}>Analytics</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const headers = ['Order ID', 'Date', 'Customer', 'Status', 'Items', 'Total'];
              const rows = filteredOrders.map(o => [
                o.id,
                o.createdAt?.toDate?.()?.toISOString?.() || '',
                o.contactName || '',
                o.status,
                o.items?.map(i => `${i.qty}x ${i.name}`).join('; ') || '',
                (o.total / 100).toFixed(2),
              ]);
              const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `catering-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              addToast('Analytics exported as CSV', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
          >
            <Download size={14} />
            Export CSV
          </button>
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
      </div>

      {/* Comparison toggle */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => setCompareMode(!compareMode)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
          style={{
            backgroundColor: compareMode ? '#6366F1' : 'transparent',
            color: compareMode ? '#fff' : 'var(--aurora-text-secondary)',
            borderColor: compareMode ? '#6366F1' : 'var(--aurora-border)',
            borderWidth: compareMode ? '0' : '1px',
          }}
        >
          <Repeat size={12} />
          {compareMode ? 'vs Period' : 'Compare'}
        </button>
      </div>

      {/* Metric cards - Feature #35: Comparison support */}
      <div className={`grid gap-3 ${compareMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {compareMode && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                Current Period
              </p>
              <div className="space-y-2">
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
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                Previous Period
              </p>
              <div className="space-y-2">
                <MetricCardWithComparison
                  icon={<DollarSign size={16} />}
                  label="Revenue"
                  value={formatPrice(metrics.totalRevenue)}
                  prevValue={formatPrice(comparisonMetrics.totalRevenue)}
                  color="#059669"
                />
                <MetricCardWithComparison
                  icon={<Package size={16} />}
                  label="Orders"
                  value={String(metrics.totalOrders)}
                  prevValue={String(comparisonMetrics.totalOrders)}
                  color="#6366F1"
                />
                <MetricCardWithComparison
                  icon={<DollarSign size={16} />}
                  label="Avg Order"
                  value={formatPrice(metrics.avgOrderValue)}
                  prevValue={formatPrice(comparisonMetrics.avgOrderValue)}
                  color="#8B5CF6"
                />
                <MetricCardWithComparison
                  icon={<Users size={16} />}
                  label="Guests Served"
                  value={String(metrics.totalGuests)}
                  prevValue={String(comparisonMetrics.totalGuests)}
                  color="#F59E0B"
                />
              </div>
            </div>
          </div>
        )}
        {!compareMode && (
          <>
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
          </>
        )}
      </div>

      {/* Revenue chart - Feature #32: Clickable bars for drill-down */}
      {revenueByDay.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--aurora-text)' }}>
            Revenue Trend {drillDownDay && `(${drillDownDay})`}
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
              <Bar
                dataKey="revenue"
                fill="#6366F1"
                radius={[4, 4, 0, 0]}
                onClick={(data) => setDrillDownDay((data as any).day)}
              />
            </BarChart>
          </ResponsiveContainer>
          {drillDownDay && (
            <DrillDownPanel
              day={drillDownDay}
              orders={filteredOrders.filter(o => {
                const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
                const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return key === drillDownDay && o.status === 'delivered';
              })}
              onClose={() => setDrillDownDay(null)}
            />
          )}
        </div>
      )}

      {/* Order status pie chart - Feature #32: Clickable slices */}
      {statusDistribution.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
              Order Status Breakdown
            </h4>
            {drillDownStatus && (
              <button
                onClick={() => setDrillDownStatus(null)}
                className="text-xs font-medium px-2 py-1 rounded transition-colors"
                style={{ color: '#6366F1' }}
              >
                Reset Filter
              </button>
            )}
          </div>
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
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrillDownStatus(statusDistribution[i].status);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1">
              {statusDistribution.map((entry, i) => (
                <button
                  key={entry.name}
                  onClick={() => setDrillDownStatus(entry.status)}
                  className="w-full flex items-center gap-2 text-xs hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: drillDownStatus === entry.status ? `${PIE_COLORS[i % PIE_COLORS.length]}20` : 'transparent', padding: '4px', borderRadius: '4px' }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="flex-1 text-left" style={{ color: 'var(--aurora-text-secondary)' }}>{entry.name}</span>
                  <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>{entry.value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feature #33: Popular Items (Best Sellers) - V-11: Now shows revenue */}
      {bestSellers.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--aurora-text)' }}>
            <Star size={16} style={{ color: '#F59E0B' }} />
            Best Sellers
          </h4>
          <div className="space-y-2.5">
            {bestSellers.map((item, idx) => (
              <div key={item.name} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span className="font-bold" style={{ color: 'var(--aurora-text)' }}>{idx + 1}.</span> {item.name}
                  </span>
                  <span style={{ color: 'var(--aurora-text)' }}>
                    {item.count} sold • {formatPrice(item.revenue)}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--aurora-border)',
                    backgroundImage: `linear-gradient(to right, #6366F1 0%, #6366F1 ${(item.revenue / bestSellers[0].revenue * 100)}%, var(--aurora-border) ${(item.revenue / bestSellers[0].revenue * 100)}%, var(--aurora-border) 100%)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature #34: Peak Times Analysis */}
      {peakTimesData.hourlyChart.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--aurora-text)' }}>
            <Clock size={16} style={{ color: '#06B6D4' }} />
            Orders by Hour
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={peakTimesData.hourlyChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: 'var(--aurora-text-muted, #9CA3AF)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--aurora-text-muted, #9CA3AF)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [v, 'Orders']}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid var(--aurora-border)',
                  backgroundColor: 'var(--aurora-surface)',
                }}
              />
              <Bar dataKey="count" fill="#06B6D4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feature #36: Customer Retention Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Users size={16} />}
          label="Unique Customers"
          value={String(customerMetrics.uniqueCount)}
          color="#6366F1"
        />
        <MetricCard
          icon={<Repeat size={16} />}
          label="Repeat Customers"
          value={String(customerMetrics.repeatCount)}
          sub={`${customerMetrics.repeatRate.toFixed(0)}% rate`}
          color="#10B981"
        />
      </div>

      {customerMetrics.topCustomers.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--aurora-text)' }}>
            <Users size={16} style={{ color: '#8B5CF6' }} />
            Top Customers
          </h4>
          <div className="space-y-2">
            {customerMetrics.topCustomers.map((customer, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--aurora-bg)' }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: '#8B5CF6', color: '#fff' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--aurora-text)' }}>
                      {customer.name}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                      {customer.count} {customer.count === 1 ? 'order' : 'orders'}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold flex-shrink-0 ml-2" style={{ color: '#10B981' }}>
                  {formatPrice(customer.total)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 p-2.5 rounded-lg border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--aurora-text-secondary)' }}>Avg Orders per Customer</span>
              <span className="font-semibold" style={{ color: 'var(--aurora-text)' }}>
                {customerMetrics.avgOrdersPerCustomer.toFixed(1)}
              </span>
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

// ── Metric Card with Comparison - Feature #35 ──
function MetricCardWithComparison({ icon, label, value, prevValue, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  prevValue: string;
  color: string;
}) {
  const isImprovement = parseFloat(value) >= parseFloat(prevValue);
  const percentChange = prevValue !== '0' && prevValue !== '$0.00'
    ? Math.abs((parseFloat(value) - parseFloat(prevValue)) / parseFloat(prevValue) * 100)
    : 0;

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
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>{value}</p>
        <div className="flex items-center gap-0.5">
          {isImprovement ? (
            <ArrowUp size={12} style={{ color: '#10B981' }} />
          ) : (
            <ArrowDown size={12} style={{ color: '#EF4444' }} />
          )}
          <span className="text-[10px] font-semibold" style={{ color: isImprovement ? '#10B981' : '#EF4444' }}>
            {percentChange.toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>vs {prevValue}</p>
    </div>
  );
}

// ── Drill-Down Panel - Feature #32 ──
function DrillDownPanel({ day, orders, onClose }: {
  day: string;
  orders: CateringOrder[];
  onClose: () => void;
}) {
  return (
    <div
      className="mt-3 p-3 rounded-lg border"
      style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--aurora-text)' }}>
          Orders on {day} ({orders.length})
        </p>
        <button
          onClick={onClose}
          className="p-0.5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--aurora-text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1.5">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between p-2 rounded bg-opacity-50"
            style={{ backgroundColor: `var(--aurora-surface)` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--aurora-text)' }}>
                {order.id}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                {order.contactName} • {order.status}
              </p>
            </div>
            <p className="text-xs font-semibold flex-shrink-0 ml-2" style={{ color: '#10B981' }}>
              {formatPrice(order.total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
