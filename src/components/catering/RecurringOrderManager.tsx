// ═════════════════════════════════════════════════════════════════════════════════
// RECURRING ORDER MANAGER
// Schedule repeating catering orders on a set cadence.
// Tier 1: Simple intervals (daily/weekly/biweekly/monthly)
// Tier 2: Calendar-based (specific days of week, day of month, skip dates)
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Calendar, Clock, Loader2, Pause, Play, Trash2,
  Plus, ChevronDown, ChevronUp, Repeat, AlertCircle, Check,
  MapPin, Users, ShoppingCart, Settings, Pencil, SkipForward,
  DollarSign, Bell, Undo2,
} from 'lucide-react';
import MultiDatePicker from '@/components/shared/MultiDatePicker';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { FavoriteOrder, RecurringOrder, RecurrenceSchedule, RecurrenceInterval, DeliveryAddress, OccurrenceOverride, OrderItem } from '@/services/cateringService';
import {
  subscribeToRecurringOrders,
  createRecurringOrder,
  updateRecurringOrder,
  deleteRecurringOrder,
  toggleRecurringOrder,
  setOccurrenceOverride,
  clearOccurrenceOverride,
  estimateMonthlyRecurringCost,
  computeNextRunDate,
  formatPrice,
  calculateOrderTotal,
} from '@/services/cateringService';

interface RecurringOrderManagerProps {
  onBack: () => void;
  prefillFromFavorite?: FavoriteOrder | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const INTERVAL_LABELS: Record<RecurrenceInterval, string> = {
  daily: 'Every Day',
  weekly: 'Every Week',
  biweekly: 'Every 2 Weeks',
  monthly: 'Every Month',
};

export default function RecurringOrderManager({ onBack, prefillFromFavorite }: RecurringOrderManagerProps) {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(!!prefillFromFavorite);
  const [submitting, setSubmitting] = useState(false);

  // ── Per-occurrence editing state ──
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<string | null>(null);
  const [occItems, setOccItems] = useState<OrderItem[]>([]);
  const [occHeadcount, setOccHeadcount] = useState<number>(0);
  const [occInstructions, setOccInstructions] = useState('');
  const [savingOcc, setSavingOcc] = useState(false);

  // ── Create form state ──
  const [scheduleMode, setScheduleMode] = useState<'simple' | 'calendar'>('simple');
  const [interval, setInterval] = useState<RecurrenceInterval>('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('11:30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Subscribe to recurring orders
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToRecurringOrders(user.uid, (recs) => {
      setRecurringOrders(recs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Prefill contact info
  useEffect(() => {
    if (userProfile) {
      setContactName(userProfile.name || '');
      setContactPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  // ── Handlers ──

  const toggleDay = useCallback((day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!user || !prefillFromFavorite) return;
    if (!prefillFromFavorite.deliveryAddress?.street) {
      addToast('This favorite has no delivery address saved. Please update it first.', 'error');
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      addToast('Please provide contact name and phone', 'error');
      return;
    }
    if (!startDate) {
      addToast('Please select a start date', 'error');
      return;
    }
    if (scheduleMode === 'calendar' && daysOfWeek.length === 0) {
      addToast('Please select at least one day of the week', 'error');
      return;
    }

    const schedule: RecurrenceSchedule = {
      timeOfDay,
      startDate,
      ...(endDate ? { endDate } : {}),
      ...(skipDates.length > 0 ? { skipDates } : {}),
    };

    if (scheduleMode === 'simple') {
      schedule.interval = interval;
    } else {
      schedule.daysOfWeek = daysOfWeek;
    }

    const nextRun = computeNextRunDate(schedule, new Date(startDate) > new Date()
      ? new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10)
      : undefined,
    );

    if (!nextRun) {
      addToast('Could not compute a valid next run date. Check your schedule settings.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createRecurringOrder({
        userId: user.uid,
        favoriteId: prefillFromFavorite.id,
        businessId: prefillFromFavorite.businessId,
        businessName: prefillFromFavorite.businessName,
        label: prefillFromFavorite.label,
        items: prefillFromFavorite.items,
        ...(prefillFromFavorite.headcount ? { headcount: prefillFromFavorite.headcount } : {}),
        ...(prefillFromFavorite.specialInstructions ? { specialInstructions: prefillFromFavorite.specialInstructions } : {}),
        deliveryAddress: prefillFromFavorite.deliveryAddress!,
        ...(prefillFromFavorite.orderForContext ? { orderForContext: prefillFromFavorite.orderForContext } : {}),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        schedule,
        active: true,
        nextRunDate: nextRun,
      });
      addToast('Recurring order created! Orders will be placed automatically.', 'success', 4000);
      setShowCreateForm(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to create recurring order', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, prefillFromFavorite, scheduleMode, interval, daysOfWeek, dayOfMonth, timeOfDay, startDate, endDate, skipDates, contactName, contactPhone, addToast]);

  const handleToggle = useCallback(async (rec: RecurringOrder) => {
    // Capture previous state for revert
    const previousOrders = recurringOrders;
    const newActive = !rec.active;

    // Optimistically update local state
    setRecurringOrders((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, active: newActive } : r))
    );

    try {
      await toggleRecurringOrder(rec.id, newActive);
      addToast(rec.active ? 'Schedule paused' : 'Schedule resumed', 'success', 2000);
    } catch (err: any) {
      // Revert on error
      setRecurringOrders(previousOrders);
      addToast(err.message || 'Failed to update schedule', 'error');
    }
  }, [recurringOrders, addToast]);

  const handleDelete = useCallback(async (recId: string) => {
    // Capture previous state for revert
    const previousOrders = recurringOrders;
    const deletedOrder = previousOrders.find((r) => r.id === recId);

    // Optimistically remove from local state
    setRecurringOrders((prev) => prev.filter((r) => r.id !== recId));

    try {
      await deleteRecurringOrder(recId);
      addToast('Recurring order deleted', 'success', 2000);
    } catch (err: any) {
      // Revert on error by re-adding the deleted order
      if (deletedOrder) {
        setRecurringOrders((prev) => [...prev, deletedOrder]);
      }
      addToast(err.message || 'Failed to delete', 'error');
    }
  }, [recurringOrders, addToast]);

  // ── Per-occurrence handlers ──
  const startEditOccurrence = useCallback((rec: RecurringOrder) => {
    const override = rec.nextOccurrenceOverride;
    setEditingOccurrenceId(rec.id);
    setOccItems(override?.items || [...rec.items]);
    setOccHeadcount(override?.headcount || rec.headcount || 0);
    setOccInstructions(override?.specialInstructions || rec.specialInstructions || '');
  }, []);

  const saveOccurrenceOverride = useCallback(async (rec: RecurringOrder) => {
    // Capture previous state for revert
    const previousOverride = rec.nextOccurrenceOverride;

    // Optimistically update local state with the new override
    const optimisticOverride = {
      forDate: rec.nextRunDate,
      items: occItems,
      headcount: occHeadcount || undefined,
      specialInstructions: occInstructions || undefined,
    };
    setRecurringOrders((prev) =>
      prev.map((r) =>
        r.id === rec.id ? { ...r, nextOccurrenceOverride: optimisticOverride } : r
      )
    );

    // Close edit form immediately
    setEditingOccurrenceId(null);

    setSavingOcc(true);
    try {
      await setOccurrenceOverride(rec.id, optimisticOverride);
      addToast('Next order modified. Changes apply only to this occurrence.', 'success', 4000);
    } catch (err: any) {
      // Revert on error
      setRecurringOrders((prev) =>
        prev.map((r) =>
          r.id === rec.id ? { ...r, nextOccurrenceOverride: previousOverride } : r
        )
      );
      // Re-open edit form on error
      setEditingOccurrenceId(rec.id);
      addToast(err.message || 'Failed to save changes', 'error');
    } finally {
      setSavingOcc(false);
    }
  }, [occItems, occHeadcount, occInstructions, addToast]);

  const skipNextOccurrence = useCallback(async (rec: RecurringOrder) => {
    // Capture previous state for revert
    const previousOverride = rec.nextOccurrenceOverride;

    // Optimistically set skip override locally
    const optimisticOverride = { forDate: rec.nextRunDate, skip: true };
    setRecurringOrders((prev) =>
      prev.map((r) =>
        r.id === rec.id ? { ...r, nextOccurrenceOverride: optimisticOverride } : r
      )
    );

    try {
      await setOccurrenceOverride(rec.id, optimisticOverride);
      addToast(`Next order on ${rec.nextRunDate} will be skipped.`, 'success', 3000);
    } catch (err: any) {
      // Revert on error
      setRecurringOrders((prev) =>
        prev.map((r) =>
          r.id === rec.id ? { ...r, nextOccurrenceOverride: previousOverride } : r
        )
      );
      addToast(err.message || 'Failed to skip', 'error');
    }
  }, [recurringOrders, addToast]);

  const revertOverride = useCallback(async (recId: string) => {
    // Capture previous override for revert
    const previousOverride = recurringOrders.find((r) => r.id === recId)?.nextOccurrenceOverride;

    // Optimistically clear the override from local state
    setRecurringOrders((prev) =>
      prev.map((r) =>
        r.id === recId ? { ...r, nextOccurrenceOverride: undefined } : r
      )
    );

    try {
      await clearOccurrenceOverride(recId);
      addToast('Next order reverted to default.', 'success', 2000);
      setEditingOccurrenceId(null);
    } catch (err: any) {
      // Revert on error
      setRecurringOrders((prev) =>
        prev.map((r) =>
          r.id === recId ? { ...r, nextOccurrenceOverride: previousOverride } : r
        )
      );
      addToast(err.message || 'Failed to revert', 'error');
    }
  }, [recurringOrders, addToast]);

  const updateOccItemQty = useCallback((idx: number, qty: number) => {
    setOccItems((prev) => prev.map((item, i) => i === idx ? { ...item, qty: Math.max(1, qty) } : item));
  }, []);

  const removeOccItem = useCallback((idx: number) => {
    setOccItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Describe schedule in human-readable text ──
  const describeSchedule = (sched: RecurrenceSchedule): string => {
    if (sched.daysOfWeek && sched.daysOfWeek.length > 0) {
      const dayLabels = sched.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ');
      return `Every ${dayLabels} at ${sched.timeOfDay}`;
    }
    if (sched.dayOfMonth) {
      return `Monthly on the ${sched.dayOfMonth}${ordinalSuffix(sched.dayOfMonth)} at ${sched.timeOfDay}`;
    }
    return `${INTERVAL_LABELS[sched.interval || 'weekly']} at ${sched.timeOfDay}`;
  };

  // ═══════════════════ RENDER ═══════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
            Recurring Orders
          </h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Automate your regular catering on a schedule
          </p>
        </div>
      </div>

      {/* ── Create Form (shown when setting up from a favorite) ── */}
      {showCreateForm && prefillFromFavorite && (
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--aurora-text)' }}>
            Set Up Schedule for "{prefillFromFavorite.label}"
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
            {prefillFromFavorite.businessName} · {prefillFromFavorite.items.length} items · {formatPrice(calculateOrderTotal(prefillFromFavorite.items))}
          </p>

          {/* Schedule mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setScheduleMode('simple')}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
              style={{
                backgroundColor: scheduleMode === 'simple' ? '#6366F1' : 'transparent',
                color: scheduleMode === 'simple' ? '#fff' : 'var(--aurora-text-secondary)',
                borderColor: scheduleMode === 'simple' ? '#6366F1' : 'var(--aurora-border)',
              }}
            >
              Simple Interval
            </button>
            <button
              onClick={() => setScheduleMode('calendar')}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
              style={{
                backgroundColor: scheduleMode === 'calendar' ? '#6366F1' : 'transparent',
                color: scheduleMode === 'calendar' ? '#fff' : 'var(--aurora-text-secondary)',
                borderColor: scheduleMode === 'calendar' ? '#6366F1' : 'var(--aurora-border)',
              }}
            >
              Specific Days
            </button>
          </div>

          {/* Simple interval picker */}
          {scheduleMode === 'simple' && (
            <div className="mb-4">
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Frequency</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(Object.keys(INTERVAL_LABELS) as RecurrenceInterval[]).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      backgroundColor: interval === iv ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: interval === iv ? '#6366F1' : 'var(--aurora-text-secondary)',
                      borderColor: interval === iv ? '#6366F1' : 'var(--aurora-border)',
                    }}
                  >
                    {INTERVAL_LABELS[iv]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Calendar-based day picker */}
          {scheduleMode === 'calendar' && (
            <div className="mb-4">
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Days of Week</label>
              <div className="flex gap-1.5 mt-1">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className="w-10 h-10 rounded-full text-xs font-medium border transition-colors flex items-center justify-center"
                    style={{
                      backgroundColor: daysOfWeek.includes(i) ? '#6366F1' : 'transparent',
                      color: daysOfWeek.includes(i) ? '#fff' : 'var(--aurora-text-secondary)',
                      borderColor: daysOfWeek.includes(i) ? '#6366F1' : 'var(--aurora-border)',
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time, start date, end date */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Delivery Time</label>
              <input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                End Date <span style={{ color: 'var(--aurora-text-muted)' }}>(optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().slice(0, 10)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
          </div>

          {/* Skip dates — multi-date picker */}
          <div className="mb-4">
            <MultiDatePicker
              selectedDates={skipDates}
              onChange={setSkipDates}
              disablePast={true}
              label="Skip Dates (select dates to skip)"
            />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              {submitting ? 'Creating...' : 'Create Schedule'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: 'var(--aurora-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Existing Recurring Orders ── */}
      {recurringOrders.length === 0 && !showCreateForm && (
        <div className="text-center py-16">
          <Repeat size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            No recurring orders yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            Save a favorite order first, then set up a recurring schedule from there.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {recurringOrders.map((rec) => {
          const isExpanded = expandedId === rec.id;
          const total = calculateOrderTotal(rec.items);

          return (
            <div
              key={rec.id}
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--aurora-surface)',
                borderColor: rec.active ? 'rgba(99,102,241,0.3)' : 'var(--aurora-border)',
              }}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Repeat size={14} style={{ color: rec.active ? '#6366F1' : '#9CA3AF' }} />
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
                      {rec.label}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        backgroundColor: rec.active ? '#D1FAE5' : '#F3F4F6',
                        color: rec.active ? '#059669' : '#6B7280',
                      }}
                    >
                      {rec.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {rec.businessName} · {describeSchedule(rec.schedule)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                    Next: {rec.nextRunDate || 'N/A'} · {rec.totalOrdersPlaced} orders placed · {formatPrice(total)}/order
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                  {/* ── Billing projection (#25) ── */}
                  <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(5,150,105,0.06)' }}>
                    <DollarSign size={14} style={{ color: '#059669' }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: '#059669' }}>
                        Est. {formatPrice(estimateMonthlyRecurringCost(rec))}/month
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                        Based on {formatPrice(total)}/order × schedule frequency
                      </p>
                    </div>
                  </div>

                  {/* ── Next occurrence override banner ── */}
                  {rec.nextOccurrenceOverride && (
                    <div
                      className="mt-3 flex items-center justify-between p-2.5 rounded-lg"
                      style={{ backgroundColor: rec.nextOccurrenceOverride.skip ? '#FEF3C7' : 'rgba(99,102,241,0.06)' }}
                    >
                      <div className="flex items-center gap-2">
                        {rec.nextOccurrenceOverride.skip ? (
                          <>
                            <SkipForward size={14} style={{ color: '#D97706' }} />
                            <p className="text-xs font-medium" style={{ color: '#92400E' }}>
                              Next order ({rec.nextRunDate}) will be skipped
                            </p>
                          </>
                        ) : (
                          <>
                            <Pencil size={14} style={{ color: '#6366F1' }} />
                            <p className="text-xs font-medium" style={{ color: '#6366F1' }}>
                              Next order ({rec.nextOccurrenceOverride.forDate}) has modifications
                            </p>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => revertOverride(rec.id)}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium"
                        style={{ color: 'var(--aurora-text-secondary)' }}
                      >
                        <Undo2 size={10} /> Revert
                      </button>
                    </div>
                  )}

                  {/* ── Push notification reminder (#26) ── */}
                  {rec.active && rec.nextRunDate && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.04)' }}>
                      <Bell size={14} style={{ color: '#6366F1' }} />
                      <p className="text-[11px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                        You'll receive a push notification 24 hours before the next order on <strong>{rec.nextRunDate}</strong>
                      </p>
                    </div>
                  )}

                  {/* ── Per-occurrence edit form (#24) ── */}
                  {editingOccurrenceId === rec.id ? (
                    <div className="mt-3 space-y-3 p-3 rounded-xl border" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.02)' }}>
                      <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>
                        Edit next order ({rec.nextRunDate}) only
                      </p>
                      {/* Editable items */}
                      <div className="space-y-1.5">
                        {occItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={occItems[i].qty}
                              onChange={(e) => updateOccItemQty(i, parseInt(e.target.value) || 1)}
                              className="w-14 text-center rounded-lg border px-2 py-1 text-xs"
                              style={{ borderColor: 'var(--aurora-border)' }}
                            />
                            <span className="flex-1 text-xs truncate" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                            <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * occItems[i].qty)}</span>
                            <button onClick={() => removeOccItem(i)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 size={12} style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Headcount */}
                      <div className="flex items-center gap-2">
                        <Users size={12} style={{ color: 'var(--aurora-text-muted)' }} />
                        <label className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>Headcount:</label>
                        <input
                          type="number"
                          min="1"
                          value={occHeadcount || ''}
                          onChange={(e) => setOccHeadcount(parseInt(e.target.value) || 0)}
                          className="w-16 rounded-lg border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        />
                      </div>
                      {/* Special instructions */}
                      <textarea
                        value={occInstructions}
                        onChange={(e) => setOccInstructions(e.target.value)}
                        placeholder="Special instructions for this order..."
                        rows={2}
                        className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
                        style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingOccurrenceId(null)}
                          className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium border"
                          style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveOccurrenceOverride(rec)}
                          disabled={savingOcc || occItems.length === 0}
                          className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: '#6366F1' }}
                        >
                          {savingOcc ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Save for Next Order'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Items */}
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--aurora-text-muted)' }}>Items</p>
                        {rec.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span style={{ color: 'var(--aurora-text)' }}>{item.qty}x {item.name}</span>
                            <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * item.qty)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Schedule details */}
                  <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.04)' }}>
                    <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--aurora-text-muted)' }}>Schedule</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text)' }}>{describeSchedule(rec.schedule)}</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Started: {rec.schedule.startDate}
                      {rec.schedule.endDate && ` · Ends: ${rec.schedule.endDate}`}
                    </p>
                    {rec.schedule.skipDates && rec.schedule.skipDates.length > 0 && (
                      <p className="text-xs" style={{ color: '#D97706' }}>
                        Skip: {rec.schedule.skipDates.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Delivery */}
                  {rec.deliveryAddress && (
                    <div className="flex items-start gap-1.5 mt-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{rec.deliveryAddress.street}, {rec.deliveryAddress.city}, {rec.deliveryAddress.state} {rec.deliveryAddress.zip}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {rec.active && editingOccurrenceId !== rec.id && (
                      <>
                        <button
                          onClick={() => startEditOccurrence(rec)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                          style={{ color: '#6366F1', borderColor: '#6366F1' }}
                        >
                          <Pencil size={12} />
                          Edit Next
                        </button>
                        <button
                          onClick={() => skipNextOccurrence(rec)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                          style={{ color: '#D97706', borderColor: '#D97706' }}
                        >
                          <SkipForward size={12} />
                          Skip Next
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleToggle(rec)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                      style={{
                        color: rec.active ? '#D97706' : '#059669',
                        borderColor: rec.active ? '#D97706' : '#059669',
                      }}
                    >
                      {rec.active ? <Pause size={12} /> : <Play size={12} />}
                      {rec.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ color: '#EF4444' }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
