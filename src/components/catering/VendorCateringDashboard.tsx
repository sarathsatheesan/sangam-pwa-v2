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
  MessageSquare, Volume2, VolumeX, BellRing, Timer,
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
  formatPrice,
  calculateOrderTotal,
  // findOrCreateConversation removed — messaging now uses OrderNotes
  subscribeToCateringNotifications,
  markNotificationRead,
  markAllNotificationsRead,
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

const VENDOR_CANCEL_REASONS = [
  'Item unavailable',
  'Cannot fulfill timeline',
  'Customer no-show',
  'Kitchen issue',
  'Other',
];

interface VendorCateringDashboardProps {
  businessId: string;
  businessName: string;
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

export default function VendorCateringDashboard({ businessId, businessName }: VendorCateringDashboardProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const { addToast } = useToast();

  // ── Accordion section state ──
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    pending: false,   // collapsed by default
    active: true,     // expanded by default
    completed: false, // collapsed by default
  });
  const toggleSection = (key: string) => setSectionExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Independent sort per section (by date) ──
  type SortDir = 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc';
  const [sortDir, setSortDir] = useState<Record<string, SortDir>>({
    pending: 'date-newest',
    active: 'date-newest',
    completed: 'date-newest',
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
          // Web Audio API — no external dependency
          // Cross-browser: resume() required for iOS Safari & Chrome autoplay policy
          if (!audioMuted) {
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
              // Clean up audio context after playback to free resources (Safari memory)
              setTimeout(() => { audioCtx.close().catch(() => {}); }, 1000);
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
        const eventMs = order.eventDate?.toDate?.()?.getTime?.() || (order.eventDate?.seconds ? order.eventDate.seconds * 1000 : 0);
        const createdMs = order.createdAt?.toDate?.()?.getTime?.() || (order.createdAt?.seconds ? order.createdAt.seconds * 1000 : 0);

        // Pending orders sitting > 30 min
        if (reminderSettings.pendingAlert && order.status === 'pending' && createdMs && (now - createdMs) > 30 * 60 * 1000) {
          reminders.push({ id: `pending_${order.id}`, type: 'pending', message: `Order from ${order.customerName} has been waiting ${Math.round((now - createdMs) / 60000)} min`, orderId: order.id });
        }
        // Preparing > 2 hours
        if (reminderSettings.preparingReminder && order.status === 'preparing') {
          const confirmedMs = order.confirmedAt?.toDate?.()?.getTime?.() || (order.confirmedAt?.seconds ? order.confirmedAt.seconds * 1000 : 0);
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
    const tax = Math.round(subtotal * 0.0825);
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
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    getBusinessPaymentInfo(businessId).then(info => {
      setPaymentUrl(info.paymentUrl || '');
      setPaymentMethod(info.paymentMethod || '');
      setPaymentNote(info.paymentNote || '');
    }).catch(() => {});
  }, [businessId]);

  const handleSavePayment = async () => {
    setPaymentSaving(true);
    try {
      await updateBusinessPaymentInfo(businessId, { paymentUrl, paymentMethod, paymentNote });
      addToast('Payment info saved', 'success');
      setShowPaymentSettings(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setPaymentSaving(false);
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
      const aMs = a.eventDate?.toDate?.()?.getTime?.() || (a.eventDate?.seconds ? a.eventDate.seconds * 1000 : 0);
      const bMs = b.eventDate?.toDate?.()?.getTime?.() || (b.eventDate?.seconds ? b.eventDate.seconds * 1000 : 0);
      return dir === 'date-newest' ? bMs - aMs : aMs - bMs;
    });
  };
  const pendingOrders = sortOrders(orders.filter(o => o.status === 'pending'), sortDir.pending);
  const activeOrders = sortOrders(orders.filter(o => ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)), sortDir.active);
  const completedOrders = sortOrders(orders.filter(o => ['delivered', 'cancelled'].includes(o.status)), sortDir.completed);

  const formatEventDate = (eventDate: any): string => {
    if (!eventDate) return '—';
    const d = eventDate.toDate?.() || (eventDate.seconds ? new Date(eventDate.seconds * 1000) : null);
    if (!d) return String(eventDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-primary, #6366F1)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SB-14: New order persistent banner */}
      {newOrderBanner && (
        <div
          className="flex items-center justify-between p-3 rounded-xl border animate-pulse"
          style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F59E0B' }}>
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
                New order from {newOrderBanner.customerName}
              </p>
              <p className="text-xs" style={{ color: '#A16207' }}>
                {formatPrice(newOrderBanner.total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setExpandedOrder(newOrderBanner.orderId);
                setFilter('pending');
                setNewOrderBanner(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#F59E0B' }}
            >
              View Order
            </button>
            <button
              onClick={() => setNewOrderBanner(null)}
              className="p-2.5 rounded hover:bg-amber-200 transition-colors"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Dismiss"
            >
              <X size={16} style={{ color: '#92400E' }} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>
            Catering Orders
          </h2>
          <p className="text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
            {businessName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* V-12: Notification bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={`Notifications${notifications.filter(n => !n.read).length > 0 ? ` (${notifications.filter(n => !n.read).length} unread)` : ''}`}
            >
              <Bell size={20} style={{ color: 'var(--aurora-text-secondary)' }} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotifPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-lg z-50" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
                <div className="p-3 border-b flex items-center justify-between sticky top-0" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>Notifications</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <button
                      onClick={() => {
                        if (!user?.uid) return;
                        markAllNotificationsRead(user.uid).catch(console.warn);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: 'var(--aurora-text-muted)' }}>No notifications yet</div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        // Mark this notification as read
                        if (!n.read) {
                          markNotificationRead(n.id).catch(console.warn);
                        }
                        // Expand the related order if it exists
                        if (n.orderId) {
                          setExpandedOrder(n.orderId);
                          setShowNotifPanel(false);
                        }
                      }}
                      className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>{n.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {/* SB-33: Audio mute toggle */}
          <button
            onClick={handleToggleAudio}
            className="p-2 rounded-lg transition-colors"
            style={{ color: audioMuted ? 'var(--aurora-text-muted)' : 'var(--aurora-text-secondary)' }}
            aria-label={audioMuted ? 'Unmute notifications' : 'Mute notifications'}
            title={audioMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          {/* Reminder settings toggle */}
          <button
            onClick={() => setShowReminderSettings(!showReminderSettings)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: showReminderSettings ? '#8B5CF6' : 'var(--aurora-border)',
              color: showReminderSettings ? '#8B5CF6' : 'var(--aurora-text-secondary)',
              backgroundColor: showReminderSettings ? 'rgba(139,92,246,0.05)' : 'transparent',
            }}
            aria-label="Reminder settings"
          >
            <BellRing size={12} />
            Reminders
            {activeReminders.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: '#8B5CF6' }}>
                {activeReminders.length > 9 ? '9+' : activeReminders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowPaymentSettings(!showPaymentSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
          >
            <CreditCard size={12} />
            Payment
          </button>
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedOrders(new Set()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: batchMode ? '#6366F1' : 'var(--aurora-border)',
              color: batchMode ? '#6366F1' : 'var(--aurora-text-secondary)',
              backgroundColor: batchMode ? 'rgba(99,102,241,0.05)' : 'transparent',
            }}
          >
            <CheckSquare size={12} />
            {batchMode ? 'Cancel' : 'Batch'}
          </button>
          {pendingCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
            >
              <AlertCircle size={12} />
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* SB-32: Vendor Pause Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{
        backgroundColor: isPaused ? '#FEF2F2' : 'rgba(99,102,241,0.04)',
        border: `1px solid ${isPaused ? '#FECACA' : 'var(--aurora-border)'}`,
      }}>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <>
              <span className="text-base">⏸️</span>
              <div>
                <span className="text-sm font-medium" style={{ color: '#991B1B' }}>Accepting Orders: Paused</span>
                <p className="text-[10px]" style={{ color: '#B91C1C' }}>New catering requests won't be shown to you</p>
              </div>
            </>
          ) : (
            <>
              <span className="text-base">✅</span>
              <div>
                <span className="text-sm font-medium" style={{ color: '#059669' }}>Accepting Orders: Active</span>
                <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>You'll receive new catering requests</p>
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleTogglePause}
          disabled={pauseLoading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: isPaused ? '#059669' : '#EF4444',
            color: '#fff',
          }}
        >
          {pauseLoading ? '...' : isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* ── Payment settings panel (#13) ── */}
      {showPaymentSettings && (
        <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.03)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#6366F1' }}>Payment Settings</p>
            <button onClick={() => setShowPaymentSettings(false)} className="p-1"><X size={14} style={{ color: 'var(--aurora-text-muted)' }} /></button>
          </div>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Customers will see this info so they can pay you directly.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment Method</label>
              <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Venmo, PayPal, Zelle"
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment URL</label>
              <input type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https://venmo.com/your-handle"
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment Instructions</label>
            <textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Please include order # in the memo"
              rows={2} className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none resize-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
          </div>
          <button onClick={handleSavePayment} disabled={paymentSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            {paymentSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Payment Info
          </button>
        </div>
      )}

      {/* ── Reminder Settings Panel ── */}
      {showReminderSettings && (
        <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.03)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#8B5CF6' }}>Reminder Settings</p>
            <button onClick={() => setShowReminderSettings(false)} className="p-1"><X size={14} style={{ color: 'var(--aurora-text-muted)' }} /></button>
          </div>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Configure when you receive order reminders and alerts.
          </p>
          <label className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Pending order alerts</span>
              <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>Alert when an order sits pending for 30+ minutes</p>
            </div>
            <input type="checkbox" checked={reminderSettings.pendingAlert}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, pendingAlert: e.target.checked })}
              className="accent-purple-600 w-4 h-4" />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Preparing too long</span>
              <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>Remind when an order has been preparing for 2+ hours</p>
            </div>
            <input type="checkbox" checked={reminderSettings.preparingReminder}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, preparingReminder: e.target.checked })}
              className="accent-purple-600 w-4 h-4" />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Event day reminder</span>
              <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>Remind when an event date is approaching</p>
            </div>
            <input type="checkbox" checked={reminderSettings.eventDayReminder}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, eventDayReminder: e.target.checked })}
              className="accent-purple-600 w-4 h-4" />
          </label>
          {reminderSettings.eventDayReminder && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Remind</label>
              <select
                value={reminderSettings.reminderLeadHours}
                onChange={(e) => saveReminderSettings({ ...reminderSettings, reminderLeadHours: Number(e.target.value) })}
                className="rounded-lg border px-2 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
              >
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
              <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>before the event</span>
            </div>
          )}
        </div>
      )}

      {/* ── Active Reminders Banner ── */}
      {activeReminders.length > 0 && (
        <div className="space-y-1.5">
          {activeReminders.slice(0, 3).map((r) => (
            <button
              key={r.id}
              onClick={() => { setExpandedOrder(r.orderId); setSectionExpanded(prev => ({ ...prev, [r.type === 'event' ? 'active' : r.type]: true })); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors hover:opacity-80"
              style={{
                backgroundColor: r.type === 'pending' ? '#FEF3C7' : r.type === 'preparing' ? '#DBEAFE' : '#F3E8FF',
                color: r.type === 'pending' ? '#92400E' : r.type === 'preparing' ? '#1E40AF' : '#6B21A8',
              }}
            >
              {r.type === 'pending' ? <Timer size={14} /> : r.type === 'preparing' ? <Clock size={14} /> : <BellRing size={14} />}
              <span className="font-medium flex-1">{r.message}</span>
              <ChevronDown size={12} />
            </button>
          ))}
          {activeReminders.length > 3 && (
            <p className="text-[10px] text-center" style={{ color: 'var(--aurora-text-muted)' }}>+{activeReminders.length - 3} more reminders</p>
          )}
        </div>
      )}

      {/* ── Batch action bar (#17) ── */}
      {batchMode && selectedOrders.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}>
          <span className="text-sm font-medium" style={{ color: '#6366F1' }}>
            {selectedOrders.size} order(s) selected
          </span>
          <div className="flex gap-2">
            <button onClick={() => handleBatchAction('confirmed')} disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#10B981' }}
            >
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Accept All
            </button>
            <button onClick={() => setShowBatchDeclineConfirm(true)} disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#EF4444' }}
            >
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Decline All
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACCORDION SECTIONS: Pending → Active → Completed               */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Global empty state for brand-new vendors */}
      {orders.length === 0 ? (
        <div className="text-center py-12">
          {true && (
            <div className="max-w-sm mx-auto">
              {/* Illustrated header with gradient */}
              <div className="relative mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
                <Package size={36} className="text-white" />
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--aurora-text)' }}>
                Welcome to Your Dashboard!
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--aurora-text-secondary)' }}>
                You&apos;re all set to receive catering orders. Here&apos;s how to get started:
              </p>
              <div className="text-left space-y-3 mb-5">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>1</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Set up payment info</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>Add your payment link so customers can pay you</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>2</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Add menu items</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>Create your catering menu so customers can browse</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>3</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Your first order will appear here</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>You&apos;ll get an alert with a chime when a new order comes in</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentSettings(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#6366F1' }}
              >
                <CreditCard size={14} className="inline mr-1.5 -mt-0.5" />
                Set Up Payment Info
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* SECTION: PENDING ORDERS */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection('pending')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
              style={{
                backgroundColor: sectionExpanded.pending ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)',
                borderBottom: sectionExpanded.pending ? '1px solid var(--aurora-border)' : 'none'
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold" style={{ color: '#F59E0B' }}>Pending Orders</h3>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#F59E0B' }}>
                    {pendingOrders.length}
                  </span>
                </div>
              </div>
              <select
                value={sortDir.pending}
                onChange={(e) => { e.stopPropagation(); setSort('pending', e.target.value as SortDir); }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
                style={{ color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23F59E0B\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
              >
                <option value="date-newest">Date: Newest</option>
                <option value="date-oldest">Date: Oldest</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
              {sectionExpanded.pending ? <ChevronUp size={18} style={{ color: '#F59E0B' }} /> : <ChevronDown size={18} style={{ color: '#F59E0B' }} />}
            </button>

            {/* Section Content */}
            {sectionExpanded.pending && (
              <div className="p-3 space-y-3">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
                    No pending orders
                  </div>
                ) : (
                  pendingOrders.map((order) => {
                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedOrder === order.id;
                    const isActionLoading = actionLoading === order.id;

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border overflow-hidden"
                        style={{
                          backgroundColor: 'var(--aurora-surface, #fff)',
                          borderColor: 'var(--aurora-border, #E2E5EF)',
                        }}
                      >
                        {/* Order header */}
                        <button
                          className="w-full flex items-center justify-between p-4 text-left"
                          onClick={() => batchMode && order.status === 'pending' ? toggleOrderSelection(order.id) : setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          {/* Batch checkbox */}
                          {batchMode && order.status === 'pending' && (
                            <div className="mr-3 flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}>
                              {selectedOrders.has(order.id)
                                ? <CheckSquare size={18} style={{ color: '#6366F1' }} />
                                : <Square size={18} style={{ color: 'var(--aurora-text-muted)' }} />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                                {order.customerName} · {formatEventDate(order.eventDate)}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                              >
                                {statusCfg.icon}
                                {statusCfg.label}
                              </span>
                              {order.rfpOrigin && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>
                                  RFP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {order.headcount} guests
                              </span>
                              <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                                {formatPrice(order.total)}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mx-3 mb-4 mt-1 p-4 space-y-3 rounded-lg border shadow-sm" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                            {/* Contact info */}
                            <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <User size={14} />
                                {order.contactName}
                              </div>
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <Phone size={14} />
                                {order.contactPhone}
                              </div>
                              <div className="col-span-2 flex items-start gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                {order.deliveryAddress?.formattedAddress ||
                                  [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zip]
                                    .filter(Boolean).join(', ')}
                              </div>
                            </div>

                            {/* Order Timeline */}
                            <div className="pt-2">
                              <OrderTimeline order={order} perspective="vendor" />
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                                Items
                              </h4>
                              <div className="space-y-1">
                                {order.items.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--aurora-text)' }}>
                                      {item.qty}x {item.name}
                                    </span>
                                    <span style={{ color: 'var(--aurora-text-secondary)' }}>
                                      {formatPrice(item.unitPrice * item.qty)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                                  <span>Total</span>
                                  <span>{formatPrice(order.total)}</span>
                                </div>
                              </div>
                            </div>

                            {/* ── Order modification form (#18) ── */}
                            {editingOrderId === order.id ? (
                              <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.02)' }}>
                                <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>Modify Order Items</p>
                                {editItems.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <input type="number" min="0" value={editItems[i].qty}
                                      onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(0, parseInt(e.target.value) || 0) } : it))}
                                      className="w-14 text-center rounded-lg border px-2 py-1 text-xs" style={{ borderColor: 'var(--aurora-border)' }}
                                    />
                                    {/* V-07: Make new item names editable */}
                                    {item.menuItemId.startsWith('added_') ? (
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => {
                                          const updated = [...editItems];
                                          const idx = updated.findIndex(it => it.menuItemId === item.menuItemId);
                                          if (idx >= 0) updated[idx] = { ...updated[idx], name: e.target.value };
                                          setEditItems(updated);
                                        }}
                                        placeholder="Item name"
                                        className="flex-1 text-sm border rounded px-2 py-1" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                      />
                                    ) : (
                                      <span className="flex-1 truncate" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                                    )}
                                    {/* SB-03: Display price in dollars, store in cents */}
                                    <span className="text-xs mr-0.5" style={{ color: 'var(--aurora-text-muted)' }}>$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={(editItems[i].unitPrice / 100).toFixed(2)}
                                      onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, unitPrice: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) } : it))}
                                      placeholder="0.00"
                                      className="w-20 text-center text-sm border rounded px-1 py-1" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                    />
                                    <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * editItems[i].qty)}</span>
                                  </div>
                                ))}
                                {/* V-07: Add new item button */}
                                <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--aurora-border)' }}>
                                  <button
                                    onClick={() => {
                                      setEditItems(prev => [...prev, {
                                        menuItemId: `added_${Date.now()}`,
                                        name: '',
                                        qty: 1,
                                        unitPrice: 0,
                                        pricingType: 'per_person',
                                      }]);
                                    }}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                    + Add Item
                                  </button>
                                </div>
                                <p className="text-xs font-medium text-right" style={{ color: 'var(--aurora-text)' }}>
                                  New total: {formatPrice(editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0))}
                                </p>
                                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
                                  placeholder="Reason for modification (e.g. item out of stock)..." rows={2}
                                  className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingOrderId(null)} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--aurora-border)' }}>Cancel</button>
                                  <button onClick={() => handleSaveModification(order)} disabled={editSaving}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#6366F1' }}
                                  >{editSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Save Changes'}</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Vendor modification notice + rejection badge (F-06) + SB-15 recovery */}
                                {order.vendorModified && (
                                  <div>
                                    <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: (order as any).modificationRejected ? '#FEE2E2' : '#FEF3C7', color: (order as any).modificationRejected ? '#991B1B' : '#92400E' }}>
                                      <span className="font-medium">
                                        {(order as any).modificationRejected ? '✗ Customer rejected modification: ' : (order as any).modificationAccepted ? '✓ Customer accepted modification: ' : 'Modified: '}
                                      </span>
                                      {order.vendorModificationNote || 'Items adjusted by vendor'}
                                    </div>
                                    {/* SB-15: Rejection recovery — Revert + Counter-Proposal */}
                                    {(order as any).modificationRejected && order.originalItems && ['confirmed', 'preparing'].includes(order.status) && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              const origSubtotal = calculateOrderTotal(order.originalItems!);
                                              const origTax = Math.round(origSubtotal * 0.0825);
                                              await vendorModifyOrder(order.id, {
                                                items: order.originalItems!,
                                                subtotal: origSubtotal,
                                                tax: origTax,
                                                total: origSubtotal + origTax,
                                                note: 'Reverted to original order items per customer request',
                                              });
                                              addToast('Order reverted to original items', 'success');
                                            } catch (err: any) {
                                              addToast(err.message || 'Failed to revert order', 'error');
                                            }
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                          style={{ borderColor: '#10B981', color: '#059669', backgroundColor: '#ECFDF5' }}
                                        >
                                          Revert to Original
                                        </button>
                                        <button
                                          onClick={() => startEditOrder(order)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                          style={{ borderColor: '#6366F1', color: '#6366F1', backgroundColor: '#EEF2FF' }}
                                        >
                                          <Pencil size={10} /> Send Counter-Proposal
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Edit order button for confirmed/preparing */}
                                {['confirmed', 'preparing'].includes(order.status) && (
                                  <button onClick={() => startEditOrder(order)}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6366F1' }}
                                  >
                                    <Pencil size={12} /> Modify order items
                                  </button>
                                )}
                              </>
                            )}

                            {/* Special instructions */}
                            {order.specialInstructions && (
                              <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                                <span className="font-medium">Note: </span>
                                {order.specialInstructions}
                              </div>
                            )}

                            {/* ── In-order messages (available for 48hrs after delivery) ── */}
                            {!['cancelled'].includes(order.status) && user && (
                              <OrderMessages
                                orderId={order.id}
                                currentUserId={user.uid}
                                currentUserName={businessName || 'Vendor'}
                                currentUserRole="vendor"
                                orderStatus={order.status}
                                deliveredAt={order.statusHistory?.find((s: any) => s.status === 'delivered')?.timestamp}
                              />
                            )}

                            {/* Messaging is handled inline via OrderMessages above */}

                            {/* Action buttons */}
                            {order.status === 'pending' && (
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => handleStatusChange(order.id, 'confirmed')}
                                  disabled={isActionLoading}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#10B981' }}
                                >
                                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                                  disabled={isActionLoading}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#EF4444' }}
                                >
                                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SECTION: ACTIVE ORDERS */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection('active')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
              style={{
                backgroundColor: sectionExpanded.active ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
                borderBottom: sectionExpanded.active ? '1px solid var(--aurora-border)' : 'none'
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold" style={{ color: '#6366F1' }}>Active Orders</h3>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#6366F1' }}>
                    {activeOrders.length}
                  </span>
                </div>
              </div>
              <select
                value={sortDir.active}
                onChange={(e) => { e.stopPropagation(); setSort('active', e.target.value as SortDir); }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
                style={{ color: '#6366F1', borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236366F1\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
              >
                <option value="date-newest">Date: Newest</option>
                <option value="date-oldest">Date: Oldest</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
              {sectionExpanded.active ? <ChevronUp size={18} style={{ color: '#6366F1' }} /> : <ChevronDown size={18} style={{ color: '#6366F1' }} />}
            </button>

            {/* Section Content */}
            {sectionExpanded.active && (
              <div className="p-3 space-y-3">
                {activeOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
                    No active orders
                  </div>
                ) : (
                  activeOrders.map((order) => {
                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedOrder === order.id;
                    const isActionLoading = actionLoading === order.id;

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border overflow-hidden"
                        style={{
                          backgroundColor: 'var(--aurora-surface, #fff)',
                          borderColor: 'var(--aurora-border, #E2E5EF)',
                        }}
                      >
                        {/* Order header */}
                        <button
                          className="w-full flex items-center justify-between p-4 text-left"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                                {order.customerName} · {formatEventDate(order.eventDate)}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                              >
                                {statusCfg.icon}
                                {statusCfg.label}
                              </span>
                              {order.rfpOrigin && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>
                                  RFP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                              <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                                {formatPrice(order.total)}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mx-3 mb-4 mt-1 p-4 space-y-3 rounded-lg border shadow-sm" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                            {/* Contact info */}
                            <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <User size={14} />
                                {order.contactName}
                              </div>
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <Phone size={14} />
                                {order.contactPhone}
                              </div>
                              <div className="col-span-2 flex items-start gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                {order.deliveryAddress?.formattedAddress ||
                                  [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zip]
                                    .filter(Boolean).join(', ')}
                              </div>
                            </div>

                            {/* Order Timeline */}
                            <div className="pt-2">
                              <OrderTimeline order={order} perspective="vendor" />
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                                Items
                              </h4>
                              <div className="space-y-1">
                                {order.items.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--aurora-text)' }}>
                                      {item.qty}x {item.name}
                                    </span>
                                    <span style={{ color: 'var(--aurora-text-secondary)' }}>
                                      {formatPrice(item.unitPrice * item.qty)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                                  <span>Total</span>
                                  <span>{formatPrice(order.total)}</span>
                                </div>
                              </div>
                            </div>

                            {/* ── Order modification form (#18) ── */}
                            {editingOrderId === order.id ? (
                              <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.02)' }}>
                                <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>Modify Order Items</p>
                                {editItems.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <input type="number" min="0" value={editItems[i].qty}
                                      onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(0, parseInt(e.target.value) || 0) } : it))}
                                      className="w-14 text-center rounded-lg border px-2 py-1 text-xs" style={{ borderColor: 'var(--aurora-border)' }}
                                    />
                                    {/* V-07: Make new item names editable */}
                                    {item.menuItemId.startsWith('added_') ? (
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => {
                                          const updated = [...editItems];
                                          const idx = updated.findIndex(it => it.menuItemId === item.menuItemId);
                                          if (idx >= 0) updated[idx] = { ...updated[idx], name: e.target.value };
                                          setEditItems(updated);
                                        }}
                                        placeholder="Item name"
                                        className="flex-1 text-sm border rounded px-2 py-1" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                      />
                                    ) : (
                                      <span className="flex-1 truncate" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                                    )}
                                    {/* SB-03: Display price in dollars, store in cents */}
                                    <span className="text-xs mr-0.5" style={{ color: 'var(--aurora-text-muted)' }}>$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={(editItems[i].unitPrice / 100).toFixed(2)}
                                      onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, unitPrice: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) } : it))}
                                      placeholder="0.00"
                                      className="w-20 text-center text-sm border rounded px-1 py-1" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                    />
                                    <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * editItems[i].qty)}</span>
                                  </div>
                                ))}
                                {/* V-07: Add new item button */}
                                <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--aurora-border)' }}>
                                  <button
                                    onClick={() => {
                                      setEditItems(prev => [...prev, {
                                        menuItemId: `added_${Date.now()}`,
                                        name: '',
                                        qty: 1,
                                        unitPrice: 0,
                                        pricingType: 'per_person',
                                      }]);
                                    }}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                    + Add Item
                                  </button>
                                </div>
                                <p className="text-xs font-medium text-right" style={{ color: 'var(--aurora-text)' }}>
                                  New total: {formatPrice(editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0))}
                                </p>
                                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
                                  placeholder="Reason for modification (e.g. item out of stock)..." rows={2}
                                  className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingOrderId(null)} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--aurora-border)' }}>Cancel</button>
                                  <button onClick={() => handleSaveModification(order)} disabled={editSaving}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#6366F1' }}
                                  >{editSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Save Changes'}</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Vendor modification notice + rejection badge (F-06) + SB-15 recovery */}
                                {order.vendorModified && (
                                  <div>
                                    <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: (order as any).modificationRejected ? '#FEE2E2' : '#FEF3C7', color: (order as any).modificationRejected ? '#991B1B' : '#92400E' }}>
                                      <span className="font-medium">
                                        {(order as any).modificationRejected ? '✗ Customer rejected modification: ' : (order as any).modificationAccepted ? '✓ Customer accepted modification: ' : 'Modified: '}
                                      </span>
                                      {order.vendorModificationNote || 'Items adjusted by vendor'}
                                    </div>
                                    {/* SB-15: Rejection recovery — Revert + Counter-Proposal */}
                                    {(order as any).modificationRejected && order.originalItems && ['confirmed', 'preparing'].includes(order.status) && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              const origSubtotal = calculateOrderTotal(order.originalItems!);
                                              const origTax = Math.round(origSubtotal * 0.0825);
                                              await vendorModifyOrder(order.id, {
                                                items: order.originalItems!,
                                                subtotal: origSubtotal,
                                                tax: origTax,
                                                total: origSubtotal + origTax,
                                                note: 'Reverted to original order items per customer request',
                                              });
                                              addToast('Order reverted to original items', 'success');
                                            } catch (err: any) {
                                              addToast(err.message || 'Failed to revert order', 'error');
                                            }
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                          style={{ borderColor: '#10B981', color: '#059669', backgroundColor: '#ECFDF5' }}
                                        >
                                          Revert to Original
                                        </button>
                                        <button
                                          onClick={() => startEditOrder(order)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                          style={{ borderColor: '#6366F1', color: '#6366F1', backgroundColor: '#EEF2FF' }}
                                        >
                                          <Pencil size={10} /> Send Counter-Proposal
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Edit order button for confirmed/preparing */}
                                {['confirmed', 'preparing'].includes(order.status) && (
                                  <button onClick={() => startEditOrder(order)}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6366F1' }}
                                  >
                                    <Pencil size={12} /> Modify order items
                                  </button>
                                )}
                              </>
                            )}

                            {/* Special instructions */}
                            {order.specialInstructions && (
                              <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                                <span className="font-medium">Note: </span>
                                {order.specialInstructions}
                              </div>
                            )}

                            {/* ── In-order messages (available for 48hrs after delivery) ── */}
                            {!['cancelled'].includes(order.status) && user && (
                              <OrderMessages
                                orderId={order.id}
                                currentUserId={user.uid}
                                currentUserName={businessName || 'Vendor'}
                                currentUserRole="vendor"
                                orderStatus={order.status}
                                deliveredAt={order.statusHistory?.find((s: any) => s.status === 'delivered')?.timestamp}
                              />
                            )}

                            {/* Messaging is handled inline via OrderMessages above */}

                            {/* Action buttons - Status advancement for active orders */}
                            {order.status === 'confirmed' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'preparing')}
                                disabled={isActionLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: 'var(--aurora-primary, #6366F1)' }}
                              >
                                {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                                Mark as Preparing
                              </button>
                            )}
                            {order.status === 'preparing' && (
                              <div className="space-y-2">
                                {/* SB-17 & SB-31: Prep time estimate input with time validation */}
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={etaInputs[`prep_${order.id}`] || ''}
                                    onChange={(e) => setEtaInputs(prev => ({ ...prev, [`prep_${order.id}`]: e.target.value }))}
                                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/30"
                                    style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                    aria-label="Estimated ready time"
                                  />
                                  {etaInputs[`prep_${order.id}`]?.trim() && (
                                    <button
                                      onClick={() => {
                                        const eta = etaInputs[`prep_${order.id}`]?.trim();
                                        if (eta) {
                                          const formattedEta = formatEtaValue(eta, 'time');
                                          handleStatusChange(order.id, 'preparing' as any, { estimatedDeliveryTime: formattedEta }).catch(() => {});
                                          addToast('Prep time estimate shared with customer', 'success');
                                        }
                                      }}
                                      className="px-3 py-2 rounded-lg text-xs font-medium text-white"
                                      style={{ backgroundColor: '#8B5CF6' }}
                                    >
                                      Share
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleStatusChange(order.id, 'ready')}
                                  disabled={isActionLoading}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#10B981' }}
                                >
                                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  Mark as Ready
                                </button>
                              </div>
                            )}
                            {order.status === 'ready' && (
                              <div className="space-y-2">
                                {/* SB-31: Delivery ETA with time/duration toggle */}
                                <div className="flex items-center gap-2">
                                  <select
                                    value={etaInputs[`mode_${order.id}`] || 'time'}
                                    onChange={(e) => setEtaInputs(prev => ({ ...prev, [`mode_${order.id}`]: e.target.value, [order.id]: '' }))}
                                    className="rounded-lg border px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500/30"
                                    style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                  >
                                    <option value="time">Specific time</option>
                                    <option value="duration">Duration (minutes)</option>
                                  </select>
                                  {(etaInputs[`mode_${order.id}`] || 'time') === 'time' ? (
                                    <input
                                      type="time"
                                      value={etaInputs[order.id] || ''}
                                      onChange={(e) => setEtaInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                      className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
                                      style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1 flex-1">
                                      <input
                                        type="number"
                                        min="5"
                                        max="480"
                                        step="5"
                                        placeholder="30"
                                        value={etaInputs[order.id] || ''}
                                        onChange={(e) => setEtaInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                        className="w-20 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
                                        style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                      />
                                      <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>minutes</span>
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const eta = etaInputs[order.id]?.trim();
                                    const mode = etaInputs[`mode_${order.id}`] || 'time';
                                    const formattedEta = eta ? formatEtaValue(eta, mode) : undefined;
                                    handleStatusChange(order.id, 'out_for_delivery', formattedEta ? { estimatedDeliveryTime: formattedEta } : undefined);
                                  }}
                                  disabled={isActionLoading}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#0EA5E9' }}
                                >
                                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                                  Dispatch for Delivery
                                </button>
                              </div>
                            )}
                            {order.status === 'out_for_delivery' && (
                              <div className="space-y-2">
                                {order.estimatedDeliveryTime && (
                                  <div className="flex items-center gap-1.5 text-xs p-2 rounded-lg" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                                    <Clock size={12} />
                                    <span className="font-medium">ETA: {order.estimatedDeliveryTime}</span>
                                  </div>
                                )}
                                <button
                                  onClick={() => handleStatusChange(order.id, 'delivered')}
                                  disabled={isActionLoading}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                  style={{ backgroundColor: '#059669' }}
                                >
                                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  Mark as Delivered
                                </button>
                              </div>
                            )}

                            {/* Cancel button for non-pending active orders */}
                            {['confirmed', 'preparing', 'ready'].includes(order.status) && (
                              <button
                                onClick={() => { setCancellingOrderId(order.id); setCancelReason(''); setCancelOtherText(''); }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border mt-2"
                                style={{ borderColor: '#FCA5A5', color: '#DC2626', backgroundColor: '#FEF2F2' }}
                              >
                                <Ban size={14} />
                                Cancel Order
                              </button>
                            )}

                            {/* Cancellation reason display */}
                            {order.status === 'cancelled' && (order.cancellationReason || order.declinedReason) && (
                              <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                                <span className="font-medium" style={{ color: '#991B1B' }}>
                                  {order.cancelledBy === 'customer' ? 'Cancelled by customer: ' : 'Reason: '}
                                </span>
                                <span style={{ color: '#DC2626' }}>{order.cancellationReason || order.declinedReason}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SECTION: COMPLETED ORDERS */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection('completed')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
              style={{
                backgroundColor: sectionExpanded.completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.04)',
                borderBottom: sectionExpanded.completed ? '1px solid var(--aurora-border)' : 'none'
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold" style={{ color: '#22C55E' }}>Completed Orders</h3>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#22C55E' }}>
                    {completedOrders.length}
                  </span>
                </div>
              </div>
              <select
                value={sortDir.completed}
                onChange={(e) => { e.stopPropagation(); setSort('completed', e.target.value as SortDir); }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
                style={{ color: '#22C55E', borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322C55E\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
              >
                <option value="date-newest">Date: Newest</option>
                <option value="date-oldest">Date: Oldest</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
              {sectionExpanded.completed ? <ChevronUp size={18} style={{ color: '#22C55E' }} /> : <ChevronDown size={18} style={{ color: '#22C55E' }} />}
            </button>

            {/* Section Content */}
            {sectionExpanded.completed && (
              <div className="p-3 space-y-3">
                {completedOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
                    No completed orders
                  </div>
                ) : (
                  completedOrders.map((order) => {
                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border overflow-hidden"
                        style={{
                          backgroundColor: 'var(--aurora-surface, #fff)',
                          borderColor: 'var(--aurora-border, #E2E5EF)',
                        }}
                      >
                        {/* Order header */}
                        <button
                          className="w-full flex items-center justify-between p-4 text-left"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                                {order.customerName} · {formatEventDate(order.eventDate)}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                              >
                                {statusCfg.icon}
                                {statusCfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                              <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                                {formatPrice(order.total)}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Expanded details - Read-only for completed orders */}
                        {isExpanded && (
                          <div className="mx-3 mb-4 mt-1 p-4 space-y-3 rounded-lg border shadow-sm" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                            {/* Contact info */}
                            <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <User size={14} />
                                {order.contactName}
                              </div>
                              <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <Phone size={14} />
                                {order.contactPhone}
                              </div>
                              <div className="col-span-2 flex items-start gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                {order.deliveryAddress?.formattedAddress ||
                                  [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zip]
                                    .filter(Boolean).join(', ')}
                              </div>
                            </div>

                            {/* Order Timeline */}
                            <div className="pt-2">
                              <OrderTimeline order={order} perspective="vendor" />
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                                Items
                              </h4>
                              <div className="space-y-1">
                                {order.items.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--aurora-text)' }}>
                                      {item.qty}x {item.name}
                                    </span>
                                    <span style={{ color: 'var(--aurora-text-secondary)' }}>
                                      {formatPrice(item.unitPrice * item.qty)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                                  <span>Total</span>
                                  <span>{formatPrice(order.total)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Special instructions */}
                            {order.specialInstructions && (
                              <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                                <span className="font-medium">Note: </span>
                                {order.specialInstructions}
                              </div>
                            )}

                            {/* Cancellation reason display */}
                            {order.status === 'cancelled' && (order.cancellationReason || order.declinedReason) && (
                              <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                                <span className="font-medium" style={{ color: '#991B1B' }}>
                                  {order.cancelledBy === 'customer' ? 'Cancelled by customer: ' : 'Reason: '}
                                </span>
                                <span style={{ color: '#DC2626' }}>{order.cancellationReason || order.declinedReason}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SB-46: Review Moderation */}
      <ReviewModerationPanel businessId={businessId} />

      {/* Cancel order dialog */}
      {cancellingOrderId && (
        <div ref={cancelModalRef} onKeyDown={cancelKeyDown} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Cancel order">
          <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => !cancelSubmitting && setCancellingOrderId(null)} />
          <div className="relative mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--aurora-text)' }}>Cancel Order</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Please select a reason for cancelling this order.
            </p>
            <div className="space-y-2 mb-4">
              {VENDOR_CANCEL_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="vendor-cancel-reason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="accent-red-500"
                  />
                  <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>{reason}</span>
                </label>
              ))}
              {cancelReason === 'Other' && (
                <textarea
                  value={cancelOtherText}
                  onChange={(e) => setCancelOtherText(e.target.value)}
                  placeholder="Please describe..."
                  rows={2}
                  maxLength={200}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-red-300"
                  style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                />
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingOrderId(null)}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelSubmitting || !cancelReason}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#EF4444' }}
              >
                {cancelSubmitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

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
