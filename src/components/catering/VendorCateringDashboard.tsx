// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR CATERING DASHBOARD
// Business owners view incoming catering orders and manage them.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  Package, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  User, MapPin, Phone, Calendar, Users, Loader2, AlertCircle, Truck, Ban,
  Square, CheckSquare, Pencil, CreditCard, ExternalLink, Save, X, Bell,
  MessageSquare, Volume2, VolumeX, BellRing, Timer, Clock3,
} from 'lucide-react';
import type { CateringOrder, OrderItem } from '@/services/cateringService';
import {
  subscribeToBusinessOrders,
  updateOrderStatus,
  cancelOrder,
  batchUpdateOrderStatus,
  vendorModifyOrder,
  updateBusinessPaymentInfo,
  getBusinessPaymentInfo,
  deferPaymentSetup,
  formatPrice,
  calculateOrderTotal,
  getTaxRate,
  subscribeToCateringNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  toEpochMs,
  toDate,
} from '@/services/cateringService';
import type { CateringNotification } from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import OrderTimeline from './OrderTimeline';
import OrderMessages from './OrderMessages';
import ReviewModerationPanel from './ReviewModerationPanel';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { STATUS_THEME } from '@/constants/cateringStatusTheme';
import {
  NewOrderBanner,
  ReminderAlerts,
  VendorNotificationPanel,
  PaymentSetupBanner,
  ReminderSettingsModal,
  CancelOrderModal,
  BatchActionBar,
  OnboardingPills,
} from './vendor';
import PendingOrdersSection from './vendor/PendingOrdersSection';
import ActiveOrdersSection from './vendor/ActiveOrdersSection';
import CompletedOrdersSection from './vendor/CompletedOrdersSection';
import CancelledOrdersSection from './vendor/CancelledOrdersSection';

interface VendorCateringDashboardProps {
  businessId: string;
  businessName: string;
  /**
   * Optional callback invoked when the user clicks an onboarding pill whose
   * action belongs to a sibling tab (e.g. "Add menu items" → 'menu').
   * The parent (catering.tsx) owns the vendor tab state, so we emit the
   * requested tab key and let the parent switch. Kept optional so the
   * component stays usable in isolation (tests, storybook).
   */
  onSwitchVendorTab?: (tab: 'orders' | 'quotes' | 'analytics' | 'reviews' | 'inventory' | 'menu') => void;
}

// SB-10: Derive vendor STATUS_CONFIG from shared STATUS_THEME + add icons
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={14} />,
  confirmed: <CheckCircle2 size={14} />,
  preparing: <Package size={14} />,
  ready: <CheckCircle2 size={14} />,
  out_for_delivery: <Truck size={14} />,
  delivered: <CheckCircle2 size={14} />,
  cancelled: <XCircle size={14} />,
};
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> =
  Object.fromEntries(
    Object.entries(STATUS_THEME).map(([key, theme]) => [
      key,
      { ...theme, icon: STATUS_ICONS[key] || <Clock size={14} /> },
    ]),
  );

// SB-31: Format ETA value based on mode (time or duration)
function formatEtaValue(value: string, mode: string): string {
  if (!value) return '';
  if (mode === 'duration') return `~${value} min`;
  // Convert 24h to 12h format
  const [h, m] = value.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function VendorCateringDashboard({ businessId, businessName, onSwitchVendorTab }: VendorCateringDashboardProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // Deep-link: read #order-{id} from URL hash to auto-expand an order
  const [expandedOrder, setExpandedOrder] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#order-', '');
      return hash && hash !== '' ? hash : null;
    }
    return null;
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const { addToast } = useToast();

  // ── Accordion section state ──
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    pending: false,   // collapsed by default
    active: true,     // expanded by default
    completed: false, // collapsed by default
    cancelled: false, // collapsed by default
  });
  const toggleSection = (key: string) => setSectionExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Independent sort per section (by date) ──
  type SortDir = 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc';
  const [sortDir, setSortDir] = useState<Record<string, SortDir>>({
    pending: 'date-newest',
    active: 'date-newest',
    completed: 'date-newest',
    cancelled: 'date-newest',
  });
  const setSort = (key: string, value: SortDir) =>
    setSortDir((prev) => ({ ...prev, [key]: value }));

  // ── Vendor reminder preferences ──
  const [reminderSettings, setReminderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(`ethnicity_vendor_reminders_${businessId}`);
      return saved ? JSON.parse(saved) : {
        pendingAlert: true,        // alert on new pending orders
        preparingReminder: true,   // remind when order is in preparing too long
        eventDayReminder: true,    // remind on event day morning
        reminderLeadHours: 24,     // hours before event to remind
      };
    } catch { return { pendingAlert: true, preparingReminder: true, eventDayReminder: true, reminderLeadHours: 24 }; }
  });
  const [showReminderSettings, setShowReminderSettings] = useState(false);

  const saveReminderSettings = (settings: typeof reminderSettings) => {
    setReminderSettings(settings);
    try { localStorage.setItem(`ethnicity_vendor_reminders_${businessId}`, JSON.stringify(settings)); } catch {}
  };

  // ── SB-14: New order alert state ──
  const [newOrderBanner, setNewOrderBanner] = useState<{ orderId: string; customerName: string; total: number } | null>(null);
  const prevOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isFirstLoadRef = React.useRef(true);
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  // ── Vendor messaging state (H-04) ──
  // messaging modal state removed — now using inline OrderMessages component

  useEffect(() => {
    const unsub = subscribeToBusinessOrders(businessId, async (incoming) => {
      // SB-14: Detect genuinely new orders after initial load
      if (isFirstLoadRef.current) {
        prevOrderIdsRef.current = new Set(incoming.map(o => o.id));
        isFirstLoadRef.current = false;
      } else {
        const prevIds = prevOrderIdsRef.current;
        const newPendingOrders = incoming.filter(o => !prevIds.has(o.id) && o.status === 'pending');
        if (newPendingOrders.length > 0) {
          const newest = newPendingOrders[0];
          setNewOrderBanner({ orderId: newest.id, customerName: newest.customerName || 'Customer', total: newest.total });
          // SB-33: Play audio chime (guarded by audioMuted)
          // Web Audio API — reuse a single AudioContext to prevent Safari memory leaks
          if (!audioMuted) {
            try {
              if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              const audioCtx = audioCtxRef.current;
              // iOS Safari / Chrome require explicit resume after user gesture
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
              }
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime);
              osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
              osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
              osc.start(audioCtx.currentTime);
              osc.stop(audioCtx.currentTime + 0.5);
            } catch { /* audio not available — silent fallback */ }
          }
          // Auto-dismiss banner after 15 seconds
          setTimeout(() => setNewOrderBanner(null), 15000);
        }
        prevOrderIdsRef.current = new Set(incoming.map(o => o.id));
      }
      setOrders(incoming);
      setLoading(false);
    });
    return unsub;
  }, [businessId]);

  // Cleanup AudioContext on unmount to prevent Safari memory leak
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // ETA inputs per order (vendor enters before dispatching for delivery)
  const [etaInputs, setEtaInputs] = useState<Record<string, string>>({});

  // SB-32: Vendor pause/capacity toggle
  const [isPaused, setIsPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  // SB-33: Audio mute control
  const [audioMuted, setAudioMuted] = useState(() => {
    try { return localStorage.getItem('ethnicity_vendor_audio_muted') === 'true'; } catch { return false; }
  });

  // ── Batch selection state (#17) ──
  const [batchMode, setBatchMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchDeclineConfirm, setShowBatchDeclineConfirm] = useState(false);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const handleBatchAction = async (action: 'confirmed' | 'cancelled') => {
    if (selectedOrders.size === 0) return;
    setBatchLoading(true);

    // Capture previous statuses for rollback
    const previousStatuses = new Map<string, CateringOrder['status']>();
    orders.forEach(order => {
      if (selectedOrders.has(order.id)) {
        previousStatuses.set(order.id, order.status);
      }
    });

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      selectedOrders.has(o.id) ? { ...o, status: action } : o
    ));

    // Clear selection immediately
    setSelectedOrders(new Set());

    try {
      const result = await batchUpdateOrderStatus([...previousStatuses.keys()], action);
      addToast(`${result.success} order(s) ${action}${result.failed ? `, ${result.failed} failed` : ''}`, 'success');
      setBatchMode(false);
    } catch (err: any) {
      // Revert to previous statuses
      setOrders(prev => prev.map(o =>
        previousStatuses.has(o.id) ? { ...o, status: previousStatuses.get(o.id)! } : o
      ));
      addToast(err.message || 'Batch action failed', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  // ── Order modification state (#18) ──
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Pagination state (V-06) ──
  const ORDERS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // ── Notification state (V-12) — subscribed to real-time feed (F-05 fix) ──
  const [notifications, setNotifications] = useState<CateringNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // F-05: Subscribe to vendor notifications
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToCateringNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });
    return unsub;
  }, [user?.uid]);

  // ── Reminder engine — check orders on interval and surface alerts ──
  const [activeReminders, setActiveReminders] = useState<Array<{ id: string; type: string; message: string; orderId: string }>>([]);
  useEffect(() => {
    if (!reminderSettings.pendingAlert && !reminderSettings.preparingReminder && !reminderSettings.eventDayReminder) return;
    const check = () => {
      const now = Date.now();
      const reminders: typeof activeReminders = [];

      for (const order of orders) {
        const eventMs = toDate(order.eventDate).getTime();
        const createdMs = toEpochMs(order.createdAt);

        // Pending orders sitting > 30 min
        if (reminderSettings.pendingAlert && order.status === 'pending' && createdMs && (now - createdMs) > 30 * 60 * 1000) {
          const elapsedMin = Math.round((now - createdMs) / 60000);
          const waitLabel = elapsedMin < 60 ? `${elapsedMin} min` : elapsedMin < 1440 ? `${(elapsedMin / 60).toFixed(1)} hrs` : `${(elapsedMin / 1440).toFixed(1)} days`;
          reminders.push({ id: `pending_${order.id}`, type: 'pending', message: `Order from ${order.customerName} has been waiting ${waitLabel}`, orderId: order.id });
        }
        // Preparing > 2 hours
        if (reminderSettings.preparingReminder && order.status === 'preparing') {
          const confirmedMs = toEpochMs(order.confirmedAt);
          if (confirmedMs && (now - confirmedMs) > 2 * 60 * 60 * 1000) {
            reminders.push({ id: `preparing_${order.id}`, type: 'preparing', message: `Order for ${order.customerName} has been preparing for ${Math.round((now - confirmedMs) / 3600000)}h`, orderId: order.id });
          }
        }
        // Event day reminder
        if (reminderSettings.eventDayReminder && eventMs && !['delivered', 'cancelled'].includes(order.status)) {
          const hoursUntilEvent = (eventMs - now) / (1000 * 60 * 60);
          if (hoursUntilEvent > 0 && hoursUntilEvent <= reminderSettings.reminderLeadHours) {
            reminders.push({ id: `event_${order.id}`, type: 'event', message: `Event for ${order.customerName} is in ${hoursUntilEvent < 1 ? 'less than 1 hour' : `${Math.round(hoursUntilEvent)}h`}`, orderId: order.id });
          }
        }
      }
      setActiveReminders(reminders);
    };
    check();
    const interval = setInterval(check, 60000); // Re-check every minute
    return () => clearInterval(interval);
  }, [orders, reminderSettings]);

  // SB-32: Load vendor pause state
  useEffect(() => {
    const loadPauseState = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/services/firebase');
        const bizSnap = await getDoc(doc(db, 'businesses', businessId));
        if (bizSnap.exists()) {
          setIsPaused(bizSnap.data()?.cateringPaused === true);
        }
      } catch { /* silent */ }
    };
    loadPauseState();
  }, [businessId]);

  const startEditOrder = (order: CateringOrder) => {
    setEditingOrderId(order.id);
    setEditItems([...order.items]);
    setEditNote('');
  };

  const handleSaveModification = async (order: CateringOrder) => {
    if (!editNote.trim()) { addToast('Please add a note explaining the change', 'error'); return; }
    setEditSaving(true);

    // Calculate new totals
    const subtotal = editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const tax = Math.round(subtotal * getTaxRate(order.deliveryAddress?.state));
    const total = subtotal + tax;

    // Capture previous state for rollback
    const previousItems = order.items;
    const previousSubtotal = order.subtotal;
    const previousTax = order.tax;
    const previousTotal = order.total;

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, items: editItems, subtotal, tax, total }
        : o
    ));

    // Close edit form immediately
    setEditingOrderId(null);

    try {
      await vendorModifyOrder(order.id, {
        items: editItems,
        subtotal,
        tax,
        total,
        note: editNote.trim(),
      });
      addToast('Order modified. Customer will be notified.', 'success');
    } catch (err: any) {
      // Revert to previous state
      setOrders(prev => prev.map(o =>
        o.id === order.id
          ? {
              ...o,
              items: previousItems,
              subtotal: previousSubtotal,
              tax: previousTax,
              total: previousTotal,
            }
          : o
      ));
      addToast(err.message || 'Failed to modify order', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Payment settings state (#13) ──
  // Payment setup is OPTIONAL. Vendors can accept & manage orders without it.
  // A vendor who isn't ready can defer with "Remind me later" — the banner hides
  // until the deferral expires. Saving valid payment info clears the deferral.
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSkippedUntil, setPaymentSkippedUntil] = useState<number | null>(null);
  const [paymentDeferring, setPaymentDeferring] = useState(false);

  useEffect(() => {
    getBusinessPaymentInfo(businessId).then(info => {
      setPaymentUrl(info.paymentUrl || '');
      setPaymentMethod(info.paymentMethod || '');
      setPaymentNote(info.paymentNote || '');
      setPaymentSkippedUntil(info.paymentSetupSkippedUntil ?? null);
    }).catch(() => {});
  }, [businessId]);

  // Derived: does the vendor have any payment info configured at all?
  const hasPaymentInfo = !!(paymentUrl?.trim() || paymentMethod?.trim() || paymentNote?.trim());

  // Derived: should we show the "set up payment" reminder banner? Hide when
  // info is already saved OR when the vendor deferred and the deadline hasn't
  // passed yet. Uses epoch millis → works identically on every browser.
  const now = Date.now();
  const paymentReminderHidden = paymentSkippedUntil !== null && paymentSkippedUntil > now;
  const showPaymentReminder = !hasPaymentInfo && !paymentReminderHidden && !showPaymentSettings;

  const handleSavePayment = async () => {
    setPaymentSaving(true);
    try {
      await updateBusinessPaymentInfo(businessId, { paymentUrl, paymentMethod, paymentNote });
      setPaymentSkippedUntil(null); // saving implicitly clears deferral
      addToast('Payment info saved', 'success');
      setShowPaymentSettings(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeferPayment = async (days: number) => {
    setPaymentDeferring(true);
    try {
      await deferPaymentSetup(businessId, days);
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      setPaymentSkippedUntil(until);
      addToast(`Reminder set — we'll nudge you in ${days} day${days === 1 ? '' : 's'}.`, 'info');
      setShowPaymentSettings(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to set reminder', 'error');
    } finally {
      setPaymentDeferring(false);
    }
  };

  // Format a skipped-until timestamp into a human-readable snooze date.
  // Uses the browser's locale via Intl.DateTimeFormat (supported on all targets).
  const formatSnoozeDate = (ms: number): string => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ms));
    } catch {
      return new Date(ms).toDateString();
    }
  };

  // Cancel order state
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherText, setCancelOtherText] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const cancelDialogClose = useCallback(() => {
    if (!cancelSubmitting) setCancellingOrderId(null);
  }, [cancelSubmitting]);
  const { modalRef: cancelModalRef, handleKeyDown: cancelKeyDown } = useModalA11y(
    !!cancellingOrderId,
    cancelDialogClose,
  );

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    const reason = cancelReason === 'Other' ? cancelOtherText.trim() || 'Other' : cancelReason;
    if (!reason) { addToast('Please select a reason', 'error'); return; }
    setCancelSubmitting(true);

    // Capture previous status for rollback
    const orderToCancel = orders.find(o => o.id === cancellingOrderId);
    const previousStatus = orderToCancel?.status;

    // Optimistically set status to cancelled
    setOrders(prev => prev.map(o =>
      o.id === cancellingOrderId ? { ...o, status: 'cancelled' } : o
    ));

    // Close dialog immediately
    setCancellingOrderId(null);
    setCancelReason('');
    setCancelOtherText('');

    try {
      await cancelOrder(cancellingOrderId, reason, 'vendor');
      addToast('Order cancelled', 'success');
    } catch (err: any) {
      // Revert to previous status
      if (previousStatus) {
        setOrders(prev => prev.map(o =>
          o.id === cancellingOrderId ? { ...o, status: previousStatus } : o
        ));
      }
      addToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: CateringOrder['status'], extra?: Record<string, any>) => {
    setActionLoading(orderId);

    // Capture previous status for rollback
    const orderToUpdate = orders.find(o => o.id === orderId);
    const prevStatus = orderToUpdate?.status;

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ));

    try {
      await updateOrderStatus(orderId, newStatus, extra);
      addToast(`Order ${newStatus.replace(/_/g, ' ')}`, 'success');
    } catch (err: any) {
      // Revert to previous status
      if (prevStatus) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: prevStatus } : o
        ));
      }
      addToast(err.message || 'Failed to update order', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // SB-32: Toggle vendor pause state
  const handleTogglePause = async () => {
    setPauseLoading(true);
    const newPaused = !isPaused;
    setIsPaused(newPaused); // Optimistic
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/services/firebase');
      await updateDoc(doc(db, 'businesses', businessId), {
        cateringPaused: newPaused,
      });
    } catch {
      setIsPaused(!newPaused); // Revert
    } finally {
      setPauseLoading(false);
    }
  };

  // SB-33: Toggle audio mute
  const handleToggleAudio = () => {
    const newMuted = !audioMuted;
    setAudioMuted(newMuted);
    try { localStorage.setItem('ethnicity_vendor_audio_muted', String(newMuted)); } catch {}
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'active') return ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
    if (filter === 'completed') return ['delivered', 'cancelled'].includes(o.status);
    return true;
  });

  // Reset page to 1 when filter changes (V-06)
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Compute paginated orders (V-06)
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // ── Accordion section groupings ──
  const sortOrders = (list: CateringOrder[], dir: SortDir): CateringOrder[] => {
    return [...list].sort((a, b) => {
      if (dir === 'name-asc' || dir === 'name-desc') {
        const nameA = (a.customerName || '').toLowerCase();
        const nameB = (b.customerName || '').toLowerCase();
        const cmp = nameA.localeCompare(nameB, 'en-US', { sensitivity: 'base' });
        return dir === 'name-asc' ? cmp : -cmp;
      }
      const aMs = toDate(a.eventDate).getTime();
      const bMs = toDate(b.eventDate).getTime();
      return dir === 'date-newest' ? bMs - aMs : aMs - bMs;
    });
  };
  const pendingOrders = sortOrders(orders.filter(o => o.status === 'pending'), sortDir.pending);
  const activeOrders = sortOrders(orders.filter(o => ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)), sortDir.active);
  const completedOrders = sortOrders(orders.filter(o => o.status === 'delivered'), sortDir.completed);
  const cancelledOrders = sortOrders(orders.filter(o => o.status === 'cancelled'), sortDir.cancelled);

  const formatEventDate = (eventDate: any, eventTime?: string): string => {
    if (!eventDate) return '—';
    const d = toDate(eventDate);
    if (!d) return String(eventDate);
    let str = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (eventTime) {
      const [h, m] = eventTime.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      str += ` at ${hour12}:${String(m).padStart(2, '0')} ${period}`;
    }
    return str;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-accent)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SB-14: New order persistent banner */}
      <NewOrderBanner
        banner={newOrderBanner}
        onDismiss={() => setNewOrderBanner(null)}
        onView={(orderId) => {
          setExpandedOrder(orderId);
          setFilter('pending');
          setNewOrderBanner(null);
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          UNIFIED COMMAND BAR
          Replaces the previous 3-row stack (title/toolbar, pause strip,
          separate pending badge). One row on desktop, two rows on mobile.
          Left cluster = status + pending chip (what's happening now).
          Right cluster = actions (icons for low-density tools, a button for
          Batch which is workflow-critical). Payment + Reminders live in the
          kebab "More" menu to reduce density — they surface contextually
          elsewhere (payment banner, reminder chime). */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2 rounded-xl border"
        style={{
          borderColor: isPaused ? '#FECACA' : 'var(--aurora-border, #e5e7eb)',
          backgroundColor: isPaused ? '#FEF2F2' : 'rgba(99,102,241,0.03)',
        }}
      >
        {/* Status cluster — at-a-glance what the vendor needs to know */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Status dot + label */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: isPaused ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: isPaused ? '#EF4444' : '#10B981',
                boxShadow: isPaused ? 'none' : '0 0 0 0 rgba(16, 185, 129, 0.5)',
                animation: isPaused ? 'none' : 'vendorStatusPulse 2s ease-out infinite',
              }}
            />
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: isPaused ? '#991B1B' : '#065F46' }}>
              {isPaused ? 'Paused' : 'Accepting orders'}
            </span>
          </div>
          {/* Pending chip — only when there's action needed */}
          {pendingCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
              title={`${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting your response`}
            >
              <AlertCircle size={12} />
              {pendingCount} pending
            </span>
          )}
          {/* Pause / resume toggle — compact, next to status */}
          <button
            type="button"
            onClick={handleTogglePause}
            disabled={pauseLoading}
            className="inline-flex items-center justify-center px-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: isPaused ? '#10B981' : 'transparent',
              color: isPaused ? '#fff' : 'var(--aurora-text-secondary, #6b7280)',
              border: isPaused ? 'none' : '1px solid var(--aurora-border, #e5e7eb)',
              minHeight: 32,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
            aria-label={isPaused ? 'Resume accepting orders' : 'Pause accepting orders'}
          >
            {pauseLoading ? <Loader2 size={12} className="animate-spin" /> : (isPaused ? 'Resume' : 'Pause')}
          </button>
        </div>

        {/* Actions cluster */}
        <div className="flex items-center gap-1">
          {/* Batch — workflow-critical, stays visible */}
          <button
            type="button"
            onClick={() => { setBatchMode(!batchMode); setSelectedOrders(new Set()); }}
            className="inline-flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: batchMode ? 'var(--aurora-accent)' : 'var(--aurora-border, #e5e7eb)',
              color: batchMode ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary, #6b7280)',
              backgroundColor: batchMode ? 'rgba(99,102,241,0.08)' : 'transparent',
              minHeight: 32,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          >
            <CheckSquare size={12} />
            {batchMode ? 'Cancel' : 'Batch'}
          </button>
          {/* Audio toggle — icon only, 44x44 touch target */}
          <button
            type="button"
            onClick={handleToggleAudio}
            className="inline-flex items-center justify-center rounded-lg transition-colors"
            style={{
              color: audioMuted ? 'var(--aurora-text-muted, #9ca3af)' : 'var(--aurora-text-secondary, #6b7280)',
              width: 32,
              height: 32,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label={audioMuted ? 'Unmute notifications' : 'Mute notifications'}
            title={audioMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          {/* Reminders — icon + badge, secondary */}
          <button
            type="button"
            onClick={() => setShowReminderSettings(!showReminderSettings)}
            className="relative inline-flex items-center justify-center rounded-lg transition-colors"
            style={{
              color: showReminderSettings ? '#8B5CF6' : 'var(--aurora-text-secondary, #6b7280)',
              backgroundColor: showReminderSettings ? 'rgba(139,92,246,0.08)' : 'transparent',
              width: 32,
              height: 32,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label="Reminder settings"
            title="Reminder settings"
          >
            <BellRing size={16} />
            {activeReminders.length > 0 && (
              <span
                className="absolute flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ top: 2, right: 2, width: 14, height: 14, backgroundColor: '#8B5CF6' }}
              >
                {activeReminders.length > 9 ? '9+' : activeReminders.length}
              </span>
            )}
          </button>
          {/* Payment setup — icon only, only visible when not configured */}
          {!hasPaymentInfo && (
            <button
              type="button"
              onClick={() => setShowPaymentSettings(!showPaymentSettings)}
              className="inline-flex items-center justify-center rounded-lg transition-colors"
              style={{
                color: showPaymentSettings ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary, #6b7280)',
                backgroundColor: showPaymentSettings ? 'rgba(99,102,241,0.08)' : 'transparent',
                width: 32,
                height: 32,
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Payment settings"
              title="Payment settings"
            >
              <CreditCard size={16} />
            </button>
          )}
          {/* Notification bell — icon + count badge */}
          <VendorNotificationPanel
            notifications={notifications}
            showPanel={showNotifPanel}
            onToggle={setShowNotifPanel}
            onNotificationClick={(n) => {
              if (n.orderId) {
                setExpandedOrder(n.orderId);
              } else if (n.quoteRequestId) {
                onSwitchVendorTab?.('quotes');
              }
            }}
            userId={user?.uid}
          />
          {/* (Old duplicate toolbar — Audio/Reminders/Payment/Batch/Pending —
              and the separate Pause Toggle strip have been consolidated into
              the unified command bar above. One row on desktop; wraps
              gracefully on narrow mobile widths.) */}
        </div>
      </div>

      {/* Status-pulse keyframe — hardware-accelerated, cross-browser */}
      <style>{`
        @keyframes vendorStatusPulse {
          0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      {/* ── Payment setup reminder banner ─────────────────────────────── */}
      <PaymentSetupBanner
        visible
        showPaymentReminder={showPaymentReminder}
        paymentUrl={paymentUrl}
        paymentMethod={paymentMethod}
        paymentNote={paymentNote}
        paymentSkippedUntil={!paymentReminderHidden ? null : paymentSkippedUntil}
        hasPaymentInfo={hasPaymentInfo}
        showPaymentSettings={showPaymentSettings}
        setShowPaymentSettings={setShowPaymentSettings}
        onSave={handleSavePayment}
        onDefer={handleDeferPayment}
        onDeferPayment={handleDeferPayment}
        paymentSaving={paymentSaving}
        paymentDeferring={paymentDeferring}
        onPaymentMethodChange={setPaymentMethod}
        onPaymentUrlChange={setPaymentUrl}
        onPaymentNoteChange={setPaymentNote}
        formatSnoozeDate={formatSnoozeDate}
      />

      {/* ── Reminder Settings Panel ── */}
      <ReminderSettingsModal
        isOpen={showReminderSettings}
        reminderSettings={reminderSettings}
        onSaveSettings={saveReminderSettings}
        onClose={() => setShowReminderSettings(false)}
      />

      {/* ── Active Reminders Banner ── */}
      <ReminderAlerts
        reminders={activeReminders}
        onExpand={(orderId, sectionKey) => {
          setExpandedOrder(orderId);
          setSectionExpanded((prev) => ({ ...prev, [sectionKey]: true }));
        }}
      />

      {/* ── Batch action bar (#17) ── */}
      <BatchActionBar
        batchMode={batchMode}
        selectedOrders={selectedOrders}
        onConfirmAll={() => handleBatchAction('confirmed')}
        onDeclineAll={() => setShowBatchDeclineConfirm(true)}
        loading={batchLoading}
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACCORDION SECTIONS: Pending → Active → Completed               */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Global empty state for brand-new vendors */}
      {orders.length === 0 ? (
        <div className="text-center py-12">
          {true && (
            <div className="max-w-sm mx-auto">
              {/* Decorative illustration removed per UX review —
                  keeps the empty state focused on the actionable onboarding pills below. */}
              <h3 className="text-lg font-bold mb-2 mt-2" style={{ color: 'var(--aurora-text)' }}>
                Welcome to Your Dashboard!
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--aurora-text-secondary)' }}>
                You&apos;re all set to receive catering orders. Here&apos;s how to get started:
              </p>
              {/* Interactive onboarding pills */}
              <OnboardingPills
                hasPaymentInfo={hasPaymentInfo}
                onOpenPaymentSettings={() => setShowPaymentSettings(true)}
                onSwitchVendorTab={onSwitchVendorTab}
              />
              {/* Bottom action row removed — Pill 1 now handles payment setup,
                  and the reminder banner at top of the dashboard handles snooze.
                  We keep only the reassuring caption. */}
              <p className="text-[11px]" style={{ color: 'var(--aurora-text-muted, #9ca3af)' }}>
                Payment setup is optional — you can still receive and accept orders without it.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* SECTION: PENDING ORDERS */}
          <PendingOrdersSection
            pendingOrders={pendingOrders}
            expandedOrder={expandedOrder}
            sectionExpanded={sectionExpanded.pending}
            sortDir={sortDir.pending}
            batchMode={batchMode}
            selectedOrders={selectedOrders}
            actionLoading={actionLoading}
            onToggleSection={() => toggleSection('pending')}
            onSetSort={(value) => setSort('pending', value as any)}
            onToggleOrderSelection={toggleOrderSelection}
            onExpandOrder={setExpandedOrder}
            onStatusChange={handleStatusChange}
            onCancelOrderClick={(orderId) => { setCancellingOrderId(orderId); setCancelReason(''); setCancelOtherText(''); }}
            businessName={businessName}
            currentUserId={user?.uid}
            formatEventDate={formatEventDate}
            STATUS_CONFIG={STATUS_CONFIG}
          />
          {/* OLD PENDING SECTION CODE — REPLACED ABOVE */}

          {/* SECTION: ACTIVE ORDERS */}
          <ActiveOrdersSection
            activeOrders={activeOrders}
            expandedOrder={expandedOrder}
            sectionExpanded={sectionExpanded.active}
            sortDir={sortDir.active}
            actionLoading={actionLoading}
            onToggleSection={() => toggleSection('active')}
            onSetSort={(value) => setSort('active', value as any)}
            onExpandOrder={setExpandedOrder}
            onStatusChange={handleStatusChange}
            onCancelOrderClick={(orderId) => { setCancellingOrderId(orderId); setCancelReason(''); setCancelOtherText(''); }}
            businessName={businessName}
            currentUserId={user?.uid}
            formatEventDate={formatEventDate}
            STATUS_CONFIG={STATUS_CONFIG}
          />

          {/* SECTION: COMPLETED ORDERS */}
          <CompletedOrdersSection
            completedOrders={completedOrders}
            expandedOrder={expandedOrder}
            sectionExpanded={sectionExpanded.completed}
            sortDir={sortDir.completed}
            onToggleSection={() => toggleSection('completed')}
            onSetSort={(value) => setSort('completed', value as any)}
            onExpandOrder={setExpandedOrder}
            businessName={businessName}
            user={user ?? undefined}
            formatEventDate={formatEventDate}
            STATUS_CONFIG={STATUS_CONFIG}
          />
        </div>
      )}

      {/* ══ Cancelled orders ══ */}
      {cancelledOrders.length > 0 && (
        <div className="space-y-0">
          <CancelledOrdersSection
            cancelledOrders={cancelledOrders}
            expandedOrder={expandedOrder}
            sectionExpanded={sectionExpanded.cancelled}
            sortDir={sortDir.cancelled}
            onToggleSection={() => toggleSection('cancelled')}
            onSetSort={(value) => setSort('cancelled', value as any)}
            onExpandOrder={setExpandedOrder}
            formatEventDate={formatEventDate}
            STATUS_CONFIG={STATUS_CONFIG}
          />
        </div>
      )}

      {/* SB-46: Review Moderation */}
      <ReviewModerationPanel businessId={businessId} />

      {/* Cancel order dialog */}
      <CancelOrderModal
        isOpen={!!cancellingOrderId}
        cancelReason={cancelReason}
        cancelOtherText={cancelOtherText}
        onReasonChange={setCancelReason}
        onOtherTextChange={setCancelOtherText}
        onSubmit={handleCancelOrder}
        onClose={() => setCancellingOrderId(null)}
        loading={cancelSubmitting}
        modalRef={cancelModalRef}
        onKeyDown={cancelKeyDown}
      />

      {/* Messaging is now handled inline via OrderMessages component on each order card */}

      {/* SB-29: Batch Decline Confirmation Dialog */}
      {showBatchDeclineConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertCircle size={20} style={{ color: '#EF4444' }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Decline All Orders?</h3>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              You are about to decline <strong>{selectedOrders.size}</strong> order{selectedOrders.size > 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--aurora-text-muted)' }}>
              Affected customers will be notified that their orders were declined.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBatchDeclineConfirm(false)}
                className="px-4 py-2.5 text-sm rounded-lg border font-medium transition-colors"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowBatchDeclineConfirm(false);
                  handleBatchAction('cancelled');
                }}
                className="px-4 py-2.5 text-sm rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: '#EF4444' }}
              >
                Yes, Decline All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
