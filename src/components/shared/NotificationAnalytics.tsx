// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION ANALYTICS — Admin dashboard for delivery metrics
// Shows send/fail/skip rates across channels and templates
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../services/firebase';

// ─── Types ──────────────────────────────────────────────────────────

interface AnalyticsEntry {
  date: string;
  template: string;
  channel: string;
  count_sent?: number;
  count_failed?: number;
  count_skipped?: number;
  count_logged?: number;
  count_rate_limited?: number;
  count_deduplicated?: number;
  count_quiet_hours?: number;
  count_pref_disabled?: number;
  totalCount: number;
}

interface ChannelSummary {
  channel: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  deliveryRate: number;
}

// ─── Component ──────────────────────────────────────────────────────

export default function NotificationAnalytics() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AnalyticsEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7); // days

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dateRange);
        const startStr = startDate.toISOString().slice(0, 10);

        const q = query(
          collection(db, 'notificationAnalytics'),
          where('date', '>=', startStr),
        );

        const snap = await getDocs(q);
        const data = snap.docs.map((d) => d.data() as AnalyticsEntry);
        setEntries(data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  // ── Computed summaries ──

  const channelSummaries = useMemo((): ChannelSummary[] => {
    const map: Record<string, { sent: number; failed: number; skipped: number; total: number }> = {};

    for (const e of entries) {
      if (!map[e.channel]) map[e.channel] = { sent: 0, failed: 0, skipped: 0, total: 0 };
      const ch = map[e.channel];
      ch.sent += e.count_sent || 0;
      ch.failed += e.count_failed || 0;
      ch.skipped += (e.count_skipped || 0) + (e.count_rate_limited || 0) + (e.count_deduplicated || 0) + (e.count_quiet_hours || 0) + (e.count_pref_disabled || 0);
      ch.total += e.totalCount || 0;
    }

    return Object.entries(map).map(([channel, data]) => ({
      channel,
      ...data,
      deliveryRate: data.total > 0 ? Math.round((data.sent / data.total) * 100) : 0,
    }));
  }, [entries]);

  const totalSent = channelSummaries.reduce((s, c) => s + c.sent, 0);
  const totalFailed = channelSummaries.reduce((s, c) => s + c.failed, 0);
  const totalSkipped = channelSummaries.reduce((s, c) => s + c.skipped, 0);
  const totalAll = channelSummaries.reduce((s, c) => s + c.total, 0);
  const overallRate = totalAll > 0 ? Math.round((totalSent / totalAll) * 100) : 0;

  // Template breakdown
  const templateBreakdown = useMemo(() => {
    const map: Record<string, { sent: number; failed: number; total: number }> = {};
    for (const e of entries) {
      if (!map[e.template]) map[e.template] = { sent: 0, failed: 0, total: 0 };
      map[e.template].sent += e.count_sent || 0;
      map[e.template].failed += e.count_failed || 0;
      map[e.template].total += e.totalCount || 0;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);
  }, [entries]);

  const channelIcons: Record<string, React.ReactNode> = {
    email: <Mail size={16} color="#6366F1" />,
    sms: <MessageSquare size={16} color="#10B981" />,
    push: <Smartphone size={16} color="#F59E0B" />,
  };

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '16px',
        minHeight: '100vh',
        backgroundColor: '#FAFBFC',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}
          >
            <ArrowLeft size={20} color="#374151" />
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
            Notification Analytics
          </h1>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(Number(e.target.value))}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            fontSize: '13px',
            color: '#374151',
            backgroundColor: '#fff',
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
          Loading analytics...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>No analytics data yet</p>
          <p style={{ fontSize: '13px' }}>Notification metrics will appear here as notifications are sent.</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Sent', value: totalSent, icon: <CheckCircle size={18} color="#10B981" />, color: '#10B981' },
              { label: 'Failed', value: totalFailed, icon: <XCircle size={18} color="#EF4444" />, color: '#EF4444' },
              { label: 'Skipped', value: totalSkipped, icon: <Clock size={18} color="#F59E0B" />, color: '#F59E0B' },
              { label: 'Delivery Rate', value: `${overallRate}%`, icon: <TrendingUp size={18} color="#6366F1" />, color: '#6366F1' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  {card.icon}
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{card.label}</span>
                </div>
                <span style={{ fontSize: '24px', fontWeight: 700, color: card.color }}>{card.value}</span>
              </div>
            ))}
          </div>

          {/* Channel Breakdown */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              Channel Breakdown
            </h2>
            {channelSummaries.map((ch) => (
              <div key={ch.channel} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {channelIcons[ch.channel] || <Bell size={16} />}
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827', textTransform: 'capitalize' }}>
                      {ch.channel}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    {ch.sent} sent / {ch.total} total ({ch.deliveryRate}%)
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${ch.deliveryRate}%`,
                      borderRadius: '3px',
                      backgroundColor: ch.deliveryRate > 80 ? '#10B981' : ch.deliveryRate > 50 ? '#F59E0B' : '#EF4444',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Top Templates */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '20px',
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              Top Notification Types
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#6B7280', fontWeight: 500 }}>Template</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#6B7280', fontWeight: 500 }}>Sent</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#6B7280', fontWeight: 500 }}>Failed</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#6B7280', fontWeight: 500 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {templateBreakdown.map(([template, data]) => (
                  <tr key={template} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 0', color: '#111827', fontWeight: 500 }}>
                      {template.replace(/_/g, ' ')}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#10B981' }}>{data.sent}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#EF4444' }}>{data.failed}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#6B7280' }}>{data.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
