import React, { useEffect, useState, useMemo } from 'react';
import {
  Star, Clock, DollarSign, CheckCircle2, XCircle, Check,
  ChevronDown, ChevronUp, ShieldCheck, Loader2, ArrowLeft,
  MessageSquare, Package, Square, CheckSquare, AlertCircle,
  HelpCircle, X, MapPin,
} from 'lucide-react';
import { notifyQuoteAccepted } from '@/services/notificationService';
import type { CateringQuoteRequest, CateringQuoteResponse, ItemAssignment } from '@/services/cateringService';
import {
  subscribeToQuoteResponses,
  acceptQuoteResponseItems,
  acceptQuoteResponse,
  declineQuoteResponse,
  finalizeQuoteRequest,
  formatPrice,
} from '@/services/cateringService';
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [finalizingOrder, setFinalizingOrder] = useState(false);

  // SB-37: Delivery address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: quoteRequest.deliveryCity || '',
    state: '',
    zip: '',
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
    const unsub = subscribeToQuoteResponses(quoteRequest.id, setResponses);
    return unsub;
  }, [quoteRequest.id]);

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

  // ── Accept selected items from a vendor ──
  const handleAcceptItems = async (response: CateringQuoteResponse) => {
    if (!user || !userProfile) return;
    const selected = selectedItems[response.id];
    if (!selected || selected.size === 0) {
      addToast('Please select at least one item to accept', 'error');
      return;
    }

    // SB-38: Check quote expiry
    if (response.validUntil) {
      const expiryMs = response.validUntil?.toMillis?.()
        || (response.validUntil?.seconds ? response.validUntil.seconds * 1000 : 0)
        || (typeof response.validUntil === 'string' ? new Date(response.validUntil).getTime() : 0);
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
      // Show confirmation dialog
      setReassignConfirm({ responseId: response.id, itemNames: selectedItemNames, existingAssignments });
      return;
    }

    // No conflicts, proceed with acceptance
    await proceedWithAcceptance(response, selectedItemNames);
  };

  const proceedWithAcceptance = async (response: CateringQuoteResponse, itemNames: string[]) => {
    if (!user || !userProfile) return;

    setAcceptingId(response.id);
    try {
      const result = await acceptQuoteResponseItems(
        response.id,
        quoteRequest.id,
        itemNames,
        {
          customerName: userProfile.name || '',
          customerEmail: userProfile.email || user.email || '',
          customerPhone: (userProfile as any).phone || '',
        },
      );

      if (result.allItemsAssigned) {
        addToast(`All items assigned! ${response.businessName} will receive your contact details.`, 'success', 5000);
      } else {
        addToast(`${itemNames.length} item${itemNames.length > 1 ? 's' : ''} accepted from ${response.businessName}. Your contact details have been shared.`, 'success', 5000);
      }

      // Notify vendor their quote was accepted (fire-and-forget, look up owner via businessId)
      import('@/services/firebase').then(({ db: fireDb }) =>
        import('firebase/firestore').then(({ doc, getDoc }) =>
          getDoc(doc(fireDb, 'businesses', response.businessId)).then((bizSnap) => {
            const ownerId = bizSnap.data()?.ownerId;
            if (ownerId) {
              notifyQuoteAccepted(ownerId, quoteRequest.id, userProfile?.name || '', response.total);
            }
          })
        )
      ).catch(() => {});

      // Clear selection for this response
      setSelectedItems((prev) => ({ ...prev, [response.id]: new Set() }));
    } catch (err: any) {
      addToast(err.message || 'Failed to accept items', 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  // ── Finalize order (close remaining) ──
  // SB-37: This is now handled in the address form modal's finalization button
  // The button click now shows the address form first (setShowAddressForm(true))
  // and the form collects the address before calling finalizeQuoteRequest
  // This function is kept for reference but is no longer directly called
  const handleFinalizeOrder = async () => {
    setFinalizingOrder(true);
    try {
      await finalizeQuoteRequest(quoteRequest.id);
      addToast('Order finalized! Track your order below.', 'success', 5000);
      // Redirect to order tracking after short delay so toast is visible
      if (onViewOrders) {
        setTimeout(() => onViewOrders(), 1500);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to finalize order', 'error');
    } finally {
      setFinalizingOrder(false);
    }
  };

  const handleDecline = async (response: CateringQuoteResponse) => {
    setDecliningId(response.id);
    try {
      await declineQuoteResponse(response.id);
      addToast('Quote declined', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to decline quote', 'error');
    } finally {
      setDecliningId(null);
    }
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

          {/* Finalize button — visible when some items assigned but not auto-closed */}
          {isPartiallyAccepted && !allAssigned && assignedCount > 0 && (
            <button
              onClick={() => setShowAddressForm(true)}
              disabled={finalizingOrder}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#059669' }}
            >
              {finalizingOrder ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Finalize Order ({assignedCount} items)
            </button>
          )}
        </div>
      )}

      {/* Status banner for fully accepted */}
      {isFullyAccepted && (
        <div
          className="p-3 rounded-xl space-y-2"
          style={{ backgroundColor: '#D1FAE5' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
            <p className="text-sm font-medium" style={{ color: '#059669' }}>
              Order finalized. Selected caterers will contact you shortly.
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
                    const expiryMs = response.validUntil?.toMillis?.() || (response.validUntil?.seconds ? response.validUntil.seconds * 1000 : 0) || 0;
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
                    const expiryDate = response.validUntil?.toDate?.() || new Date(response.validUntil);
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
                    {formatPrice(response.total)}
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

                {/* Fee breakdown */}
                <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--aurora-border)' }}>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Subtotal</span>
                    <span>{formatPrice(response.subtotal)}</span>
                  </div>
                  {response.serviceFee != null && response.serviceFee > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                      <span>Service fee</span>
                      <span>{formatPrice(response.serviceFee)}</span>
                    </div>
                  )}
                  {response.deliveryFee != null && response.deliveryFee > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                      <span>Delivery fee</span>
                      <span>{formatPrice(response.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1" style={{ color: 'var(--aurora-text)' }}>
                    <span>Total</span>
                    <span style={{ color: '#6366F1' }}>{formatPrice(response.total)}</span>
                  </div>
                </div>

                {/* Caterer message */}
                {response.message && (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--aurora-bg)' }}>
                    <MessageSquare size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }} />
                    <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{response.message}</p>
                  </div>
                )}

                {/* Actions — item-level accept */}
                {isSubmitted && !isFullyAccepted && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleAcceptItems(response)}
                      disabled={acceptingId === response.id || selected.size === 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#059669' }}
                    >
                      {acceptingId === response.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {selected.size > 0
                        ? `Accept ${selected.size} Item${selected.size > 1 ? 's' : ''}`
                        : 'Select Items to Accept'}
                    </button>
                    <button
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
                onClick={async () => {
                  const { responseId, itemNames } = reassignConfirm;
                  setReassignConfirm(null);
                  const response = responses.find(r => r.id === responseId);
                  if (response) {
                    await proceedWithAcceptance(response, itemNames);
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

      {/* SB-37: Delivery Address Form — required before finalization */}
      {showAddressForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} style={{ color: '#6366F1' }} />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Delivery Address</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Please provide the full delivery address for your event.
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
                onClick={() => { setShowAddressForm(false); setAddressErrors({}); }}
                className="px-4 py-2.5 text-sm rounded-lg border font-medium transition-colors"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Validate
                  const errs: Record<string, string> = {};
                  if (!deliveryAddress.street.trim()) errs.street = 'Required';
                  if (!deliveryAddress.city.trim()) errs.city = 'Required';
                  if (!deliveryAddress.state.trim()) errs.state = 'Required';
                  if (!deliveryAddress.zip.trim()) errs.zip = 'Required';
                  else if (!/^\d{5}(-\d{4})?$/.test(deliveryAddress.zip.trim())) errs.zip = 'Invalid ZIP';
                  if (Object.keys(errs).length > 0) { setAddressErrors(errs); return; }
                  setAddressErrors({});
                  setShowAddressForm(false);
                  // Proceed with finalization, passing address
                  setFinalizingOrder(true);
                  try {
                    await finalizeQuoteRequest(quoteRequest.id, deliveryAddress);
                    addToast('Order finalized! Check your orders tab.', 'success', 5000);
                    if (onViewOrders) onViewOrders();
                  } catch (err: any) {
                    addToast(err.message || 'Failed to finalize order', 'error');
                  } finally {
                    setFinalizingOrder(false);
                  }
                }}
                disabled={finalizingOrder}
                className="px-4 py-2.5 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#6366F1' }}
              >
                {finalizingOrder && <Loader2 size={14} className="animate-spin" />}
                Finalize Order
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
                    proceedWithAcceptance(response, selectedItemNames);
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
