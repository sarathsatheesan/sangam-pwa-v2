/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHARED FIRESTORE TYPE DEFINITIONS
 *
 * Central location for all Firestore document shapes used across the application.
 * Each interface represents a document collection structure with optional fields
 * for extensibility and backward compatibility.
 *
 * IMPORTANT: Each interface includes [key: string]: any index signature to allow
 * extra fields and maintain compatibility with existing code that uses `as any`.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// USER COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User profile stored in 'users' collection.
 * Single source of truth for user information across the application.
 *
 * Collection: /users/{uid}
 * Indexed on: uid, email, heritage, createdAt
 */
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  preferredName?: string;
  avatar?: string;
  heritage?: string | string[];
  city?: string;
  profession?: string;
  interests?: string[];
  bio?: string;

  // Account management
  accountType?: 'individual' | 'business';
  phone?: string;
  messagingPrivacy?: 'everyone' | 'connections' | 'nobody';

  // Business-specific fields
  businessName?: string;
  businessType?: string;
  customBusinessType?: string;
  businessAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    lat: number;
    lng: number;
    formattedAddress: string;
  };
  stateOfIncorp?: string;

  // Tax & Verification
  isRegistered?: boolean;
  tinNumber?: string;
  tinValidationStatus?: 'valid' | 'invalid' | 'not_checked';
  tinValidationDetails?: {
    checkedAt: string;
    message: string;
    confidence: number;
  };
  profitStatus?: 'profit' | 'non-profit';

  // KYC & Beneficial Owners
  beneficialOwners?: Array<{
    name: string;
    title: string;
    ownershipPct: number;
    dob?: string;
  }>;
  verificationDocUrls?: string[];
  photoIdUrl?: string;

  // Admin & Moderation
  role?: 'admin' | 'business_owner' | 'user';
  isAdmin?: boolean;
  isBanned?: boolean;
  isDisabled?: boolean;
  adminReviewRequired?: boolean;
  adminApproved?: boolean;

  // Social
  blockedUsers?: string[];
  connections?: string[];

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  verifiedAt?: Timestamp | null;
  lastLoginAt?: Timestamp;

  // Extra fields for extensibility
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business listing stored in 'businesses' collection.
 * Represents a business/vendor profile with full details and analytics.
 *
 * Collection: /businesses/{businessId}
 * Indexed on: ownerId, category, heritage, verified, createdAt
 */
export interface BusinessListing {
  id?: string;
  name: string;
  emoji?: string;
  description?: string;
  category: string;
  heritage?: string | string[];
  ownerId: string;
  ownerName?: string;

  // Contact & Location
  phone?: string;
  email?: string;
  website?: string;
  hours?: string;
  location?: string;
  latitude?: number;
  longitude?: number;

  // Address components
  addressComponents?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  placeId?: string;

  // Business Details
  yearEstablished?: number;
  priceRange?: string;
  specialtyTags?: string[];
  paymentMethods?: string[];
  deliveryOptions?: string[];
  menu?: string;
  services?: string;

  // Media & Branding
  photos?: string[];
  coverPhotoIndex?: number;
  bgColor?: string;
  bookingUrl?: string;

  // Reviews & Ratings
  rating?: number;
  reviewCount?: number;
  deals?: Array<{
    id: string;
    title: string;
    description?: string;
    discount?: number;
    code?: string;
    expiresAt?: Timestamp;
  }>;

  // Verification & Compliance
  verified?: boolean;
  verifiedAt?: Timestamp;
  verificationMethod?: 'tin' | 'admin' | 'document';
  tin?: string;
  tinType?: 'EIN' | 'BN';
  tinVerified?: boolean;
  stateOfIncorp?: string;
  verificationDocs?: Array<{
    url: string;
    name: string;
    type: string;
    uploadedAt: Timestamp;
  }>;
  kycStatus?: 'pending' | 'in_review' | 'approved' | 'rejected';
  kycRejectionReason?: string;
  registrationStatus?: 'draft' | 'submitted' | 'approved' | 'rejected';

  // Beneficial Owners
  beneficialOwners?: Array<{
    name: string;
    title: string;
    ownershipPct: number;
    dob?: string;
  }>;

  // Social & Analytics
  followers?: string[];
  followerCount?: number;
  viewCount?: number;
  contactClicks?: number;
  shareCount?: number;

  // Content Moderation
  isHidden?: boolean;
  isVerified?: boolean;
  hiddenAt?: Timestamp;
  hiddenReason?: string;
  promoted?: boolean;

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Sign-up Progress
  signupDraft?: {
    currentStep: number;
    lastSavedAt: Timestamp;
    completedSteps: number[];
  };
  country?: 'US' | 'CA';

  // Extra fields for extensibility
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marketplace item (classifieds/for-sale listings) stored in 'marketplace' collection.
 * Individual items for sale or trade by users.
 *
 * Collection: /marketplace/{itemId}
 * Indexed on: sellerId, category, heritage, createdAt, status
 */
export interface MarketplaceItem {
  id?: string;
  title: string;
  description?: string;
  price?: number | string;
  category: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  heritage?: string | string[];
  sellerId: string;
  sellerName?: string;
  sellerAvatar?: string;

  // Location
  location?: string;
  locCity?: string;
  locState?: string;
  locZip?: string;
  latitude?: number;
  longitude?: number;

  // Product Details
  brand?: string;
  model?: string;
  photos?: string[];
  photoUrls?: string[];

  // Status & Visibility
  status?: 'available' | 'pending' | 'sold';
  isHidden?: boolean;
  promoted?: boolean;
  featured?: boolean;

  // Analytics
  viewCount?: number;
  saveCount?: number;

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Extra fields for extensibility
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event stored in 'events' collection.
 * Community events, cultural gatherings, and special occasions.
 *
 * Collection: /events/{eventId}
 * Indexed on: organizerId, category, heritage, createdAt, fullDate
 */
export interface EventDoc {
  id?: string;
  title: string;
  emoji?: string;
  description?: string;
  type?: string;
  category?: string;
  heritage?: string | string[];

  // Date & Time
  fullDate?: string;
  date?: string;
  time?: string;
  endDate?: string;
  endTime?: string;

  // Location
  location: string;
  locCity?: string;
  locState?: string;
  locZip?: string;
  latitude?: number;
  longitude?: number;

  // Organizer
  organizerId: string;
  organizer?: string;
  organizerName?: string;
  posterName?: string;
  posterId?: string;

  // Event Details
  desc?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Ticketing
  ticket?: 'free' | 'ticketed';
  price?: string | number;
  capacity?: number;
  status?: 'coming_soon' | 'active' | 'sold_out' | 'canceled' | 'postponed';
  ticketTiers?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sold: number;
    description?: string;
  }>;

  // Waitlist
  waitlistEnabled?: boolean;
  waitlistUsers?: string[];

  // Attendees
  rsvpUsers?: string[];
  count?: number;

  // Media
  photos?: string[];
  coverPhotoIndex?: number;

  // Moderation & Analytics
  promoted?: boolean;
  viewCount?: number;
  isHidden?: boolean;
  disabled?: boolean;
  hiddenAt?: Timestamp;
  hiddenReason?: string;

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Extra fields for extensibility
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED/POSTS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feed post stored in 'posts' collection.
 * Community posts, updates, and shared content.
 *
 * Collection: /posts/{postId}
 * Indexed on: authorId, createdAt, likes
 */
export interface FeedPost {
  id?: string;
  content?: string;
  type?: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;

  // Media
  mediaUrls?: string[];
  image?: string;

  // Engagement
  likes?: string[];
  likeCount?: number;
  comments?: Array<{
    id: string;
    text: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    createdAt: Timestamp;
  }>;
  commentCount?: number;

  // Content Moderation
  isHidden?: boolean;

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Extra fields for extensibility
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING/CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Message in a conversation stored in 'conversations/{conversationId}/messages/{messageId}'.
 * Supports text, voice, media, reactions, replies, and rich message types.
 */
export interface ChatMessage {
  id?: string;

  // Core Message
  text?: string;
  senderId: string;
  senderName?: string;

  // Message Type
  type?: 'text' | 'image' | 'file' | 'gif' | 'sticker' | 'voice' | 'system';
  mediaUrl?: string;

  // File Attachments
  file?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded
  };
  fileName?: string;
  fileSize?: number;

  // Voice Messages
  voiceMessage?: {
    duration: number;
    audioUrl?: string;
    transcription?: string;
  };

  // Image
  image?: string;

  // Rich Message Features
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
  };
  reactions?: Record<string, string[]>; // emoji -> userIds
  forwarded?: boolean;
  pinned?: boolean;
  starred?: boolean;

  // Call Events (for call messages)
  callEvent?: {
    type: 'missed' | 'completed' | 'rejected' | 'cancelled';
    callType: 'audio' | 'video';
    duration?: number; // seconds, only for completed calls
  };

  // Disappearing Messages
  disappearing?: boolean;
  disappearingDuration?: number; // milliseconds
  expiresAt?: Timestamp;

  // Message State
  encrypted?: boolean;
  isRead?: boolean;
  readAt?: Timestamp;
  deleted?: boolean;

  // Editing
  editedAt?: Timestamp;

  // Metadata
  createdAt?: Timestamp;

  // Extra fields for extensibility
  [key: string]: any;
}

/**
 * Conversation metadata stored in 'conversations/{conversationId}'.
 * Groups messages with participants and settings.
 */
export interface Conversation {
  id?: string;
  participants: string[]; // Array of user IDs
  participantNames?: Record<string, string>; // userId -> name
  participantAvatars?: Record<string, string>; // userId -> avatarUrl
  type?: 'direct' | 'group';
  groupName?: string;
  groupAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  messageCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATERING COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catering menu item stored in 'cateringMenuItems/{itemId}'.
 * Food/beverage offerings from catering vendors.
 */
export interface CateringMenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number; // cents
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  servesCount?: number;
  category: 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package';
  dietaryTags?: string[]; // vegetarian, vegan, halal, kosher, gluten_free, dairy_free, nut_free
  photoUrl?: string;
  available: boolean;
  minOrderQty?: number;
  maxOrderQty?: number;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockCount?: number;
  availableFrom?: string; // ISO date
  availableUntil?: string;
  prepTimeMinutes?: number;
  popularityScore?: number; // 0-100
  sortOrder?: number;
  archived?: boolean;
  createdAt?: Timestamp;
  [key: string]: any;
}

/**
 * Catering order stored in 'cateringOrders/{orderId}'.
 * Customer orders for catered food/beverages.
 */
export interface CateringOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessId: string;
  businessName: string;
  items: Array<{
    menuItemId: string;
    name: string;
    qty: number;
    unitPrice: number; // cents
    pricingType: string;
    specialInstructions?: string;
  }>;
  subtotal: number; // cents
  serviceFee?: number;
  deliveryFee?: number;
  tax?: number;
  total: number; // cents
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  eventDate: Timestamp;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  headcount: number;
  specialInstructions?: string;
  contactName: string;
  contactPhone: string;
  eventType?: string;
  estimatedDeliveryTime?: string;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  paymentUrl?: string;
  paymentMethod?: string;
  vendorModified?: boolean;
  createdAt?: Timestamp;
  [key: string]: any;
}

/**
 * Catering quote request stored in 'cateringQuoteRequests/{requestId}'.
 * RFP for catering services from customers.
 */
export interface CateringQuoteRequest {
  id: string;
  customerId: string;
  customerName?: string;
  deliveryCity: string;
  cuisineCategory: string;
  eventType?: string;
  eventDate: Timestamp;
  headcount: number;
  items: Array<{
    name: string;
    description?: string;
    qty: number;
    pricingType: 'per_person' | 'per_tray' | 'flat_rate';
    dietaryTags?: string[];
  }>;
  specialInstructions?: string;
  status: 'open' | 'reviewing' | 'accepted' | 'expired' | 'cancelled';
  responseCount: number;
  expiresAt?: Timestamp;
  createdAt?: Timestamp;
  [key: string]: any;
}

/**
 * Catering quote response stored in 'cateringQuoteResponses/{responseId}'.
 * Vendor's response to a quote request.
 */
export interface CateringQuoteResponse {
  id: string;
  quoteRequestId: string;
  businessId: string;
  businessName: string;
  businessRating?: number;
  quotedItems: Array<{
    name: string;
    qty: number;
    unitPrice: number; // cents
    pricingType: string;
  }>;
  subtotal: number; // cents
  serviceFee?: number;
  deliveryFee?: number;
  total: number; // cents
  estimatedPrepTime?: string;
  message?: string;
  status: 'submitted' | 'accepted' | 'declined' | 'expired';
  createdAt?: Timestamp;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODERATION & METADATA COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Banned user record stored in 'bannedUsers/{uid}'.
 * Simple marker document indicating user is banned.
 */
export interface BannedUser {
  uid: string;
  bannedAt?: Timestamp;
  bannedBy?: string;
  reason?: string;
  [key: string]: any;
}

/**
 * Disabled user record stored in 'disabledUsers/{uid}'.
 * Simple marker document indicating user account is disabled.
 */
export interface DisabledUser {
  uid: string;
  disabledAt?: Timestamp;
  disabledBy?: string;
  reason?: string;
  [key: string]: any;
}

/**
 * App configuration stored in 'appConfig/settings'.
 * Global application settings and admin lists.
 */
export interface AppConfig {
  adminEmails?: string[];
  settings?: Record<string, any>;
  featureFlags?: Record<string, boolean>;
  [key: string]: any;
}

/**
 * Generic report/flag record stored in 'reports/{reportId}'.
 * User reports for content, accounts, or issues.
 */
export interface Report {
  id?: string;
  type: 'content' | 'user' | 'business' | 'event' | 'marketplace_item';
  reportedItemId: string;
  reportedBy: string;
  reporterName?: string;
  category: string;
  description?: string;
  status?: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolution?: string;
  createdAt?: Timestamp;
  resolvedAt?: Timestamp;
  [key: string]: any;
}
