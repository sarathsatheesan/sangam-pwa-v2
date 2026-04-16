import React, { useState, useMemo } from 'react';
import type { ModerationItem } from '@/types/admin';
import AvatarImg from '@/components/shared/AvatarImg';
import { SkeletonRow } from '@/components/admin';
import {
  Flag, EyeOff, Eye, Trash2, AlertOctagon, AlertTriangle,
  Ban, CheckCircle2, Filter,
} from 'lucide-react';

interface ModerationPanelProps {
  loading: boolean;
  modQueue: ModerationItem[];
  filteredModQueue: ModerationItem[];
  modFilterCategory: string;
  modSortBy: 'recent' | 'frequency';
  modCategoryCounts: Record<string, number>;
  onModFilterCategoryChange: (cat: string) => void;
  onModSortByChange: (sort: 'recent' | 'frequency') => void;
  // Tabs
  modTab: 'reports' | 'hidden';
  onModTabChange: (tab: 'reports' | 'hidden') => void;
  // Report actions
  onDismiss: (id: string) => void;
  onHide: (item: ModerationItem) => void;
  onDelete: (item: ModerationItem) => void;
  onWarnUser: (item: ModerationItem) => void;
  onBanUser: (item: ModerationItem) => void;
  // Hidden content
  hiddenPosts: any[];
  hiddenBusinesses: any[];
  loadingHidden: boolean;
  onUnhidePost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onUnhideBusiness: (businessId: string) => void;
  onDeleteBusiness: (businessId: string) => void;
}

export function ModerationPanel({
  loading,
  modQueue,
  filteredModQueue,
  modFilterCategory,
  modSortBy,
  modCategoryCounts,
  onModFilterCategoryChange,
  onModSortByChange,
  modTab,
  onModTabChange,
  onDismiss,
  onHide,
  onDelete,
  onWarnUser,
  onBanUser,
  hiddenPosts,
  hiddenBusinesses,
  loadingHidden,
  onUnhidePost,
  onDeletePost,
  onUnhideBusiness,
  onDeleteBusiness,
}: ModerationPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Moderation</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Review reports and manage hidden content</p>
      </div>

      {/* Tab Toggle: Reports vs Hidden Posts */}
      <div className="flex gap-1 p-1 bg-[var(--aurora-surface-variant)] rounded-xl w-fit">
        <button
          onClick={() => onModTabChange('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            modTab === 'reports'
              ? 'bg-[var(--aurora-surface)] shadow-sm text-[var(--aurora-text)]'
              : 'text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]'
          }`}
        >
          <Flag size={14} />
          Reports
          {modQueue.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {modQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => onModTabChange('hidden')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            modTab === 'hidden'
              ? 'bg-[var(--aurora-surface)] shadow-sm text-[var(--aurora-text)]'
              : 'text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]'
          }`}
        >
          <EyeOff size={14} />
          Hidden Content
          {(hiddenPosts.length + hiddenBusinesses.length) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
              {hiddenPosts.length + hiddenBusinesses.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Hidden Content Tab ─── */}
      {modTab === 'hidden' && (
        <div className="space-y-4">
          {loadingHidden ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : (hiddenPosts.length === 0 && hiddenBusinesses.length === 0) ? (
            <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16">
              <Eye size={48} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-semibold text-[var(--aurora-text)]">No hidden content</p>
              <p className="text-sm text-[var(--aurora-text-secondary)]">All posts and businesses are currently visible to the public</p>
            </div>
          ) : (
            <>
              {/* Hidden Posts */}
              {hiddenPosts.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--aurora-text-secondary)] px-1">Hidden Posts ({hiddenPosts.length})</h4>
                  {hiddenPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-[var(--aurora-surface)] rounded-2xl border border-orange-200 dark:border-orange-800/30 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="px-5 pt-4 pb-2 border-b border-[var(--aurora-border)]/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 uppercase flex items-center gap-1">
                            <EyeOff size={10} /> Hidden Post
                          </span>
                          {post.hiddenReason && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              {post.hiddenReason}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--aurora-text-secondary)] ml-auto">
                            Hidden: {post.hiddenAt ? new Date(post.hiddenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="px-5 py-3">
                        <p className="text-sm text-[var(--aurora-text)] whitespace-pre-wrap leading-relaxed">
                          &ldquo;{(post.content || '').length > 400 ? (post.content || '').slice(0, 400) + '...' : (post.content || '')}&rdquo;
                        </p>
                        {post.images && post.images.length > 0 && (
                          <div className="flex gap-2 mt-2 overflow-x-auto">
                            {post.images.slice(0, 4).map((img: string, idx: number) => (
                              <img key={idx} src={img} alt={`Image ${idx + 1}`} className="w-16 h-16 rounded-lg object-cover border border-[var(--aurora-border)]" />
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Author */}
                      <div className="px-5 py-2 bg-[var(--aurora-surface-variant)]/30 border-t border-[var(--aurora-border)]/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--aurora-surface-variant)] flex items-center justify-center text-sm overflow-hidden">
                            <AvatarImg value={post.userAvatar} />
                          </div>
                          <p className="text-xs text-[var(--aurora-text-secondary)]">
                            By <span className="font-semibold text-[var(--aurora-text)]">{post.userName || 'Unknown'}</span>
                            {post.createdAt && (
                              <span className="ml-1 opacity-60">
                                · Posted {post.createdAt?.toDate?.()?.toLocaleDateString?.('en-US', { month: 'short', day: 'numeric' }) || ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="px-5 py-3 border-t border-[var(--aurora-border)]/50 flex items-center gap-2">
                        <button
                          onClick={() => onUnhidePost(post.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition"
                        >
                          <Eye size={12} /> Restore / Unhide
                        </button>
                        <button
                          onClick={() => onDeletePost(post.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
                        >
                          <Trash2 size={12} /> Delete Permanently
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden Businesses */}
              {hiddenBusinesses.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--aurora-text-secondary)] px-1">Hidden Businesses ({hiddenBusinesses.length})</h4>
                  {hiddenBusinesses.map((biz) => (
                    <div
                      key={biz.id}
                      className="bg-[var(--aurora-surface)] rounded-2xl border border-orange-200 dark:border-orange-800/30 overflow-hidden"
                    >
                      <div className="px-5 pt-4 pb-2 border-b border-[var(--aurora-border)]/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 uppercase flex items-center gap-1">
                            <EyeOff size={10} /> Hidden Business
                          </span>
                          {biz.hiddenReason && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              {biz.hiddenReason}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--aurora-text-secondary)] ml-auto">
                            Hidden: {biz.hiddenAt ? new Date(biz.hiddenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="px-5 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{biz.emoji || '💼'}</span>
                          <p className="text-sm font-semibold text-[var(--aurora-text)]">{biz.name || 'Unnamed Business'}</p>
                          {biz.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)]">{biz.category}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--aurora-text-secondary)] leading-relaxed">
                          {(biz.desc || '').length > 200 ? (biz.desc || '').slice(0, 200) + '...' : (biz.desc || 'No description')}
                        </p>
                        {biz.photos && biz.photos.length > 0 && (
                          <div className="flex gap-2 mt-2 overflow-x-auto">
                            {biz.photos.slice(0, 4).map((img: string, idx: number) => (
                              <img key={idx} src={img} alt={`Photo ${idx + 1}`} className="w-16 h-16 rounded-lg object-cover border border-[var(--aurora-border)]" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-2 bg-[var(--aurora-surface-variant)]/30 border-t border-[var(--aurora-border)]/50">
                        <p className="text-xs text-[var(--aurora-text-secondary)]">
                          {biz.location && <span>{biz.location} · </span>}
                          Owner ID: <span className="font-mono text-[10px]">{biz.ownerId || 'Unknown'}</span>
                        </p>
                      </div>
                      <div className="px-5 py-3 border-t border-[var(--aurora-border)]/50 flex items-center gap-2">
                        <button
                          onClick={() => onUnhideBusiness(biz.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition"
                        >
                          <Eye size={12} /> Restore / Unhide
                        </button>
                        <button
                          onClick={() => onDeleteBusiness(biz.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
                        >
                          <Trash2 size={12} /> Delete Permanently
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Reports Tab ─── */}
      {modTab === 'reports' && (<>
        {/* Filter & Sort Bar */}
        {modQueue.length > 0 && (
          <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--aurora-text-secondary)]">
                <Filter size={14} /> Filter:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onModFilterCategoryChange('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                    modFilterCategory === 'all'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-border)]'
                  }`}
                >
                  All ({modQueue.length})
                </button>
                {Object.entries(modCategoryCounts).map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => onModFilterCategoryChange(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition capitalize ${
                      modFilterCategory === cat
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-border)]'
                    }`}
                  >
                    {cat.replace(/_/g, ' ')} ({count})
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--aurora-text-secondary)]">Sort:</span>
                <button
                  onClick={() => onModSortByChange('recent')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                    modSortBy === 'recent' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30' : 'text-[var(--aurora-text-secondary)]'
                  }`}
                >
                  Recent
                </button>
                <button
                  onClick={() => onModSortByChange('frequency')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                    modSortBy === 'frequency' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'text-[var(--aurora-text-secondary)]'
                  }`}
                >
                  Most Reported
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredModQueue.length === 0 ? (
          <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
            <p className="font-semibold text-[var(--aurora-text)]">All clear!</p>
            <p className="text-sm text-[var(--aurora-text-secondary)]">
              {modFilterCategory !== 'all' ? 'No reports in this category' : 'No flagged content to review'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredModQueue.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--aurora-surface)] rounded-2xl border border-red-200 dark:border-red-800/30 overflow-hidden"
              >
                {/* Report Header with Category & Frequency Badge */}
                <div className="px-5 pt-4 pb-3 border-b border-[var(--aurora-border)]/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase">
                      {item.type}
                    </span>
                    {item.categoryLabel && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {item.categoryLabel}
                      </span>
                    )}
                    {(item.reportCount || 1) > 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1">
                        <AlertOctagon size={10} /> {item.reportCount} reports
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--aurora-text-secondary)] ml-auto">
                      {item.createdAt?.toDate?.()?.toLocaleDateString?.('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}
                    </span>
                  </div>
                </div>

                {/* Flagged Content Preview */}
                <div className="px-5 py-3">
                  <p className="text-sm text-[var(--aurora-text)] mb-2 whitespace-pre-wrap leading-relaxed">
                    &ldquo;{item.content.length > 400 ? item.content.slice(0, 400) + '...' : item.content}&rdquo;
                  </p>
                  {item.images && item.images.length > 0 && (
                    <div className="flex gap-2 mt-2 mb-2 overflow-x-auto">
                      {item.images.slice(0, 3).map((img, idx) => (
                        <img key={idx} src={img} alt={`Attached ${idx + 1}`} className="w-16 h-16 rounded-lg object-cover border border-[var(--aurora-border)]" />
                      ))}
                      {item.images.length > 3 && (
                        <div className="w-16 h-16 rounded-lg bg-[var(--aurora-surface-variant)] flex items-center justify-center text-xs font-semibold text-[var(--aurora-text-secondary)]">
                          +{item.images.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Author & Reporter Info */}
                <div className="px-5 py-3 bg-[var(--aurora-surface-variant)]/30 border-t border-[var(--aurora-border)]/50">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                        <AvatarImg value={item.authorAvatar} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--aurora-text)]">
                          Author: {item.authorName || 'Unknown'}
                        </p>
                        {item.authorId && (
                          <p className="text-[10px] text-[var(--aurora-text-secondary)] opacity-60">{item.authorId.slice(0, 12)}...</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                        <AvatarImg value={item.reporterAvatar} fallback="🛡️" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--aurora-text)]">
                          Reported by: {item.reporterName || 'Unknown'}
                        </p>
                        {item.reportedBy && (
                          <p className="text-[10px] text-[var(--aurora-text-secondary)] opacity-60">{item.reportedBy.slice(0, 12)}...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Multiple reporters list */}
                  {item.reporters && item.reporters.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-[var(--aurora-border)]/30">
                      <p className="text-[10px] font-semibold text-[var(--aurora-text-secondary)] mb-1.5 uppercase tracking-wider">All Reporters ({item.reporters.length})</p>
                      <div className="space-y-1">
                        {item.reporters.map((r, idx) => (
                          <div key={r.uid || `reporter-${idx}`} className="flex items-center gap-2 text-[11px]">
                            <span className="w-5 h-5 rounded-full overflow-hidden inline-flex items-center justify-center shrink-0"><AvatarImg value={r.avatar} className="w-5 h-5 rounded-full object-cover" /></span>
                            <span className="font-medium text-[var(--aurora-text)]">{r.name}</span>
                            <span className="text-[var(--aurora-text-secondary)] capitalize">— {r.category?.replace(/_/g, ' ')}</span>
                            {r.details && <span className="text-[var(--aurora-text-secondary)] italic truncate max-w-[150px]">"{r.details}"</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons — Dismiss, Hide, Delete, Warn User, Ban User */}
                <div className="px-5 py-3 border-t border-[var(--aurora-border)]/50 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onDismiss(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition"
                  >
                    <CheckCircle2 size={12} /> Dismiss
                  </button>
                  <button
                    onClick={() => onHide(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 transition"
                  >
                    <EyeOff size={12} /> Hide
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  {item.authorId && (
                    <>
                      <button
                        onClick={() => onWarnUser(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition"
                      >
                        <AlertTriangle size={12} /> Warn User
                      </button>
                      <button
                        onClick={() => onBanUser(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 transition"
                      >
                        <Ban size={12} /> Ban User
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}
