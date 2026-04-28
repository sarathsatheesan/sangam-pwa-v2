import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Star, Clock, DollarSign, CheckCircle2, XCircle, Check,
  ChevronDown, ChevronUp, ShieldCheck, Loader2, ArrowLeft,
  MessageSquare, Package, Square, CheckSquare, AlertCircle,
  HelpCircle, X, MapPin, RefreshCw, Timer,
} from 'lucide-react';
import { notifyQuoteAccepted, notifyVendorQuoteDeclinedMultiChannel, notifyVendorRepriceRequestedMultiChannel, notifyCustomerRepriceResponseMultiChannel, notifyVendorCounterResolvedMultiChannel } from '@/services/notificationService';
import { notifyVendorQuoteDeclined, notifyVendorQuoteAccepted, notifyVendorRepriceRequested, notifyCustomerRepriceResponse, notifyVendorCounterResolved } from '@/services/catering/cateringNotifications';
import type { CateringQuoteRequest, CateringQuoteResponse, ItemAssignment } from '@/services/cateringService';
import {
  subscribeToQuoteResponses,
  acceptQuoteResponseItems,
  declineQuoteResponse,
  finalizeQuoteRequest,
  createOrdersFromQuote,
  formatPrice,
  requestReprice,
  resolveCounterOffer,
  toEpochMs,
  toDate,
} from '@/services/cateringService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface QuoteComparisonProps {
  quoteRequest: CateringQuoteRequest;
  onBack: () => void;
  onViewOrders?: () => void;
}

export default function QuoteComparison({ quoteRequest, onBack, onViewOrders }: QuoteComparisonProps) {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [responses, setResponses] = useState<CateringQuoteResponse[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [finalizingOrder, setFinalizingOrder] = useState(false);
  const [ordersCreated, setOrdersCreated] = useState(false);

  // SB-37: Delivery address form state
  // Pre-fill from stored deliveryAddress if available (captured during RFP submission)
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    const saved = quoteRequest.deliveryAddress;
    if (saved?.street) {
      return {
        street: saved.street,
        city: saved.city || quoteRequest.deliveryCity || '',
        state: saved.state || '',
        zip: saved.zip || '',
      };
    }
    return {
      street: '',
      city: quoteRequest.deliveryCity || '',
      state: '',
      zip: '',
    };
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // Item-level selection: Map<responseId, Set<itemName>>
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});

  // Reassignment confirmation dialog
  const [reassignConfirm, setReassignConfirm] = useState<{
    responseId: string;
    itemNames: string[];
    existingAssignments: Array<{itemName: string; businessName: string}>;
  } | null>(null);

  // Pending acceptance — stores the response and items selected for the combined
  // "Accept & Finalize" flow so we can chain accept → finalize → create orders
  const [pendingAcceptance, setPendingAcceptance] = useState<{
    response: CateringQuoteResponse;
    itemNames: string[];
  } | null>(null);

  // ── Reprice negotiation state ──
  const [repriceResponseId, setRepriceResponseId] = useState<string | null>(null); // which response is being repriced
  const [repriceAmount, setRepriceAmount] = useState('');           // dollars string input
  const [repriceReason, setRepriceReason] = useState('');
  const [repricingId, setRepricingId] = useState<string | null>(null); // loading state
  const [resolvingCounterId, setResolvingCounterId] = useState<string | null>(null); // loading for counter accept/decline

  // SB-38: Quote expiry warning state
  const [expiredQuoteId, setExpiredQuoteId] = useState<string | null>(null);

  // ── RFQ Walkthrough (onboarding) ──
  const WALKTHROUGH_KEY = 'ethnicity_rfq_walkthrough_seen';
  const [walkthroughStep, setWalkthroughStep] = useState(() => {
    try { return localStorage.getItem(WALKTHROUGH_KEY) ? -1 : 0; } catch { return 0; }
  });
  const dismissWalkthrough = () => {
    setWalkthroughStep(-1);
    try { localStorage.setItem(WALKTHROUGH_KEY, '1'); } catch {}
  };
  const walkthroughSteps = [
    { title: 'Compare Vendor Quotes', desc: 'Multiple caterers will respond with their prices. Expand each card to see quoted items, pricing, and estimated prep time.' },
    { title: 'Pick & Choose Items', desc: 'You don\'t have to accept everything from one vendor. Select specific items from each caterer using the checkboxes.' },
    { title: 'Mix & Match Vendors', desc: 'Assign different items to different vendors — e.g., appetizers from one caterer, mains from another. The progress tracker at the top shows your coverage.' },
    { title: 'Finalize Your Order', desc: 'Once all items are assigned, finalize the order. Your contact details are only shared with the vendors you choose.' },
  ];

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const unsub = subscribeToQuoteResponses(quoteRequest.id, (newResponses) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setResponses(newResponses), 300);
    });
    return () => { clearTimeout(timeoutId); unsub(); };
  }, [quoteRequest.id]);

  // ── Check if orders already exist for this quote (survives page refresh) ──
  useEffect(() => {
    if (ordersCreated) return; // already know
    import('firebase/firestore').then(({ collection, query, where, getDocs }) =>
      getDocs(query(
        collection(db, 'cateringOrders'),
        where('quoteRequestId', '==', quoteRequest.id),
      )).then((snap) => {
        if (snap.size > 0) {
          setOrdersCreated(true);
        }
      })
    ).catch(() => {});
  }, [quoteRequest.id, ordersCreated]);

  // ── Compute assigned items from the quote request's itemAssignments ──
  // Falls back to deriving assignments from accepted/partially_accepted responses
  // when itemAssignments is missing (e.g., orders accepted via the old full-accept flow).
  const assignedItemsMap = useMemo(() => {
    const map = new Map<string, ItemAssignment>();

    // Primary source: explicit itemAssignments on the quote request
    const explicit = quoteRequest.itemAssignments || [];
    explicit.forEach((a) => {
      map.set(a.itemName, a);
    });

    // Fallback: if no explicit assignments exist but there are accepted responses,
    // derive assignments from accepted response data so the tracker is accurate.
    if (map.size === 0 && responses.length > 0) {
      responses.forEach((resp) => {
        if (resp.status === 'accepted' || resp.status === 'partially_accepted') {
          // For partially_accepted, only count the explicitly accepted items
          const assignedNames = resp.acceptedItemNames && resp.acceptedItemNames.length > 0
            ? resp.acceptedItemNames
            : resp.quotedItems.map((qi) => qi.name); // full accept = all items

          assignedNames.forEach((itemName) => {
            if (!map.has(itemName)) {
              map.set(itemName, {
                itemName,
                responseId: resp.id,
                businessId: resp.businessId,
                businessName: resp.businessName,
                assignedAt: resp.createdAt,
              });
            }
          });
        }
      });
    }

    return map;
  }, [quoteRequest.itemAssignments, responses]);

  const totalRequestItems = quoteRequest.items.length;
  const assignedCount = assignedItemsMap.size;
  const allAssigned = assignedCount >= totalRequestItems;
  const isFullyAccepted = quoteRequest.status === 'accepted';
  const isPartiallyAccepted = quoteRequest.status === 'partially_accepted';

  // SB-39: Compute vendor summary from assignedItemsMap
  const vendorSummary = useMemo(() => {
    const vendors = new Map<string, { businessName: string; items: string[]; subtotal: number }>();

    assignedItemsMap.forEach((assignment, itemName) => {
      const existing = vendors.get(assignment.businessId) || {
        businessName: assignment.businessName,
        items: [],
        subtotal: 0,
      };
      existing.items.push(itemName);

      // Find the price from the vendor's response
      const response = responses.find(r => r.id === assignment.responseId);
      const quotedItem = response?.quotedItems.find(qi => qi.name === itemName);
      if (quotedItem) {
        existing.subtotal += quotedItem.unitPrice * quotedItem.qty;
      }

      vendors.set(assignment.businessId, existing);
    });

    return vendors;
  }, [assignedItemsMap, responses]);

  const multiVendor = vendorSummary.size > 1;
  const grandTotal = useMemo(() => {
    let total = 0;
    vendorSummary.forEach(v => { total += v.subtotal; });
    // Add delivery fees from accepted responses
    responses.forEach(r => {
      if (r.status === 'accepted' || r.status === 'partially_accepted') {
        total += (r.deliveryFee || 0);
      }
    });
    return total;
  }, [vendorSummary, responses]);

  // ── Item selection handlers ──
  const toggleItemSelection = (responseId: string, itemName: string) => {
    setSelectedItems((prev) => {
      const current = new Set(prev[responseId] || []);
      if (current.has(itemName)) {
        current.delete(itemName);
      } else {
        current.add(itemName);
      }
      return { ...prev, [responseId]: current };
    });
  };

  const selectAllItems = (responseId: string, itemNames: string[]) => {
    // Only select items that aren't already assigned to another vendor
    const selectable = itemNames.filter((name) => !assignedItemsMap.has(name));
    setSelectedItems((prev) => ({
      ...prev,
      [responseId]: new Set(selectable),
    }));
  };

  const deselectAllItems = (responseId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [responseId]: new Set(),
    }));
  };

  // ── Accept & Finalize — single-step flow ──
  // Validates selection, stores pending data, and opens the address form.
  // The address form submit handler chains: accept → finalize → create orders → notify.
  const handleAcceptItems = async (response: CateringQuoteResponse) => {
    if (!user || !userProfile) return;
    const selected = selectedItems[response.id];
    if (!selected || selected.size === 0) {
      addToast('Please select at least one item to accept', 'error');
      return;
    }

    // SB-38: Check quote expiry
    if (response.validUntil) {
      const expiryMs = toEpochMs(response.validUntil);
      if (expiryMs && expiryMs < Date.now()) {
        setExpiredQuoteId(response.id);
        return;
      }
    }

    const selectedItemNames = Array.from(selected);

    // Check for existing assignments to other vendors
    const existingAssignments = selectedItemNames
      .map(name => {
        const existing = quoteRequest.itemAssignments?.find(
          a => a.itemName === name && a.responseId !== response.id
        );
        return existing ? { itemName: name, businessName: existing.businessName } : null;
      })
      .filter((x): x is {itemName: string; businessName: string} => x !== null);

    if (existingAssignments.length > 0) {
      // Show confirmation dialog — reassignConfirm handler will also set pendingAcceptance
      setReassignConfirm({ responseId: response.id, itemNames: selectedItemNames, existingAssignments });
      return;
    }

    // No conflicts — store pending acceptance and show address form directly
    setPendingAcceptance({ response, itemNames: selectedItemNames });
    setShowAddressForm(true);
  };

  const handleDecline = async (response: CateringQuoteResponse) => {
    setDecliningId(response.id);
    try {
      await declineQuoteResponse(response.id);
      addToast('Quote declined', 'info');

      // Fire-and-forget: notify vendor their quote was declined
      getDoc(doc(db, 'businesses', response.businessId)).then((bizSnap) => {
        if (!bizSnap.exists()) return;
        const bizData = bizSnap.data();
        const ownerId = bizData?.ownerId;
        if (ownerId) {
          notifyVendorQuoteDeclined(ownerId, quoteRequest.id, response.businessName);
          notifyVendorQuoteDeclinedMultiChannel(ownerId, quoteRequest.id, response.businessName);
        }
      }).catch(() => {});
    } catch (err: any) {
      addToast(err.message || 'Failed to decline quote', 'error');
    } finally {
      setDecliningId(null);
    }
  };

  // ── Reprice handlers ──

  const handleRequestReprice = async (response: CateringQuoteResponse) => {
    const priceCents = Math.round(parseFloat(repriceAmount) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      addToast('Please enter a valid price', 'error');
      return;
    }
    if (priceCents >= response.total) {
      addToast('Proposed price must be lower than the current quote', 'error');
      return;
    }

    setRepricingId(response.id);
    try {
      await requestReprice(response.id, priceCents, repriceReason);
      addToast('Reprice request sent! The vendor has 24 hours to respond.', 'success', 5000);
      setRepriceResponseId(null);
      setRepriceAmount('');
      setRepriceReason('');

      // Fire-and-forget notifications
      getDoc(doc(db, 'businesses', response.businessId)).then((bizSnap) => {
        if (!bizSnap.exists()) return;
        const bizData = bizSnap.data();
        const ownerId = bizData?.ownerId;
        if (ownerId) {
          notifyVendorRepriceRequested(ownerId, quoteRequest.id, response.businessName, priceCents).catch(() => {});
          notifyVendorRepriceRequestedMultiChannel(ownerId, quoteRequest.id, priceCents).catch(() => {});
        }
      }).catch(() => {});
    } catch (err: any) {
      addToast(err.message || 'Failed to send reprice request', 'error');
    } finally {
      setRepricingId(null);
    }
  };

  const handleResolveCounter = async (response: CateringQuoteResponse, accept: boolean) => {
    setResolvingCounterId(response.id);
    try {
      await resolveCounterOffer(response.id, accept ? 'accept' : 'decline');
      addToast(
        accept
          ? `Counter-offer accepted! The new price of ${formatPrice(response.repriceCounterPrice || 0)} is now active.`
          : 'Counter-offer declined. The original quote price stands.',
        accept ? 'success' : 'info',
        5000,
      );

      // Fire-and-forget notifications
      getDoc(doc(db, 'businesses', response.businessId)).then((bizSnap) => {
        if (!bizSnap.exists()) return;
        const bizData = bizSnap.data();
        const ownerId = bizData?.ownerId;
        if (ownerId) {
          notifyVendorCounterResolved(ownerId, quoteRequest.id, response.businessName, accept).catch(() => {});
          notifyVendorCounterResolvedMultiChannel(ownerId, quoteRequest.id, accept).catch(() => {});
        }
      }).catch(() => {});
    } catch (err: any) {
      addToast(err.message || 'Failed to resolve counter-offer', 'error');
    } finally {
      setResolvingCounterId(null);
    }
  };

  // ── Countdown timer: single top-level interval drives re-renders,
  //    getCountdown is a pure function safe to call anywhere in JSX ──
  const [_tickNow, setTickNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTickNow(Date.now()), 10_000);
    return () => clearInterval(interval);
  }, []);

  const getCountdown = (expiresAt: any): { timeLeft: string; isExpired: boolean; isUrgent: boolean } => {
    const expiresMs = toEpochMs(expiresAt);
    const remainingMs = Math.max(0, expiresMs - Date.now());
    const isExpired = remainingMs <= 0;
    const hrs = Math.floor(remainingMs / (60 * 60 * 1000));
    const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const isUrgent = hrs < 4 && !isExpired;
    const timeLeft = isExpired ? 'Expired' : hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins}m remaining`;
    return { timeLeft, isExpired, isUrgent };
  };

  const submittedResponses = responses.filter((r) => r.status === 'submitted');
  const sortedByPrice = [...submittedResponses].sort((a, b) => a.total - b.total);

  // Heritage match: Check if caterer's heritage aligns with the event type / cuisine
  const HERITAGE_EVENT_MAP: Record<string, string[]> = {
    pooja: ['Indian', 'Hindu', 'South Asian'],
    sangeet: ['Indian', 'South Asian', 'Punjabi'],
    eid: ['Middle Eastern', 'South Asian', 'Pakistani', 'Bangladeshi'],
    wedding: [],
    cultural_festival: [],
    religious: [],
  };
  const getHeritageMatch = (heritage?: string): boolean => {
    if (!heritage || !quoteRequest.eventType) return false;
    const matchTerms = HERITAGE_EVENT_MAP[quoteRequest.eventType] || [];
    if (matchTerms.length === 0) return false;
    return matchTerms.some((term) => heritage.toLowerCase().includes(term.toLowerCase()));
  };

  // Determine which items from a response are already assigned to another vendor
  const getItemAssignmentStatus = (itemName: string) => {
    return assignedItemsMap.get(itemName) || null;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
            Quote Responses
          </h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            {quoteRequest.cuisineCategory}
            {quoteRequest.eventType && <span className="capitalize"> · {quoteRequest.eventType.replace(/_/g, ' ')}</span>}
            {' '}· {quoteRequest.headcount} guests · {quoteRequest.deliveryCity}
          </p>
        </div>
      </div>

      {/* Privacy reminder */}
      <div
        className="flex items-start gap-3 p-3 rounded-xl"
        style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
      >
        <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
          {isFullyAccepted || isPartiallyAccepted
            ? 'Your details have been shared with selected caterers for the accepted items.'
            : 'Your identity is hidden. Only your delivery city is visible to caterers. Select specific items to accept from each vendor.'}
        </p>
      </div>

      {/* ── RFQ Walkthrough ── */}
      {walkthroughStep >= 0 && (
        <div
          className="relative rounded-2xl border overflow-hidden"
          style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.04)' }}
        >
          <div className="flex items-start gap-3 p-4">
            <HelpCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: '#6366F1' }}>
                {walkthroughSteps[walkthroughStep].title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aurora-text-secondary)' }}>
                {walkthroughSteps[walkthroughStep].desc}
              </p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1.5">
                  {walkthroughSteps.map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: i === walkthroughStep ? 20 : 8,
                        backgroundColor: i === walkthroughStep ? '#6366F1' : 'rgba(99,102,241,0.25)',
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={dismissWalkthrough}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ color: 'var(--aurora-text-muted)' }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => walkthroughStep < walkthroughSteps.length - 1 ? setWalkthroughStep(walkthroughStep + 1) : dismissWalkthrough()}
                    className="text-[11px] px-3 py-1 rounded-lg font-medium text-white"
                    style={{ backgroundColor: '#6366F1' }}
                  >
                    {walkthroughStep < walkthroughSteps.length - 1 ? 'Next' : 'Got it'}
                  </button>
                </div>
              </div>
            </div>
            <button onClick={dismissWalkthrough} className="p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
              <X size={14} style={{ color: 'var(--aurora-text-muted)' }} />
            </button>
          </div>
        </div>
      )}

      {/* Item assignment progress tracker */}
      {totalRequestItems > 0 && (
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: allAssigned ? '#D1FAE5' : isPartiallyAccepted ? '#FEF3C7' : 'var(--aurora-surface)',
            borderColor: allAssigned ? '#059669' : isPartiallyAccepted ? '#D97706' : 'var(--aurora-border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: allAssigned ? '#059669' : isPartiallyAccepted ? '#92400E' : 'var(--aurora-text)' }}>
              {allAssigned
                ? 'All items assigned!'
                : `${assignedCount} of ${totalRequestItems} items assigned`}
            </p>
            {isPartiallyAccepted && !allAssigned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FDE68A', color: '#92400E' }}>
                In Progress
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalRequestItems > 0 ? (assignedCount / totalRequestItems) * 100 : 0}%`,
                backgroundColor: allAssigned ? '#059669' : '#6366F1',
              }}
            />
          </div>
          {/* Item status list */}
          <div className="mt-3 space-y-1">
            {quoteRequest.items.map((item) => {
              const assignment = getItemAssignmentStatus(item.name);
              return (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  {assignment ? (
                    <CheckCircle2 size={14} style={{ color: '#059669' }} />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: 'var(--aurora-border)' }} />
                  )}
                  <span style={{ color: assignment ? '#059669' : 'var(--aurora-text-secondary)' }}>
                    {item.name}
                  </span>
                  {assignment && (
                    <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                      {assignment.businessName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* SB-39: Multi-Vendor Order Summary */}
          {assignedCount > 0 && vendorSummary.size > 0 && (
            <div className="rounded-xl border p-4 space-y-3 mt-4" style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                Order Summary — {vendorSummary.size} Vendor{vendorSummary.size > 1 ? 's' : ''}
              </h3>
              {Array.from(vendorSummary.entries()).map(([bizId, vendor]) => (
                <div key={bizId} className="flex items-start justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--aurora-border)' }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>{vendor.businessName}</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                      {vendor.items.join(', ')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#6366F1' }}>
                    {formatPrice(vendor.subtotal)}
                  </span>
                </div>
              ))}
              {multiVendor && (
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                  <span className="text-sm font-bold" style={{ color: 'var(--aurora-text)' }}>Estimated Total</span>
                  <span className="text-lg font-bold" style={{ color: '#6366F1' }}>{formatPrice(grandTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* Finalize button — visible when any items are assigned and orders not yet created.
              We check assignedCount directly rather than quoteRequest.status because the
              assignedItemsMap is built from BOTH quoteRequest.itemAssignments AND
              response.acceptedItemNames — so items can be assigned even if request status
              wasn't updated to 'partially_accepted'. */}
          {assignedCount > 0 && !ordersCreated && !allAssigned && !isFullyAccepted && (
            <button
              onClick={() => { setPendingAcceptance(null); setShowAddressForm(true); }}
              disabled={finalizingOrder}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#059669' }}
            >
              {finalizingOrder ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Finalize Order ({assignedCount} item{assignedCount > 1 ? 's' : ''})
            </button>
          )}
        </div>
      )}

      {/* Status banner for fully accepted — go directly to address form for finalization.
          Use allAssigned || isFullyAccepted to handle both computed and Firestore-based states. */}
      {(allAssigned || isFullyAccepted) && !ordersCreated && (
        <div
          className="p-3 rounded-xl space-y-2"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: '#D97706' }} />
            <p className="text-sm font-medium" style={{ color: '#92400E' }}>
              All items assigned! Provide a delivery address to finalize your order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setPendingAcceptance(null); setShowAddressForm(true); }}
            disabled={finalizingOrder}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#059669' }}
          >
            {finalizingOrder ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Finalize & Create Orders
          </button>
        </div>
      )}

      {/* Status banner for orders successfully created */}
      {(allAssigned || isFullyAccepted) && ordersCreated && (
        <div
          className="p-3 rounded-xl space-y-2"
          style={{ backgroundColor: '#D1FAE5' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
            <p className="text-sm font-medium" style={{ color: '#059669' }}>
              Orders created! Your vendors have been notified.
            </p>
          </div>
          {onViewOrders && (
            <button
              onClick={onViewOrders}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#059669' }}
            >
              Track Your Orders
            </button>
          )}
        </div>
      )}

      {/* No responses yet */}
      {responses.length === 0 && (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            Waiting for caterer responses...
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            Caterers in your area will respond with their best quotes.
          </p>
        </div>
      )}

      {/* Response cards */}
      {(isFullyAccepted ? responses : [...responses].sort((a, b) => {
        // Show accepted/partially_accepted first, then submitted (by price), then declined
        const statusOrder: Record<string, number> = { accepted: 0, partially_accepted: 1, submitted: 2, declined: 3, expired: 4 };
        const aOrder = statusOrder[a.status] ?? 5;
        const bOrder = statusOrder[b.status] ?? 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.total - b.total;
      })).map((response, idx) => {
        const isExpanded = expandedId === response.id;
        const isSubmitted = response.status === 'submitted';
        const isResponseAccepted = response.status === 'accepted' || response.status === 'partially_accepted';
        const selected = selectedItems[response.id] || new Set<string>();
        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
          submitted: { bg: '#EEF2FF', text: '#6366F1', label: 'Pending' },
          accepted: { bg: '#D1FAE5', text: '#059669', label: 'Accepted' },
          partially_accepted: { bg: '#FEF3C7', text: '#D97706', label: 'Partially Accepted' },
          declined: { bg: '#FEE2E2', text: '#EF4444', label: 'Declined' },
          expired: { bg: '#F3F4F6', text: '#6B7280', label: 'Expired' },
        };
        const sc = statusColors[response.status] || statusColors.submitted;

        // Determine which quoted items are selectable (not already assigned to another vendor)
        const selectableItems = response.quotedItems.filter((qi) => {
          const assignment = assignedItemsMap.get(qi.name);
          // Selectable if: not assigned, or assigned to THIS vendor (allow re-select)
          return !assignment || assignment.responseId === response.id;
        });

        return (
          <div
            key={response.id}
            className="rounded-2xl border overflow-hidden transition-all"
            style={{
              backgroundColor: 'var(--aurora-surface)',
              borderColor: isResponseAccepted ? '#059669' : 'var(--aurora-border)',
              boxShadow: isResponseAccepted ? '0 0 0 2px rgba(5, 150, 105, 0.2)' : undefined,
            }}
          >
            {/* Card header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : response.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedId(isExpanded ? null : response.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={expandedId === response.id}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Rank badge for submitted only */}
                {isSubmitted && idx === 0 && (
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
                      {response.businessName}
                    </p>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: sc.bg, color: sc.text }}
                    >
                      {sc.label}
                    </span>
                  </div>
                  {response.businessHeritage && (
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{response.businessHeritage}</p>
                      {getHeritageMatch(response.businessHeritage) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                          Heritage Match
                        </span>
                      )}
                    </div>
                  )}
                  {/* SB-38: Quote expiry status indicator */}
                  {response.validUntil && (() => {
                    const expiryMs = toEpochMs(response.validUntil);
                    const isExpired = expiryMs > 0 && expiryMs < Date.now();
                    const expiryDate = expiryMs > 0 ? new Date(expiryMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                    return isExpired ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        Expired {expiryDate}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                        Valid until {expiryDate}
                      </span>
                    );
                  })()}
                  {/* SB-05: Quote expiry countdown */}
                  {response.validUntil && response.status === 'submitted' && (() => {
                    const expiryDate = toDate(response.validUntil);
                    const msLeft = expiryDate.getTime() - Date.now();
                    if (msLeft <= 0) return <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#DC2626' }}>Quote expired</p>;
                    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
                    const daysLeft = Math.floor(hoursLeft / 24);
                    const isUrgent = hoursLeft < 24;
                    return (
                      <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: isUrgent ? '#DC2626' : '#D97706' }}>
                        <Clock size={10} />
                        Expires in {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h` : `${hoursLeft}h`}
                      </p>
                    );
                  })()}
                  {/* Show accepted item count for partially accepted */}
                  {response.acceptedItemNames && response.acceptedItemNames.length > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: '#059669' }}>
                      {response.acceptedItemNames.length} item{response.acceptedItemNames.length > 1 ? 's' : ''} accepted
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-lg font-bold" style={{ color: '#6366F1' }}>
                    {formatPrice(response.subtotal + (response.deliveryFee || 0))}
                  </p>
                  {response.estimatedPrepTime && (
                    <p className="text-[10px] flex items-center gap-1 justify-end" style={{ color: 'var(--aurora-text-secondary)' }}>
                      <Clock size={10} /> {response.estimatedPrepTime}
                    </p>
                  )}
                </div>
              </div>
              {isExpanded ? <ChevronUp size={18} className="ml-2 opacity-40" /> : <ChevronDown size={18} className="ml-2 opacity-40" />}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                {/* Quoted items with checkboxes */}
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Quoted Items
                    </p>
                    {/* Select all / Deselect all — only for submitted responses */}
                    {isSubmitted && !isFullyAccepted && selectableItems.length > 0 && (
                      <button
                        onClick={() => {
                          const selectableNames = selectableItems.map((qi) => qi.name);
                          const allSelected = selectableNames.every((n) => selected.has(n));
                          if (allSelected) {
                            deselectAllItems(response.id);
                          } else {
                            selectAllItems(response.id, selectableNames);
                          }
                        }}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors"
                        style={{ color: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}
                      >
                        {selectableItems.every((qi) => selected.has(qi.name)) ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {response.quotedItems.map((qi, i) => {
                      const assignment = assignedItemsMap.get(qi.name);
                      const isAssignedToOther = assignment && assignment.responseId !== response.id;
                      const isAssignedToThis = assignment && assignment.responseId === response.id;
                      const isChecked = selected.has(qi.name);
                      const canSelect = isSubmitted && !isFullyAccepted && !isAssignedToOther;

                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 transition-colors"
                          style={{
                            backgroundColor: isAssignedToThis ? 'rgba(5, 150, 105, 0.05)' : isChecked ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                            opacity: isAssignedToOther ? 0.45 : 1,
                          }}
                        >
                          {/* Checkbox */}
                          {canSelect ? (
                            <button
                              onClick={() => toggleItemSelection(response.id, qi.name)}
                              className="flex-shrink-0"
                            >
                              {isChecked ? (
                                <CheckSquare size={18} style={{ color: '#6366F1' }} />
                              ) : (
                                <Square size={18} style={{ color: 'var(--aurora-border)' }} />
                              )}
                            </button>
                          ) : isAssignedToThis ? (
                            <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: '#059669' }} />
                          ) : isAssignedToOther ? (
                            <div className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center">
                              <AlertCircle size={14} style={{ color: '#9CA3AF' }} />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-[18px]" />
                          )}

                          <span className="flex-1" style={{ color: 'var(--aurora-text)' }}>
                            {qi.name} x {qi.qty}
                            {qi.notes && <span className="text-xs ml-1" style={{ color: 'var(--aurora-text-secondary)' }}>({qi.notes})</span>}
                          </span>
                          <span className="font-medium flex-shrink-0" style={{ color: 'var(--aurora-text)' }}>
                            {formatPrice(qi.unitPrice * qi.qty)}
                          </span>

                          {/* Assignment indicator */}
                          {isAssignedToOther && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                              {assignment.businessName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fee breakdown — dynamic totaling for partial selections */}
                {(() => {
                  // Compute display total excluding legacy serviceFee (backward compat)
                  const displayTotal = response.subtotal + (response.deliveryFee || 0);
                  const selectedSubtotal = response.quotedItems
                    .filter(qi => selected.has(qi.name))
                    .reduce((sum, qi) => sum + qi.unitPrice * qi.qty, 0);
                  const isPartialSelection = selected.size > 0 && selected.size < response.quotedItems.length;
                  const selectedTotal = selectedSubtotal + (response.deliveryFee || 0);

                  return (
                    <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--aurora-border)' }}>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span>Subtotal ({response.quotedItems.length} items)</span>
                        <span>{formatPrice(response.subtotal)}</span>
                      </div>
                      {response.deliveryFee != null && response.deliveryFee > 0 && (
                        <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                          <span>Delivery fee</span>
                          <span>{formatPrice(response.deliveryFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-1" style={{ color: 'var(--aurora-text)' }}>
                        <span>Total</span>
                        <span style={{ color: '#6366F1' }}>{formatPrice(displayTotal)}</span>
                      </div>
                      {/* Dynamic selection total — shown when user selects a subset of items */}
                      {isPartialSelection && (
                        <div className="mt-1.5 pt-1.5 border-t border-dashed" style={{ borderColor: 'var(--aurora-border)' }}>
                          <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                            <span>Selected items ({selected.size})</span>
                            <span>{formatPrice(selectedSubtotal)}</span>
                          </div>
                          {response.deliveryFee != null && response.deliveryFee > 0 && (
                            <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                              <span>Delivery fee</span>
                              <span>{formatPrice(response.deliveryFee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-semibold pt-0.5" style={{ color: '#059669' }}>
                            <span>Your Selection</span>
                            <span>{formatPrice(selectedTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Caterer message */}
                {response.message && (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--aurora-bg)' }}>
                    <MessageSquare size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }} />
                    <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{response.message}</p>
                  </div>
                )}

                {/* ── Reprice status banners ── */}
                {(() => {
                  const rs = response.repriceStatus;
                  if (!rs || rs === 'none') return null;

                  // Vendor accepted the customer's proposed price
                  if (rs === 'vendor_accepted') {
                    return (
                      <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: '#D1FAE5' }}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} style={{ color: '#059669' }} />
                          <p className="text-sm font-medium" style={{ color: '#059669' }}>
                            Price request accepted! New total: {formatPrice(response.repriceRequestedPrice || response.total)}
                          </p>
                        </div>
                        {response.quotedItems && response.quotedItems.length > 0 && (
                          <div className="ml-6 mt-0.5">
                            <ul className="space-y-0.5">
                              {response.quotedItems.map((item, idx) => (
                                <li key={idx} className="text-xs flex items-center gap-1.5" style={{ color: '#047857' }}>
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#059669' }} />
                                  {item.name} × {item.qty}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {response.repriceVendorNote && (
                          <p className="text-xs ml-6" style={{ color: '#047857' }}>&ldquo;{response.repriceVendorNote}&rdquo;</p>
                        )}
                      </div>
                    );
                  }

                  // Vendor denied the customer's request
                  if (rs === 'vendor_denied') {
                    return (
                      <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: '#FEF3C7' }}>
                        <div className="flex items-center gap-2">
                          <XCircle size={16} style={{ color: '#D97706' }} />
                          <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                            Price request declined — original price of {formatPrice(response.total)} stands.
                          </p>
                        </div>
                        {response.repriceVendorNote && (
                          <p className="text-xs ml-6" style={{ color: '#92400E' }}>&ldquo;{response.repriceVendorNote}&rdquo;</p>
                        )}
                      </div>
                    );
                  }

                  // Vendor sent a counter-offer — customer must respond
                  if (rs === 'vendor_countered') {
                    const counterExpiry = getCountdown(response.repriceCounterExpiresAt);
                    return (
                      <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: '#EFF6FF' }}>
                        <div className="flex items-center gap-2">
                          <RefreshCw size={16} style={{ color: '#3B82F6' }} />
                          <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>
                            Counter-offer: {formatPrice(response.repriceCounterPrice || 0)}
                            <span className="font-normal text-xs ml-1">(was {formatPrice(response.total)})</span>
                          </p>
                        </div>
                        {response.quotedItems && response.quotedItems.length > 0 && (
                          <div className="ml-6">
                            <ul className="space-y-0.5">
                              {response.quotedItems.map((item, idx) => (
                                <li key={idx} className="text-xs flex items-center gap-1.5" style={{ color: '#1E40AF' }}>
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#3B82F6' }} />
                                  {item.name} × {item.qty} — {formatPrice(item.unitPrice * item.qty)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {response.repriceVendorNote && (
                          <p className="text-xs ml-6" style={{ color: '#1E40AF' }}>&ldquo;{response.repriceVendorNote}&rdquo;</p>
                        )}
                        <div className="flex items-center gap-1 ml-6">
                          <Timer size={12} style={{ color: counterExpiry.isUrgent ? '#D97706' : '#6B7280' }} />
                          <span className={`text-xs ${counterExpiry.isUrgent ? 'font-medium' : ''}`} style={{ color: counterExpiry.isUrgent ? '#D97706' : '#6B7280' }}>
                            {counterExpiry.timeLeft}
                          </span>
                        </div>
                        {!counterExpiry.isExpired && (
                          <div className="flex gap-2 ml-6">
                            <button
                              type="button"
                              onClick={() => handleResolveCounter(response, true)}
                              disabled={resolvingCounterId === response.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#059669' }}
                            >
                              {resolvingCounterId === response.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              Accept Counter
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveCounter(response, false)}
                              disabled={resolvingCounterId === response.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {counterExpiry.isExpired && (
                          <p className="text-xs ml-6 font-medium" style={{ color: '#EF4444' }}>This counter-offer has expired.</p>
                        )}
                      </div>
                    );
                  }

                  // Customer accepted counter
                  if (rs === 'counter_accepted') {
                    return (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: '#D1FAE5' }}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} style={{ color: '#059669' }} />
                          <p className="text-sm font-medium" style={{ color: '#059669' }}>
                            Counter-offer accepted! New total: {formatPrice(response.repriceCounterPrice || response.total)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Customer declined counter
                  if (rs === 'counter_declined') {
                    return (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
                        <div className="flex items-center gap-2">
                          <XCircle size={16} style={{ color: '#D97706' }} />
                          <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                            Counter-offer declined — original price of {formatPrice(response.total)} stands.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Reprice request pending vendor response
                  if (rs === 'requested') {
                    const reqExpiry = getCountdown(response.repriceExpiresAt);
                    return (
                      <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: '#FFF7ED' }}>
                        <div className="flex items-center gap-2">
                          <Clock size={16} style={{ color: '#EA580C' }} />
                          <p className="text-sm font-medium" style={{ color: '#9A3412' }}>
                            Reprice request sent — proposed {formatPrice(response.repriceRequestedPrice || 0)}
                          </p>
                        </div>
                        {/* Items included in this reprice */}
                        {response.quotedItems && response.quotedItems.length > 0 && (
                          <div className="ml-6 mt-1">
                            <p className="text-xs font-medium mb-0.5" style={{ color: '#9A3412' }}>Items:</p>
                            <ul className="space-y-0.5">
                              {response.quotedItems.map((item, idx) => (
                                <li key={idx} className="text-xs flex items-center gap-1.5" style={{ color: '#92400E' }}>
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#EA580C' }} />
                                  {item.name} × {item.qty} — {formatPrice(item.unitPrice * item.qty)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center gap-1 ml-6">
                          <Timer size={12} style={{ color: reqExpiry.isUrgent ? '#D97706' : '#6B7280' }} />
                          <span className={`text-xs ${reqExpiry.isUrgent ? 'font-medium' : ''}`} style={{ color: reqExpiry.isUrgent ? '#D97706' : '#6B7280' }}>
                            Waiting for vendor — {reqExpiry.timeLeft}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Expired
                  if (rs === 'expired') {
                    return (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
                        <div className="flex items-center gap-2">
                          <Clock size={16} style={{ color: '#6B7280' }} />
                          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
                            Price negotiation expired — original price stands.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Actions — item-level accept + reprice */}
                {isSubmitted && !isFullyAccepted && (
                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcceptItems(response)}
                        disabled={finalizingOrder || selected.size === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#059669' }}
                      >
                        <CheckCircle2 size={14} />
                        {selected.size > 0
                          ? `Accept ${selected.size} Item${selected.size > 1 ? 's' : ''}`
                          : 'Select Items to Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(response)}
                        disabled={decliningId === response.id}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: '#FEE2E2',
                          color: '#EF4444',
                        }}
                      >
                        {decliningId === response.id ? <Loader2 size={14} className="animate-spin" /> : 'Decline'}
                      </button>
                    </div>
                    {/* Reprice button — only show if no reprice has been initiated yet */}
                    {(!response.repriceStatus || response.repriceStatus === 'none') && (
                      <button
                        type="button"
                        onClick={() => { setRepriceResponseId(response.id); setRepriceAmount(''); setRepriceReason(''); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                        style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', color: '#6366F1' }}
                      >
                        <RefreshCw size={13} />
                        Request New Price
                      </button>
                    )}
                  </div>
                )}

                {/* Accepted state — show which items were accepted + contact shared */}
                {isResponseAccepted && (
                  <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: '#D1FAE5' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} style={{ color: '#059669' }} />
                      <p className="text-sm font-medium" style={{ color: '#059669' }}>
                        {response.status === 'accepted' ? 'All items accepted' : 'Selected items accepted'}
                        {' '}&mdash; contact details shared.
                      </p>
                    </div>
                    {response.acceptedItemNames && response.acceptedItemNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-6">
                        {response.acceptedItemNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: 'rgba(5, 150, 105, 0.15)', color: '#059669' }}
                          >
                            <Check size={10} />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Reassignment Confirmation Dialog ── */}
      {reassignConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Reassign Items?</h3>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
              The following items are already assigned to other vendors:
            </p>
            <ul className="mb-4 space-y-1">
              {reassignConfirm.existingAssignments.map((a, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>{a.itemName}</span>
                  {' '}— currently with{' '}
                  <span style={{ color: '#6366F1' }}>{a.businessName}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Proceeding will reassign these items to the new vendor.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReassignConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border font-medium transition-colors"
                style={{
                  borderColor: 'var(--aurora-border)',
                  color: 'var(--aurora-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { responseId, itemNames } = reassignConfirm;
                  setReassignConfirm(null);
                  const response = responses.find(r => r.id === responseId);
                  if (response) {
                    // Store pending acceptance and go to address form
                    setPendingAcceptance({ response, itemNames });
                    setShowAddressForm(true);
                  }
                }}
                className="px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: '#6366F1' }}
              >
                Reassign Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX-LOCK: Finalize Confirmation Modal — lets customer choose to
          finalize (which auto-declines remaining vendors) or continue selecting */}
      {/* ── Reprice Request Modal ── */}
      {repriceResponseId && (() => {
        const targetResp = responses.find((r) => r.id === repriceResponseId);
        if (!targetResp) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={20} style={{ color: '#6366F1' }} />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Request New Price</h3>
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                Current quote from <strong>{targetResp.businessName}</strong>: <strong>{formatPrice(targetResp.total)}</strong>
              </p>
              <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-muted)' }}>
                This is a one-time request. The vendor can accept your price, decline, or send a counter-offer. You&apos;ll have 24 hours to respond to any counter.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    Your proposed total price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--aurora-text-muted)' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={repriceAmount}
                      onChange={(e) => setRepriceAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border pl-7 pr-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      style={{ borderColor: 'var(--aurora-border)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    Reason <span className="text-xs font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={repriceReason}
                    onChange={(e) => setRepriceReason(e.target.value)}
                    placeholder="e.g. Budget constraint, competing offer..."
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button
                  type="button"
                  onClick={() => { setRepriceResponseId(null); setRepriceAmount(''); setRepriceReason(''); }}
                  className="px-4 py-2.5 text-sm rounded-lg border font-medium transition-colors"
                  style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestReprice(targetResp)}
                  disabled={repricingId === targetResp.id || !repriceAmount}
                  className="px-4 py-2.5 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: '#6366F1' }}
                >
                  {repricingId === targetResp.id && <Loader2 size={14} className="animate-spin" />}
                  Send Request
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SB-37: Delivery Address Form + Accept & Finalize — single-step flow */}
      {showAddressForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} style={{ color: pendingAcceptance ? '#059669' : '#6366F1' }} />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>
                {pendingAcceptance ? 'Accept & Finalize Order' : 'Delivery Address'}
              </h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              {pendingAcceptance
                ? `Provide the delivery address to accept ${pendingAcceptance.itemNames.length} item${pendingAcceptance.itemNames.length > 1 ? 's' : ''} and finalize your order.`
                : 'Please provide the full delivery address for your event.'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryAddress.street}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="123 Main Street"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    addressErrors.street ? 'border-red-400' : ''
                  }`}
                  style={{ borderColor: addressErrors.street ? undefined : 'var(--aurora-border)' }}
                />
                {addressErrors.street && <p className="text-xs text-red-500 mt-1">{addressErrors.street}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress.city}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      addressErrors.city ? 'border-red-400' : ''
                    }`}
                    style={{ borderColor: addressErrors.city ? undefined : 'var(--aurora-border)' }}
                  />
                  {addressErrors.city && <p className="text-xs text-red-500 mt-1">{addressErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress.state}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, state: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      addressErrors.state ? 'border-red-400' : ''
                    }`}
                    style={{ borderColor: addressErrors.state ? undefined : 'var(--aurora-border)' }}
                  />
                  {addressErrors.state && <p className="text-xs text-red-500 mt-1">{addressErrors.state}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryAddress.zip}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, zip: e.target.value }))}
                  placeholder="95112"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    addressErrors.zip ? 'border-red-400' : ''
                  }`}
                  style={{ borderColor: addressErrors.zip ? undefined : 'var(--aurora-border)' }}
                />
                {addressErrors.zip && <p className="text-xs text-red-500 mt-1">{addressErrors.zip}</p>}
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => { setShowAddressForm(false); setAddressErrors({}); setPendingAcceptance(null); }}
                className="px-4 py-2.5 text-sm rounded-lg border font-medium transition-colors"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Validate address
                  const errs: Record<string, string> = {};
                  if (!deliveryAddress.street.trim()) errs.street = 'Required';
                  if (!deliveryAddress.city.trim()) errs.city = 'Required';
                  if (!deliveryAddress.state.trim()) errs.state = 'Required';
                  if (!deliveryAddress.zip.trim()) errs.zip = 'Required';
                  // Accept US ZIP (12345 or 12345-6789) and Canadian postal codes (A1A 1A1)
                  else if (!/^\d{5}(-\d{4})?$/.test(deliveryAddress.zip.trim()) &&
                           !/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(deliveryAddress.zip.trim())) errs.zip = 'Invalid ZIP/postal code';
                  if (Object.keys(errs).length > 0) { setAddressErrors(errs); return; }
                  setAddressErrors({});
                  setShowAddressForm(false);

                  // ── Combined Accept → Finalize → Create Orders → Notify ──
                  setFinalizingOrder(true);
                  try {
                    // Step 1: Accept items (if pending from the single-step flow)
                    if (pendingAcceptance && user && userProfile) {
                      const { response: pendingResponse, itemNames } = pendingAcceptance;
                      await acceptQuoteResponseItems(
                        pendingResponse.id,
                        quoteRequest.id,
                        itemNames,
                        {
                          customerName: userProfile?.name || '',
                          customerEmail: userProfile?.email || user.email || '',
                          customerPhone: (userProfile as any)?.phone || '',
                        },
                      );
                      // Clear selection for this response
                      setSelectedItems((prev) => ({ ...prev, [pendingResponse.id]: new Set() }));
                    }

                    // Step 2: Finalize the quote request (declines remaining vendors, locks assignments)
                    await finalizeQuoteRequest(quoteRequest.id, deliveryAddress);

                    // Step 3: Re-fetch fresh quoteRequest from Firestore to get updated itemAssignments
                    const freshSnap = await getDoc(doc(db, 'cateringQuoteRequests', quoteRequest.id));
                    const freshQuoteRequest = freshSnap.exists()
                      ? { id: freshSnap.id, ...freshSnap.data() } as CateringQuoteRequest
                      : quoteRequest;

                    // Step 4: Create orders for each accepted vendor
                    // Patch responses with customer details + status that were just written to Firestore
                    // (the local `responses` array is stale — it doesn't have customerName/status yet)
                    const patchedResponses = pendingAcceptance
                      ? responses.map((r) =>
                          r.id === pendingAcceptance.response.id
                            ? {
                                ...r,
                                status: (pendingAcceptance.itemNames.length >= (r.quotedItems?.length || 0)
                                  ? 'accepted' : 'partially_accepted') as 'accepted' | 'partially_accepted',
                                customerName: userProfile?.name || '',
                                customerEmail: userProfile?.email || user?.email || '',
                                customerPhone: (userProfile as any)?.phone || '',
                              }
                            : r,
                        )
                      : responses;
                    const orderIds = await createOrdersFromQuote(freshQuoteRequest, patchedResponses, deliveryAddress);
                    setOrdersCreated(true);

                    // Step 5: Notify vendor(s) — fire-and-forget after orders are created
                    if (pendingAcceptance && userProfile) {
                      const { response: pendingResponse, itemNames } = pendingAcceptance;
                      getDoc(doc(db, 'businesses', pendingResponse.businessId)).then((bizSnap) => {
                        if (!bizSnap.exists()) return;
                        const bizData = bizSnap.data();
                        const ownerId = bizData?.ownerId;
                        if (ownerId) {
                          notifyQuoteAccepted(ownerId, quoteRequest.id, userProfile?.name || '', pendingResponse.total);
                          notifyVendorQuoteAccepted(
                            ownerId, quoteRequest.id, pendingResponse.businessName,
                            userProfile?.name || '', itemNames.length,
                          );
                        }
                      }).catch(() => {});
                    }

                    setPendingAcceptance(null);
                    if (orderIds.length === 0) {
                      // Race condition: another tab/session already created orders
                      addToast('Orders were already created for this request. Check your orders tab.', 'info', 5000);
                    } else {
                      addToast(
                        orderIds.length === 1
                          ? 'Order accepted and created! Track it in your orders tab.'
                          : `${orderIds.length} orders accepted and created. Track them in your orders tab.`,
                        'success',
                        5000,
                      );
                    }
                    if (onViewOrders) onViewOrders();
                  } catch (err: any) {
                    console.error('[QuoteComparison] Accept & Finalize error:', err);
                    addToast(err.message || 'Failed to accept and finalize order', 'error');
                  } finally {
                    setFinalizingOrder(false);
                  }
                }}
                disabled={finalizingOrder}
                className="px-4 py-2.5 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#059669' }}
              >
                {finalizingOrder && <Loader2 size={14} className="animate-spin" />}
                {pendingAcceptance ? `Accept ${pendingAcceptance.itemNames.length} Item${pendingAcceptance.itemNames.length > 1 ? 's' : ''} & Finalize` : 'Finalize Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SB-38: Quote Expired Warning Modal */}
      {expiredQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                <AlertCircle size={20} style={{ color: '#D97706' }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Quote Expired</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              This vendor's quote has expired. The pricing may no longer be valid. You can still accept it, but we recommend contacting the vendor first to confirm availability and pricing.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setExpiredQuoteId(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  const response = responses.find(r => r.id === expiredQuoteId);
                  if (response) {
                    const selectedItemNames = Array.from(selectedItems[response.id] || []);
                    setPendingAcceptance({ response, itemNames: selectedItemNames });
                    setShowAddressForm(true);
                  }
                  setExpiredQuoteId(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#D97706' }}
              >
                Accept Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
