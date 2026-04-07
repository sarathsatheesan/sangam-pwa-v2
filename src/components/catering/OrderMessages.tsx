import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp, Check, CheckCheck, Lock } from 'lucide-react';
import type { OrderNote } from '@/services/cateringService';
import { addOrderNote, subscribeToOrderNotes, markOrderNotesRead } from '@/services/cateringService';

const MESSAGING_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

interface OrderMessagesProps {
  orderId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'customer' | 'vendor';
  /** Collapsed by default — user can expand */
  defaultExpanded?: boolean;
  /** When the order was delivered (Firestore Timestamp or epoch). If set and > 48hrs ago, messaging is read-only. */
  deliveredAt?: any;
  /** Current order status */
  orderStatus?: string;
}

/**
 * Safely extract epoch milliseconds from a Firestore Timestamp, epoch number, or Date.
 * Returns 0 when the value is unrecognisable — callers treat 0 as "no timestamp".
 */
function toEpochMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  // ISO-8601 string fallback (Android WebView sometimes serialises dates this way)
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Compare two Dates by calendar day without relying on `toDateString()` (locale-safe).
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function OrderMessages({
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  defaultExpanded = false,
  deliveredAt,
  orderStatus,
}: OrderMessagesProps) {
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute whether the 48-hour messaging window has expired
  const { isExpired, timeRemainingLabel } = useMemo(() => {
    if (orderStatus !== 'delivered' || !deliveredAt) {
      return { isExpired: false, timeRemainingLabel: '' };
    }
    const deliveredMs = toEpochMs(deliveredAt);
    if (!deliveredMs) return { isExpired: false, timeRemainingLabel: '' };

    const elapsed = Date.now() - deliveredMs;
    const remaining = MESSAGING_WINDOW_MS - elapsed;
    if (remaining <= 0) {
      return { isExpired: true, timeRemainingLabel: '' };
    }
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const label = hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;
    return { isExpired: false, timeRemainingLabel: label };
  }, [deliveredAt, orderStatus]);

  // Subscribe to real-time notes
  useEffect(() => {
    const unsub = subscribeToOrderNotes(orderId, setNotes);
    return () => unsub();
  }, [orderId]);

  // Auto-scroll on new messages — use rAF to wait for DOM paint (consistent across browsers)
  useEffect(() => {
    if (expanded && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [notes.length, expanded]);

  // Mark messages as read when panel is expanded and there are unread messages
  useEffect(() => {
    if (!expanded || !currentUserId) return;
    const hasUnread = notes.some(
      (n) => n.senderId !== currentUserId && !(n.readBy || []).includes(currentUserId),
    );
    if (hasUnread) {
      markOrderNotesRead(orderId, currentUserId).catch(() => {});
    }
  }, [expanded, notes, orderId, currentUserId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || isExpired) return;
    setSending(true);
    try {
      await addOrderNote(orderId, {
        orderId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        text,
      });
      setDraft('');
      inputRef.current?.focus();
    } catch (err) {
      console.warn('Failed to send order note:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: any): string => {
    const ms = toEpochMs(ts);
    if (!ms) return '';
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    if (isSameDay(date, now)) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return (
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
  };

  // Count unread messages from the OTHER party
  const unreadCount = notes.filter(
    (n) => n.senderId !== currentUserId && !(n.readBy || []).includes(currentUserId),
  ).length;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: 'var(--aurora-text)' }}
        aria-expanded={expanded}
        aria-label={`Order messages — ${notes.length} messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        {/* Safari 14 flex gap fallback: use margin-right instead of gap-2 */}
        <div className="flex items-center" style={{ gap: '0.5rem' }}>
          <MessageSquare
            size={16}
            style={{
              color: isExpired ? 'var(--aurora-text-muted)' : 'var(--color-aurora-indigo, #6366F1)',
              flexShrink: 0,
            }}
          />
          <span>{isExpired ? 'Messages (closed)' : 'Messages'}</span>
          {notes.length > 0 && unreadCount === 0 && (
            <span
              className="text-xs rounded-full"
              style={{
                backgroundColor: 'rgba(99,102,241,0.1)',
                color: 'var(--color-aurora-indigo, #6366F1)',
                padding: '2px 6px',
              }}
            >
              {notes.length}
            </span>
          )}
          {unreadCount > 0 && (
            <span
              className="text-xs rounded-full font-semibold text-white"
              style={{
                backgroundColor: '#EF4444',
                minWidth: '20px',
                textAlign: 'center',
                padding: '2px 6px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Messages panel */}
      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--aurora-border)' }}>
          {/* Messaging window countdown for delivered orders */}
          {orderStatus === 'delivered' && !isExpired && timeRemainingLabel && (
            <div
              className="flex items-center px-4 py-2"
              style={{
                backgroundColor: 'rgba(99,102,241,0.05)',
                color: 'var(--aurora-text-secondary)',
                fontSize: '11px',
                gap: '0.5rem',
              }}
            >
              <MessageSquare size={12} style={{ flexShrink: 0 }} />
              <span>Messaging available for {timeRemainingLabel} after delivery</span>
            </div>
          )}

          {/* Messages list — with iOS inertia scrolling */}
          <div
            ref={scrollRef}
            className="px-4 py-3 overflow-y-auto"
            style={{
              maxHeight: '240px',
              WebkitOverflowScrolling: 'touch', // iOS Safari smooth scroll
              overscrollBehavior: 'contain',     // prevent parent scroll bleed on all browsers
            }}
          >
            {notes.length === 0 ? (
              <p
                className="text-center text-xs py-4"
                style={{ color: 'var(--aurora-text-muted)' }}
              >
                {isExpired
                  ? 'Messaging window has closed. Previous messages are shown above.'
                  : `No messages yet. Send a note to ${currentUserRole === 'customer' ? 'the vendor' : 'the customer'}.`}
              </p>
            ) : (
              notes.map((note, idx) => {
                const isOwn = note.senderId === currentUserId;
                const readBy = note.readBy || [];
                const isRead = isOwn && readBy.length > 0;
                return (
                  <div
                    key={note.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    style={{ marginTop: idx > 0 ? '0.75rem' : 0 }} // space-y-3 replacement for Safari 14
                  >
                    {!isOwn && (
                      <span
                        className="font-medium"
                        style={{
                          color: 'var(--aurora-text-muted)',
                          fontSize: '10px',
                          lineHeight: '1.4',
                          marginBottom: '2px',
                        }}
                      >
                        {note.senderName}
                      </span>
                    )}
                    <div
                      className="rounded-xl text-sm"
                      style={{
                        padding: '8px 12px',
                        maxWidth: '80%',
                        wordBreak: 'break-word',       // prevent long words from overflowing
                        overflowWrap: 'break-word',     // Firefox fallback
                        ...(isOwn
                          ? { backgroundColor: 'var(--color-aurora-indigo, #6366F1)', color: '#fff' }
                          : { backgroundColor: 'var(--aurora-surface-variant, #F3F4F6)', color: 'var(--aurora-text)' }),
                      }}
                    >
                      {note.text}
                    </div>
                    <div
                      className="flex items-center"
                      style={{ gap: '4px', marginTop: '2px' }}
                    >
                      <span style={{ color: 'var(--aurora-text-muted)', fontSize: '10px', lineHeight: '1.4' }}>
                        {formatTime(note.createdAt)}
                      </span>
                      {isOwn && (
                        isRead ? (
                          <CheckCheck size={12} style={{ color: '#6366F1', flexShrink: 0 }} aria-label="Read" />
                        ) : (
                          <Check size={12} style={{ color: 'var(--aurora-text-muted)', flexShrink: 0 }} aria-label="Sent" />
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input — hidden when expired */}
          {isExpired ? (
            <div
              className="flex items-center border-t"
              style={{
                borderColor: 'var(--aurora-border)',
                backgroundColor: 'rgba(0,0,0,0.02)',
                padding: '12px 16px',
                gap: '0.5rem',
              }}
            >
              <Lock size={14} style={{ color: 'var(--aurora-text-muted)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                Messaging closed — 48-hour window after delivery has passed
              </span>
            </div>
          ) : (
            <div
              className="flex items-center border-t"
              style={{
                borderColor: 'var(--aurora-border)',
                padding: '12px 16px',
                gap: '0.5rem',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 text-sm rounded-lg border outline-none"
                style={{
                  borderColor: 'var(--aurora-border)',
                  backgroundColor: 'var(--aurora-bg)',
                  color: 'var(--aurora-text)',
                  padding: '8px 12px',
                  fontSize: '14px',                     // prevent iOS zoom on focus (≥16px not needed with viewport meta)
                  WebkitAppearance: 'none',              // iOS Safari: remove default styling
                  appearance: 'none',                    // standard
                  borderRadius: '0.5rem',
                }}
                aria-label="Type a message"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="rounded-lg text-white transition-colors"
                style={{
                  backgroundColor: 'var(--color-aurora-indigo, #6366F1)',
                  minWidth: '44px',                     // Apple HIG 44px touch target
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: (!draft.trim() || sending) ? 0.4 : 1,
                  cursor: (!draft.trim() || sending) ? 'default' : 'pointer',
                  WebkitTapHighlightColor: 'transparent', // remove iOS tap flash
                }}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
