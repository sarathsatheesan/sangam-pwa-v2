import { useState } from 'react';
import type { User, Message, Conversation, ViewState } from '@/types/messages';

/**
 * Core chat data domain (Session 62 — messages.tsx decomposition tranche 10a,
 * domain 10 of docs/messages-state-decomposition-plan.md — STATE HALF ONLY).
 *
 * The render backbone: conversation list, the open thread's messages, the
 * selected user/conversation, the people directory, and list view/filter/
 * search state.
 *
 * SCOPE — this is the STATE extraction only. The Firestore subscriptions that
 * feed these setters (6 onSnapshot listeners + the `msgSnapshotSeqRef`
 * snapshot-race guard from Session 42), plus all effects/refs, DELIBERATELY
 * stay in the page. Moving that I/O into a `services/messages.ts` is tranche
 * 10b — a separate, focused session with the E2EE test suite as a guard,
 * because it's the highest-risk surgery in the whole decomposition.
 *
 * Raw setters with identical names → all ~30 call sites (subscriptions +
 * navigation handlers) stay byte-for-byte unchanged; only the declarations
 * move here. Lowest-risk technique, same as the composer (tranche 9).
 */
export function useChatData() {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'connects' | 'archived'>('all');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  return {
    viewState, setViewState,
    conversations, setConversations,
    selectedUser, setSelectedUser,
    messages, setMessages,
    loading, setLoading,
    messagesLoading, setMessagesLoading,
    users, setUsers,
    searchTerm, setSearchTerm,
    activeFilter, setActiveFilter,
    selectedConvId, setSelectedConvId,
  };
}
