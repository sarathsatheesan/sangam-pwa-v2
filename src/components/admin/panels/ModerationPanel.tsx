import React from 'react';
import type { ModerationItem } from '@/types/admin';
import { AlertOctagon, Eye, EyeOff, Trash2 } from 'lucide-react';

interface ModerationPanelProps {
  modQueue: ModerationItem[];
  hiddenPosts: any[];
  hiddenBusinesses: any[];
  onApproveItem: (id: string) => void;
  onRejectItem: (id: string) => void;
  onUnhidePost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onUnhideBusiness: (businessId: string) => void;
  onDeleteBusiness: (businessId: string) => void;
}

export function ModerationPanel({
  modQueue,
  hiddenPosts,
  hiddenBusinesses,
  onApproveItem,
  onRejectItem,
  onUnhidePost,
  onDeletePost,
  onUnhideBusiness,
  onDeleteBusiness,
}: ModerationPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Moderation</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Review flagged content and manage visibility</p>
      </div>

      {/* Moderation Queue */}
      <div>
        <h3 className="text-lg font-bold text-[var(--aurora-text)] mb-3">Flagged Content ({modQueue.length})</h3>
        {modQueue.length === 0 ? (
          <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-8 text-center">
            <AlertOctagon size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-[var(--aurora-text-secondary)]">No flagged content</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modQueue.map((item) => (
              <div key={item.id} className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm text-[var(--aurora-text)]">{item.content?.substring(0, 100)}</p>
                    <p className="text-xs text-[var(--aurora-text-secondary)]">Reason: {item.category || 'Unknown'}</p>
                  </div>
                  {item.reportCount && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{item.reportCount} reports</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onApproveItem(item.id)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200">
                    Approve
                  </button>
                  <button onClick={() => onRejectItem(item.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden Posts */}
      <div>
        <h3 className="text-lg font-bold text-[var(--aurora-text)] mb-3">Hidden Posts ({hiddenPosts.length})</h3>
        {hiddenPosts.length === 0 ? (
          <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-8 text-center">
            <p className="text-[var(--aurora-text-secondary)]">No hidden posts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hiddenPosts.map((post) => (
              <div key={post.id} className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--aurora-text)] truncate">{post.content?.substring(0, 50)}</span>
                <div className="flex gap-1">
                  <button onClick={() => onUnhidePost(post.id)} className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => onDeletePost(post.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
