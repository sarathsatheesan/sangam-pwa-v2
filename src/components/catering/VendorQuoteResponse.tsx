import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Package, Clock, Users, MapPin, Send, Loader2,
  ChevronDown, ChevronUp, ShieldCheck, Plus, Trash2, DollarSign,
  Bell, CheckCircle2, XCircle, Check, Edit,
} from 'lucide-react';
import { notifyVendorQuoteReceived } from '@/services/notificationService';

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
      const parsed = parseFloat(raw || '0');
      const newCents = Math.round(parsed * 100);
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
} from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';

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

  // Track previous response statuses to detect real-time changes
  const prevResponseStatusRef = useRef<Record<string, string>>({});

  // Quote form state per request
  const [quoteForms, setQuoteForms] = useState<Record<string, {
    items: QuotedItem[];
    serviceFee: number;
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
          serviceFee: 0,
          deliveryFee: 0,
          estimatedPrepTime: '',
          message: '',
        },
      }));
      return { items, serviceFee: 0, deliveryFee: 0, estimatedPrepTime: '', message: '' };
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

    const total = subtotal + (form.serviceFee || 0) + (form.deliveryFee || 0);

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
        serviceFee: form.serviceFee || undefined,
        deliveryFee: form.deliveryFee || undefined,
        total,
        estimatedPrepTime: form.estimatedPrepTime || undefined,
        message: form.message || undefined,
        status: 'submitted',
      });
      addToast('Quote submitted successfully!', 'success');
      // Notify customer about the new quote (fire-and-forget)
      notifyVendorQuoteReceived(request.customerId, request.id, businessName, total).catch(() => {});
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
        serviceFee: response.serviceFee || 0,
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

    const total = subtotal + (form.serviceFee || 0) + (form.deliveryFee || 0);

    setSubmittingId(response.id);
    try {
      await updateQuoteResponse(response.id, {
        quotedItems: form.items.filter((i) => i.unitPrice > 0),
        subtotal,
        serviceFee: form.serviceFee || undefined,
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

  const hasRespondedTo = (requestId: string) =>
    myResponses.some((r) => r.quoteRequestId === requestId);

  // Filter out requests already responded to
  const openRequests = requests.filter((r) => !hasRespondedTo(r.id));
  const respondedRequests = requests.filter((r) => hasRespondedTo(r.id));

  // Separate accepted responses for prominent display
  const acceptedResponses = myResponses.filter((r) => r.status === 'accepted' || r.status === 'partially_accepted');
  const pendingResponses = myResponses.filter((r) => r.status === 'submitted');
  const declinedResponses = myResponses.filter((r) => r.status === 'declined');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
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
        <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
          Customer details are hidden until they accept your quote. You'll be notified in real-time when a customer accepts.
        </p>
      </div>

      {/* ══ Open requests (not yet responded to) ══ */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--aurora-text)' }}>
          Open Requests ({openRequests.length})
        </h3>

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
              const formTotal = formSubtotal + (form.serviceFee || 0) + (form.deliveryFee || 0);

              return (
                <div
                  key={request.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {request.cuisineCategory} Catering
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                          {request.status === 'partially_accepted' ? 'Partial' : 'Open'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {request.eventDate?.toDate?.() ? request.eventDate.toDate().toLocaleDateString('en-US') : request.eventDate}
                        </span>
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
                            Note: {request.specialInstructions}
                          </p>
                        )}
                      </div>

                      {/* Quote form */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6366F1' }}>
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
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
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
                              {/* Tray size selector */}
                              {!assignedToOther && (
                                <div className="flex items-center gap-2 ml-1">
                                  <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>Tray size:</span>
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
                                          : { borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }
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
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Service fee ($)</label>
                            <PriceInput
                              cents={form.serviceFee}
                              onCentsChange={(c) => updateQuoteForm(request.id, { serviceFee: c })}
                              className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1"
                              style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                            />
                          </div>
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
                          <span className="text-lg font-bold" style={{ color: '#6366F1' }}>
                            {formTotal > 0 ? formatPrice(formTotal) : '$0.00'}
                          </span>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={() => handleSubmitQuote(request)}
                          disabled={submittingId === request.id || formSubtotal === 0}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#6366F1' }}
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

      {/* ══ Accepted quotes ══ */}
      {acceptedResponses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#059669' }}>
            <CheckCircle2 size={16} />
            Accepted ({acceptedResponses.length})
          </h3>
          <div className="space-y-3">
            {acceptedResponses.map((response) => {
              const request = requests.find((r) => r.id === response.quoteRequestId);
              const isPartial = response.status === 'partially_accepted';

              return (
                <div
                  key={response.id}
                  className="p-4 rounded-2xl border-2"
                  style={{ backgroundColor: 'var(--aurora-surface)', borderColor: '#059669' }}
                >
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                    >
                      <CheckCircle2 size={12} />
                      {isPartial ? 'Partially Accepted' : 'Accepted'}
                    </span>
                    <span className="text-lg font-bold" style={{ color: '#6366F1' }}>
                      {formatPrice(response.total)}
                    </span>
                  </div>

                  {/* Request details */}
                  {request && (
                    <div className="mb-3">
                      <div className="flex items-center gap-3 flex-wrap text-xs mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <span>{request.cuisineCategory}</span>
                        {request.eventType && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
                            {request.eventType.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="flex items-center gap-1"><Users size={12} /> {request.headcount} guests</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {request.deliveryCity}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {request.eventDate?.toDate?.() ? request.eventDate.toDate().toLocaleDateString('en-US') : String(request.eventDate || '')}
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
                        {response.serviceFee != null && response.serviceFee > 0 && (
                          <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                            <span>Service fee</span><span>{formatPrice(response.serviceFee)}</span>
                          </div>
                        )}
                        {response.deliveryFee != null && response.deliveryFee > 0 && (
                          <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                            <span>Delivery fee</span><span>{formatPrice(response.deliveryFee)}</span>
                          </div>
                        )}
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
                    <div className="mb-3">
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

                  {/* Customer contact details — the key info vendors need */}
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
              );
            })}
          </div>
        </div>
      )}

      {/* ══ Pending quotes (submitted, awaiting customer decision) ══ */}
      {pendingResponses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#6366F1' }}>
            Awaiting Decision ({pendingResponses.length})
          </h3>
          <div className="space-y-2">
            {pendingResponses.map((response) => {
              const request = requests.find((r) => r.id === response.quoteRequestId);
              const isExpanded = expandedId === `pending-${response.id}`;
              const isEditing = editingResponseId === response.id;
              const canEdit = isQuoteResponseEditable(response);
              const form = isEditing && quoteForms[response.id] ? quoteForms[response.id] : null;
              const formSubtotal = form ? form.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) : 0;
              const formTotal = form ? formSubtotal + (form.serviceFee || 0) + (form.deliveryFee || 0) : 0;

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
                          {request?.cuisineCategory || 'Catering'} · {request?.headcount || '?'} guests · {request?.deliveryCity || ''}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        Your quote: {isEditing && form ? formatPrice(formTotal) : formatPrice(response.total)}
                      </p>
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
                          <p className="text-xs font-semibold uppercase tracking-wider pt-3" style={{ color: '#6366F1' }}>
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
                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>
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
                              </div>
                            );
                          })}

                          {/* Fees in edit mode */}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Service fee ($)</label>
                              <PriceInput
                                cents={form.serviceFee}
                                onCentsChange={(c) => updateQuoteForm(response.id, { serviceFee: c })}
                                className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 mt-1"
                                style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                              />
                            </div>
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
                            <span className="text-lg font-bold" style={{ color: '#6366F1' }}>
                              {formTotal > 0 ? formatPrice(formTotal) : '$0.00'}
                            </span>
                          </div>

                          {/* Edit mode buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveQuoteChanges(response, request)}
                              disabled={submittingId === response.id || formSubtotal === 0}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#6366F1' }}
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
                              {request.eventDate?.toDate?.() ? request.eventDate.toDate().toLocaleDateString('en-US') : String(request.eventDate || '')}
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
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6366F1' }}>
                              Your Submitted Quote
                            </p>
                            {response.quotedItems.map((qi, i) => (
                              <div key={i} className="flex justify-between text-sm mb-1" style={{ color: 'var(--aurora-text)' }}>
                                <span>{qi.name} x {qi.qty} <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>({qi.pricingType?.replace(/_/g, ' ') || 'per unit'})</span></span>
                                <span>{formatPrice(qi.unitPrice * qi.qty)}</span>
                              </div>
                            ))}
                            {response.serviceFee != null && response.serviceFee > 0 && (
                              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <span>Service fee</span><span>{formatPrice(response.serviceFee)}</span>
                              </div>
                            )}
                            {response.deliveryFee != null && response.deliveryFee > 0 && (
                              <div className="flex justify-between text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                                <span>Delivery fee</span><span>{formatPrice(response.deliveryFee)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}>
                              <span>Total</span><span style={{ color: '#6366F1' }}>{formatPrice(response.total)}</span>
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

                          {/* Edit Quote button with edit window countdown */}
                          {canEdit && (() => {
                            const createdMs = response.createdAt?.toMillis?.() || (response.createdAt?.seconds ? response.createdAt.seconds * 1000 : 0);
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
        </div>
      )}

      {/* ══ Declined quotes ══ */}
      {declinedResponses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
            Declined ({declinedResponses.length})
          </h3>
          <div className="space-y-2">
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
                          {request?.cuisineCategory || 'Catering'} · {request?.headcount || '?'} guests · {request?.deliveryCity || ''}
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
                          {request.eventDate?.toDate?.() ? request.eventDate.toDate().toLocaleDateString('en-US') : String(request.eventDate || '')}
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
        </div>
      )}
    </div>
  );
}
