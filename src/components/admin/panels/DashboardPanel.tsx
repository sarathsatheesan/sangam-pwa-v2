import React from 'react';
import {
  Users,
  ClipboardList,
  MessageSquare,
  Activity,
  Calendar,
  Flag,
  ChefHat,
  Ban,
  Settings,
  Megaphone,
} from 'lucide-react';
import { StatCard, SkeletonCard } from '@/components/admin';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  disabledUsers: number;
  totalListings: number;
  businessCount: number;
  housingCount: number;
  travelCount: number;
  forumThreads: number;
  forumReplies: number;
  totalEvents: number;
  totalPosts: number;
  modQueueCount: number;
  announcementCount: number;
  cateringOrderCount: number;
  cateringPendingCount: number;
  cateringBusinessCount: number;
  cateringRfpCount: number;
  recentSignups: number[];
}

interface DashboardPanelProps {
  loading: boolean;
  dashStats: DashboardStats;
  onNavigate: (section: string) => void;
}

export function DashboardPanel({ loading, dashStats, onNavigate }: DashboardPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Dashboard</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Overview of your community platform</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          {/* Top stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Users"
              value={dashStats.totalUsers}
              trend="up"
              trendLabel={`${dashStats.activeUsers} active`}
              color="#FF3008"
              chartData={dashStats.recentSignups}
            />
            <StatCard
              icon={ClipboardList}
              label="Total Listings"
              value={dashStats.totalListings}
              trend="neutral"
              trendLabel={`${dashStats.businessCount}B / ${dashStats.housingCount}H / ${dashStats.travelCount}T`}
              color="#6366F1"
            />
            <StatCard
              icon={MessageSquare}
              label="Forum Activity"
              value={dashStats.forumThreads + dashStats.forumReplies}
              trend="up"
              trendLabel={`${dashStats.forumThreads} threads`}
              color="#10B981"
              chartData={[3, 5, 2, 8, 6, 4, 7]}
            />
            <StatCard
              icon={Activity}
              label="Feed Posts"
              value={dashStats.totalPosts}
              color="#F59E0B"
            />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Calendar} label="Events" value={dashStats.totalEvents} color="#8B5CF6" />
            <StatCard
              icon={Flag}
              label="Moderation Queue"
              value={dashStats.modQueueCount}
              trend={dashStats.modQueueCount > 0 ? 'down' : 'neutral'}
              trendLabel={dashStats.modQueueCount > 0 ? 'Needs review' : 'Clear'}
              color="#EF4444"
            />
            <StatCard
              icon={ChefHat}
              label="Catering Orders"
              value={dashStats.cateringOrderCount}
              trend={dashStats.cateringPendingCount > 0 ? 'down' : 'neutral'}
              trendLabel={dashStats.cateringPendingCount > 0 ? `${dashStats.cateringPendingCount} pending` : `${dashStats.cateringBusinessCount} caterers`}
              color="#F97316"
            />
            <StatCard
              icon={Ban}
              label="Banned / Disabled"
              value={`${dashStats.bannedUsers} / ${dashStats.disabledUsers}`}
              color="#EF4444"
            />
          </div>

          {/* Quick actions */}
          <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
            <h3 className="text-lg font-bold text-[var(--aurora-text)] mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Manage Users', icon: Users, section: 'users', color: '#FF3008' },
                { label: 'Feature Toggles', icon: Settings, section: 'features', color: '#6366F1' },
                { label: 'New Announcement', icon: Megaphone, section: 'announcements', color: '#06B6D4' },
                { label: 'Review Flagged', icon: Flag, section: 'moderation', color: '#EF4444' },
              ].map((action) => (
                <button
                  key={action.section}
                  onClick={() => onNavigate(action.section)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-[var(--aurora-border)] hover:border-[var(--aurora-text-secondary)]/30 hover:shadow-md transition-all text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${action.color}15` }}
                  >
                    <action.icon size={18} style={{ color: action.color }} />
                  </div>
                  <span className="text-sm font-medium text-[var(--aurora-text)]">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
