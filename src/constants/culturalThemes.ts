import { ETHNICITY_HIERARCHY, ETHNICITY_CHILDREN } from './config';

export interface CulturalTheme {
  id: string;
  name: string;
  description: string;
  // Color palette
  colors: {
    primary: string;       // Main accent color (hex)
    secondary: string;     // Secondary accent (hex)
    accent: string;        // Highlight color (hex)
    gradientFrom: string;  // Gradient start
    gradientVia: string;   // Gradient middle
    gradientTo: string;    // Gradient end
    cardBg: string;        // Card background with opacity (rgba or tailwind)
    cardBorder: string;    // Card border color
    textPrimary: string;   // Primary text color for themed elements
    textSecondary: string; // Secondary text for themed elements
  };
  // Tailwind class strings for direct application
  classes: {
    pageBg: string;        // Page background gradient (inline style format)
    cardGlass: string;     // Glassmorphism card style
    activeTab: string;     // Active sort tab gradient
    composerBg: string;    // Create post composer gradient accent
    searchBg: string;      // Search section background gradient
    accentButton: string;  // Primary action button gradient
    badge: string;         // Heritage/type badges
  };
  // SVG pattern configuration
  pattern: {
    id: string;            // Pattern component identifier
    opacity: number;       // Pattern overlay opacity (0.03-0.06)
    color: string;         // Pattern stroke/fill color
  };
}

// Theme definitions indexed by id
const THEME_DEFINITIONS: Record<string, CulturalTheme> = {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    description: 'Default aurora indigo and emerald theme',
    colors: {
      primary: '#818CF8',     // indigo-500
      secondary: '#10B981',   // emerald-500
      accent: '#06B6D4',      // cyan-500
      gradientFrom: '#818CF8',
      gradientVia: '#06B6D4',
      gradientTo: '#10B981',
      cardBg: 'rgba(129, 140, 248, 0.08)',
      cardBorder: '#818CF8',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #818CF8 0%, #06B6D4 50%, #10B981 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-white/20',
      activeTab: 'bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500',
      composerBg: 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20',
      searchBg: 'bg-gradient-to-r from-cyan-500/10 to-emerald-500/10',
      accentButton: 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600',
      badge: 'bg-indigo-100 text-indigo-800',
    },
    pattern: {
      id: 'neutral_pattern',
      opacity: 0.04,
      color: '#818CF8',
    },
  },

  south_asian: {
    id: 'south_asian',
    name: 'South Asian',
    description: 'Warm saffron, maroon, and gold inspired by rangoli and temple art',
    colors: {
      primary: '#FF6B00',     // Deep orange
      secondary: '#800020',   // Maroon
      accent: '#FFD700',      // Gold
      gradientFrom: '#FF6B00',
      gradientVia: '#FFD700',
      gradientTo: '#800020',
      cardBg: 'rgba(255, 107, 0, 0.08)',
      cardBorder: '#FF6B00',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #FF6B00 0%, #FFD700 50%, #800020 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-orange-400/30',
      activeTab: 'bg-gradient-to-r from-orange-600 via-yellow-500 to-red-900',
      composerBg: 'bg-gradient-to-r from-orange-600/20 to-yellow-500/20',
      searchBg: 'bg-gradient-to-r from-yellow-500/10 to-red-900/10',
      accentButton: 'bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-700 hover:to-yellow-600',
      badge: 'bg-orange-100 text-orange-800',
    },
    pattern: {
      id: 'rangoli_pattern',
      opacity: 0.05,
      color: '#FF6B00',
    },
  },

  east_asian: {
    id: 'east_asian',
    name: 'East Asian',
    description: 'Ink wash, zen minimalism with cherry blossom and jade accents',
    colors: {
      primary: '#2D3047',     // Muted indigo
      secondary: '#FFB7C5',   // Cherry blossom pink
      accent: '#00A86B',      // Jade
      gradientFrom: '#2D3047',
      gradientVia: '#FFB7C5',
      gradientTo: '#00A86B',
      cardBg: 'rgba(45, 48, 71, 0.08)',
      cardBorder: '#2D3047',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #2D3047 0%, #FFB7C5 50%, #00A86B 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-pink-300/30',
      activeTab: 'bg-gradient-to-r from-slate-700 via-pink-300 to-emerald-500',
      composerBg: 'bg-gradient-to-r from-slate-700/20 to-pink-300/20',
      searchBg: 'bg-gradient-to-r from-pink-300/10 to-emerald-500/10',
      accentButton: 'bg-gradient-to-r from-slate-700 to-pink-300 hover:from-slate-800 hover:to-pink-400',
      badge: 'bg-pink-100 text-pink-800',
    },
    pattern: {
      id: 'inkwash_pattern',
      opacity: 0.04,
      color: '#2D3047',
    },
  },

  southeast_asian: {
    id: 'southeast_asian',
    name: 'Southeast Asian',
    description: 'Tropical batik vibrancy with teal, gold, and temple red',
    colors: {
      primary: '#008080',     // Teal
      secondary: '#FFD700',   // Golden yellow
      accent: '#C41E3A',      // Temple red
      gradientFrom: '#008080',
      gradientVia: '#FFD700',
      gradientTo: '#C41E3A',
      cardBg: 'rgba(0, 128, 128, 0.08)',
      cardBorder: '#008080',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #008080 0%, #FFD700 50%, #C41E3A 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-teal-400/30',
      activeTab: 'bg-gradient-to-r from-teal-600 via-yellow-500 to-red-700',
      composerBg: 'bg-gradient-to-r from-teal-600/20 to-yellow-500/20',
      searchBg: 'bg-gradient-to-r from-yellow-500/10 to-red-700/10',
      accentButton: 'bg-gradient-to-r from-teal-600 to-yellow-500 hover:from-teal-700 hover:to-yellow-600',
      badge: 'bg-teal-100 text-teal-800',
    },
    pattern: {
      id: 'batik_pattern',
      opacity: 0.05,
      color: '#008080',
    },
  },

  central_asian: {
    id: 'central_asian',
    name: 'Central Asian',
    description: 'Silk road nomadic heritage with azure and amber',
    colors: {
      primary: '#007FFF',     // Azure blue
      secondary: '#FFBF00',   // Amber
      accent: '#FFFFF0',      // Ivory
      gradientFrom: '#007FFF',
      gradientVia: '#FFBF00',
      gradientTo: '#E8D5C4',
      cardBg: 'rgba(0, 127, 255, 0.08)',
      cardBorder: '#007FFF',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #007FFF 0%, #FFBF00 50%, #E8D5C4 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-blue-400/30',
      activeTab: 'bg-gradient-to-r from-blue-600 via-amber-400 to-amber-100',
      composerBg: 'bg-gradient-to-r from-blue-600/20 to-amber-400/20',
      searchBg: 'bg-gradient-to-r from-amber-400/10 to-amber-100/10',
      accentButton: 'bg-gradient-to-r from-blue-600 to-amber-400 hover:from-blue-700 hover:to-amber-500',
      badge: 'bg-blue-100 text-blue-800',
    },
    pattern: {
      id: 'silkroad_pattern',
      opacity: 0.05,
      color: '#007FFF',
    },
  },

  hispanic_latino: {
    id: 'hispanic_latino',
    name: 'Hispanic & Latino',
    description: 'Warm fiesta tones with terracotta, turquoise, and marigold',
    colors: {
      primary: '#E2725B',     // Terracotta
      secondary: '#40E0D0',   // Turquoise
      accent: '#EAA221',      // Golden marigold
      gradientFrom: '#E2725B',
      gradientVia: '#EAA221',
      gradientTo: '#40E0D0',
      cardBg: 'rgba(226, 114, 91, 0.08)',
      cardBorder: '#E2725B',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #E2725B 0%, #EAA221 50%, #40E0D0 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-orange-400/30',
      activeTab: 'bg-gradient-to-r from-red-500 via-yellow-400 to-cyan-400',
      composerBg: 'bg-gradient-to-r from-red-500/20 to-yellow-400/20',
      searchBg: 'bg-gradient-to-r from-yellow-400/10 to-cyan-400/10',
      accentButton: 'bg-gradient-to-r from-red-500 to-yellow-400 hover:from-red-600 hover:to-yellow-500',
      badge: 'bg-orange-100 text-orange-800',
    },
    pattern: {
      id: 'fiesta_pattern',
      opacity: 0.05,
      color: '#E2725B',
    },
  },

  european: {
    id: 'european',
    name: 'European',
    description: 'Classic elegance with navy, gold, and ivory',
    colors: {
      primary: '#1B365D',     // Navy
      secondary: '#C9A84C',   // Gold
      accent: '#FFFFF0',      // Ivory
      gradientFrom: '#1B365D',
      gradientVia: '#C9A84C',
      gradientTo: '#FFFFF0',
      cardBg: 'rgba(27, 54, 93, 0.08)',
      cardBorder: '#1B365D',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #1B365D 0%, #C9A84C 50%, #FFFFF0 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-yellow-600/30',
      activeTab: 'bg-gradient-to-r from-blue-900 via-yellow-600 to-yellow-50',
      composerBg: 'bg-gradient-to-r from-blue-900/20 to-yellow-600/20',
      searchBg: 'bg-gradient-to-r from-yellow-600/10 to-yellow-50/10',
      accentButton: 'bg-gradient-to-r from-blue-900 to-yellow-600 hover:from-blue-950 hover:to-yellow-700',
      badge: 'bg-yellow-100 text-yellow-800',
    },
    pattern: {
      id: 'classic_pattern',
      opacity: 0.04,
      color: '#1B365D',
    },
  },

  african: {
    id: 'african',
    name: 'African',
    description: 'Kente cloth and bold patterns with deep green, gold, and red',
    colors: {
      primary: '#006B3F',     // Deep green
      secondary: '#FFD700',   // Rich gold
      accent: '#C41E3A',      // Kente red
      gradientFrom: '#006B3F',
      gradientVia: '#FFD700',
      gradientTo: '#C41E3A',
      cardBg: 'rgba(0, 107, 63, 0.08)',
      cardBorder: '#006B3F',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #006B3F 0%, #FFD700 50%, #C41E3A 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-green-500/30',
      activeTab: 'bg-gradient-to-r from-green-700 via-yellow-500 to-red-700',
      composerBg: 'bg-gradient-to-r from-green-700/20 to-yellow-500/20',
      searchBg: 'bg-gradient-to-r from-yellow-500/10 to-red-700/10',
      accentButton: 'bg-gradient-to-r from-green-700 to-yellow-500 hover:from-green-800 hover:to-yellow-600',
      badge: 'bg-green-100 text-green-800',
    },
    pattern: {
      id: 'kente_pattern',
      opacity: 0.05,
      color: '#006B3F',
    },
  },

  middle_eastern: {
    id: 'middle_eastern',
    name: 'Middle Eastern',
    description: 'Arabesque and geometric patterns with deep teal, gold, and purple',
    colors: {
      primary: '#005F6B',     // Deep teal
      secondary: '#C49B3E',   // Gold
      accent: '#4A0080',      // Royal purple
      gradientFrom: '#005F6B',
      gradientVia: '#C49B3E',
      gradientTo: '#4A0080',
      cardBg: 'rgba(0, 95, 107, 0.08)',
      cardBorder: '#005F6B',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #005F6B 0%, #C49B3E 50%, #4A0080 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-teal-600/30',
      activeTab: 'bg-gradient-to-r from-teal-900 via-yellow-600 to-purple-900',
      composerBg: 'bg-gradient-to-r from-teal-900/20 to-yellow-600/20',
      searchBg: 'bg-gradient-to-r from-yellow-600/10 to-purple-900/10',
      accentButton: 'bg-gradient-to-r from-teal-900 to-yellow-600 hover:from-teal-950 hover:to-yellow-700',
      badge: 'bg-teal-100 text-teal-800',
    },
    pattern: {
      id: 'arabesque_pattern',
      opacity: 0.05,
      color: '#005F6B',
    },
  },

  oceanian: {
    id: 'oceanian',
    name: 'Oceanian & Pacific Islander',
    description: 'Ocean and island vibes with deep blue, coral, and palm green',
    colors: {
      primary: '#006994',     // Ocean blue
      secondary: '#FF6F61',   // Coral
      accent: '#228B22',      // Palm green
      gradientFrom: '#006994',
      gradientVia: '#FF6F61',
      gradientTo: '#228B22',
      cardBg: 'rgba(0, 105, 148, 0.08)',
      cardBorder: '#006994',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #006994 0%, #FF6F61 50%, #228B22 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-blue-500/30',
      activeTab: 'bg-gradient-to-r from-blue-800 via-red-400 to-green-700',
      composerBg: 'bg-gradient-to-r from-blue-800/20 to-red-400/20',
      searchBg: 'bg-gradient-to-r from-red-400/10 to-green-700/10',
      accentButton: 'bg-gradient-to-r from-blue-800 to-red-400 hover:from-blue-900 hover:to-red-500',
      badge: 'bg-blue-100 text-blue-800',
    },
    pattern: {
      id: 'ocean_pattern',
      opacity: 0.05,
      color: '#006994',
    },
  },

  indigenous: {
    id: 'indigenous',
    name: 'Indigenous & Native People',
    description: 'Earth and nature with earthy red, turquoise, and forest green',
    colors: {
      primary: '#8B4513',     // Earth red
      secondary: '#48D1CC',   // Turquoise
      accent: '#228B22',      // Forest green
      gradientFrom: '#8B4513',
      gradientVia: '#48D1CC',
      gradientTo: '#228B22',
      cardBg: 'rgba(139, 69, 19, 0.08)',
      cardBorder: '#8B4513',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
    },
    classes: {
      pageBg: 'linear-gradient(135deg, #8B4513 0%, #48D1CC 50%, #228B22 100%)',
      cardGlass: 'backdrop-blur-md bg-white/10 border border-orange-700/30',
      activeTab: 'bg-gradient-to-r from-orange-900 via-cyan-400 to-green-700',
      composerBg: 'bg-gradient-to-r from-orange-900/20 to-cyan-400/20',
      searchBg: 'bg-gradient-to-r from-cyan-400/10 to-green-700/10',
      accentButton: 'bg-gradient-to-r from-orange-900 to-cyan-400 hover:from-orange-950 hover:to-cyan-500',
      badge: 'bg-orange-100 text-orange-800',
    },
    pattern: {
      id: 'earth_pattern',
      opacity: 0.05,
      color: '#8B4513',
    },
  },
};

/**
 * Resolves the appropriate cultural theme based on user's heritage selection.
 *
 * Logic:
 * - Empty/null heritage → neutral
 * - Resolves each heritage item to its theme (checking both ethnicities AND
 *   ETHNICITY_CHILDREN like Indian states)
 * - If ALL items resolve to the SAME theme → apply that theme
 * - If items resolve to DIFFERENT themes → neutral (multicultural)
 *
 * This means ['Kerala', 'Tamil Nadu'] → both under Indian → south_asian (same theme).
 * But ['Kerala', 'Chinese'] → south_asian + east_asian → neutral (different themes).
 */
export function resolveThemeForUser(heritage: string | string[] | null | undefined): CulturalTheme {
  // Handle empty/null heritage
  if (!heritage || (Array.isArray(heritage) && heritage.length === 0)) {
    return THEME_DEFINITIONS.neutral;
  }

  // Normalize to array
  const heritageArray = Array.isArray(heritage) ? heritage : [heritage];

  if (heritageArray.length === 0 || !heritageArray[0]) {
    return THEME_DEFINITIONS.neutral;
  }

  // Resolve each heritage item to a theme ID
  const themeIds = new Set<string>();

  for (const item of heritageArray) {
    const themeId = resolveHeritageItemToThemeId(item);
    if (themeId) {
      themeIds.add(themeId);
    }
  }

  // If all items resolve to the same single theme, use it
  if (themeIds.size === 1) {
    const id = [...themeIds][0];
    return THEME_DEFINITIONS[id] || THEME_DEFINITIONS.neutral;
  }

  // Multiple different themes or no match → neutral
  return THEME_DEFINITIONS.neutral;
}

/**
 * Resolves a single heritage item (ethnicity name OR child like a state name)
 * to a theme ID string.
 */
function resolveHeritageItemToThemeId(item: string): string | null {
  // First: check if it's directly in a subregion's ethnicities
  for (const region of ETHNICITY_HIERARCHY) {
    for (const subregion of region.subregions) {
      if (subregion.ethnicities.includes(item)) {
        return mapSubregionToThemeId(region.region, subregion.name);
      }
    }
  }

  // Second: check if it's a child value (e.g., 'Kerala' under 'Indian')
  for (const [parentEthnicity, children] of Object.entries(ETHNICITY_CHILDREN)) {
    if (children.includes(item)) {
      // Find which subregion the parent belongs to
      for (const region of ETHNICITY_HIERARCHY) {
        for (const subregion of region.subregions) {
          if (subregion.ethnicities.includes(parentEthnicity)) {
            return mapSubregionToThemeId(region.region, subregion.name);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Maps a subregion (and its parent region) to a theme ID
 */
function mapSubregionToThemeId(region: string, subregion: string): string {
  switch (region) {
    case 'Asian':
      if (subregion === 'South Asian') return 'south_asian';
      if (subregion === 'East Asian') return 'east_asian';
      if (subregion === 'Southeast Asian') return 'southeast_asian';
      if (subregion === 'Central Asian') return 'central_asian';
      break;

    case 'Hispanic or Latino':
      // All Hispanic/Latino subregions map to same theme
      return 'hispanic_latino';

    case 'European':
      // All European subregions map to same theme
      return 'european';

    case 'African':
      // All African subregions map to same theme
      return 'african';

    case 'Middle Eastern':
      // All Middle Eastern subregions map to same theme
      return 'middle_eastern';

    case 'Oceanian / Pacific Islander':
      // All Oceanian subregions map to same theme
      return 'oceanian';

    case 'Indigenous & Native People':
      // All Indigenous subregions map to same theme
      return 'indigenous';

    case 'Multiracial & Other':
    case 'Prefer Not to Say':
      return 'neutral';
  }

  return 'neutral';
}

/**
 * Get all available themes
 */
export function getAllThemes(): CulturalTheme[] {
  return Object.values(THEME_DEFINITIONS);
}

/**
 * Get a theme by ID
 */
export function getThemeById(id: string): CulturalTheme {
  return THEME_DEFINITIONS[id] || THEME_DEFINITIONS.neutral;
}
