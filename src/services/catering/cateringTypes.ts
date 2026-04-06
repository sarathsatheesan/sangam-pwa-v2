// ═══════════════════════════════════════════════════════════════════════
// CATERING TYPES — Shared type definitions for all catering sub-modules
// ═══════════════════════════════════════════════════════════════════════

export interface CateringMenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;              // cents (1299 = $12.99)
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  servesCount?: number;
  category: 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package';
  dietaryTags?: string[];     // vegetarian, vegan, halal, kosher, gluten_free, dairy_free, nut_free
  photoUrl?: string;
  available: boolean;
  minOrderQty?: number;
  maxOrderQty?: number;
  // Inventory management (#19)
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockCount?: number;        // null = unlimited
  availableFrom?: string;     // ISO date — seasonal/time-window availability
  availableUntil?: string;
  prepTimeMinutes?: number;   // UI-07: estimated prep time in minutes
  popularityScore?: number;   // UI-07: 0-100 popularity index (based on order volume)
  createdAt?: any;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;          // cents
  pricingType: string;
  specialInstructions?: string;
  minOrderQty?: number;
  maxOrderQty?: number;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface OrderForContext {
  type: 'self' | 'individual' | 'organization' | 'anonymous';
  recipientName?: string;
  recipientContact?: string;
  organizationName?: string;
  department?: string;
  relationship?: string;
}

export interface CateringOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessId: string;
  businessName: string;
  items: OrderItem[];
  subtotal: number;           // cents
  tax?: number;               // cents
  total: number;              // cents
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  eventDate: any;
  deliveryAddress: DeliveryAddress;
  headcount: number;
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  eventType?: string;           // corporate_meeting | wedding | cultural_festival | religious | birthday | other
  estimatedDeliveryTime?: string; // e.g. "2:30 PM" or "30 minutes"
  // Payment (#13) — vendor's payment info surfaced to customer
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  paymentUrl?: string;        // Vendor's external payment link
  paymentMethod?: string;     // "Venmo", "PayPal", "Square", etc.
  paymentNote?: string;       // Any vendor-specific payment instructions
  // Order modification (#18) — vendor adjusts items post-confirmation
  vendorModified?: boolean;
  vendorModifiedAt?: any;
  vendorModificationNote?: string;
  originalItems?: OrderItem[];  // Snapshot before vendor modification
  createdAt?: any;
  confirmedAt?: any;
  declinedReason?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: any;
  statusHistory?: Array<{ status: string; timestamp: any }>;
  // RFP-origin tracking — back-reference to the quote that spawned this order
  quoteRequestId?: string;
  quoteResponseId?: string;
  rfpOrigin?: boolean;          // true when order was auto-created from an accepted RFP
}

// ── In-order messaging (customer ↔ vendor notes within an order) ──

export interface OrderNote {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'vendor';
  text: string;
  createdAt: any;
}

export interface QuoteRequestItem {
  name: string;
  description?: string;
  qty: number;
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  dietaryTags?: string[];
}

export interface ItemAssignment {
  itemName: string;
  responseId: string;
  businessId: string;
  businessName: string;
  assignedAt: any;
}

export interface CateringQuoteRequest {
  id: string;
  customerId: string;
  // Privacy: NO customer name/email/phone stored here
  deliveryCity: string;           // Only city shared with caterers
  cuisineCategory: string;
  eventType?: string;             // corporate_meeting | wedding | cultural_festival | religious | birthday | other
  eventDate: any;
  headcount: number;
  items: QuoteRequestItem[];      // What they want catered
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  status: 'open' | 'reviewing' | 'partially_accepted' | 'accepted' | 'expired' | 'cancelled';
  selectedResponseId?: string;    // Which vendor response was accepted (full accept — legacy)
  selectedBusinessId?: string;    // Which vendor was selected (full accept — legacy)
  itemAssignments?: ItemAssignment[];  // Item-level assignments to different vendors
  targetBusinessIds?: string[];   // Specific businesses to request from (empty = broadcast to all in category)
  responseCount: number;          // How many vendors responded
  expiresAt?: any;
  createdAt?: any;
}

export interface CateringQuoteResponse {
  id: string;
  quoteRequestId: string;
  businessId: string;
  businessName: string;
  businessRating?: number;
  businessHeritage?: string;
  // Quote details
  quotedItems: QuotedItem[];
  subtotal: number;               // cents
  serviceFee?: number;            // cents
  deliveryFee?: number;           // cents
  total: number;                  // cents
  estimatedPrepTime?: string;     // e.g. "2-3 hours"
  message?: string;               // Personal message from caterer
  validUntil?: any;               // Quote expiry
  status: 'submitted' | 'accepted' | 'partially_accepted' | 'declined' | 'expired';
  // Only populated after customer accepts (full or partial) this response
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  acceptedItemNames?: string[];   // Which specific items were accepted from this vendor
  createdAt?: any;
}

export interface QuotedItem {
  name: string;
  qty: number;
  unitPrice: number;              // cents
  pricingType: string;
  traySize?: 'small' | 'medium' | 'large';  // tray size offered by vendor
  notes?: string;                 // caterer notes per item
}

export interface CateringReview {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number;                   // 1–5 stars
  text: string;
  orderId?: string;                 // links to catering order (optional)
  eventType?: string;               // from the original order
  itemsOrdered?: string[];          // item names for context
  headcount?: number;
  isCateringReview: boolean;        // distinguishes from general biz reviews
  vendorResponse?: string;          // vendor's reply to this review
  vendorRespondedAt?: any;
  // Flagging (#22)
  flagged?: boolean;
  flaggedBy?: string;               // vendor userId who flagged
  flaggedAt?: any;
  flagReason?: string;
  createdAt: any;
}

export interface FavoriteOrder {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  label: string;                       // e.g. "Weekly Office Lunch"
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  deliveryAddress?: DeliveryAddress;
  orderForContext?: OrderForContext;
  lastOrderedAt?: any;
  useCount: number;
  createdAt?: any;
}

export type RecurrenceInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceSchedule {
  // Simple interval mode
  interval?: RecurrenceInterval;
  // Calendar-based mode (advanced)
  daysOfWeek?: number[];               // 0=Sun..6=Sat (e.g. [1,3] = Mon,Wed)
  dayOfMonth?: number;                 // For monthly on a specific date (1–31)
  // Shared
  timeOfDay: string;                   // "11:30" (HH:mm) — delivery target time
  startDate: string;                   // ISO date "2026-04-01"
  endDate?: string;                    // ISO date or null for indefinite
  skipDates?: string[];                // Holidays / vacation dates to skip
}

/** Per-occurrence overrides — modifications to the next scheduled run only */
export interface OccurrenceOverride {
  forDate: string;                     // The nextRunDate this override applies to
  items?: OrderItem[];                 // Override items (null = use default)
  headcount?: number;
  specialInstructions?: string;
  skip?: boolean;                      // Skip just this occurrence
}

export interface RecurringOrder {
  id: string;
  userId: string;
  favoriteId: string;                  // Links to the FavoriteOrder being repeated
  businessId: string;
  businessName: string;
  label: string;
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  deliveryAddress: DeliveryAddress;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  schedule: RecurrenceSchedule;
  active: boolean;
  nextRunDate: string;                 // ISO date of next scheduled order
  lastRunDate?: string;
  totalOrdersPlaced: number;
  nextOccurrenceOverride?: OccurrenceOverride;  // One-time modification for the next run
  createdAt?: any;
  updatedAt?: any;
}

export interface OrderTemplate {
  id: string;
  creatorId: string;
  creatorName: string;
  businessId: string;
  businessName: string;
  title: string;                       // "Q1 Team Lunch Template"
  description?: string;
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  eventType?: string;
  // Sharing
  shareCode: string;                   // 8-char unique code for link sharing
  isPublic: boolean;                   // Anyone with link can use it
  // Organization scoping
  organizationId?: string;             // Ties to an org for team library
  organizationName?: string;
  // Stats
  useCount: number;
  lastUsedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  // Feature #30: Versioning
  version?: number;
  versionHistory?: Array<{
    version: number;
    items: OrderItem[];
    headcount?: number;
    specialInstructions?: string;
    updatedAt: any;
    updatedBy: string;
  }>;
}
