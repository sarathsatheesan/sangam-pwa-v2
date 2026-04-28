import { useTranslation } from 'react-i18next';

/**
 * Custom hook for accessing catering module translations.
 *
 * Usage:
 * const t = useI18nCatering();
 *
 * Display order status:
 * <p>{t('status.pending')}</p>
 *
 * Display error with interpolation:
 * <p>{t('errors.invalidTransition', { from: 'pending', to: 'ready' })}</p>
 *
 * Display plural messages (requires i18next plugin):
 * <p>{t('toast.ordersAccepted', { count: 5 })}</p>
 */
export function useI18nCatering() {
  const { t } = useTranslation('catering');
  return t;
}

/**
 * Type-safe translation key helper.
 * Prevents runtime errors by ensuring keys exist at compile time.
 */
export const cateringKeys = {
  // Status keys
  status: {
    pending: 'status.pending',
    confirmed: 'status.confirmed',
    preparing: 'status.preparing',
    ready: 'status.ready',
    out_for_delivery: 'status.out_for_delivery',
    delivered: 'status.delivered',
    cancelled: 'status.cancelled',
  },
  // Error keys
  errors: {
    orderNotFound: 'errors.orderNotFound',
    invalidTransition: 'errors.invalidTransition',
    unauthorized: 'errors.unauthorized',
    invalidETA: 'errors.invalidETA',
    etaAfterEvent: 'errors.etaAfterEvent',
    headcountMin: 'errors.headcountMin',
    headcountMax: 'errors.headcountMax',
    failedToAccept: 'errors.failedToAccept',
    failedToDecline: 'errors.failedToDecline',
    failedToSubmit: 'errors.failedToSubmit',
  },
  // Toast keys
  toast: {
    orderAccepted: 'toast.orderAccepted',
    ordersAccepted: 'toast.ordersAccepted',
    ordersAlreadyCreated: 'toast.ordersAlreadyCreated',
    quoteDeclined: 'toast.quoteDeclined',
    repriceRequested: 'toast.repriceRequested',
    orderCancelled: 'toast.orderCancelled',
  },
  // Label keys
  labels: {
    notifications: 'labels.notifications',
    markAllRead: 'labels.markAllRead',
    noNotifications: 'labels.noNotifications',
    orderTimeline: 'labels.orderTimeline',
    specialInstructions: 'labels.specialInstructions',
    deliveryAddress: 'labels.deliveryAddress',
    headcount: 'labels.headcount',
    eventDate: 'labels.eventDate',
    subtotal: 'labels.subtotal',
    tax: 'labels.tax',
    total: 'labels.total',
    loadMore: 'labels.loadMore',
    noOrders: 'labels.noOrders',
  },
  // Action keys
  actions: {
    acceptAndFinalize: 'actions.acceptAndFinalize',
    decline: 'actions.decline',
    cancel: 'actions.cancel',
    requestReprice: 'actions.requestReprice',
    submitQuote: 'actions.submitQuote',
    viewOrders: 'actions.viewOrders',
    retry: 'actions.retry',
    goBack: 'actions.goBack',
  },
  // Currency keys
  currency: {
    symbol: 'currency.symbol',
    code: 'currency.code',
  },
} as const;
