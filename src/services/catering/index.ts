// ═══════════════════════════════════════════════════════════════════════
// CATERING SERVICE — Barrel re-export from domain sub-modules
// All existing imports from '@/services/cateringService' continue to work.
// ═══════════════════════════════════════════════════════════════════════

// Types
export type {
  CateringMenuItem,
  MenuCategory,
  MenuTemplateItem,
  MenuTemplate,
  MenuTemplateType,
  ParsedMenuItem,
  VendorImageAuditEntry,
  OrderItem,
  DeliveryAddress,
  OrderForContext,
  CateringOrder,
  QuoteRequestItem,
  ItemAssignment,
  CateringQuoteRequest,
  CateringQuoteResponse,
  QuotedItem,
  CateringReview,
  FavoriteOrder,
  RecurrenceInterval,
  RecurrenceSchedule,
  OccurrenceOverride,
  RecurringOrder,
  OrderTemplate,
  OrderNote,
} from './cateringTypes';

// Menu items & inventory
export {
  fetchMenuItemsByBusiness,
  fetchMenuItemsByCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updateMenuItemStock,
  // Vendor Storefront Builder
  fetchAllMenuItemsByBusiness,
  subscribeToMenuItems,
  batchCreateMenuItems,
  archiveMenuItem,
  restoreMenuItem,
  logImageUpload,
} from './cateringMenu';

// Orders, payments, messaging
export {
  createOrder,
  fetchOrdersByCustomer,
  fetchOrdersByBusiness,
  subscribeToCustomerOrders,
  subscribeToBusinessOrders,
  updateOrderStatus,
  isValidStatusTransition,
  cancelOrder,
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  formatPrice,
  calculateOrderTotal,
  batchUpdateOrderStatus,
  vendorModifyOrder,
  updateBusinessPaymentInfo,
  getBusinessPaymentInfo,
  updateOrderPaymentStatus,
  findOrCreateConversation,
  createOrdersFromQuote,
  addOrderNote,
  subscribeToOrderNotes,
  markOrderNotesRead,
} from './cateringOrders';

// Quote requests & responses
export {
  createQuoteRequest,
  isQuoteRequestEditable,
  quoteEditTimeRemaining,
  updateQuoteRequest,
  fetchQuoteRequestsByCustomer,
  fetchOpenQuoteRequests,
  fetchQuoteRequestsForBusiness,
  subscribeToCustomerQuoteRequests,
  updateQuoteRequestStatus,
  createQuoteResponse,
  fetchQuoteResponsesByRequest,
  fetchQuoteResponsesByBusiness,
  subscribeToQuoteResponses,
  acceptQuoteResponse,
  declineQuoteResponse,
  acceptQuoteResponseItems,
  finalizeQuoteRequest,
  subscribeToBusinessQuoteResponses,
  updateQuoteResponse,
  isQuoteResponseEditable,
} from './cateringQuotes';

// Reviews
export {
  fetchCateringReviews,
  submitCateringReview,
  hasReviewedOrder,
  batchHasReviewedOrders,
  addVendorResponse,
  flagReview,
  fetchFlaggedReviews,
  dismissFlaggedReview,
  hideReview,
} from './cateringReviews';

// Favorites & recurring orders
export {
  saveFavoriteOrder,
  fetchFavoriteOrders,
  subscribeToFavorites,
  updateFavoriteOrder,
  deleteFavoriteOrder,
  reorderFromFavorite,
  computeNextRunDate,
  estimateMonthlyRecurringCost,
  estimateMonthlyRecurringCostLive,
  createRecurringOrder,
  fetchRecurringOrders,
  subscribeToRecurringOrders,
  updateRecurringOrder,
  deleteRecurringOrder,
  toggleRecurringOrder,
  setOccurrenceOverride,
  clearOccurrenceOverride,
  fetchRecurringExecutionHistory,
} from './cateringRecurring';

// Order templates
export {
  createOrderTemplate,
  fetchMyTemplates,
  fetchOrgTemplates,
  fetchTemplateByShareCode,
  updateOrderTemplate,
  deleteOrderTemplate,
  recordTemplateUsage,
  subscribeToTemplates,
  fetchPublicTemplates,
  fetchTemplateUsageStats,
  fetchArchivedVersions,
} from './cateringTemplates';

// Notifications
export type { CateringNotification } from './cateringNotifications';
export {
  sendCateringNotification,
  notifyVendorNewOrder,
  notifyCustomerStatusChange,
  notifyCustomerOrderModified,
  notifyVendorModificationRejected,
  fetchCateringNotifications,
  subscribeToCateringNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from './cateringNotifications';

// Notification types & preferences (Phase 1–4)
export type {
  NotificationUrgency,
  NotificationCategory,
  NotificationEventType,
  NotificationEventConfig,
  NotificationPreferences,
  NotificationDocument,
  EmailTemplate,
  SmsTemplate,
} from './notificationTypes';
export {
  URGENCY_CHANNELS,
  NOTIFICATION_EVENTS,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from './notificationTypes';
export {
  getNotificationPreferences,
  saveNotificationPreferences,
  toggleCategoryChannel,
  updateQuietHours,
  resolveChannels,
  isInQuietHours,
  getEffectiveChannels,
} from './notificationPreferences';
