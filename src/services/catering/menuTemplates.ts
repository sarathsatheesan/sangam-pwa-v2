// ═══════════════════════════════════════════════════════════════════════
// MENU TEMPLATES — Cuisine-specific starter templates for Vendor Storefront Builder
// ═══════════════════════════════════════════════════════════════════════

import { MenuTemplate, MenuTemplateItem, MenuTemplateType } from './cateringTypes';

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

// ═══════════════════════════════════════════════════════════════════════
// GROCERY TEMPLATES
// ═══════════════════════════════════════════════════════════════════════

// ── Grocery 1: South Asian Essentials ───────────────────────────────────

const grocerySouthAsianItems: MenuTemplateItem[] = [
  {
    name: 'Basmati Rice (10 lb)',
    description: 'Premium aged basmati rice — extra-long grain',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Toor Dal (4 lb)',
    description: 'Split pigeon peas — staple for sambar and dal fry',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Chana Dal (2 lb)',
    description: 'Split chickpeas for dal, sweets, and snack mixes',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Atta Whole Wheat Flour (20 lb)',
    description: 'Fine-ground whole wheat flour for roti and paratha',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan'],
  },
  {
    name: 'Mustard Oil (1 L)',
    description: 'Cold-pressed mustard oil for Bengali and North Indian cooking',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Coconut Oil (1 L)',
    description: 'Virgin coconut oil for South Indian and Sri Lankan dishes',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Ghee (32 oz)',
    description: 'Pure clarified butter — essential for dal, rice, and sweets',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Chickpeas (4 lb)',
    description: 'Dried kabuli chana for chana masala and salads',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Grocery 2: Spice & Masala Collection ────────────────────────────────

const grocerySpicesItems: MenuTemplateItem[] = [
  {
    name: 'Turmeric Powder (200 g)',
    description: 'Ground turmeric — used in virtually every curry',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Red Chili Powder (200 g)',
    description: 'Kashmiri or regular red chili powder',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Garam Masala (100 g)',
    description: 'Aromatic blend of cardamom, cinnamon, cloves, and peppercorns',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Cumin Seeds (200 g)',
    description: 'Whole cumin seeds for tempering and roasting',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Coriander Powder (200 g)',
    description: 'Ground coriander — base spice for curries and marinades',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Mustard Seeds (100 g)',
    description: 'Black mustard seeds for South Indian tempering',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Biryani Masala (100 g)',
    description: 'Special blend for authentic dum biryani',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Sambar Powder (200 g)',
    description: 'South Indian lentil soup spice blend',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Grocery 3: Snacks & Ready-to-Eat ───────────────────────────────────

const grocerySnacksItems: MenuTemplateItem[] = [
  {
    name: 'Haldiram Aloo Bhujia (400 g)',
    description: 'Crispy potato noodle snack — a teatime classic',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Parle-G Biscuits (800 g)',
    description: 'Iconic glucose biscuits — perfect with chai',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'MTR Rava Idli Mix (500 g)',
    description: 'Just-add-water instant rava idli mix',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Maggi Noodles (12-pack)',
    description: 'Instant masala noodles — family pack',
    category: 'Entree',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian'],
  },
  {
    name: 'Papad (200 g)',
    description: 'Urad dal papadums — roast or fry',
    category: 'Appetizer',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Pickle Variety Pack',
    description: 'Mango, lime, and mixed vegetable pickle assortment',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Grocery 4: Fresh Produce & Dairy ────────────────────────────────────

const groceryFreshItems: MenuTemplateItem[] = [
  {
    name: 'Fresh Paneer (400 g)',
    description: 'Soft, fresh cottage cheese block — made daily',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Dahi / Yogurt (2 lb)',
    description: 'Thick, creamy plain yogurt for raita, lassi, and cooking',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Fresh Curry Leaves',
    description: 'Aromatic curry leaves — essential for South Indian tempering',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Fresh Cilantro Bunch',
    description: 'Fresh coriander leaves for garnishing and chutney',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Green Chilies (100 g)',
    description: 'Fresh Indian green chilies for heat and flavor',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Ginger-Garlic Paste (300 g)',
    description: 'Ready-to-use ginger-garlic paste for marinades and curries',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Tamarind Paste (200 g)',
    description: 'Seedless tamarind concentrate for sambar, chutneys, and sauces',
    category: 'Side',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Grocery 5: Beverages & Drinks ───────────────────────────────────────

const groceryBeveragesItems: MenuTemplateItem[] = [
  {
    name: 'Masala Chai Tea Bags (100 ct)',
    description: 'Pre-spiced black tea bags with cardamom and ginger',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'gluten_free'],
  },
  {
    name: 'Loose Leaf CTC Tea (500 g)',
    description: 'Strong CTC black tea for traditional stovetop chai',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Mango Pulp (850 g)',
    description: 'Alphonso mango pulp for lassi, milkshakes, and desserts',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Rose Syrup (750 ml)',
    description: 'Rooh Afza or similar rose syrup for falooda and drinks',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Coconut Water (12-pack)',
    description: 'Natural coconut water — refreshing and hydrating',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
  {
    name: 'Thumbs Up / Limca (12-pack)',
    description: 'Classic Indian soft drinks — cola and lemon varieties',
    category: 'Beverage',
    pricingType: 'flat_rate',
    dietaryTags: ['vegetarian', 'vegan', 'gluten_free'],
  },
];

// ── Master Templates Array ───────────────────────────────────────────────

export const MENU_TEMPLATES: MenuTemplate[] = [
  // ── Catering Templates ───────────────────────────────────────────
  {
    id: 'south-indian',
    name: 'South Indian Catering',
    cuisine: 'South Indian',
    type: 'catering',
    description:
      'Authentic South Indian specialties featuring dosas, idlis, biryanis, and traditional filter coffee service',
    version: 1,
    items: southIndianItems,
  },
  {
    id: 'north-indian',
    name: 'North Indian Feast',
    cuisine: 'North Indian',
    type: 'catering',
    description:
      'Popular North Indian curries, breads, and desserts perfect for corporate events and celebrations',
    version: 1,
    items: northIndianItems,
  },
  {
    id: 'pakistani',
    name: 'Pakistani Catering',
    cuisine: 'Pakistani',
    type: 'catering',
    description:
      'Traditional Pakistani kebabs, nihari, karahi, and breads with rich, aromatic flavors',
    version: 1,
    items: pakistaniItems,
  },
  {
    id: 'sri-lankan',
    name: 'Sri Lankan Spread',
    cuisine: 'Sri Lankan',
    type: 'catering',
    description:
      'Vibrant Sri Lankan cuisine featuring hoppers, kottu roti, curries, and tropical desserts',
    version: 1,
    items: sriLankanItems,
  },
  {
    id: 'tiffin',
    name: 'Tiffin Service',
    cuisine: 'Multi-cuisine',
    type: 'catering',
    description: 'Daily and weekly tiffin subscriptions with complete meal packages',
    version: 1,
    items: tiffinItems,
  },
  {
    id: 'chaat-street',
    name: 'Chaat & Street Food',
    cuisine: 'Indian Street Food',
    type: 'catering',
    description:
      'Popular Indian street food and chaat items perfect for casual events and live stations',
    version: 1,
    items: chaatStreetItems,
  },
  {
    id: 'sweets',
    name: 'Sweets & Desserts',
    cuisine: 'Indian Sweets',
    type: 'catering',
    description: 'Premium traditional sweets and desserts for celebrations and special occasions',
    version: 1,
    items: sweetsItems,
  },

  // ── Grocery Templates ────────────────────────────────────────────
  {
    id: 'grocery-south-asian',
    name: 'South Asian Grocery Essentials',
    cuisine: 'South Asian',
    type: 'grocery',
    description:
      'Everyday staples — rice, lentils, spices, flour, and oils for South Asian households',
    version: 1,
    items: grocerySouthAsianItems,
  },
  {
    id: 'grocery-spices',
    name: 'Spice & Masala Collection',
    cuisine: 'Indian Spices',
    type: 'grocery',
    description:
      'Whole spices, ground masalas, and custom blends for authentic home cooking',
    version: 1,
    items: grocerySpicesItems,
  },
  {
    id: 'grocery-snacks',
    name: 'Snacks & Ready-to-Eat',
    cuisine: 'South Asian Snacks',
    type: 'grocery',
    description:
      'Popular packaged snacks, namkeen, ready-to-eat meals, and instant mixes',
    version: 1,
    items: grocerySnacksItems,
  },
  {
    id: 'grocery-fresh',
    name: 'Fresh Produce & Dairy',
    cuisine: 'Fresh & Organic',
    type: 'grocery',
    description:
      'Fresh vegetables, herbs, paneer, yogurt, and specialty produce for South Asian cooking',
    version: 1,
    items: groceryFreshItems,
  },
  {
    id: 'grocery-beverages',
    name: 'Beverages & Drinks',
    cuisine: 'South Asian Beverages',
    type: 'grocery',
    description:
      'Teas, chai mixes, mango drinks, rose water, and traditional beverage essentials',
    version: 1,
    items: groceryBeveragesItems,
  },

  // ── Blank Template (always last) ─────────────────────────────────
  {
    id: 'blank',
    name: 'Blank Template',
    cuisine: 'Custom',
    type: 'catering',
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
