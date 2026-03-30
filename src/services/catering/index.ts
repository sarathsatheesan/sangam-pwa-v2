// ═══════════════════════════════════════════════════════════════════════
// CATERING SERVICE — Barrel re-export from domain sub-modules
// All existing imports from '@/services/cateringService' continue to work.
// ═══════════════════════════════════════════════════════════════════════

// Types
export type {
  CateringMenuItem,
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
} from './cateringTypes';

// Menu items & inventory
export {
  fetchMenuItemsByBusiness,
  fetchMenuItemsByCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updateMenuItemStock,
} from './cateringMenu';

// Orders, payments, messaging
export {
  createOrder,
  fetchOrdersByCustomer,
  fetchOrdersByBusiness,
  subscribeToCustomerOrders,
  subscribeToBusinessOrders,
  updateOrderStatus,
  cancelOrder,
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  formatPrice,
  calculateOrderTotal,
  batchUpdateOrderStatus,
  vendorModifyOrder,
  updateBusinessPaymentInfo,
  getBusinessPaymentInfo,
  findOrCreateConversation,
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
} from './cateringQuotes';

// Reviews
export {
  fetchCateringReviews,
  submitCateringReview,
  hasReviewedOrder,
  addVendorResponse,
  flagReview,
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
  createRecurringOrder,
  fetchRecurringOrders,
  subscribeToRecurringOrders,
  updateRecurringOrder,
  deleteRecurringOrder,
  toggleRecurringOrder,
  setOccurrenceOverride,
  clearOccurrenceOverride,
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
} from './cateringTemplates';
