import React from 'react';
import type { CulturalTheme } from '../constants/culturalThemes';

export interface PatternProps {
  color?: string;
  opacity?: number;
  className?: string;
}

// South Asian Rangoli Pattern
export const RangoliPattern: React.FC<PatternProps> = ({
  color = '#FF6B00',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="rangoli" patternUnits="userSpaceOnUse" width="120" height="120">
          {/* Concentric circles - mandala center */}
          <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
          <circle cx="60" cy="60" r="40" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
          <circle cx="60" cy="60" r="30" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6" />
          <circle cx="60" cy="60" r="20" fill="none" stroke={color} strokeWidth="0.5" opacity="0.7" />

          {/* Petal shapes around circles */}
          <path d="M 60 20 Q 70 30 60 40 Q 50 30 60 20" fill={color} opacity="0.3" />
          <path d="M 100 60 Q 90 70 80 60 Q 90 50 100 60" fill={color} opacity="0.3" />
          <path d="M 60 100 Q 50 90 60 80 Q 70 90 60 100" fill={color} opacity="0.3" />
          <path d="M 20 60 Q 30 50 40 60 Q 30 70 20 60" fill={color} opacity="0.3" />

          {/* Decorative dots */}
          <circle cx="60" cy="60" r="2" fill={color} opacity="0.7" />
          <circle cx="60" cy="30" r="1.5" fill={color} opacity="0.5" />
          <circle cx="90" cy="60" r="1.5" fill={color} opacity="0.5" />
          <circle cx="60" cy="90" r="1.5" fill={color} opacity="0.5" />
          <circle cx="30" cy="60" r="1.5" fill={color} opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rangoli)" />
    </svg>
  </div>
);

// East Asian Ink Wash Pattern
export const InkWashPattern: React.FC<PatternProps> = ({
  color = '#2D3047',
  opacity = 0.04,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="inkwash" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Flowing brushstroke waves */}
          <path
            d="M 0 40 Q 25 20 50 40 T 100 40"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            opacity="0.3"
          />
          <path
            d="M 0 60 Q 25 80 50 60 T 100 60"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            opacity="0.25"
          />

          {/* Cherry blossom circles */}
          <circle cx="25" cy="25" r="6" fill={color} opacity="0.2" />
          <circle cx="75" cy="75" r="5" fill={color} opacity="0.15" />

          {/* Bamboo-line verticals */}
          <line x1="20" y1="0" x2="20" y2="100" stroke={color} strokeWidth="0.8" opacity="0.2" />
          <line x1="80" y1="0" x2="80" y2="100" stroke={color} strokeWidth="0.8" opacity="0.15" />

          {/* Accent dots */}
          <circle cx="50" cy="50" r="1" fill={color} opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#inkwash)" />
    </svg>
  </div>
);

// Southeast Asian Batik Pattern
export const BatikPattern: React.FC<PatternProps> = ({
  color = '#008080',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="batik" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Organic leaf/floral motifs */}
          <path
            d="M 50 20 Q 60 30 55 45 Q 50 50 45 45 Q 40 30 50 20"
            fill={color}
            opacity="0.3"
          />
          <path
            d="M 20 50 Q 30 60 45 55 Q 50 50 45 45 Q 30 40 20 50"
            fill={color}
            opacity="0.3"
          />
          <path
            d="M 80 50 Q 70 60 55 55 Q 50 50 55 45 Q 70 40 80 50"
            fill={color}
            opacity="0.3"
          />

          {/* Cloud scrolls */}
          <path
            d="M 10 70 Q 20 65 30 70 Q 35 75 25 80 Q 15 80 10 70"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.25"
          />
          <path
            d="M 70 30 Q 80 25 90 30 Q 95 35 85 40 Q 75 40 70 30"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.25"
          />

          {/* Small accent dots */}
          <circle cx="50" cy="50" r="1.5" fill={color} opacity="0.4" />
          <circle cx="30" cy="30" r="1" fill={color} opacity="0.3" />
          <circle cx="70" cy="70" r="1" fill={color} opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#batik)" />
    </svg>
  </div>
);

// Central Asian Silk Road Pattern
export const SilkRoadPattern: React.FC<PatternProps> = ({
  color = '#007FFF',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="silkroad" patternUnits="userSpaceOnUse" width="120" height="120">
          {/* Geometric medallion center */}
          <circle cx="60" cy="60" r="25" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
          <circle cx="60" cy="60" r="20" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />

          {/* Interconnected stars */}
          <path
            d="M 60 35 L 65 50 L 80 55 L 65 60 L 60 75 L 55 60 L 40 55 L 55 50 Z"
            fill={color}
            opacity="0.25"
          />
          <path
            d="M 85 60 L 90 70 L 100 75 L 90 80 L 85 90 L 80 80 L 70 75 L 80 70 Z"
            fill={color}
            opacity="0.2"
          />
          <path
            d="M 35 60 L 30 70 L 20 75 L 30 80 L 35 90 L 40 80 L 50 75 L 40 70 Z"
            fill={color}
            opacity="0.2"
          />

          {/* Decorative lines connecting elements */}
          <line x1="60" y1="60" x2="85" y2="60" stroke={color} strokeWidth="0.5" opacity="0.2" />
          <line x1="60" y1="60" x2="35" y2="60" stroke={color} strokeWidth="0.5" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#silkroad)" />
    </svg>
  </div>
);

// Hispanic/Latino Fiesta Pattern
export const FiestaPattern: React.FC<PatternProps> = ({
  color = '#E2725B',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="fiesta" patternUnits="userSpaceOnUse" width="110" height="110">
          {/* Papel picado-style cut shapes */}
          <path
            d="M 55 20 L 65 35 L 75 30 L 70 45 L 80 50 L 65 50 L 60 65 L 55 50 L 40 50 L 50 45 L 45 30 Z"
            fill={color}
            opacity="0.3"
          />

          {/* Marigold flowers */}
          <circle cx="25" cy="25" r="8" fill={color} opacity="0.25" />
          <circle cx="25" cy="25" r="5" fill={color} opacity="0.3" />
          <circle cx="85" cy="85" r="7" fill={color} opacity="0.2" />
          <circle cx="85" cy="85" r="4" fill={color} opacity="0.25" />

          {/* Decorative petals around flowers */}
          <circle cx="25" cy="15" r="2" fill={color} opacity="0.35" />
          <circle cx="35" cy="25" r="2" fill={color} opacity="0.35" />
          <circle cx="25" cy="35" r="2" fill={color} opacity="0.35" />
          <circle cx="15" cy="25" r="2" fill={color} opacity="0.35" />

          {/* Small accent dots */}
          <circle cx="55" cy="55" r="1.5" fill={color} opacity="0.3" />
          <circle cx="20" cy="80" r="1" fill={color} opacity="0.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fiesta)" />
    </svg>
  </div>
);

// European Classic Pattern
export const ClassicPattern: React.FC<PatternProps> = ({
  color = '#1B365D',
  opacity = 0.04,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="classic" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Damask/fleur-de-lis repeating pattern */}
          <path
            d="M 50 20 L 55 35 L 70 35 L 58 45 L 63 60 L 50 50 L 37 60 L 42 45 L 30 35 L 45 35 Z"
            fill={color}
            opacity="0.25"
          />
          <path
            d="M 50 80 L 55 65 L 70 65 L 58 55 L 63 40 L 50 50 L 37 40 L 42 55 L 30 65 L 45 65 Z"
            fill={color}
            opacity="0.2"
          />

          {/* Side flourishes */}
          <path
            d="M 15 50 Q 25 45 25 50 Q 25 55 15 50"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.2"
          />
          <path
            d="M 85 50 Q 75 45 75 50 Q 75 55 85 50"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.2"
          />

          {/* Center dot */}
          <circle cx="50" cy="50" r="1.5" fill={color} opacity="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#classic)" />
    </svg>
  </div>
);

// African Kente Pattern
export const KentePattern: React.FC<PatternProps> = ({
  color = '#006B3F',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="kente" patternUnits="userSpaceOnUse" width="80" height="80">
          {/* Bold interlocking zigzag stripes */}
          <path
            d="M 0 20 L 20 20 L 40 40 L 20 60 L 0 60"
            fill={color}
            opacity="0.3"
          />
          <path
            d="M 40 0 L 60 0 L 80 20 L 60 40 L 80 60 L 60 80 L 40 80 L 60 60 L 40 40 L 60 20"
            fill={color}
            opacity="0.25"
          />

          {/* Geometric weave pattern - horizontal lines */}
          <line x1="0" y1="15" x2="80" y2="15" stroke={color} strokeWidth="1" opacity="0.2" />
          <line x1="0" y1="35" x2="80" y2="35" stroke={color} strokeWidth="1" opacity="0.2" />
          <line x1="0" y1="55" x2="80" y2="55" stroke={color} strokeWidth="1" opacity="0.2" />
          <line x1="0" y1="75" x2="80" y2="75" stroke={color} strokeWidth="1" opacity="0.2" />

          {/* Vertical accent lines */}
          <line x1="25" y1="0" x2="25" y2="80" stroke={color} strokeWidth="0.8" opacity="0.15" />
          <line x1="55" y1="0" x2="55" y2="80" stroke={color} strokeWidth="0.8" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
    </svg>
  </div>
);

// Middle Eastern Arabesque Pattern
export const ArabesquePattern: React.FC<PatternProps> = ({
  color = '#005F6B',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="arabesque" patternUnits="userSpaceOnUse" width="120" height="120">
          {/* Interlocking geometric stars */}
          <path
            d="M 60 20 L 68 40 L 90 45 L 72 60 L 78 82 L 60 70 L 42 82 L 48 60 L 30 45 L 52 40 Z"
            fill={color}
            opacity="0.3"
          />
          <path
            d="M 60 100 L 68 80 L 90 75 L 72 60 L 78 38 L 60 50 L 42 38 L 48 60 L 30 75 L 52 80 Z"
            fill={color}
            opacity="0.25"
          />

          {/* Tessellation circles */}
          <circle cx="30" cy="30" r="12" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" />
          <circle cx="90" cy="90" r="12" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" />

          {/* Connecting lines for geometric feel */}
          <line x1="60" y1="20" x2="60" y2="100" stroke={color} strokeWidth="0.5" opacity="0.15" />
          <line x1="20" y1="60" x2="100" y2="60" stroke={color} strokeWidth="0.5" opacity="0.15" />

          {/* Center accent */}
          <circle cx="60" cy="60" r="3" fill={color} opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#arabesque)" />
    </svg>
  </div>
);

// Oceanian Ocean Pattern
export const OceanPattern: React.FC<PatternProps> = ({
  color = '#006994',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="ocean" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Wave curves */}
          <path
            d="M 0 30 Q 25 20 50 30 T 100 30"
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            opacity="0.3"
          />
          <path
            d="M 0 50 Q 25 40 50 50 T 100 50"
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            opacity="0.25"
          />
          <path
            d="M 0 70 Q 25 60 50 70 T 100 70"
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.2"
          />

          {/* Tapa cloth triangles */}
          <polygon points="20,20 30,35 10,35" fill={color} opacity="0.25" />
          <polygon points="70,50 80,65 60,65" fill={color} opacity="0.2" />
          <polygon points="40,80 50,95 30,95" fill={color} opacity="0.15" />

          {/* Small accent dots for island islands */}
          <circle cx="50" cy="50" r="1.5" fill={color} opacity="0.35" />
          <circle cx="25" cy="75" r="1" fill={color} opacity="0.25" />
          <circle cx="75" cy="25" r="1" fill={color} opacity="0.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ocean)" />
    </svg>
  </div>
);

// Indigenous Earth Pattern
export const EarthPattern: React.FC<PatternProps> = ({
  color = '#8B4513',
  opacity = 0.05,
  className = '',
}) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="earth" patternUnits="userSpaceOnUse" width="100" height="100">
          {/* Dreamcatcher circles */}
          <circle cx="50" cy="50" r="30" fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
          <circle cx="50" cy="50" r="20" fill="none" stroke={color} strokeWidth="0.8" opacity="0.35" />
          <circle cx="50" cy="50" r="10" fill="none" stroke={color} strokeWidth="0.6" opacity="0.4" />

          {/* Arrow motifs pointing outward */}
          <path d="M 50 20 L 55 30 L 50 28 L 45 30 Z" fill={color} opacity="0.3" />
          <path d="M 80 50 L 70 55 L 72 50 L 70 45 Z" fill={color} opacity="0.3" />
          <path d="M 50 80 L 45 70 L 50 72 L 55 70 Z" fill={color} opacity="0.3" />
          <path d="M 20 50 L 30 45 L 28 50 L 30 55 Z" fill={color} opacity="0.3" />

          {/* Zigzag lines */}
          <polyline
            points="15,20 25,30 35,20 45,30 55,20 65,30 75,20"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.2"
          />

          {/* Center accent dot */}
          <circle cx="50" cy="50" r="2" fill={color} opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#earth)" />
    </svg>
  </div>
);

/**
 * Component that renders the correct cultural pattern overlay based on theme
 */
export const CulturalPatternOverlay: React.FC<{ theme: CulturalTheme }> = ({ theme }) => {
  const patternConfig = theme.pattern;
  const patternId = patternConfig.id;

  switch (patternId) {
    case 'rangoli_pattern':
      return (
        <RangoliPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'inkwash_pattern':
      return (
        <InkWashPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'batik_pattern':
      return (
        <BatikPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'silkroad_pattern':
      return (
        <SilkRoadPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'fiesta_pattern':
      return (
        <FiestaPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'classic_pattern':
      return (
        <ClassicPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'kente_pattern':
      return (
        <KentePattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'arabesque_pattern':
      return (
        <ArabesquePattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'ocean_pattern':
      return (
        <OceanPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'earth_pattern':
      return (
        <EarthPattern
          color={patternConfig.color}
          opacity={patternConfig.opacity}
        />
      );
    case 'neutral_pattern':
    default:
      // Neutral pattern or fallback - just empty
      return null;
  }
};
