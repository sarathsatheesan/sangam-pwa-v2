import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
const en = {
  "status": {
    "pending": "Order Placed",
    "confirmed": "Order Confirmed",
    "preparing": "Preparing",
    "ready": "Ready for Pickup/Delivery",
    "out_for_delivery": "Out for Delivery",
    "delivered": "Delivered",
    "cancelled": "Cancelled"
  },
  "errors": {
    "orderNotFound": "Order not found",
    "invalidTransition": "Invalid status transition: {{from}} → {{to}}",
    "unauthorized": "Only the vendor can advance order status",
    "invalidETA": "Delivery ETA must be in the future",
    "etaAfterEvent": "Delivery ETA must be before the event date",
    "headcountMin": "Headcount must be at least 1",
    "headcountMax": "Headcount cannot exceed 10,000",
    "failedToAccept": "Failed to accept and finalize order",
    "failedToDecline": "Failed to decline quote",
    "failedToSubmit": "Failed to submit quote"
  },
  "toast": {
    "orderAccepted": "Order accepted and created! Track it in your orders tab.",
    "ordersAccepted": "{{count}} orders accepted and created. Track them in your orders tab.",
    "ordersAlreadyCreated": "Orders were already created for this request. Check your orders tab.",
    "quoteDeclined": "Quote declined",
    "repriceRequested": "Reprice request sent to vendor",
    "orderCancelled": "Order cancelled successfully"
  },
  "labels": {
    "notifications": "Notifications",
    "markAllRead": "Mark all read",
    "noNotifications": "No notifications yet",
    "orderTimeline": "Order Timeline",
    "specialInstructions": "Special Instructions",
    "deliveryAddress": "Delivery Address",
    "headcount": "Headcount",
    "eventDate": "Event Date",
    "subtotal": "Subtotal",
    "tax": "Tax",
    "total": "Total",
    "loadMore": "Load More Orders",
    "noOrders": "No orders yet"
  },
  "actions": {
    "acceptAndFinalize": "Accept & Finalize",
    "decline": "Decline",
    "cancel": "Cancel Order",
    "requestReprice": "Request Reprice",
    "submitQuote": "Submit Quote",
    "viewOrders": "View Orders",
    "retry": "Try Again",
    "goBack": "Go Back"
  },
  "currency": {
    "symbol": "$",
    "code": "USD"
  }
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { catering: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['catering'],
    defaultNS: 'catering',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
