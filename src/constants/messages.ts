import React from 'react';

// ===== REGEX PATTERNS =====

export const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// ===== WALLPAPER PRESETS =====

/**
 * Wallpaper presets for chat background customization
 * Each preset includes a label and CSS styling
 */
export const WALLPAPER_PRESETS = {
  default: {
    label: 'Aurora',
    description: 'Subtle aurora indigo pattern',
    style: {
      backgroundColor: 'var(--msg-own-bubble-hover)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3E.d%7Bfill:%236366F1;opacity:0.06%7D%3C/style%3E%3C/defs%3E%3Ccircle class='d' cx='20' cy='30' r='3'/%3E%3Crect class='d' x='60' y='15' width='8' height='10' rx='2'/%3E%3Ccircle class='d' cx='110' cy='25' r='4'/%3E%3Crect class='d' x='155' y='20' width='6' height='8' rx='1'/%3E%3Ccircle class='d' cx='40' cy='80' r='3.5'/%3E%3Crect class='d' x='90' y='70' width='10' height='6' rx='2'/%3E%3Ccircle class='d' cx='140' cy='85' r='3'/%3E%3Crect class='d' x='175' y='75' width='7' height='9' rx='1.5'/%3E%3Ccircle class='d' cx='25' cy='140' r='4'/%3E%3Crect class='d' x='70' y='130' width='9' height='7' rx='2'/%3E%3Ccircle class='d' cx='120' cy='145' r='3'/%3E%3Crect class='d' x='165' y='135' width='8' height='6' rx='1'/%3E%3Ccircle class='d' cx='50' cy='185' r='3'/%3E%3Crect class='d' x='100' y='180' width='7' height='9' rx='2'/%3E%3Ccircle class='d' cx='150' cy='175' r='4'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
  gradient_blue: {
    label: 'Ocean',
    description: 'Cool blue gradient',
    style: {
      backgroundImage: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.08) 50%, rgba(139,92,246,0.05) 100%)',
    } as React.CSSProperties,
  },
  gradient_sunset: {
    label: 'Sunset',
    description: 'Warm sunset gradient',
    style: {
      backgroundImage: 'linear-gradient(135deg, rgba(251,146,60,0.05) 0%, rgba(244,63,94,0.08) 50%, rgba(168,85,247,0.05) 100%)',
    } as React.CSSProperties,
  },
  dark_minimal: {
    label: 'Minimal',
    description: 'Dark minimal style',
    style: { backgroundColor: 'var(--aurora-bg)' } as React.CSSProperties,
  },
  teal: {
    label: 'Indigo Dark',
    description: 'Deep indigo night',
    style: {
      backgroundColor: 'var(--aurora-bg)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3E.d%7Bfill:%23ffffff;opacity:0.03%7D%3C/style%3E%3C/defs%3E%3Ccircle class='d' cx='20' cy='30' r='3'/%3E%3Crect class='d' x='60' y='15' width='8' height='10' rx='2'/%3E%3Ccircle class='d' cx='110' cy='25' r='4'/%3E%3Ccircle class='d' cx='40' cy='80' r='3.5'/%3E%3Crect class='d' x='90' y='70' width='10' height='6' rx='2'/%3E%3Ccircle class='d' cx='140' cy='85' r='3'/%3E%3Ccircle class='d' cx='25' cy='140' r='4'/%3E%3Crect class='d' x='70' y='130' width='9' height='7' rx='2'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
  geometric: {
    label: 'Geo',
    description: 'Geometric pattern',
    style: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30Z' fill='none' stroke='%2363668808' stroke-width='0.5'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
};

// ===== EMOJI CATEGORIES =====

/**
 * Emoji picker categories with curated emoji selections
 */
export const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Recent': [],
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏'],
  'People': ['👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️','👩‍🦳','🧑‍🦳','👨‍🦳','👩‍🦲','🧑‍🦲','👨‍🦲','🧔‍♀️','🧔','🧔‍♂️','👵','🧓','👴','👲','👳‍♀️','👳','👳‍♂️','🧕','👮‍♀️','👮','👮‍♂️','👷‍♀️','👷','👷‍♂️'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🦂','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'],
  'Food': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🍕','🍔','🌮','🍩','🍰','🍪','☕','🍵','🥤'],
  'Activities': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🎱','🏓','🏸','🏒','🎳','🎯','🎮','🎲','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🧘'],
  'Travel': ['🚗','🚕','🚙','🚌','🚎','🚓','🚑','🚒','🚐','🚚','🚛','🏎️','✈️','🚀','🚁','🛳️','🚢','⛵','🚤','🚂','🚆','🚇','🚞','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🗼','⛪','🕌'],
  'Objects': ['🎉','🎊','🎈','🎁','🏆','⭐','🌟','💫','✨','🔥','💯','🎯','💡','📱','💻','📸','🎵','🎶','☕','🧩','🎮','📚','🖼️','🎨','🎭'],
  'Symbols': ['❤️','💔','💕','💞','💓','💗','💖','💘','💝','💟','✔️','❌','⭕','✨','⚡','💥','🔔','📢','📣','🎺','🎸','🎹','🎤','🎧','📻'],
  'Flags': ['🏳️','🏴','🏁','🚩','🏳️‍🌈','🇺🇸','🇬🇧','🇮🇳','🇨🇦','🇦🇺','🇫🇷','🇩🇪','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇲🇽','🇮🇹','🇪🇸','🇷🇺','🇿🇦','🇳🇬','🇰🇪'],
};

// ===== QUICK REPLIES =====

/**
 * Quick reply suggestions for fast message composition
 */
export const QUICK_REPLIES = ['Got it!', 'Thanks!', 'Sure!', 'OK', 'Nice!', 'See you!'];

// ===== MESSAGE CONFIG =====

/**
 * Configuration constants for message behavior
 */
export const MESSAGE_CONFIG = {
  TYPING_DEBOUNCE_MS: 3000,
  MESSAGE_EDIT_WINDOW_MS: 15 * 60 * 1000,
  UNDO_TOAST_DURATION_MS: 5000,
  MAX_MESSAGE_LENGTH: 5000,
  PAGINATION_SIZE: 50,
} as const;

// ===== PRESENCE CONSTANTS =====

/**
 * Presence system constants
 * HEARTBEAT_INTERVAL: How often to write "I'm still here" to Firestore (60s)
 * AWAY_TIMEOUT: How long after tab blur before marking as "away" (5 min)
 * OFFLINE_THRESHOLD: If lastSeen is older than this, consider user offline (2.5 min)
 */
export const PRESENCE_HEARTBEAT_INTERVAL = 60_000;
export const PRESENCE_AWAY_TIMEOUT = 5 * 60_000;
export const PRESENCE_OFFLINE_THRESHOLD = 2.5 * 60_000;

// ===== DISAPPEARING MESSAGES =====

/**
 * Disappearing message timer presets (in milliseconds).
 * Used for conversation-level default and per-message override.
 */
export const DISAPPEARING_TIMER_OPTIONS: { label: string; value: number }[] = [
  { label: '30 seconds', value: 30_000 },
  { label: '5 minutes', value: 5 * 60_000 },
  { label: '1 hour', value: 60 * 60_000 },
  { label: '24 hours', value: 24 * 60 * 60_000 },
  { label: '7 days', value: 7 * 24 * 60 * 60_000 },
];

// ===== MESSAGE REPORTING =====

export const MESSAGE_REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or Misleading', icon: '🚫', description: 'Unwanted promotional, repetitive, or misleading content' },
  { id: 'harassment', label: 'Harassment or Bullying', icon: '🛑', description: 'Threatening, abusive, or intimidating messages' },
  { id: 'hate_speech', label: 'Hate Speech', icon: '⚠️', description: 'Content targeting race, ethnicity, religion, gender, or identity' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: '🔞', description: 'Sexual, violent, or graphic content not suitable for the community' },
  { id: 'scam', label: 'Scam or Fraud', icon: '🎣', description: 'Phishing, financial fraud, or deceptive schemes' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Something else that violates community guidelines' },
];
