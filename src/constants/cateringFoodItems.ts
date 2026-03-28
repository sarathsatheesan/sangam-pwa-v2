// ═════════════════════════════════════════════════════════════════════════════════
// CATERING FOOD ITEMS BY CUISINE TYPE
// Pre-built food item catalogs organized by cuisine category.
// Categories and items inspired by popular catering platforms.
// ═════════════════════════════════════════════════════════════════════════════════

export interface CuisineFoodItem {
  name: string;
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  dietaryTags?: string[];
}

export interface CuisineCategory {
  label: string;
  emoji: string;
  items: CuisineFoodItem[];
}

export const CUISINE_CATEGORIES: Record<string, CuisineCategory> = {
  asian_bbq: {
    label: 'Asian BBQ',
    emoji: '🥢',
    items: [
      { name: 'Korean BBQ Short Ribs (Galbi)', pricingType: 'per_tray' },
      { name: 'Teriyaki Chicken', pricingType: 'per_tray' },
      { name: 'Bulgogi Beef', pricingType: 'per_tray' },
      { name: 'Char Siu Pork (Chinese BBQ)', pricingType: 'per_tray' },
      { name: 'Yakitori Skewers', pricingType: 'per_person' },
      { name: 'Satay Chicken with Peanut Sauce', pricingType: 'per_tray' },
      { name: 'Thai BBQ Pork Skewers', pricingType: 'per_tray' },
      { name: 'Steamed Jasmine Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Kimchi Fried Rice', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Asian Coleslaw', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Edamame', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Japchae (Glass Noodles)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
    ],
  },

  breakfast: {
    label: 'Breakfast & Brunch',
    emoji: '🥞',
    items: [
      { name: 'Scrambled Eggs', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Bacon Strips', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Turkey Sausage Links', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Pancake Stack', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'French Toast Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Assorted Bagels with Cream Cheese', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'Fresh Fruit Platter', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Yogurt Parfait Cups', pricingType: 'per_person', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Breakfast Burrito Tray', pricingType: 'per_person' },
      { name: 'Oatmeal Bar', pricingType: 'per_person', dietaryTags: ['vegan'] },
      { name: 'Muffin & Pastry Assortment', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Avocado Toast Platter', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Hash Brown Casserole', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Coffee Carafe (serves 12)', pricingType: 'flat_rate' },
      { name: 'Orange Juice Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegan', 'gluten_free'] },
    ],
  },

  healthy: {
    label: 'Healthy',
    emoji: '🥗',
    items: [
      { name: 'Mixed Green Salad', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Grilled Chicken Breast', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Quinoa & Roasted Vegetable Bowl', pricingType: 'per_person', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Salmon Fillet Tray', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Mediterranean Grain Bowl', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'Grilled Vegetable Platter', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Kale Caesar Salad', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Turkey Lettuce Wraps', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Acai Bowl Bar', pricingType: 'per_person', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Hummus & Crudité Platter', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Protein Power Bowl', pricingType: 'per_person', dietaryTags: ['gluten_free'] },
      { name: 'Steamed Brown Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
    ],
  },

  italian: {
    label: 'Italian',
    emoji: '🍝',
    items: [
      { name: 'Penne Marinara', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Chicken Parmesan Tray', pricingType: 'per_tray' },
      { name: 'Lasagna (Meat)', pricingType: 'per_tray' },
      { name: 'Vegetable Lasagna', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Fettuccine Alfredo', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Eggplant Parmesan', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Caesar Salad', pricingType: 'per_tray' },
      { name: 'Caprese Salad', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Bruschetta Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Garlic Bread', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Italian Meatballs', pricingType: 'per_tray' },
      { name: 'Tiramisu Tray', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Antipasto Platter', pricingType: 'per_tray' },
      { name: 'Minestrone Soup', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
    ],
  },

  mediterranean: {
    label: 'Mediterranean',
    emoji: '🫒',
    items: [
      { name: 'Chicken Shawarma Platter', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Lamb Kofta', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Falafel Platter', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Hummus with Pita', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Baba Ganoush', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Tabbouleh Salad', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Greek Salad', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Grilled Lamb Chops', pricingType: 'per_tray', dietaryTags: ['halal', 'gluten_free'] },
      { name: 'Stuffed Grape Leaves (Dolma)', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Kebab Platter (Mixed Grill)', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Saffron Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Fattoush Salad', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Baklava Tray', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Spanakopita (Spinach Pie)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
    ],
  },

  mexican: {
    label: 'Mexican',
    emoji: '🌮',
    items: [
      { name: 'Taco Bar (Chicken)', pricingType: 'per_person' },
      { name: 'Taco Bar (Beef)', pricingType: 'per_person' },
      { name: 'Taco Bar (Veggie)', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'Burrito Bowl Bar', pricingType: 'per_person' },
      { name: 'Chicken Enchiladas', pricingType: 'per_tray' },
      { name: 'Cheese Quesadilla Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Chips & Guacamole', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Chips & Salsa', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Mexican Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Refried Beans', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Elote (Street Corn)', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Churros Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Carnitas Tray', pricingType: 'per_tray' },
      { name: 'Tamales (Assorted)', pricingType: 'per_tray' },
    ],
  },

  indian: {
    label: 'Indian',
    emoji: '🍛',
    items: [
      { name: 'Butter Chicken', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Chicken Tikka Masala', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Lamb Biryani', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Vegetable Biryani', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Palak Paneer (Spinach & Cheese)', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Chana Masala (Chickpea Curry)', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Dal Makhani (Black Lentil Curry)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Naan Bread Basket', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Garlic Naan', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Basmati Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Samosa Platter (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Tandoori Chicken', pricingType: 'per_tray', dietaryTags: ['halal', 'gluten_free'] },
      { name: 'Aloo Gobi (Potato & Cauliflower)', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Raita (Yogurt Dip)', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Gulab Jamun', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Mango Lassi Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegetarian', 'gluten_free'] },
    ],
  },

  chinese: {
    label: 'Chinese',
    emoji: '🥡',
    items: [
      { name: 'General Tso\'s Chicken', pricingType: 'per_tray' },
      { name: 'Kung Pao Chicken', pricingType: 'per_tray' },
      { name: 'Sweet & Sour Chicken', pricingType: 'per_tray' },
      { name: 'Beef & Broccoli', pricingType: 'per_tray' },
      { name: 'Vegetable Lo Mein', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Fried Rice (Chicken)', pricingType: 'per_tray' },
      { name: 'Fried Rice (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Spring Rolls (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Egg Rolls', pricingType: 'per_tray' },
      { name: 'Mapo Tofu', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Steamed Dumplings (Pork)', pricingType: 'per_tray' },
      { name: 'Steamed Dumplings (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Hot & Sour Soup', pricingType: 'per_tray' },
      { name: 'Stir-Fried Mixed Vegetables', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
    ],
  },

  american: {
    label: 'American',
    emoji: '🍔',
    items: [
      { name: 'Slider Platter (Beef)', pricingType: 'per_tray' },
      { name: 'Slider Platter (Chicken)', pricingType: 'per_tray' },
      { name: 'BBQ Pulled Pork Tray', pricingType: 'per_tray' },
      { name: 'Grilled Chicken Sandwich Tray', pricingType: 'per_tray' },
      { name: 'Mac & Cheese', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Coleslaw', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Potato Salad', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Garden Salad', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Chicken Tender Platter', pricingType: 'per_tray' },
      { name: 'Wings Platter (Buffalo)', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Wings Platter (BBQ)', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Cookie & Brownie Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Chips & Dip Assortment', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
    ],
  },

  sandwich_wraps: {
    label: 'Sandwiches & Wraps',
    emoji: '🥪',
    items: [
      { name: 'Assorted Sandwich Platter', pricingType: 'per_person' },
      { name: 'Turkey & Swiss Wraps', pricingType: 'per_person' },
      { name: 'Chicken Caesar Wraps', pricingType: 'per_person' },
      { name: 'Veggie Wrap Platter', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'Club Sandwich Tray', pricingType: 'per_tray' },
      { name: 'Italian Sub Platter', pricingType: 'per_tray' },
      { name: 'Grilled Panini Platter', pricingType: 'per_tray' },
      { name: 'Falafel Wraps', pricingType: 'per_person', dietaryTags: ['vegan'] },
      { name: 'Soup & Sandwich Combo', pricingType: 'per_person' },
      { name: 'Pinwheel Sandwich Tray', pricingType: 'per_tray' },
      { name: 'Croissant Sandwich Platter', pricingType: 'per_tray' },
    ],
  },

  pizza: {
    label: 'Pizza & Flatbreads',
    emoji: '🍕',
    items: [
      { name: 'Cheese Pizza (Large)', pricingType: 'flat_rate', dietaryTags: ['vegetarian'] },
      { name: 'Pepperoni Pizza (Large)', pricingType: 'flat_rate' },
      { name: 'Margherita Pizza (Large)', pricingType: 'flat_rate', dietaryTags: ['vegetarian'] },
      { name: 'BBQ Chicken Pizza (Large)', pricingType: 'flat_rate' },
      { name: 'Vegetable Supreme Pizza (Large)', pricingType: 'flat_rate', dietaryTags: ['vegetarian'] },
      { name: 'Meat Lovers Pizza (Large)', pricingType: 'flat_rate' },
      { name: 'Garlic Knots', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Breadsticks', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Buffalo Chicken Flatbread', pricingType: 'per_tray' },
      { name: 'Mediterranean Flatbread', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'House Salad', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
    ],
  },

  thai: {
    label: 'Thai',
    emoji: '🍜',
    items: [
      { name: 'Pad Thai (Chicken)', pricingType: 'per_tray' },
      { name: 'Pad Thai (Tofu)', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Green Curry (Chicken)', pricingType: 'per_tray' },
      { name: 'Red Curry (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Massaman Curry', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Thai Basil Stir-Fry', pricingType: 'per_tray' },
      { name: 'Tom Yum Soup', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Spring Rolls (Fresh)', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Mango Sticky Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Thai Iced Tea Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegetarian'] },
      { name: 'Jasmine Rice', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Panang Curry', pricingType: 'per_tray' },
    ],
  },

  japanese: {
    label: 'Japanese',
    emoji: '🍣',
    items: [
      { name: 'Sushi Platter (Assorted)', pricingType: 'per_tray' },
      { name: 'California Roll Platter', pricingType: 'per_tray' },
      { name: 'Vegetable Roll Platter', pricingType: 'per_tray', dietaryTags: ['vegan'] },
      { name: 'Chicken Katsu Tray', pricingType: 'per_tray' },
      { name: 'Teriyaki Salmon', pricingType: 'per_tray' },
      { name: 'Gyoza (Pork Dumplings)', pricingType: 'per_tray' },
      { name: 'Gyoza (Vegetable)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Miso Soup', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Edamame', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Tempura Vegetables', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Shrimp Tempura', pricingType: 'per_tray' },
      { name: 'Japanese Curry Rice', pricingType: 'per_tray' },
    ],
  },

  caribbean: {
    label: 'Caribbean',
    emoji: '🌴',
    items: [
      { name: 'Jerk Chicken', pricingType: 'per_tray', dietaryTags: ['halal', 'gluten_free'] },
      { name: 'Curry Goat', pricingType: 'per_tray', dietaryTags: ['halal', 'gluten_free'] },
      { name: 'Oxtail Stew', pricingType: 'per_tray', dietaryTags: ['halal'] },
      { name: 'Rice & Peas', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Fried Plantains', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Callaloo', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Roti Wraps (Chicken)', pricingType: 'per_person' },
      { name: 'Roti Wraps (Vegetable)', pricingType: 'per_person', dietaryTags: ['vegan'] },
      { name: 'Festival (Fried Dumplings)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Coconut Shrimp', pricingType: 'per_tray' },
      { name: 'Mango Salsa', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
    ],
  },

  soul_food: {
    label: 'Soul Food & Southern',
    emoji: '🍗',
    items: [
      { name: 'Fried Chicken Platter', pricingType: 'per_tray' },
      { name: 'Baked Mac & Cheese', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Collard Greens', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Cornbread', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Candied Yams', pricingType: 'per_tray', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Smothered Pork Chops', pricingType: 'per_tray' },
      { name: 'Black-Eyed Peas', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Shrimp & Grits', pricingType: 'per_tray', dietaryTags: ['gluten_free'] },
      { name: 'Banana Pudding', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Peach Cobbler', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Biscuits & Gravy', pricingType: 'per_tray' },
    ],
  },

  desserts: {
    label: 'Desserts & Sweets',
    emoji: '🍰',
    items: [
      { name: 'Assorted Cookie Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Brownie Tray', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Mini Cupcake Assortment', pricingType: 'per_person', dietaryTags: ['vegetarian'] },
      { name: 'Cheesecake Platter', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Fresh Fruit Display', pricingType: 'per_tray', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Chocolate Mousse Cups', pricingType: 'per_person', dietaryTags: ['vegetarian', 'gluten_free'] },
      { name: 'Tiramisu Tray', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Baklava Assortment', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Gulab Jamun', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Tres Leches Cake', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Donut Platter (Assorted)', pricingType: 'per_tray', dietaryTags: ['vegetarian'] },
      { name: 'Ice Cream Sundae Bar', pricingType: 'per_person', dietaryTags: ['vegetarian', 'gluten_free'] },
    ],
  },

  beverages: {
    label: 'Beverages',
    emoji: '🥤',
    items: [
      { name: 'Coffee Carafe (serves 12)', pricingType: 'flat_rate' },
      { name: 'Hot Tea Selection', pricingType: 'flat_rate', dietaryTags: ['vegan'] },
      { name: 'Iced Tea Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegan'] },
      { name: 'Lemonade Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Orange Juice Pitcher', pricingType: 'flat_rate', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Bottled Water (case)', pricingType: 'flat_rate', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Assorted Soft Drinks (case)', pricingType: 'flat_rate', dietaryTags: ['vegan'] },
      { name: 'Sparkling Water (case)', pricingType: 'flat_rate', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Fresh Juice Assortment', pricingType: 'per_person', dietaryTags: ['vegan', 'gluten_free'] },
      { name: 'Chai Latte Carafe', pricingType: 'flat_rate', dietaryTags: ['vegetarian'] },
    ],
  },
};

// Sorted keys for consistent UI rendering
export const CUISINE_CATEGORY_KEYS = Object.keys(CUISINE_CATEGORIES).sort((a, b) =>
  CUISINE_CATEGORIES[a].label.localeCompare(CUISINE_CATEGORIES[b].label)
);
