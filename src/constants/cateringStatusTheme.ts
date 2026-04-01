// ═══════════════════════════════════════════════════════════════════════
// SB-10: Shared Status Theme — single source of truth for both personas
// ═══════════════════════════════════════════════════════════════════════

/**
 * Consistent color palette for catering order status across
 * Customer (CateringOrderStatus) and Vendor (VendorCateringDashboard).
 */
export const STATUS_THEME: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    description: 'Waiting for vendor to confirm',
  },
  confirmed: {
    label: 'Confirmed',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    description: 'Vendor has accepted this order',
  },
  preparing: {
    label: 'Preparing',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    description: 'Food is being prepared',
  },
  ready: {
    label: 'Ready',
    color: '#10B981',
    bgColor: '#D1FAE5',
    description: 'Order is ready for pickup/delivery',
  },
  out_for_delivery: {
    label: 'On the Way',
    color: '#0EA5E9',
    bgColor: '#E0F2FE',
    description: 'Order is out for delivery',
  },
  delivered: {
    label: 'Delivered',
    color: '#059669',
    bgColor: '#A7F3D0',
    description: 'Order has been delivered',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    description: 'Order was cancelled',
  },
};

/** Customer-facing step labels (slightly different wording) */
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Delivery',
  out_for_delivery: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
