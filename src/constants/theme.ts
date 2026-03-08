// ══════════════════════════════════════════════════════════════
// SANGAM — Modern Aurora Design System (Light)
// ══════════════════════════════════════════════════════════════

export const Theme = {
  colors: {
    // ── Core Aurora Palette ──
    primary: '#6366F1',           // Electric Indigo
    primaryLight: '#818CF8',      // Indigo light (hover states)
    primaryDark: '#4F46E5',       // Indigo dark (pressed states)
    secondary: '#10B981',         // Soft Mint
    secondaryLight: '#34D399',    // Mint light
    tertiary: '#22D3EE',          // Aurora Cyan
    accent: '#6366F1',            // Alias for primary (backward compat)
    accentLight: '#818CF8',
    gradient: ['#6366F1', '#10B981'], // Indigo to Mint

    // ── Backgrounds ──
    background: '#F5F6FA',         // Soft cool gray — page base
    backgroundSecondary: '#FFFFFF', // White — cards, elevated
    backgroundTertiary: '#EDF0F7',  // Light blue-gray — inputs, hover

    // ── Text ──
    text: {
      primary: '#1E2132',          // Dark slate — headlines
      secondary: '#5B5E72',        // Medium gray — body text
      muted: '#9295A5',            // Light gray — captions
    },

    // ── Borders ──
    border: '#E2E5EF',
    borderLight: '#EDF0F7',
    borderGlass: '#D0D4E0',

    // ── Semantic ──
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#6366F1',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },

  borderRadius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 28,
    full: 9999,
  },

  fontSizes: {
    caption: 11,
    label: 12,
    bodySmall: 13,
    body: 14,
    bodyLarge: 16,
    subtitle: 16,
    title: 20,
    headline: 24,
    display: 32,
    // Legacy aliases
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
  },

  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.04)',
    xl: '0 16px 40px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.04)',
    glow: '0 4px 16px rgba(99, 102, 241, 0.2)',
    glowLg: '0 8px 24px rgba(99, 102, 241, 0.25)',
    mintGlow: '0 4px 16px rgba(16, 185, 129, 0.2)',
    card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  },

  transitions: {
    micro: '150ms',
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    aurora: '20s',
  },

  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export type ThemeType = typeof Theme;

// Re-export as default for backward compatibility
export default Theme;
