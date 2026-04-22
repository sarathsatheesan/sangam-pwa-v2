// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS MODULE CONSTANTS
// Extracted from business.tsx for reuse across components, hooks, and utils
// ═════════════════════════════════════════════════════════════════════════════════

import {
  Palette, Scissors, Shirt, BookOpen, DollarSign, ShoppingBag,
  Stethoscope, Flower2, Building2, Gem, Scale, Users, Home,
  Utensils, Laptop, UtensilsCrossed, Plane, Briefcase, Camera,
} from 'lucide-react';

// ── Category list ──
export const CATEGORIES = [
  'Arts & Entertainment',
  'Beauty & Wellness',
  'Boutique',
  'Education & Tutoring',
  'Financial Services',
  'Grocery & Market',
  'Healthcare',
  'Henna',
  'Hotels',
  'Jewelry',
  'Legal & Immigration',
  'Non-Profit',
  'Photo/Videography',
  'Real Estate',
  'Restaurant & Food',
  'Technology',
  'Tiffin',
  'Travel & Tourism',
  'Other',
];

// ── Category → Emoji mapping ──
export const CATEGORY_EMOJI_MAP: { [key: string]: string } = {
  'Arts & Entertainment': '🎭',
  'Beauty & Wellness': '💆',
  'Boutique': '👗',
  'Education & Tutoring': '📚',
  'Financial Services': '💰',
  'Grocery & Market': '🛒',
  'Healthcare': '🏥',
  'Henna': '🌿',
  'Hotels': '🏨',
  'Jewelry': '💎',
  'Legal & Immigration': '⚖️',
  'Non-Profit': '🤝',
  'Photo/Videography': '📸',
  'Real Estate': '🏠',
  'Restaurant & Food': '🍛',
  'Technology': '💻',
  'Tiffin': '🍱',
  'Travel & Tourism': '✈️',
  'Other': '💼',
};

// ── Category → Brand color ──
export const CATEGORY_COLORS: { [key: string]: string } = {
  'Arts & Entertainment': '#D97706',
  'Beauty & Wellness': '#DB2777',
  'Boutique': '#E11D48',
  'Education & Tutoring': '#6366F1',
  'Financial Services': '#0369A1',
  'Grocery & Market': '#16A34A',
  'Healthcare': '#059669',
  'Henna': '#65A30D',
  'Hotels': '#8B5CF6',
  'Jewelry': '#CA8A04',
  'Legal & Immigration': '#B45309',
  'Non-Profit': '#DC2626',
  'Photo/Videography': '#EC4899',
  'Real Estate': '#1E40AF',
  'Restaurant & Food': '#EA580C',
  'Technology': '#7C3AED',
  'Tiffin': '#F97316',
  'Travel & Tourism': '#0D9488',
  'Other': '#6D28D9',
};

// ── Category → Lucide icon component ──
export const CATEGORY_ICONS: { [key: string]: any } = {
  'Arts & Entertainment': Palette,
  'Beauty & Wellness': Scissors,
  'Boutique': Shirt,
  'Education & Tutoring': BookOpen,
  'Financial Services': DollarSign,
  'Grocery & Market': ShoppingBag,
  'Healthcare': Stethoscope,
  'Henna': Flower2,
  'Hotels': Building2,
  'Jewelry': Gem,
  'Legal & Immigration': Scale,
  'Non-Profit': Users,
  'Photo/Videography': Camera,
  'Real Estate': Home,
  'Restaurant & Food': Utensils,
  'Technology': Laptop,
  'Tiffin': UtensilsCrossed,
  'Travel & Tourism': Plane,
  'Other': Briefcase,
};

// ── Report reasons ──
export const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or Misleading', icon: '🚫', description: 'Unwanted promotional, repetitive, or misleading content' },
  { id: 'hate_speech', label: 'Hate Speech or Bullying', icon: '🛑', description: 'Content targeting race, ethnicity, religion, gender, or personal attacks' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: '⚠️', description: 'Sexual, violent, or graphic content not suitable for the community' },
  { id: 'ip_violation', label: 'Intellectual Property Violation', icon: '©️', description: 'Unauthorized use of copyrighted material or trademarks' },
  { id: 'misinformation', label: 'Misinformation', icon: '❌', description: 'False or misleading information that could cause harm' },
  { id: 'scam', label: 'Scam or Fraud', icon: '🎣', description: 'Phishing, financial fraud, or deceptive schemes' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Something else that violates community guidelines' },
];
