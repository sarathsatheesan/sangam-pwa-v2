// ═══════════════════════════════════════════════════════════════════════
// MENU TEMPLATES — Cuisine-specific starter templates for Vendor Storefront Builder
// ═══════════════════════════════════════════════════════════════════════

import { MenuTemplate, MenuTemplateItem } from './cateringTypes';

// ── Template 1: South Indian Catering ────────────────────────────────────

const southIndianItems: MenuTemplateItem[] = [
  {
    name: 'Dosa Platter',
    description: 'Assortment of masala dosa, paper dosa, and rava dosa with sambar and chutney trio',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Idli Sambar Tray',
    description: 'Steamed rice cakes with sambar, coconut chutney, and tomato chutney',
    category: 'Appetizer',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Vada Assortment',
    description: 'Medu vada and masala vada with sambar and chutney',
    category: 'Appetizer',
    pricingType: 'per_tray',
    servesCount: 12,
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Vegetable Biryani',
    description: 'Fragrant basmati rice layered with seasonal vegetables and aromatic spices',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Chicken Biryani',
    description: 'Hyderabadi-style dum biryani with tender chicken pieces and saffron rice',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['halal'],
  },
  {
    name: 'Filter Coffee Service',
    description: 'Traditional South Indian filter coffee served with fresh milk',
    category: 'Beverage',
    pricingType: 'per_person',
    dietaryTags: [],
  },
  {
    name: 'Payasam',
    description: 'Creamy vermicelli payasam with cashews and raisins',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Rasam',
    description: 'Tangy pepper rasam with tomato and tamarind',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Template 2: North Indian Feast ───────────────────────────────────────

const northIndianItems: MenuTemplateItem[] = [
  {
    name: 'Samosa Platter',
    description: 'Crispy pastries filled with spiced potatoes and peas',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    servesCount: 20,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Butter Chicken Tray',
    description: 'Tender chicken in rich tomato-butter gravy',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['halal'],
  },
  {
    name: 'Paneer Tikka Masala',
    description: 'Grilled paneer cubes in spiced tomato gravy',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Naan Basket',
    description: 'Assorted naan — butter, garlic, and plain',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Dal Makhani',
    description: 'Slow-cooked black lentils in creamy tomato base',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Gulab Jamun',
    description: 'Warm milk dumplings soaked in rose-cardamom syrup',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 20,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Mango Lassi',
    description: 'Chilled yogurt drink blended with Alphonso mango pulp',
    category: 'Beverage',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Raita',
    description: 'Cool yogurt with cucumber, mint, and roasted cumin',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
];

// ── Template 3: Pakistani Catering ───────────────────────────────────────

const pakistaniItems: MenuTemplateItem[] = [
  {
    name: 'Chapli Kebab Platter',
    description: 'Peshawar-style minced beef patties with fresh tomatoes and herbs',
    category: 'Appetizer',
    pricingType: 'per_tray',
    servesCount: 12,
    dietaryTags: ['halal'],
  },
  {
    name: 'Nihari',
    description: 'Slow-cooked beef stew with aromatic spices, served with naan',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 8,
    dietaryTags: ['halal'],
  },
  {
    name: 'Chicken Karahi',
    description: 'Wok-style chicken in tomato-based gravy with green chilies',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['halal'],
  },
  {
    name: 'Haleem',
    description: 'Rich lentil and meat stew with wheat — a Ramadan favorite',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['halal'],
  },
  {
    name: 'Naan & Paratha Basket',
    description: 'Fresh-baked naan and layered paratha',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: [],
  },
  {
    name: 'Kheer',
    description: 'Creamy rice pudding with cardamom, pistachios, and almonds',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian'],
  },
];

// ── Template 4: Sri Lankan Spread ────────────────────────────────────────

const sriLankanItems: MenuTemplateItem[] = [
  {
    name: 'Hoppers Station',
    description: 'Crispy bowl-shaped rice flour pancakes with egg or plain options',
    category: 'Appetizer',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Kottu Roti',
    description: 'Chopped roti stir-fried with vegetables, egg, and spices',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: [],
  },
  {
    name: 'Fish Curry',
    description: 'Seer fish simmered in coconut milk with goraka and pandan',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 8,
    dietaryTags: ['gluten_free'],
  },
  {
    name: 'Pol Sambol',
    description: 'Fresh coconut relish with red onion, chili, and lime',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Watalappam',
    description: 'Coconut custard pudding with jaggery and cardamom',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 12,
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'String Hoppers',
    description: 'Steamed rice noodle nests served with kiri hodi',
    category: 'Side',
    pricingType: 'per_tray',
    servesCount: 12,
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Template 5: Tiffin Service ───────────────────────────────────────────

const tiffinItems: MenuTemplateItem[] = [
  {
    name: 'Daily Tiffin — Vegetarian',
    description: 'Complete meal: 2 rotis, rice, dal, sabzi, salad, and pickle',
    category: 'Package',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Daily Tiffin — Non-Veg',
    description: 'Complete meal: 2 rotis, rice, meat curry, sabzi, salad, and pickle',
    category: 'Package',
    pricingType: 'per_person',
    dietaryTags: ['halal'],
  },
  {
    name: 'Weekly Subscription — Veg',
    description: '5-day vegetarian tiffin service with rotating daily menu',
    category: 'Package',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Weekly Subscription — Non-Veg',
    description: '5-day non-veg tiffin service with rotating daily menu',
    category: 'Package',
    pricingType: 'per_person',
    dietaryTags: ['halal'],
  },
  {
    name: 'Roti Pack',
    description: 'Pack of 10 fresh chapatis',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Rice Bowl',
    description: 'Steamed basmati rice with choice of dal or curry',
    category: 'Entree',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
];

// ── Template 6: Chaat & Street Food ──────────────────────────────────────

const chaatStreetItems: MenuTemplateItem[] = [
  {
    name: 'Pani Puri Station',
    description: 'Live pani puri station with sweet and spicy water',
    category: 'Appetizer',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Bhel Puri',
    description: 'Puffed rice tossed with chutneys, onion, and sev',
    category: 'Appetizer',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'vegan'],
  },
  {
    name: 'Chaat Station',
    description: 'Assorted chaat — papdi, dahi puri, and sev puri',
    category: 'Appetizer',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Vada Pav',
    description: 'Mumbai-style spiced potato fritters in pav buns',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    servesCount: 20,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Chai Service',
    description: 'Masala chai with milk and sugar options',
    category: 'Beverage',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Pav Bhaji',
    description: 'Spiced mashed vegetable curry with buttered pav',
    category: 'Entree',
    pricingType: 'per_tray',
    servesCount: 10,
    dietaryTags: ['vegetarian'],
  },
];

// ── Template 7: Sweets & Desserts ────────────────────────────────────────

const sweetsItems: MenuTemplateItem[] = [
  {
    name: 'Mithai Assortment',
    description: 'Premium assortment: barfi, peda, ladoo, and kaju katli',
    category: 'Dessert',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Jalebi Platter',
    description: 'Crispy saffron-soaked spirals — served warm',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 15,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Rasgulla',
    description: 'Soft cheese balls in light sugar syrup',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 20,
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Barfi Selection',
    description: 'Assorted barfi — kaju, pista, and badam varieties',
    category: 'Dessert',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Kulfi',
    description: 'Traditional Indian ice cream in mango, pistachio, and malai flavors',
    category: 'Dessert',
    pricingType: 'per_person',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Gajar Ka Halwa',
    description: 'Slow-cooked carrot pudding with khoya, nuts, and cardamom',
    category: 'Dessert',
    pricingType: 'per_tray',
    servesCount: 12,
    dietaryTags: ['vegetarian'],
  },
];

// ── Template 8: Blank Template ───────────────────────────────────────────

const blankItems: MenuTemplateItem[] = [];

// ── Master Templates Array ───────────────────────────────────────────────

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    id: 'south-indian',
    name: 'South Indian Catering',
    cuisine: 'South Indian',
    description:
      'Authentic South Indian specialties featuring dosas, idlis, biryanis, and traditional filter coffee service',
    version: 1,
    items: southIndianItems,
  },
  {
    id: 'north-indian',
    name: 'North Indian Feast',
    cuisine: 'North Indian',
    description:
      'Popular North Indian curries, breads, and desserts perfect for corporate events and celebrations',
    version: 1,
    items: northIndianItems,
  },
  {
    id: 'pakistani',
    name: 'Pakistani Catering',
    cuisine: 'Pakistani',
    description:
      'Traditional Pakistani kebabs, nihari, karahi, and breads with rich, aromatic flavors',
    version: 1,
    items: pakistaniItems,
  },
  {
    id: 'sri-lankan',
    name: 'Sri Lankan Spread',
    cuisine: 'Sri Lankan',
    description:
      'Vibrant Sri Lankan cuisine featuring hoppers, kottu roti, curries, and tropical desserts',
    version: 1,
    items: sriLankanItems,
  },
  {
    id: 'tiffin',
    name: 'Tiffin Service',
    cuisine: 'Multi-cuisine',
    description: 'Daily and weekly tiffin subscriptions with complete meal packages',
    version: 1,
    items: tiffinItems,
  },
  {
    id: 'chaat-street',
    name: 'Chaat & Street Food',
    cuisine: 'Indian Street Food',
    description:
      'Popular Indian street food and chaat items perfect for casual events and live stations',
    version: 1,
    items: chaatStreetItems,
  },
  {
    id: 'sweets',
    name: 'Sweets & Desserts',
    cuisine: 'Indian Sweets',
    description: 'Premium traditional sweets and desserts for celebrations and special occasions',
    version: 1,
    items: sweetsItems,
  },
  {
    id: 'blank',
    name: 'Blank Template',
    cuisine: 'Custom',
    description: 'Start from scratch — add items one by one using the menu editor',
    version: 1,
    items: blankItems,
  },
];

// ── Helper Function ──────────────────────────────────────────────────────

/**
 * Retrieves a menu template by its unique identifier.
 * @param id The template ID (e.g., 'south-indian', 'north-indian')
 * @returns The MenuTemplate object, or undefined if not found
 */
export function getTemplateById(id: string): MenuTemplate | undefined {
  return MENU_TEMPLATES.find((template) => template.id === id);
}
