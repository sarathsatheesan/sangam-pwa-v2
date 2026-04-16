import React from 'react';
import {
  Search,
  Users,
  Shield,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  UserCheck,
  Ban,
  Trash2,
  UserX,
} from 'lucide-react';
import type { UserRecord } from '@/types/admin';
import { SkeletonRow } from '@/components/admin';
import AvatarImg from '@/components/shared/AvatarImg';

interface UserManagementPanelProps {
  loading: boolean;
  users: UserRecord[];
  filteredUsers: UserRecord[];
  userSearch: string;
  onUserSearchChange: (search: string) => void;
  userFilter: 'all' | 'active' | 'business' | 'disabled' | 'banned' | 'admin';
  onUserFilterChange: (filter: 'all' | 'active' | 'business' | 'disabled' | 'banned' | 'admin') => void;
  bannedUserIds: string[];
  disabledUserIds: string[];
  expandedUser: string | null;
  onExpandedUserChange: (userId: string | null) => void;
  deletingContent: string | null;
  isUserAdmin: (user: UserRecord) => boolean;
  onDisableUser: (userId: string) => void;
  onEnableUser: (userId: string) => void;
  onBanUser: (userId: string) => void;
  onUnbanUser: (userId: string) => void;
  onDeleteContent: (userId: string, userName: string) => void;
  onRemoveUser: (userId: string, userName: string) => void;
}

export function UserManagementPanel({
  loading,
  users,
  filteredUsers,
  userSearch,
  onUserSearchChange,
  userFilter,
  onUserFilterChange,
  bannedUserIds,
  disabledUserIds,
  expandedUser,
  onExpandedUserChange,
  deletingContent,
  isUserAdmin,
  onDisableUser,
  onEnableUser,
  onBanUser,
  onUnbanUser,
  onDeleteContent,
  onRemoveUser,
}: UserManagementPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Users</h2>
          <p className="text-sm text-[var(--aurora-text-secondary)]">{users.length} registered users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={userSearch}
            onChange={(e) => onUserSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'business', 'admin', 'disabled', 'banned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onUserFilterChange(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                userFilter === f
                  ? 'bg-[#FF3008] text-white shadow-md'
                  : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-variant)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)]">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-[var(--aurora-text-secondary)]">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--aurora-border)]">
              {filteredUsers.map((u) => {
                const userIsAdmin = isUserAdmin(u);
                const isBanned = bannedUserIds.includes(u.id);
                const isDisabled = disabledUserIds.includes(u.id);
                const isExpanded = expandedUser === u.id;

                return (
                  <div key={u.id}>
                    <button
                      onClick={() => onExpandedUserChange(isExpanded ? null : u.id)}
                      className={`w-full flex items-center gap-4 p-4 hover:bg-[var(--aurora-surface-variant)]/50 transition text-left ${
                        userIsAdmin ? 'bg-[#FF3008]/[0.03]' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 overflow-hidden ${
                        userIsAdmin
                          ? 'bg-gradient-to-br from-[#FF3008] to-[#FF6034] text-white'
                          : 'bg-[var(--aurora-surface-variant)]'
                      }`}>
                        <AvatarImg value={u.avatar} fallback="🧑" />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[var(--aurora-text)] truncate">{u.name}</p>
                          {userIsAdmin && (
                            <span className="text-[9px] bg-[#FF3008] text-white px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">
                              ADMIN
                            </span>
                          )}
                          {u.accountType === 'business' && (
                            <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">
                              BUSINESS
                            </span>
                          )}
                          {u.accountType === 'business' && u.adminReviewRequired && u.adminApproved === false && (
                            <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">
                              PENDING
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--aurora-text-secondary)] truncate">
                          {u.email}
                          {u.businessName ? ` — ${u.businessName}` : ''}
                        </p>
                      </div>
                      {/* Heritage */}
                      <div className="hidden md:block text-xs text-[var(--aurora-text-secondary)] w-24 truncate">
                        {u.heritage
                          ? Array.isArray(u.heritage) ? u.heritage.join(', ') : u.heritage
                          : '-'}
                      </div>
                      {/* City */}
                      <div className="hidden md:block text-xs text-[var(--aurora-text-secondary)] w-20 truncate">
                        {u.city || '-'}
                      </div>
                      {/* Status */}
                      <div className="flex-shrink-0">
                        {userIsAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FF3008]/10 text-[#FF3008]">
                            <Shield size={10} /> Protected
                          </span>
                        ) : isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle size={10} /> Banned
                          </span>
                        ) : isDisabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle size={10} /> Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-[var(--aurora-text-secondary)] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-[var(--aurora-surface-variant)]/30">
                        <div className="flex flex-wrap gap-2 ml-14">
                          {userIsAdmin ? (
                            <p className="text-xs text-[var(--aurora-text-secondary)] italic py-2">
                              Admin accounts are protected from moderation actions
                            </p>
                          ) : (
                            <>
                              {isDisabled ? (
                                <button
                                  onClick={() => onEnableUser(u.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition"
                                >
                                  <CheckCircle2 size={12} /> Enable
                                </button>
                              ) : (
                                <button
                                  onClick={() => onDisableUser(u.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition"
                                >
                                  <EyeOff size={12} /> Disable
                                </button>
                              )}
                              {isBanned ? (
                                <button
                                  onClick={() => onUnbanUser(u.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40 transition"
                                >
                                  <UserCheck size={12} /> Unban
                                </button>
                              ) : (
                                <button
                                  onClick={() => onBanUser(u.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40 transition"
                                >
                                  <Ban size={12} /> Ban
                                </button>
                              )}
                              <button
                                onClick={() => onDeleteContent(u.id, u.name)}
                                disabled={deletingContent === u.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition disabled:opacity-50"
                              >
                                <Trash2 size={12} /> {deletingContent === u.id ? 'Deleting...' : 'Delete Content'}
                              </button>
                              <button
                                onClick={() => onRemoveUser(u.id, u.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                              >
                                <UserX size={12} /> Remove User
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
