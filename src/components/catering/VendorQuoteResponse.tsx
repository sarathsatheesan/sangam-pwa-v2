import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Package, Clock, Users, MapPin, Send, Loader2,
  ChevronDown, ChevronUp, ShieldCheck, Plus, Trash2, DollarSign,
  Bell, CheckCircle2, XCircle, Check, Edit, BellRing, Timer,
  BellOff, ChevronRight, RefreshCw,
} from 'lucide-react';
import { notifyVendorQuoteReceived, notifyCustomerRepriceResponseMultiChannel } from '@/services/notificationService';
import { notifyCustomerQuoteReceived, notifyCustomerRepriceResponse } from '@/services/catering/cateringNotifications';

// ── PriceInput: local-state input that avoids cursor-jump on controlled value ──
// Manages its own string state; only pushes cents to parent on blur/Enter.
function PriceInput({
  cents,
  onCentsChange,
  placeholder = '0.00',
  className = '',
  style,
}: {
  cents: number;
  onCentsChange: (cents: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [localValue, setLocalValue] = useState(() =>
    cents > 0 ? (cents / 100).toFixed(2) : '',
  );
  const lastPushedCents = useRef(cents);

  // Sync from parent only when the external value changes (e.g. form reset)
  useEffect(() => {
    if (cents !== lastPushedCents.current) {
      setLocalValue(cents > 0 ? (cents / 100).toFixed(2) : '');
      lastPushedCents.current = cents;
    }
  }, [cents]);

  const pushValue = useCallback(
    (raw: string) => {
      // FIX-CURRENCY: Avoid floating-point precision loss (e.g. 10.005 * 100 = 1000.499...)
      // by parsing whole and fractional parts as integers via string splitting.
      const trimmed = (raw || '0').trim();
      const parts = trimmed.split('.');
      const whole = parseInt(parts[0] || '0', 10) || 0;
      const fracStr = (parts[1] || '').padEnd(2, '0').slice(0, 2); // exactly 2 digits
      const frac = parseInt(fracStr, 10) || 0;
      const newCents = Math.abs(whole) * 100 + frac;
      lastPushedCents.current = newCents;
      onCentsChange(newCents);
    },
    [onCentsChange],
  );

  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => pushValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') pushValue((e.target as HTMLInputElement).value);
      }}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}
import type { CateringQuoteRequest, CateringQuoteResponse, QuotedItem } from '@/services/cateringService';
import {
  fetchQuoteRequestsForBusiness,
  subscribeToBusinessQuoteResponses,
  createQuoteResponse,
  updateQuoteResponse,
  isQuoteResponseEditable,
  formatPrice,
  respondToReprice,
  toEpochMs,
  toDate,
} from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';
import { SafeText } from './SafeText';

interface VendorQuoteResponseProps {
  businessId: string;
  businessName: string;
  businessHeritage?: string;
  businessRating?: number;
}

export default function VendorQuoteResponse({
  businessId,
  businessName,
  businessHeritage,
  businessRating,
}: VendorQuoteResponseProps) {
  const { addToast } = useToast();
  const [requests, setRequests] = useState<CateringQuoteRequest[]>([]);
  const [myResponses, setMyResponses] = useState<CateringQuoteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);

  // ── Reprice response state ──
  const [repriceRespondingId, setRepriceRespondingId] = useState<string | null>(null); // loading
  const [repriceCounterAmount, setRepriceCounterAmount] = useState('');
  const [repriceVendorNote, setRepriceVendorNote] = useState('');
  const [showRepriceCounter, setShowRepriceCounter] = useState<string | null>(null); // responseId showing counter form

  // ── Accordion & sorting state ──
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    open: false,       // Open Requests collapsed by default
    accepted: true,    // Accepted expanded by default
    pending: true,     // Awaiting Decision expanded by default
    declined: false,   // Declined collapsed by default
  });
  const [sortDir, setSortDir] = useState<Record<string, 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc'>>({
    open: 'date-newest',
    accepted: 'date-newest',
    pending: 'date-newest',
    declined: 'date-newest',
  });

  // ── Reminder state ──
  const [reminderSettings, setReminderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(`vendor-quote-reminders-${businessId}`);
      return saved ? JSON.parse(saved) : {
        openRequestAlert: true,
        acceptedReminder: true,
        eventDayReminder: true,
        reminderLeadHours: 24,
      };
    } catch { return { openRequestAlert: true, acceptedReminder: true, eventDayReminder: true, reminderLeadHours: 24 }; }
  });
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [activeReminders, setActiveReminders] = useState<Array<{ id: string; type: string; message: string; requestId: string }>>([]);
  // Snoozed reminders: map of reminder ID → snooze expiry timestamp
  const [snoozedReminders, setSnoozedReminders] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`vendor-snoozed-reminders-${businessId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // Ref for scrolling to a specific request card
  const requestCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Track previous response statuses to detect real-time changes
  const prevResponseStatusRef = useRef<Record<string, string>>({});

  // Quote form state per request
  const [quoteForms, setQuoteForms] = useState<Record<string, {
    items: QuotedItem[];
    deliveryFee: number;
    estimatedPrepTime: string;
    message: string;
  }>>({});

  // ── Load open quote requests (one-time) ──
  useEffect(() => {
    setLoading(true);
    fetchQuoteRequestsForBusiness(businessId)
      .then((reqs) => setRequests(reqs))
      .catch((err) => console.error('Failed to load quote requests:', err))
      .finally(() => setLoading(false));
  }, [businessId]);

  // ── Clean up quoteForms when requests change — remove entries for requests no longer in the list ──
  useEffect(() => {
    setQuoteForms(prev => {
      const activeIds = new Set(requests.map(r => r.id));
      const pruned: typeof prev = {};
      for (const [key, val] of Object.entries(prev)) {
        if (activeIds.has(key)) pruned[key] = val;
      }
      return Object.keys(pruned).length === Object.keys(prev).length ? prev : pruned;
    });
  }, [requests]);

  // ── Real-time subscription for vendor's own quote responses ──
  useEffect(() => {
    const unsub = subscribeToBusinessQuoteResponses(businessId, (responses) => {
      // Detect status changes for notifications
      const prevStatuses = prevResponseStatusRef.current;
      for (const resp of responses) {
        const prev = prevStatuses[resp.id];
        if (prev && prev !== resp.status) {
          // Status changed — notify vendor
          if (resp.status === 'accepted') {
            addToast(
              `Your quote was accepted! Customer ${resp.customerName || ''} has shared their contact details.`,
              'success',
              8000,
            );
          } else if (resp.status === 'partially_accepted') {
            const itemCount = resp.acceptedItemNames?.length || 0;
            addToast(
              `${itemCount} item${itemCount > 1 ? 's' : ''} accepted from your quote! Customer contact details shared.`,
              'success',
              8000,
            );
          } else if (resp.status === 'declined') {
            addToast('A customer has declined your quote.', 'info', 5000);
          }
        }
      }

      // Update previous statuses
      const newStatuses: Record<string, string> = {};
      for (const resp of responses) {
        newStatuses[resp.id] = resp.status;
      }
      prevResponseStatusRef.current = newStatuses;

      setMyResponses(responses);
    });
    return unsub;
  }, [businessId, addToast]);

  const getFormForRequest = (requestId: string, request: CateringQuoteRequest) => {
    if (!quoteForms[requestId]) {
      const items: QuotedItem[] = request.items.map((ri) => ({
        name: ri.name,
        qty: ri.qty,
        unitPrice: 0,
        pricingType: ri.pricingType,
      }));
      setQuoteForms((prev) => ({
        ...prev,
        [requestId]: {
          items,
          deliveryFee: 0,
          estimatedPrepTime: '',
          message: '',
        },
      }));
      return { items, deliveryFee: 0, estimatedPrepTime: '', message: '' };
    }
    return quoteForms[requestId];
  };

  const updateQuoteForm = (requestId: string, updates: Partial<typeof quoteForms[string]>) => {
    setQuoteForms((prev) => ({
      ...prev,
      [requestId]: { ...prev[requestId], ...updates },
    }));
  };

  const updateQuoteItem = (requestId: string, index: number, updates: Partial<QuotedItem>) => {
    setQuoteForms((prev) => {
      const form = prev[requestId];
      if (!form) return prev;
      const items = [...form.items];
      items[index] = { ...items[index], ...updates };
      return { ...prev, [requestId]: { ...form, items } };
    });
  };

  const handleSubmitQuote = async (request: CateringQuoteRequest) => {
    const form = quoteForms[request.id];
    if (!form) return;

    const subtotal = form.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    if (subtotal === 0) {
      addToast('Please enter prices for at least one item', 'error');
      return;
    }

    // Validate tray size is selected for every priced item
    const pricedItems = form.items.filter((i) => i.unitPrice > 0);
    const missingTraySize = pricedItems.filter((i) => !i.traySize);
    if (missingTraySize.length > 0) {
      addToast(
        `Please select a tray size for: ${missingTraySize.map((i) => i.name).join(', ')}`,
        'error',
        5000,
      );
      return;
    }

    const total = subtotal + (form.deliveryFee || 0);

    setSubmittingId(request.id);
    try {
      await createQuoteResponse({
        quoteRequestId: request.id,
        businessId,
        businessName,
        businessRating,
        businessHeritage,
        quotedItems: form.items.filter((i) => i.unitPrice > 0),
        subtotal,
        deliveryFee: form.deliveryFee || undefined,
        total,
        estimatedPrepTime: form.estimatedPrepTime || undefined,
        message: form.message || undefined,
        status: 'submitted',
      });
      addToast('Quote submitted successfully!', 'success');
      // Notify customer about the new quote (fire-and-forget)
      notifyVendorQuoteReceived(request.customerId, request.id, businessName, total).catch(() => {});
      // In-app bell notification for customer
      notifyCustomerQuoteReceived(request.customerId, request.id, businessName, total).catch(() => {});
      // Reload requests to update the open/responded lists
      fetchQuoteRequestsForBusiness(businessId).then(setRequests).catch(() => {});
    } catch (err: any) {
      addToast(err.message || 'Failed to submit quote', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleEditPendingResponse = (response: CateringQuoteResponse, request: CateringQuoteRequest) => {
    // Populate the form with the existing response data
    setQuoteForms((prev) => ({
      ...prev,
      [response.id]: {
        items: response.quotedItems || [],
        deliveryFee: response.deliveryFee || 0,
        estimatedPrepTime: response.estimatedPrepTime || '',
        message: response.message || '',
      },
    }));
    setEditingResponseId(response.id);
  };

  const handleSaveQuoteChanges = async (response: CateringQuoteResponse, request: CateringQuoteRequest) => {
    const form = quoteForms[response.id];
    if (!form) return;

    const subtotal = form.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    if (subtotal === 0) {
      addToast('Please enter prices for at least one item', 'error');
      return;
    }

    // Validate tray size is selected for every priced item
    const pricedItems = form.items.filter((i) => i.unitPrice > 0);
    const missingTraySize = pricedItems.filter((i) => !i.traySize);
    if (missingTraySize.length > 0) {
      addToast(
        `Please select a tray size for: ${missingTraySize.map((i) => i.name).join(', ')}`,
        'error',
        5000,
      );
      return;
    }

    const total = subtotal + (form.deliveryFee || 0);

    setSubmittingId(response.id);
    try {
      await updateQuoteResponse(response.id, {
        quotedItems: form.items.filter((i) => i.unitPrice > 0),
        subtotal,
        deliveryFee: form.deliveryFee || undefined,
        total,
        estimatedPrepTime: form.estimatedPrepTime || undefined,
        message: form.message || undefined,
      });
      addToast('Quote updated successfully!', 'success');
      setEditingResponseId(null);
      // Reload responses to reflect updates
      fetchQuoteRequestsForBusiness(businessId).then(setRequests).catch(() => {});
    } catch (err: any) {
      addToast(err.message || 'Failed to update quote', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // ── Reprice response handler ──
  const handleRepriceResponse = async (
    response: CateringQuoteResponse,
    action: 'accept' | 'deny' | 'counter',
  ) => {
    setRepriceRespondingId(response.id);
    try {
      let counterPrice: number | undefined;
      if (action === 'counter') {
        counterPrice = Math.round(parseFloat(repriceCounterAmount) * 100);
        if (isNaN(counterPrice) || counterPrice <= 0) {
          addToast('Please enter a valid counter price', 'error');
          setRepriceRespondingId(null);
          return;
        }
      }

      await respondToReprice(response.id, action, counterPrice, repriceVendorNote);

      const actionLabel = action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : 'countered';
      addToast(
        action === 'accept'
          ? 'Price request accepted! The customer can now proceed.'
          : action === 'deny'
            ? 'Price request declined. Your original price stands.'
            : `Counter-offer of $${(counterPrice! / 100).toFixed(2)} sent! Waiting for customer.`,
        action === 'accept' ? 'success' : 'info',
        5000,
      );

      setShowRepriceCounter(null);
      setRepriceCounterAmount('');
      setRepriceVendorNote('');

      // Notify customer (fire-and-forget)
      const request = requests.find((r) => r.id === response.quoteRequestId);
      if (request?.customerId) {
        notifyCustomerRepriceResponse(
          request.customerId, response.quoteRequestId, businessName,
          action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : 'countered',
          counterPrice,
        ).catch(() => {});
        notifyCustomerRepriceResponseMultiChannel(
          request.customerId, response.quoteRequestId,
          action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : 'countered',
          counterPrice,
        ).catch(() => {});
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to respond to reprice request', 'error');
    } finally {
      setRepriceRespondingId(null);
    }
  };

  const hasRespondedTo = (requestId: string) =>
    myResponses.some((r) => r.quoteRequestId === requestId);

  // ── Section helpers ──
  const toggleSection = (key: string) =>
    setSectionExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  type SortOption = 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc';
  const setSort = (key: string, value: SortOption) =>
    setSortDir((prev) => ({ ...prev, [key]: value }));

  const saveReminderSettings = (updates: Partial<typeof reminderSettings>) => {
    setReminderSettings((prev: typeof reminderSettings) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(`vendor-quote-reminders-${businessId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const formatEventDate = (eventDate: any): string => {
    if (!eventDate) return '';
    const date = toDate(eventDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRequestEventMs = (req: CateringQuoteRequest): number => {
    if (!req.eventDate) return 0;
    const d = toDate(req.eventDate);
    return d.getTime();
  };

  const sortRequests = (arr: CateringQuoteRequest[], dir: 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc') => {
    return [...arr].sort((a, b) => {
      if (dir === 'date-newest' || dir === 'date-oldest') {
        const diff = getRequestEventMs(b) - getRequestEventMs(a);
        return dir === 'date-newest' ? diff : -diff;
      } else if (dir === 'name-asc' || dir === 'name-desc') {
        const nameA = a.customerName || a.cuisineCategory || '';
        const nameB = b.customerName || b.cuisineCategory || '';
        const comparison = nameA.localeCompare(nameB, 'en-US', { sensitivity: 'base' });
        return dir === 'name-asc' ? comparison : -comparison;
      }
      return 0;
    });
  };

  const sortResponses = (arr: CateringQuoteResponse[], dir: 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc') => {
    return [...arr].sort((a, b) => {
      const reqA = requests.find((r) => r.id === a.quoteRequestId);
      const reqB = requests.find((r) => r.id === b.quoteRequestId);

      if (dir === 'date-newest' || dir === 'date-oldest') {
        const diff = getRequestEventMs(reqB as any || {} as any) - getRequestEventMs(reqA as any || {} as any);
        return dir === 'date-newest' ? diff : -diff;
      } else if (dir === 'name-asc' || dir === 'name-desc') {
        const nameA = a.customerName || (reqA ? reqA.cuisineCategory : '') || '';
        const nameB = b.customerName || (reqB ? reqB.cuisineCategory : '') || '';
        const comparison = nameA.localeCompare(nameB, 'en-US', { sensitivity: 'base' });
        return dir === 'name-asc' ? comparison : -comparison;
      }
      return 0;
    });
  };

  // Filter out requests already responded to
  const openRequests = sortRequests(requests.filter((r) => !hasRespondedTo(r.id)), sortDir.open);
  const respondedRequests = requests.filter((r) => hasRespondedTo(r.id));

  // Separate accepted responses for prominent display
  const acceptedResponses = sortResponses(myResponses.filter((r) => r.status === 'accepted' || r.status === 'partially_accepted'), sortDir.accepted);
  const pendingResponses = sortResponses(myResponses.filter((r) => r.status === 'submitted'), sortDir.pending);
  const declinedResponses = sortResponses(myResponses.filter((r) => r.status === 'declined'), sortDir.declined);

  // ── Snooze handler — snoozes a reminder for a given duration ──
  const handleSnooze = useCallback((reminderId: string, durationMs: number) => {
    const expiresAt = Date.now() + durationMs;
    setSnoozedReminders((prev) => {
      const next = { ...prev, [reminderId]: expiresAt };
      try { localStorage.setItem(`vendor-snoozed-reminders-${businessId}`, JSON.stringify(next)); } catch {}
      return next;
    });
    addToast('Reminder snoozed', 'info');
  }, [businessId, addToast]);

  // ── Click-to-navigate: expand Open Requests section, expand the card, scroll to it ──
  const handleReminderClick = useCallback((requestId: string) => {
    // Ensure the Open Requests section is expanded
    setSectionExpanded((prev) => ({ ...prev, open: true }));
    // Expand the specific request card
    setExpandedId(requestId);
    // Scroll to the card after a brief delay for DOM update
    setTimeout(() => {
      const el = requestCardRefs.current[requestId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight flash
        el.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.4)';
        setTimeout(() => { el.style.boxShadow = ''; }, 1500);
      }
    }, 150);
  }, []);

  // ── Reminder engine ──
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const reminders: Array<{ id: string; type: string; message: string; requestId: string }> = [];

      if (reminderSettings.openRequestAlert) {
        for (const req of requests.filter((r) => !hasRespondedTo(r.id))) {
          const createdMs = toEpochMs(req.createdAt);
          if (createdMs > 0 && now - createdMs > 30 * 60 * 1000) {
            const elapsedMin = Math.round((now - createdMs) / 60000);
            const waitLabel = elapsedMin < 60 ? `${elapsedMin} min` : elapsedMin < 1440 ? `${(elapsedMin / 60).toFixed(1)} hrs` : `${(elapsedMin / 1440).toFixed(1)} days`;
            reminders.push({ id: `open-${req.id}`, type: 'open', message: `${formatEventDate(req.eventDate)} · ${req.headcount} guests · waiting ${waitLabel}`, requestId: req.id });
          }
        }
      }
      if (reminderSettings.eventDayReminder) {
        const leadMs = (reminderSettings.reminderLeadHours || 24) * 60 * 60 * 1000;
        for (const req of requests) {
          const eventMs = getRequestEventMs(req);
          if (eventMs > 0 && eventMs - now > 0 && eventMs - now < leadMs) {
            reminders.push({ id: `event-${req.id}`, type: 'event', message: `${formatEventDate(req.eventDate)} · event within ${reminderSettings.reminderLeadHours}h`, requestId: req.id });
          }
        }
      }
      // Filter out snoozed reminders (check expiry vs now)
      const filtered = reminders.filter((r) => {
        const expiresAt = snoozedReminders[r.id];
        return !expiresAt || expiresAt <= now;
      });
      setActiveReminders(filtered);
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, myResponses, reminderSettings, snoozedReminders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-accent)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading quote requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Privacy notice */}
      <div
        className="flex items-start gap-3 p-3 rounded-xl"
        style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
      >
        <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--aurora-accent)' }} />
        <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
          Customer details are hidden until they accept your quote. You'll be notified in real-time when a customer accepts.
        </p>
      </div>

      {/* ── Active Reminders Banner — clickable pills with snooze ── */}
      {activeReminders.length > 0 && (
        <div className="space-y-2">
          {activeReminders.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-xl text-xs font-medium overflow-hidden"
              style={{
                backgroundColor: r.type === 'open' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                color: r.type === 'open' ? '#D97706' : 'var(--aurora-accent)',
              }}
            >
              {/* Clickable pill — navigates to the request card */}
              <button
                type="button"
                onClick={() => handleReminderClick(r.requestId)}
                className="flex items-center gap-2 flex-1 p-3 text-left"
                style={{ color: 'inherit', WebkitTapHighlightColor: 'transparent' }}
              >
                {r.type === 'open' ? <Timer size={14} className="flex-shrink-0" /> : <BellRing size={14} className="flex-shrink-0" />}
                <span className="flex-1">{r.message}</span>
                <ChevronRight size={14} className="flex-shrink-0 opacity-50" />
              </button>
              {/* Snooze button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSnooze(r.id, 2 * 60 * 60 * 1000); }}
                className="flex items-center gap-1 px-3 py-2 mr-1 rounded-lg text-[10px] font-semibold"
                style={{
                  color: r.type === 'open' ? '#D97706' : 'var(--aurora-accent)',
                  backgroundColor: r.type === 'open' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                  WebkitTapHighlightColor: 'transparent',
                }}
                title="Snooze for 2 hours"
              >
                <BellOff size={12} />
                <span className="hidden sm:inline">Snooze</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Reminder Settings Toggle ── */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowReminderSettings(!showReminderSettings)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--aurora-text-secondary)', backgroundColor: showReminderSettings ? 'rgba(99,102,241,0.08)' : 'transparent' }}
        >
          <Bell size={14} /> Reminders
        </button>
      </div>

      {showReminderSettings && (
        <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aurora-text-secondary)' }}>Reminder Preferences</p>
          {[
            { key: 'openRequestAlert', label: 'Alert for unanswered requests (>30 min)' },
            { key: 'eventDayReminder', label: 'Upcoming event day reminder' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>{label}</span>
              <div
                className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                style={{ backgroundColor: (reminderSettings as any)[key] ? 'var(--aurora-accent)' : 'var(--aurora-border)' }}
                onClick={() => saveReminderSettings({ [key]: !(reminderSettings as any)[key] })}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ left: (reminderSettings as any)[key] ? '22px' : '2px' }}
                />
              </div>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>Event lead time:</span>
            <select
              value={reminderSettings.reminderLeadHours}
              onChange={(e) => saveReminderSettings({ reminderLeadHours: Number(e.target.value) })}
              className="text-sm rounded-lg border px-2 py-1 outline-none"
              style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text)' }}
            >
              {[6, 12, 24, 48, 72].map((h) => (
                <option key={h} value={h}>{h}h</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ══ Open requests (not yet responded to) ══ */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
        {/* Section header — collapsible */}
        <button
          onClick={() => toggleSection('open')}
          className="w-full flex items-center justify-between p-4 text-left transition-colors"
          style={{
            backgroundColor: sectionExpanded.open ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)',
            borderBottom: sectionExpanded.open ? '1px solid var(--aurora-border)' : 'none',
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: '#F59E0B' }}>Open Requests</h3>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#F59E0B' }}>
                {openRequests.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortDir.open}
              onChange={(e) => { e.stopPropagation(); setSort('open', e.target.value as SortOption); }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
              style={{ color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23F59E0B\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
            >
              <option value="date-newest">Date: Newest</option>
              <option value="date-oldest">Date: Oldest</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="name-desc">Name: Z → A</option>
            </select>
            {sectionExpanded.open ? <ChevronUp size={18} style={{ color: '#F59E0B' }} /> : <ChevronDown size={18} style={{ color: '#F59E0B' }} />}
          </div>
        </button>

        {sectionExpanded.open && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--aurora-border)' }}>
        {openRequests.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>No open quote requests right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openRequests.map((request) => {
              const isExpanded = expandedId === request.id;
              const form = getFormForRequest(request.id, request);
              const formSubtotal = form.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
              const formTotal = formSubtotal + (form.deliveryFee || 0);

              return (
                <div
                  key={request.id}
                  ref={(el) => { requestCardRefs.current[request.id] = el; }}
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)', transition: 'box-shadow 0.3s ease' }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {request.customerName || request.cuisineCategory} · {formatEventDate(request.eventDate)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                          {request.status === 'partially_accepted' ? 'Partial' : 'Open'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>
                        <span>{request.cuisineCategory}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="opacity-40" /> : <ChevronDown size={18} className="opacity-40" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                      {/* Requested items */}
                      <div className="pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                          Requested Items
                        </p>
                        {request.items.map((ri, i) => {
                          // Show if this item is already assigned to another vendor
                          const assignment = (request.itemAssignments || []).find((a) => a.itemName === ri.name);
                          return (
                            <div key={i} className="flex items-center gap-3 text-sm mb-1" style={{ color: 'var(--aurora-text)', opacity: assignment ? 0.5 : 1 }}>
                              <span>
                                {assignment ? <CheckCircle2 size={12} className="inline mr-1" style={{ color: '#059669' }} /> : ''}
                                {ri.name} (qty: {ri.qty}, {ri.pricingType.replace('_', ' ')})
                              </span>
                              {ri.dietaryTags && ri.dietaryTags.length > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE520', color: '#059669' }}>
                                  {ri.dietaryTags.join(', ')}
                                </span>
                              )}
                              {assignment && (
                                <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                                  Assigned to {assignment.businessName}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {request.specialInstructions && (
                          <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-secondary)' }}>
                            Note: <SafeText text={request.specialInstructions} />
                          </p>
                        )}
                      </div>

                      {/* Quote form */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aurora-accent)' }}>
                          Your Quote
                        </p>
                        {form.items.map((qi, idx) => {
                          const requestItem = request.items[idx];
                          const pricingLabel = (requestItem?.pricingType || qi.pricingType || 'per_unit').replace(/_/g, ' ');

                          // Check if this item is assigned to another vendor
                          const assignedToOther = (request.itemAssignments || []).find(
                            (a) => a.itemName === qi.name && a.businessId !== businessId
                          );

                          return (
                            <div key={idx} className="space-y-2 pb-3 border-b last:border-b-0" style={{ borderColor: 'var(--aurora-border)', opacity: assignedToOther ? 0.5 : 1 }}>
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>
                                    {qi.name} x {qi.qty}
                                  </span>
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: 'var(--aurora-accent)' }}>
                                    {pricingLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {assignedToOther ? (
                                    <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                                      Assigned to {assignedToOther.businessName}
                                    </span>
                                  ) : (
                                    <>
                                      <DollarSign size={14} style={{ color: 'var(--aurora-text-secondary)' }} />
                                      <PriceInput
                                        cents={qi.unitPrice}
                                        onCentsChange={(c) => updateQuoteItem(request.id, idx, { unitPrice: c })}
                                        className="w-24 rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                      />
                                      <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>/{pricingLabel.split(' ').pop()}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {/* Tray size selector (required) */}
                              {!assignedToOther && (
                                <div className="flex items-center gap-2 ml-1">
                                  <span className="text-xs" style={{ color: !qi.traySize && qi.unitPrice > 0 ? '#EF4444' : 'var(--aurora-text-secondary)' }}>
                                    Tray size{!qi.traySize && qi.unitPrice > 0 ? ' *' : ':'}
                                  </span>
                                  {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => updateQuoteItem(request.id, idx, { traySize: qi.traySize === size ? undefined : size })}
                                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                        qi.traySize === size ? 'text-white' : 'border hover:opacity-80'
                                      }`}
                                      style={
                                        qi.traySize === size
                                          ? { backgroundColor: '#6366F1' }
                                          : {
                                              borderColor: !qi.traySize && qi.unitPrice > 0 ? '#FCA5A5' : 'var(--aurora-border)',
                                              color: 'var(--aurora-text-secondary)',
                                            }
                                      }
                                    >
                                      {size.charAt(0).toUpperCase() + size.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Fees */}
                        <div className="pt-2">
                          <div>
                            <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Delivery fee ($)</label>
                            <PriceInput
                              cents={form.deliveryFee}
                              onCentsChange={(c) => updateQuoteForm(request.id, { deliveryFee: c })}
                              className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1"
                              style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                            />
                          </div>
                        </div>

                        {/* Prep time & message */}
                        <input
                          type="text"
                          value={form.estimatedPrepTime}
                          onChange={(e) => updateQuoteForm(request.id, { estimatedPrepTime: e.target.value })}
                          placeholder="Estimated prep time (e.g. 2-3 hours)"
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                          style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                        />
                        <textarea
                          value={form.message}
                          onChange={(e) => updateQuoteForm(request.id, { message: e.target.value })}
                          placeholder="Personal message to the customer (optional)"
                          rows={2}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/30"
                          style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                        />

                        {/* Total preview */}
                        <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: 'var(--aurora-bg)' }}>
                          <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>Quote Total</span>
                          <span className="text-lg font-bold" style={{ color: 'var(--aurora-accent)' }}>
                            {formTotal > 0 ? formatPrice(formTotal) : '$0.00'}
                          </span>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={() => handleSubmitQuote(request)}
                          disabled={submittingId === request.id || formSubtotal === 0}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: 'var(--aurora-accent)' }}
                        >
                          {submittingId === request.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                          Submit Quote
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>

      {/* ══ Accepted quotes ══ */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
        <button
          onClick={() => toggleSection('accepted')}
          className="w-full flex items-center justify-between p-4 text-left transition-colors"
          style={{
            backgroundColor: sectionExpanded.accepted ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.04)',
            borderBottom: sectionExpanded.accepted ? '1px solid var(--aurora-border)' : 'none',
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: '#22C55E' }}>Accepted</h3>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#22C55E' }}>
                {acceptedResponses.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortDir.accepted}
              onChange={(e) => { e.stopPropagation(); setSort('accepted', e.target.value as SortOption); }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
              style={{ color: '#22C55E', borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322C55E\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
            >
              <option value="date-newest">Date: Newest</option>
              <option value="date-oldest">Date: Oldest</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="name-desc">Name: Z → A</option>
            </select>
            {sectionExpanded.accepted ? <ChevronUp size={18} style={{ color: '#22C55E' }} /> : <ChevronDown size={18} style={{ color: '#22C55E' }} />}
          </div>
        </button>

        {sectionExpanded.accepted && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--aurora-border)' }}>
        {acceptedResponses.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 size={28} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>No accepted quotes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptedResponses.map((response) => {
              const request = requests.find((r) => r.id === response.quoteRequestId);
              const isPartial = response.status === 'partially_accepted';
              const isExpAccepted = expandedId === `accepted-${response.id}`;

              return (
                <div
                  key={response.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                >
                  {/* Collapsible pill header */}
                  <button
                    onClick={() => setExpandedId(isExpAccepted ? null : `accepted-${response.id}`)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {response.customerName || request?.cuisineCategory || 'Catering'} · {request ? formatEventDate(request.eventDate) : ''}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                        >
                          <CheckCircle2 size={10} />
                          {isPartial ? 'Partial' : 'Accepted'}
                        </span>
                        {/* Finalize Pending indicator: shows when quote is accepted but customer hasn't provided delivery address yet */}
                        {request && !request.deliveryAddress && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                          >
                            <Timer size={10} />
                            Awaiting Finalization
                          </span>
                        )}
                        {request && request.deliveryAddress && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}
                          >
                            <Package size={10} />
                            Order Created
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        {request && <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>}
                        {request && <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>}
                        <span>{request?.cuisineCategory}</span>
                        <span className="font-medium" style={{ color: 'var(--aurora-accent)' }}>{formatPrice(response.total)}</span>
                      </div>
                    </div>
                    {isExpAccepted ? <ChevronUp size={18} className="opacity-40" /> : <ChevronDown size={18} className="opacity-40" />}
                  </button>

                  {isExpAccepted && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                      {/* Request details */}
                      {request && (
                        <div className="pt-3">
                          <div className="flex items-center gap-3 flex-wrap text-xs mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                            {request.eventType && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: 'var(--aurora-accent)' }}>
                                {request.eventType.replace(/_/g, ' ')}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {toDate(request.eventDate).toLocaleDateString('en-US')}
                            </span>
                          </div>
                          {/* Full item breakdown */}
                          <div className="space-y-1">
                            {response.quotedItems?.map((qi, i) => (
                              <div key={i} className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <span>{qi.name} x {qi.qty} ({qi.pricingType?.replace(/_/g, ' ') || 'per unit'}){qi.traySize ? ` · ${qi.traySize}` : ''}</span>
                                <span>{formatPrice(qi.unitPrice * qi.qty)}</span>
                              </div>
                            ))}
                            {response.deliveryFee != null && response.deliveryFee > 0 && (
                              <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <span>Delivery fee</span><span>{formatPrice(response.deliveryFee)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}>
                              <span>Total</span><span style={{ color: 'var(--aurora-accent)' }}>{formatPrice(response.total)}</span>
                            </div>
                          </div>
                          {request.specialInstructions && (
                            <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-secondary)' }}>
                              Customer note: {request.specialInstructions}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Accepted items */}
                      {response.acceptedItemNames && response.acceptedItemNames.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                            Accepted Items
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {response.acceptedItemNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}
                              >
                                <Check size={10} />
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customer contact details */}
                      {response.customerName && (
                        <div
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: '#D1FAE5' }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#059669' }}>
                            Customer Contact
                          </p>
                          <div className="space-y-1">
                            <p className="text-sm font-medium" style={{ color: '#065F46' }}>
                              {response.customerName}
                            </p>
                            {response.customerPhone && (
                              <p className="text-xs" style={{ color: '#065F46' }}>
                                Phone: {response.customerPhone}
                              </p>
                            )}
                            {response.customerEmail && (
                              <p className="text-xs" style={{ color: '#065F46' }}>
                                Email: {response.customerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>

      {/* ══ Pending quotes (submitted, awaiting customer decision) ══ */}
      {pendingResponses.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
          <button
            onClick={() => toggleSection('pending')}
            className="w-full flex items-center justify-between p-4 text-left transition-colors"
            style={{
              backgroundColor: sectionExpanded.pending ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
              borderBottom: sectionExpanded.pending ? '1px solid var(--aurora-border)' : 'none',
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold" style={{ color: 'var(--aurora-accent)' }}>Awaiting Decision</h3>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--aurora-accent)' }}>
                  {pendingResponses.length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortDir.pending}
                onChange={(e) => { e.stopPropagation(); setSort('pending', e.target.value as SortOption); }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
                style={{ color: '#6366F1', borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236366F1\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
              >
                <option value="date-newest">Date: Newest</option>
                <option value="date-oldest">Date: Oldest</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
              {sectionExpanded.pending ? <ChevronUp size={18} style={{ color: 'var(--aurora-accent)' }} /> : <ChevronDown size={18} style={{ color: 'var(--aurora-accent)' }} />}
            </div>
          </button>

          {sectionExpanded.pending && (
          <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: 'var(--aurora-border)' }}>
            {pendingResponses.map((response) => {
              const request = requests.find((r) => r.id === response.quoteRequestId);
              const isExpanded = expandedId === `pending-${response.id}`;
              const isEditing = editingResponseId === response.id;
              const canEdit = isQuoteResponseEditable(response);
              const form = isEditing && quoteForms[response.id] ? quoteForms[response.id] : null;
              const formSubtotal = form ? form.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) : 0;
              const formTotal = form ? formSubtotal + (form.deliveryFee || 0) : 0;

              return (
                <div
                  key={response.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : `pending-${response.id}`)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                          {request?.customerName || request?.cuisineCategory || 'Catering'} · {request ? formatEventDate(request.eventDate) : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span>{request?.headcount || '?'} guests</span>
                        <span>{request?.deliveryCity || ''}</span>
                        <span>Quote: {isEditing && form ? formatPrice(formTotal) : formatPrice(response.total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}
                      >
                        {isEditing ? 'Editing' : 'Pending'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                    </div>
                  </button>
                  {isExpanded && request && (
                    <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: 'var(--aurora-border)' }}>
                      {isEditing && form ? (
                        <>
                          {/* Edit mode: quote form */}
                          <p className="text-xs font-semibold uppercase tracking-wider pt-3" style={{ color: 'var(--aurora-accent)' }}>
                            Edit Your Quote
                          </p>
                          {form.items.map((qi, idx) => {
                            const requestItem = request.items[idx];
                            const pricingLabel = (requestItem?.pricingType || qi.pricingType || 'per_unit').replace(/_/g, ' ');
                            return (
                              <div key={idx} className="space-y-2 pb-3 border-b last:border-b-0" style={{ borderColor: 'var(--aurora-border)' }}>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>
                                      {qi.name} x {qi.qty}
                                    </span>
                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: 'var(--aurora-accent)' }}>
                                      {pricingLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <DollarSign size={14} style={{ color: 'var(--aurora-text-secondary)' }} />
                                    <PriceInput
                                      cents={qi.unitPrice}
                                      onCentsChange={(c) => updateQuoteItem(response.id, idx, { unitPrice: c })}
                                      className="w-24 rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-500/30"
                                      style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                                    />
                                    <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>/{pricingLabel.split(' ').pop()}</span>
                                  </div>
                                </div>
                                {/* Tray size selector (edit mode) */}
                                <div className="flex items-center gap-2 ml-1">
                                  <span className="text-xs" style={{ color: !qi.traySize ? '#EF4444' : 'var(--aurora-text-secondary)' }}>
                                    Tray size{!qi.traySize ? ' *' : ':'}
                                  </span>
                                  {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => updateQuoteItem(response.id, idx, { traySize: qi.traySize === size ? undefined : size })}
                                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                        qi.traySize === size ? 'text-white' : 'border hover:opacity-80'
                                      }`}
                                      style={
                                        qi.traySize === size
                                          ? { backgroundColor: '#6366F1' }
                                          : { borderColor: !qi.traySize ? '#FCA5A5' : 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }
                                      }
                                    >
                                      {size.charAt(0).toUpperCase() + size.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {/* Fees in edit mode */}
                          <div className="pt-2">
                            <div>
                              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Delivery fee ($)</label>
                              <PriceInput
                                cents={form.deliveryFee}
                                onCentsChange={(c) => updateQuoteForm(response.id, { deliveryFee: c })}
                                className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1"
                                style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                              />
                            </div>
                          </div>

                          {/* Prep time & message in edit mode */}
                          <input
                            type="text"
                            value={form.estimatedPrepTime}
                            onChange={(e) => updateQuoteForm(response.id, { estimatedPrepTime: e.target.value })}
                            placeholder="Estimated prep time (e.g. 2-3 hours)"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                          />
                          <textarea
                            value={form.message}
                            onChange={(e) => updateQuoteForm(response.id, { message: e.target.value })}
                            placeholder="Personal message to the customer (optional)"
                            rows={2}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                          />

                          {/* Total preview in edit mode */}
                          <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: 'var(--aurora-bg)' }}>
                            <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>Updated Total</span>
                            <span className="text-lg font-bold" style={{ color: 'var(--aurora-accent)' }}>
                              {formTotal > 0 ? formatPrice(formTotal) : '$0.00'}
                            </span>
                          </div>

                          {/* Edit mode buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveQuoteChanges(response, request)}
                              disabled={submittingId === response.id || formSubtotal === 0}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: 'var(--aurora-accent)' }}
                            >
                              {submittingId === response.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingResponseId(null)}
                              disabled={submittingId === response.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                              style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* View mode */}
                          {/* Event details */}
                          <div className="flex items-center gap-3 text-xs pt-3" style={{ color: 'var(--aurora-text-secondary)' }}>
                            <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>
                            <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {toDate(request.eventDate).toLocaleDateString('en-US')}
                            </span>
                          </div>
                          {/* Requested items */}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                              Requested Items
                            </p>
                            {request.items.map((ri, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm mb-1.5" style={{ color: 'var(--aurora-text)' }}>
                                <span>{ri.name} (qty: {ri.qty}, {ri.pricingType.replace(/_/g, ' ')})</span>
                                {ri.dietaryTags && ri.dietaryTags.length > 0 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                                    {ri.dietaryTags.join(', ')}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Your submitted quote breakdown */}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aurora-accent)' }}>
                              Your Submitted Quote
                            </p>
                            {response.quotedItems.map((qi, i) => (
                              <div key={i} className="flex justify-between text-sm mb-1" style={{ color: 'var(--aurora-text)' }}>
                                <span>{qi.name} x {qi.qty} <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>({qi.pricingType?.replace(/_/g, ' ') || 'per unit'})</span></span>
                                <span>{formatPrice(qi.unitPrice * qi.qty)}</span>
                              </div>
                            ))}
                            {response.deliveryFee != null && response.deliveryFee > 0 && (
                              <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <span>Delivery fee</span><span>{formatPrice(response.deliveryFee)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}>
                              <span>Total</span><span style={{ color: 'var(--aurora-accent)' }}>{formatPrice(response.total)}</span>
                            </div>
                          </div>
                          {response.estimatedPrepTime && (
                            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                              <Clock size={12} /> Prep time: {response.estimatedPrepTime}
                            </p>
                          )}
                          {request.specialInstructions && (
                            <p className="text-xs p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-secondary)' }}>
                              Customer note: {request.specialInstructions}
                            </p>
                          )}

                          {/* ── Reprice Request Panel — vendor responds to customer's price request ── */}
                          {response.repriceStatus === 'requested' && (() => {
                            const expiresMs = toEpochMs(response.repriceExpiresAt);
                            const remainingMs = Math.max(0, expiresMs - Date.now());
                            const hrs = Math.floor(remainingMs / (60 * 60 * 1000));
                            const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                            const isExpired = remainingMs <= 0;
                            const isUrgent = hrs < 4 && !isExpired;
                            const timeLeft = isExpired ? 'Expired' : hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;

                            return (
                              <div className="mt-2 p-3 rounded-xl border space-y-2" style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}>
                                <div className="flex items-center gap-2">
                                  <RefreshCw size={16} style={{ color: '#D97706' }} />
                                  <p className="text-sm font-semibold" style={{ color: '#92400E' }}>Price Negotiation Request</p>
                                </div>
                                <p className="text-sm" style={{ color: '#92400E' }}>
                                  Customer proposes: <strong>{formatPrice(response.repriceRequestedPrice || 0)}</strong>
                                  <span className="text-xs ml-1">(your quote: {formatPrice(response.total)})</span>
                                </p>
                                {/* Items included in this reprice request */}
                                {response.quotedItems && response.quotedItems.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs font-medium mb-0.5" style={{ color: '#92400E' }}>Items in request:</p>
                                    <ul className="space-y-0.5">
                                      {response.quotedItems.map((item, idx) => (
                                        <li key={idx} className="text-xs flex items-center gap-1.5" style={{ color: '#92400E' }}>
                                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#D97706' }} />
                                          {item.name} × {item.qty} — {formatPrice(item.unitPrice * item.qty)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {response.repriceReason && (
                                  <p className="text-xs" style={{ color: '#92400E' }}>Reason: &ldquo;{response.repriceReason}&rdquo;</p>
                                )}
                                <div className="flex items-center gap-1">
                                  <Timer size={12} style={{ color: isUrgent ? '#D97706' : '#6B7280' }} />
                                  <span className={`text-xs ${isUrgent ? 'font-medium' : ''}`} style={{ color: isUrgent ? '#D97706' : '#6B7280' }}>
                                    {timeLeft}
                                  </span>
                                </div>

                                {!isExpired && showRepriceCounter !== response.id && (
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleRepriceResponse(response, 'accept')}
                                      disabled={repriceRespondingId === response.id}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                      style={{ backgroundColor: '#059669' }}
                                    >
                                      {repriceRespondingId === response.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                      Accept Price
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setShowRepriceCounter(response.id); setRepriceCounterAmount(''); setRepriceVendorNote(''); }}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                                      style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}
                                    >
                                      <RefreshCw size={12} />
                                      Counter-Offer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRepriceResponse(response, 'deny')}
                                      disabled={repriceRespondingId === response.id}
                                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                      style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}

                                {/* Counter-offer form */}
                                {showRepriceCounter === response.id && !isExpired && (
                                  <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                                    <div>
                                      <label className="block text-xs font-medium mb-1" style={{ color: '#92400E' }}>
                                        Your counter price <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--aurora-text-muted)' }}>$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={repriceCounterAmount}
                                          onChange={(e) => setRepriceCounterAmount(e.target.value)}
                                          placeholder="0.00"
                                          className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                          style={{ borderColor: 'var(--aurora-border)' }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium mb-1" style={{ color: '#92400E' }}>
                                        Note <span className="text-xs font-normal">(optional)</span>
                                      </label>
                                      <textarea
                                        value={repriceVendorNote}
                                        onChange={(e) => setRepriceVendorNote(e.target.value)}
                                        placeholder="Explain your counter-offer..."
                                        rows={2}
                                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                        style={{ borderColor: 'var(--aurora-border)' }}
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleRepriceResponse(response, 'counter')}
                                        disabled={repriceRespondingId === response.id || !repriceCounterAmount}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--aurora-accent)' }}
                                      >
                                        {repriceRespondingId === response.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                        Send Counter
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowRepriceCounter(null)}
                                        className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                                        style={{ color: 'var(--aurora-text-secondary)' }}
                                      >
                                        Back
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {isExpired && (
                                  <p className="text-xs font-medium" style={{ color: '#EF4444' }}>This reprice request has expired.</p>
                                )}
                              </div>
                            );
                          })()}

                          {/* Reprice resolved status banners for vendor */}
                          {response.repriceStatus === 'vendor_accepted' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#059669' }}>
                                <CheckCircle2 size={12} /> You accepted the customer&apos;s price of {formatPrice(response.repriceRequestedPrice || 0)}
                              </p>
                            </div>
                          )}
                          {response.repriceStatus === 'vendor_denied' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#92400E' }}>
                                <XCircle size={12} /> You declined the price request. Original price stands.
                              </p>
                            </div>
                          )}
                          {response.repriceStatus === 'vendor_countered' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#1E40AF' }}>
                                <RefreshCw size={12} /> Counter-offer of {formatPrice(response.repriceCounterPrice || 0)} sent. Waiting for customer response.
                              </p>
                            </div>
                          )}
                          {response.repriceStatus === 'counter_accepted' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#059669' }}>
                                <CheckCircle2 size={12} /> Customer accepted your counter-offer of {formatPrice(response.repriceCounterPrice || 0)}
                              </p>
                            </div>
                          )}
                          {response.repriceStatus === 'counter_declined' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#92400E' }}>
                                <XCircle size={12} /> Customer declined your counter-offer. Original price stands.
                              </p>
                            </div>
                          )}
                          {response.repriceStatus === 'expired' && (
                            <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#F3F4F6' }}>
                              <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#6B7280' }}>
                                <Clock size={12} /> Price negotiation expired.
                              </p>
                            </div>
                          )}

                          {/* Edit Quote button with edit window countdown */}
                          {canEdit && (() => {
                            const createdMs = toEpochMs(response.createdAt);
                            const expiresMs = createdMs + 24 * 60 * 60 * 1000;
                            const remainingMs = Math.max(0, expiresMs - Date.now());
                            const remainingHrs = Math.floor(remainingMs / (60 * 60 * 1000));
                            const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                            const isUrgent = remainingHrs < 4;
                            return (
                              <div className="mt-2 space-y-1">
                                <button
                                  onClick={() => handleEditPendingResponse(response, request)}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                  style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}
                                >
                                  <Edit size={16} />
                                  Edit Quote
                                </button>
                                {createdMs > 0 && (
                                  <p className={`text-xs text-center ${isUrgent ? 'font-medium' : ''}`} style={{ color: isUrgent ? '#D97706' : 'var(--aurora-text-muted)' }}>
                                    {remainingHrs > 0 ? `${remainingHrs}h ${remainingMins}m` : `${remainingMins}m`} left to edit
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ══ Declined quotes ══ */}
      {declinedResponses.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
          <button
            onClick={() => toggleSection('declined')}
            className="w-full flex items-center justify-between p-4 text-left transition-colors"
            style={{
              backgroundColor: sectionExpanded.declined ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
              borderBottom: sectionExpanded.declined ? '1px solid var(--aurora-border)' : 'none',
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold" style={{ color: '#EF4444' }}>Declined</h3>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#EF4444' }}>
                  {declinedResponses.length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sectionExpanded.declined ? <ChevronUp size={18} style={{ color: '#EF4444' }} /> : <ChevronDown size={18} style={{ color: '#EF4444' }} />}
            </div>
          </button>

          {sectionExpanded.declined && (
          <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: 'var(--aurora-border)' }}>
            {declinedResponses.map((response) => {
              const request = requests.find((r) => r.id === response.quoteRequestId);
              const isExpanded = expandedId === `declined-${response.id}`;
              return (
                <div
                  key={response.id}
                  className="rounded-2xl border overflow-hidden opacity-60"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : `declined-${response.id}`)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                          {request?.customerName || request?.cuisineCategory || 'Catering'} · {request ? formatEventDate(request.eventDate) : ''}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        Your quote: {formatPrice(response.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}
                      >
                        Declined
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                    </div>
                  </button>
                  {isExpanded && request && (
                    <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: 'var(--aurora-border)' }}>
                      <div className="flex items-center gap-3 text-xs pt-3" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {toDate(request.eventDate).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                          Requested Items
                        </p>
                        {request.items.map((ri, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm mb-1.5" style={{ color: 'var(--aurora-text)' }}>
                            <span>{ri.name} (qty: {ri.qty}, {ri.pricingType.replace(/_/g, ' ')})</span>
                            {ri.dietaryTags && ri.dietaryTags.length > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                                {ri.dietaryTags.join(', ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-2 border-t" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}>
                        <span>Your quote was</span><span style={{ color: '#EF4444' }}>{formatPrice(response.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
