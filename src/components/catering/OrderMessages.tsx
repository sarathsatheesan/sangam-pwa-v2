import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrderNote } from '@/services/cateringService';
import { addOrderNote, subscribeToOrderNotes } from '@/services/cateringService';

interface OrderMessagesProps {
  orderId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'customer' | 'vendor';
  /** Collapsed by default — user can expand */
  defaultExpanded?: boolean;
}

export default function OrderMessages({
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  defaultExpanded = false,
}: OrderMessagesProps) {
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time notes
  useEffect(() => {
    const unsub = subscribeToOrderNotes(orderId, setNotes);
    return () => unsub();
  }, [orderId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes.length, expanded]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
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
    if (!ts) return '';
    const date = ts.toDate?.() || new Date(ts.seconds * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const unreadCount = 0; // Future: track read status

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
        aria-label={`Order messages — ${notes.length} messages`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={16} style={{ color: 'var(--color-aurora-indigo, #6366F1)' }} />
          <span>Messages</span>
          {notes.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--color-aurora-indigo, #6366F1)' }}
            >
              {notes.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Messages panel */}
      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--aurora-border)' }}>
          {/* Messages list */}
          <div
            ref={scrollRef}
            className="px-4 py-3 space-y-3 overflow-y-auto"
            style={{ maxHeight: '240px' }}
          >
            {notes.length === 0 ? (
              <p className="text-center text-xs py-4" style={{ color: 'var(--aurora-text-muted)' }}>
                No messages yet. Send a note to {currentUserRole === 'customer' ? 'the vendor' : 'the customer'}.
              </p>
            ) : (
              notes.map((note) => {
                const isOwn = note.senderId === currentUserId;
                return (
                  <div
                    key={note.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    {!isOwn && (
                      <span className="text-[10px] mb-0.5 font-medium" style={{ color: 'var(--aurora-text-muted)' }}>
                        {note.senderName}
                      </span>
                    )}
                    <div
                      className="rounded-xl px-3 py-2 max-w-[80%] text-sm"
                      style={
                        isOwn
                          ? { backgroundColor: 'var(--color-aurora-indigo, #6366F1)', color: '#fff' }
                          : { backgroundColor: 'var(--aurora-surface-variant, #F3F4F6)', color: 'var(--aurora-text)' }
                      }
                    >
                      {note.text}
                    </div>
                    <span className="text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                      {formatTime(note.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-t"
            style={{ borderColor: 'var(--aurora-border)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              className="flex-1 text-sm rounded-lg border px-3 py-2 outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              style={{
                borderColor: 'var(--aurora-border)',
                backgroundColor: 'var(--aurora-bg)',
                color: 'var(--aurora-text)',
              }}
              aria-label="Type a message"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="p-2.5 rounded-lg text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-aurora-indigo, #6366F1)', minWidth: '40px', minHeight: '40px' }}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
