/**
 * SkeletonConversation Component
 * Loading skeleton for conversation list items
 */
export function SkeletonConversation() {
  return (
    <div className="px-4 py-3 animate-pulse flex items-center gap-3 border-b" style={{ borderColor: 'var(--msg-divider)' }}>
      <div className="w-12 h-12 rounded-full" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
      <div className="flex-1">
        <div className="h-4 w-28 rounded mb-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
        <div className="h-3 w-44 rounded" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
      </div>
    </div>
  );
}
