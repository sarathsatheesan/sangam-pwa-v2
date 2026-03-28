import React from 'react';
import {
  MapPin, UserPlus, Clock, Check, X, MessageCircle, Globe,
  MoreVertical, Ban,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  avatar: string;
  heritage: string | string[];
  city: string;
  profession: string;
  bio: string;
  interests: string[];
  createdAt?: any;
  updatedAt?: any;
  showLocation?: boolean;
}

interface PersonCardProps {
  person: User;
  variant: 'grid' | 'pymk-city' | 'pymk-heritage' | 'pymk-interests' | 'incoming' | 'sent';
  score?: number;
  status?: 'pending' | 'connected';
  isNew?: boolean;
  mutualCount?: number;
  searchQuery?: string;
  timestamp?: string;
  acceptAnimating?: boolean;
  connecting?: boolean;
  activeTab?: string;
  // Event handlers
  onClick?: () => void;
  onConnect?: (id: string) => void;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onBlock?: (id: string, name: string) => void;
  onMessage?: (id: string) => void;
  onMutualClick?: (id: string) => void;
  onMenuToggle?: (id: string | null) => void;
  openMenuId?: string | null;
  // Helpers
  renderAvatar?: (avatar: string | undefined, name: string, size?: 'sm' | 'md' | 'lg') => React.ReactNode;
  renderHeritage?: (person: User, size?: 'xs' | 'sm') => React.ReactNode;
  HighlightText?: React.FC<{ text: string; query: string; className?: string }>;
  MatchBadge?: React.FC<{ score: number; inline?: boolean }>;
  hasPhotoAvatar?: (avatar: string | undefined) => boolean;
  isNewMember?: (person: User) => boolean;
  formatRequestTime?: (timestamp: any) => string;
}

const VARIANT_CONFIG = {
  grid: {
    width: 'w-full',
    gradientHeader: 'from-green-500 to-emerald-400',
    badgeBg: 'bg-green-700',
    badgeText: 'text-green-700',
    borderColor: 'border-green-200 dark:border-green-500/30',
  },
  'pymk-city': {
    width: 'w-44 sm:w-52 flex-shrink-0',
    gradientHeader: 'from-blue-500 to-blue-400',
    badgeBg: 'bg-blue-700',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
  },
  'pymk-heritage': {
    width: 'w-44 sm:w-52 flex-shrink-0',
    gradientHeader: 'from-orange-500 to-amber-400',
    badgeBg: 'bg-orange-700',
    badgeText: 'text-orange-700',
    borderColor: 'border-orange-200 dark:border-orange-500/30',
  },
  'pymk-interests': {
    width: 'w-44 sm:w-52 flex-shrink-0',
    gradientHeader: 'from-purple-500 to-pink-400',
    badgeBg: 'bg-purple-700',
    badgeText: 'text-purple-700',
    borderColor: 'border-purple-200 dark:border-purple-500/30',
  },
  incoming: {
    width: 'w-full',
    gradientHeader: 'from-orange-400 to-amber-400',
    badgeBg: 'bg-orange-600',
    badgeText: 'text-orange-600',
    borderColor: 'border-orange-300 dark:border-orange-500/40',
  },
  sent: {
    width: 'w-full',
    gradientHeader: 'from-purple-500 to-blue-400',
    badgeBg: 'bg-purple-700',
    badgeText: 'text-purple-700',
    borderColor: 'border-purple-200 dark:border-purple-500/30',
  },
};

const BADGE_CONFIG = {
  grid: 'Discover',
  'pymk-city': 'Your City',
  'pymk-heritage': 'Heritage',
  'pymk-interests': 'Interests',
  incoming: 'Wants to connect',
  sent: 'Sent request',
};

const BADGE_ICONS = {
  grid: null,
  'pymk-city': MapPin,
  'pymk-heritage': Globe,
  'pymk-interests': UserPlus,
  incoming: UserPlus,
  sent: Clock,
};

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  variant,
  score = 0,
  status,
  isNew = false,
  mutualCount = 0,
  searchQuery = '',
  timestamp,
  acceptAnimating = false,
  connecting = false,
  activeTab = 'discover',
  onClick,
  onConnect,
  onAccept,
  onDecline,
  onBlock,
  onMessage,
  onMutualClick,
  onMenuToggle,
  openMenuId,
  renderAvatar = defaultRenderAvatar,
  renderHeritage = defaultRenderHeritage,
  HighlightText = DefaultHighlightText,
  MatchBadge = DefaultMatchBadge,
  hasPhotoAvatar = defaultHasPhotoAvatar,
  isNewMember = defaultIsNewMember,
  formatRequestTime = defaultFormatRequestTime,
}) => {
  const config = VARIANT_CONFIG[variant];
  const BadgeIcon = BADGE_ICONS[variant];
  const badgeText = BADGE_CONFIG[variant];

  const containerClasses = `${config.width} bg-aurora-surface rounded-2xl border ${config.borderColor} overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer relative`;

  const headerPx = variant === 'grid' ? 'px-2' : 'px-3';
  const headerPy = variant === 'grid' ? 'py-1.5' : 'py-2';
  const avatarSize = variant === 'grid' || variant === 'sent' ? 'w-11 h-11' : 'w-12 h-12';
  const avatarSizeParam = variant === 'grid' ? 'sm' : variant === 'incoming' ? 'md' : 'sm';
  const fontSize = variant === 'grid' ? 'text-xs' : 'text-sm';
  const profFontSize = variant === 'grid' ? 'text-[10px]' : 'text-xs';

  const isIncomingAnimating = variant === 'incoming' && acceptAnimating;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View profile of ${person.name}${person.profession ? `, ${person.profession}` : ''}`}
      className={`${containerClasses} ${isIncomingAnimating ? 'border-green-400 dark:border-green-500/60 scale-[1.02]' : ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      onTouchStart={() => {}}
    >
      {/* Accept animation overlay */}
      {isIncomingAnimating && (
        <div className="absolute inset-0 bg-green-500/10 z-10 flex items-center justify-center rounded-2xl animate-pulse">
          <div className="bg-green-500 text-white rounded-full p-3 shadow-lg animate-bounce">
            <Check className="w-6 h-6" />
          </div>
        </div>
      )}

      {/* Header with gradient and badge */}
      <div className={`bg-gradient-to-r ${config.gradientHeader} ${headerPx} ${headerPy} flex items-center ${variant === 'grid' ? 'justify-between' : 'gap-2'}`}>
        {variant === 'grid' && isNew && (
          <span className="bg-green-700 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none">NEW</span>
        )}
        <div className={`${config.badgeBg} text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${variant === 'grid' ? 'ml-auto' : ''}`}>
          {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
          {badgeText}
        </div>
        {variant === 'grid' && score >= 40 && (
          <div className="flex items-center gap-1">
            <MatchBadge score={score} inline />
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuToggle?.(openMenuId === person.id ? null : person.id);
                }}
                className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Options menu"
              >
                <MoreVertical className="w-3.5 h-3.5 text-white/80" />
              </button>
              {openMenuId === person.id && (
                <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[120px] z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock?.(person.id, person.name);
                      onMenuToggle?.(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Ban className="w-3 h-3" /> Block
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1" style={{ minHeight: 0 }}>
        {/* Avatar + Name/Title */}
        <div className={`flex items-center gap-${variant === 'grid' ? '2.5' : '3'} ${variant === 'grid' ? 'mb-2' : 'mb-3'}`}>
          <div className={`${avatarSize} rounded-full flex items-center justify-center font-bold text-lg border-2 shrink-0 shadow-sm ${
            hasPhotoAvatar(person.avatar)
              ? variant === 'grid'
                ? 'ring-2 ring-green-400/50 ring-offset-1'
                : 'border-white/50'
              : variant === 'grid'
              ? 'bg-blue-500 text-white'
              : variant === 'pymk-city'
              ? 'bg-blue-500 text-white border-blue-300'
              : variant === 'pymk-heritage'
              ? 'bg-orange-500 text-white border-orange-300'
              : variant === 'pymk-interests'
              ? 'bg-purple-500 text-white border-purple-300'
              : variant === 'incoming'
              ? 'bg-orange-500 text-white border-orange-300'
              : 'bg-purple-500 text-white border-purple-300'
          }`}>
            {renderAvatar(person.avatar, person.name, avatarSizeParam)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`${fontSize} font-bold text-[var(--aurora-text)] truncate leading-tight`}>
              <HighlightText text={person.name} query={searchQuery} />
            </h4>
            {person.profession && (
              <p className={`${profFontSize} text-[var(--aurora-text-secondary)] truncate`}>
                <HighlightText text={person.profession} query={searchQuery} />
              </p>
            )}
          </div>
        </div>

        {/* Heritage, location, mutual */}
        <div className="space-y-0.5">
          {renderHeritage(person)}
          {person.showLocation && (
            <p className={`${variant === 'grid' ? 'text-[10px]' : 'text-xs'} text-[var(--aurora-text-muted)] flex items-center gap-0.5 truncate`}>
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <HighlightText text={person.city} query={searchQuery} />
            </p>
          )}
          {mutualCount > 0 && variant !== 'sent' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMutualClick?.(person.id);
              }}
              className={`${variant === 'grid' ? 'text-[10px]' : 'text-xs'} text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer transition-colors text-left`}
            >
              {mutualCount} mutual
            </button>
          )}
          {variant === 'grid' && timestamp && (
            <p className="text-[9px] text-[var(--aurora-text-muted)] flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 shrink-0" /> {timestamp}
            </p>
          )}
        </div>

        {/* Action button(s) */}
        <div className="mt-auto pt-2.5">
          {variant === 'grid' && activeTab === 'pending' ? (
            <div className="flex gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept?.(person.id);
                }}
                disabled={connecting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Check className="w-3 h-3" /> Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline?.(person.id);
                }}
                disabled={connecting}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" /> Decline
              </button>
            </div>
          ) : variant === 'incoming' ? (
            <div className="flex gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept?.(person.id);
                }}
                disabled={connecting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline?.(person.id);
                }}
                disabled={connecting}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Decline
              </button>
            </div>
          ) : variant === 'sent' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect?.(person.id);
              }}
              disabled={connecting}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" /> Pending
            </button>
          ) : status === 'connected' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMessage?.(person.id);
              }}
              className={`w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium ${variant === 'grid' ? 'text-[10px]' : 'text-xs'} flex items-center justify-center gap-1`}
            >
              <MessageCircle className="w-3 h-3" /> Message
            </button>
          ) : status === 'pending' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect?.(person.id);
              }}
              disabled={connecting}
              className={`w-full bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium ${variant === 'grid' ? 'text-[10px]' : 'text-xs'} disabled:opacity-50 flex items-center justify-center gap-1`}
            >
              <Clock className="w-3 h-3" /> Pending
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect?.(person.id);
              }}
              disabled={connecting}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium ${variant === 'grid' ? 'text-[10px]' : 'text-xs'} disabled:opacity-50 flex items-center justify-center gap-1`}
            >
              <UserPlus className="w-3 h-3" /> Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Default implementations of helper functions
function defaultRenderAvatar(avatar: string | undefined, name: string, size: 'sm' | 'md' | 'lg' = 'sm'): React.ReactNode {
  const isPhoto = avatar && (avatar.startsWith('http') || avatar.startsWith('data:'));
  if (isPhoto) {
    return <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" loading="lazy" />;
  }
  if (avatar && /\p{Emoji}/u.test(avatar)) {
    const emojiSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';
    return <span className={emojiSize}>{avatar}</span>;
  }
  const textSize = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm';
  return <span className={`${textSize} font-bold`}>{name.charAt(0).toUpperCase() || '👤'}</span>;
}

function defaultHasPhotoAvatar(avatar: string | undefined): boolean {
  return !!(avatar && (avatar.startsWith('http') || avatar.startsWith('data:')));
}

function defaultRenderHeritage(person: User, size: 'xs' | 'sm' = 'xs'): React.ReactNode {
  const raw = Array.isArray(person.heritage) ? person.heritage : [person.heritage];
  const display = raw.filter((h) => h && h !== 'Prefer Not to Say' && h !== 'Other');
  if (display.length === 0) return null;
  const textSizeClass = size === 'sm' ? 'text-sm' : 'text-xs';
  return (
    <p className={`${textSizeClass} text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5`}>
      <Globe className="w-3 h-3 shrink-0" /> <span className="truncate">{display.join(', ')}</span>
    </p>
  );
}

function DefaultHighlightText({ text, query, className = '' }: { text: string; query: string; className?: string }): React.ReactNode {
  if (!query.trim() || !text) return <span className={className}>{text}</span>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

function DefaultMatchBadge({ score, inline = false }: { score: number; inline?: boolean }): React.ReactNode {
  if (score < 40) return null;
  const color = score >= 75 ? 'from-green-400 to-emerald-500' : 'from-blue-400 to-cyan-500';
  return (
    <div className={`${inline ? '' : 'absolute top-3 right-3'} bg-gradient-to-r ${color} text-white text-xs font-bold px-2 py-1 rounded-full`}>
      {score}%
    </div>
  );
}

function defaultIsNewMember(person: User): boolean {
  if (!person.createdAt) return false;
  const created = person.createdAt?.toDate ? person.createdAt.toDate() : new Date(person.createdAt);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  return created > fourteenDaysAgo;
}

function defaultFormatRequestTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
