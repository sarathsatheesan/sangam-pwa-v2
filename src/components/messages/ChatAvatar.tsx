import React from 'react';
import type { User } from '@/types/messages';
import { getPresenceDotColor } from '@/utils/messageHelpers';

/**
 * ChatAvatar Component
 * Displays user avatar with intelligent fallback:
 * 1. URL-based image (http/data URL)
 * 2. Emoji
 * 3. User initials on gradient background
 */
export function ChatAvatar({ user, size = 'md', showOnlineStatus = false }: { user?: User; size?: string; showOnlineStatus?: boolean }) {
  const sizeClasses: Record<string, string> = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-11 h-11',
    lg: 'w-12 h-12',
  };
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  if (!user) {
    return <div className={`${sizeClass} rounded-full`} style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />;
  }

  const isUrl = user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:'));
  const isEmoji = user.avatar && !isUrl;

  const avatarElement = isUrl ? (
    <img src={user.avatar} alt={user.name} className={`${sizeClass} rounded-full object-cover`} />
  ) : isEmoji ? (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-lg`} style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>{user.avatar}</div>
  ) : (
    <>
      {(() => {
        const initials = user.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const colors = ['#6366F1', '#818CF8', '#4F46E5', '#34B7F1', '#6366F1'];
        const colorIndex = user.id.charCodeAt(0) % colors.length;
        return (
          <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white`} style={{ backgroundColor: colors[colorIndex] }}>
            {initials}
          </div>
        );
      })()}
    </>
  );

  if (!showOnlineStatus) return <>{avatarElement}</>;

  const dotColor = getPresenceDotColor(user);

  return (
    <div className="relative flex-shrink-0">
      {avatarElement}
      {dotColor && (
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: dotColor }} />
      )}
    </div>
  );
}
