// ═══════════════════════════════════════════════════════════════════════
// MESSAGES — Firestore data access for pages/messages.tsx
// (Session 67 extraction — companion 10b of the messages decomposition)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Conventions (mirrors services/feed.ts header):
 * - MECHANICAL MOVES ONLY: every function issues the IDENTICAL query/payload
 *   the page issued before extraction — same collections, same where/orderBy
 *   clauses, same field names, same serverTimestamp() choices. Do NOT
 *   "improve" queries here without a dedicated session.
 * - Error handling: subscription functions take onError so the page's existing
 *   console.error + toast feedback stays at the call site. Promise-returning
 *   functions do NOT swallow errors — the page's try/catch stays.
 * - Crypto boundary: key generation/derivation/decryption primitives stay in
 *   utils/encryption. This module owns Firestore I/O; the thread subscription
 *   also owns the multi-strategy decrypt PIPELINE because it is inseparable
 *   from the snapshot handler (strategy 3 does a Firestore getDoc mid-stream).
 * - The msgSnapshotSeqRef monotonic guard (Session 42) is passed IN from the
 *   page as a mutable { current } so it survives re-subscribes — a slow old
 *   handler must see bumps made by the subscription that replaced it.
 */

import {
  collection, query, orderBy, where, getDocs, doc, updateDoc,
  onSnapshot, serverTimestamp, writeBatch, getDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  deriveSharedKey, e2eDecrypt, generateConversationKey, decryptMessage,
  getDeterministicSharedKey,
  type ExportedPublicKey,
} from '@/utils/encryption';
import type { User, Message, Conversation, PresenceStatus } from '@/types/messages';
import {
  PRESENCE_HEARTBEAT_INTERVAL,
  PRESENCE_AWAY_TIMEOUT,
} from '@/constants/messages';

// ─── Users ───────────────────────────────────────────────────────────────

/** One-time load of all users (page's mount fetch). Errors propagate. */
export async function fetchAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, 'users'));
  const usersData: User[] = [];
  snap.forEach((d) => {
    usersData.push({ id: d.id, ...d.data() } as User);
  });
  return usersData;
}

// ─── Conversations ───────────────────────────────────────────────────────

/** Real-time conversation list for a user, newest first. */
export function subscribeToConversations(
  uid: string,
  onData: (convs: Conversation[]) => void,
  onError: (err: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'conversations'), where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc')),
    (snap) => {
      const convs: Conversation[] = [];
      snap.forEach((d) => {
        convs.push({ id: d.id, ...d.data() } as Conversation);
      });
      onData(convs);
    },
    onError,
  );
}

// ─── Active group call (in-chat banner) ──────────────────────────────────

/** Watches for an active group call room in a conversation (null = none). */
export function subscribeToActiveGroupCall(
  conversationId: string,
  onChange: (roomId: string | null) => void,
): () => void {
  const q = query(
    collection(db, 'groupCalls'),
    where('conversationId', '==', conversationId),
    where('status', '==', 'active'),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.empty ? null : snap.docs[0].id);
  });
}

// ─── Presence ────────────────────────────────────────────────────────────

/**
 * Presence writer: online now, heartbeat while visible, away on hidden,
 * offline on unload/pagehide/unmount. Returns the teardown.
 * (Body moved verbatim from the page's presence effect.)
 */
export function startPresenceHeartbeat(uid: string): () => void {
  const userDocRef = doc(db, 'users', uid);
  let awayTimer: ReturnType<typeof setTimeout>;

  const updatePresence = async (status: PresenceStatus) => {
    try {
      await updateDoc(userDocRef, {
        presenceStatus: status,
        isOnline: status !== 'offline',
        lastSeen: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating presence:', err);
    }
  };

  // Set online immediately
  updatePresence('online');

  // Heartbeat: refresh lastSeen every 60s while tab is visible
  const heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      updatePresence('online');
    }
  }, PRESENCE_HEARTBEAT_INTERVAL);

  // Visibility change: tab hidden → start away timer, tab visible → set online
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      awayTimer = setTimeout(() => {
        updatePresence('away');
      }, PRESENCE_AWAY_TIMEOUT);
    } else {
      clearTimeout(awayTimer);
      updatePresence('online');
    }
  };

  // Before unload / pagehide: set offline (best-effort, may not always fire)
  // `pagehide` is more reliable than `beforeunload` on iOS Safari and Android
  // Chrome. We listen on both for maximum cross-browser coverage.
  const handleBeforeUnload = () => {
    updatePresence('offline');
  };
  const handlePageHide = () => {
    updatePresence('offline');
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);

  return () => {
    clearInterval(heartbeatTimer);
    clearTimeout(awayTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
    // Set offline on unmount
    updatePresence('offline');
  };
}

export type PresenceUpdate = {
  id: string;
  isOnline: boolean;
  lastSeen: User['lastSeen'];
  presenceStatus: PresenceStatus;
};

/**
 * Real-time presence for a set of users, batched into 'in' queries of 10
 * (Firestore limit). onPresence receives the added/modified doc changes of
 * each snapshot (possibly empty — the page's merge ran unconditionally before
 * and still does). Returns one unsubscribe covering all batches.
 */
export function subscribeToPresenceOfUsers(
  userIds: string[],
  onPresence: (updates: PresenceUpdate[]) => void,
  onError: (err: unknown) => void,
): () => void {
  const unsubscribes: (() => void)[] = [];

  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const q = query(
      collection(db, 'users'),
      where('__name__', 'in', batch)
    );
    const unsub = onSnapshot(q, (snap) => {
      const updates: PresenceUpdate[] = [];
      snap.docChanges().forEach((change) => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          updates.push({
            id: change.doc.id,
            isOnline: data.isOnline ?? false,
            lastSeen: data.lastSeen ?? undefined,
            presenceStatus: data.presenceStatus ?? 'offline',
          });
        }
      });
      onPresence(updates);
    }, onError);
    unsubscribes.push(unsub);
  }

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// ─── E2EE key material (Firestore fetch/publish only — crypto in utils) ──

/** Publish this device's public key so peers can derive shared keys. */
export async function publishPublicKey(uid: string, publicKey: ExportedPublicKey): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    e2ePublicKey: publicKey,
  });
}

/** Peer's published public key, or null if the peer hasn't set up E2EE. */
export async function fetchPeerPublicKey(peerId: string): Promise<ExportedPublicKey | null> {
  const peerDoc = await getDoc(doc(db, 'users', peerId));
  const peerData = peerDoc.data();
  return (peerData?.e2ePublicKey as ExportedPublicKey | undefined) ?? null;
}

/**
 * The wrapped group key for `uid` in a group conversation plus the
 * distributor's public key — everything needed to unwrap. Null when either
 * half is missing (no key distributed yet / distributor has no E2EE).
 */
export async function fetchGroupKeyMaterial(
  uid: string,
  conversationId: string,
): Promise<{ wrappedKey: string; distributorPublicKey: ExportedPublicKey } | null> {
  const convDoc = await getDoc(doc(db, 'conversations', conversationId));
  const convData = convDoc.data();
  if (!convData?.e2eGroupKeys || !convData.e2eGroupKeys[uid]) {
    // No group key distributed for us yet
    return null;
  }
  const wrappedKey = convData.e2eGroupKeys[uid];
  const distributorUid = convData.e2eKeyDistributor || convData.groupCreatedBy;

  // Fetch distributor's public key
  const distributorDoc = await getDoc(doc(db, 'users', distributorUid));
  const distributorData = distributorDoc.data();
  if (!distributorData?.e2ePublicKey) return null;

  return {
    wrappedKey,
    distributorPublicKey: distributorData.e2ePublicKey as ExportedPublicKey,
  };
}

// ─── Read receipts ───────────────────────────────────────────────────────

/**
 * Mark every unread message from others in a conversation as read and reset
 * the conversation's unread counters. (Body of the page's visibilitychange
 * mark-read handler; the event listener + visibility check stay in the page.)
 */
export async function markThreadRead(uid: string, conversationId: string): Promise<void> {
  const msgsRef = collection(db, 'conversations', conversationId, 'messages');
  const msgsSnap = await getDocs(msgsRef);
  const unreadFromOthers = msgsSnap.docs.filter((d) => {
    const data = d.data();
    return data.senderId !== uid && !data.read;
  });
  if (unreadFromOthers.length > 0) {
    const batch = writeBatch(db);
    unreadFromOthers.forEach((d) => {
      batch.update(doc(db, 'conversations', conversationId, 'messages', d.id), {
        read: true,
        readAt: serverTimestamp(),
      });
    });
    batch.update(doc(db, 'conversations', conversationId), { unreadCount: 0, lastMessageRead: true });
    await batch.commit();
  }
}

// ─── Thread messages (the render backbone) ───────────────────────────────

export interface ThreadE2EContext {
  privateKeyRef: { current: CryptoKey | null };
  sharedKeysRef: { current: Map<string, CryptoKey> };
  groupKeysRef: { current: Map<string, CryptoKey> };
}

export interface SubscribeToThreadMessagesOpts {
  uid: string;
  convId: string;
  /** 1:1 peer id (null for group threads) — drives the 4-strategy decrypt. */
  selectedUserId: string | null;
  /** Whether the open thread is a group (page computes from conversations). */
  isGroupConv: boolean;
  /** The selected conversation id as the page saw it (group key lookup). */
  selectedConvId: string | null;
  e2e: ThreadE2EContext;
  /** Monotonic snapshot-race guard — MUST be the page's long-lived ref. */
  seqRef: { current: number };
  /**
   * Decrypted, ordered messages. initialLoad is true exactly once per
   * subscription (first snapshot) — the page uses it for the pin-to-bottom
   * retry scroll. The page applies setMessages/setPinned/loading here.
   */
  onMessages: (msgs: Message[], initialLoad: boolean) => void;
  onError: (err: unknown) => void;
}

/**
 * Live thread subscription: snapshot → multi-strategy decrypt → onMessages →
 * mark-visible-unread-as-read. Moved verbatim from the page's messages
 * effect (Session 42 race guard, Session 63 decrypt-noise notes apply).
 */
export function subscribeToThreadMessages(opts: SubscribeToThreadMessagesOpts): () => void {
  const { uid, convId, selectedUserId, isGroupConv, selectedConvId, e2e, seqRef, onMessages, onError } = opts;

  // Reset per-subscription: the first snapshot of this thread is the initial load.
  let didInitialScroll = false;

  return onSnapshot(
    query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')),
    async (snap) => {
      // Monotonic guard against out-of-order async handlers (Issue 1).
      const mySeq = ++seqRef.current;
      // serverTimestamps: 'estimate' makes a just-sent message's pending
      // `createdAt` resolve to a local estimate instead of null — otherwise the
      // sender's own message has no timestamp for ordering/date-grouping and
      // doesn't render until the next snapshot (i.e. the next message).
      const rawMsgs = snap.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), id: d.id }));
      const msgs: Message[] = [];
      for (const rawMsg of rawMsgs) {
        let text = (rawMsg as Record<string, unknown>).text as string || '';
        let image = (rawMsg as Record<string, unknown>).image as string | undefined;
        let voiceMessage = (rawMsg as Record<string, unknown>).voiceMessage as Message['voiceMessage'];

        const isEncrypted = (rawMsg as Record<string, unknown>).encrypted;

        if (isEncrypted) {
          // Helper to check if a string is still encrypted (decryption failed)
          const isStillEncrypted = (s: string): boolean => {
            try {
              const p = JSON.parse(s);
              return !!(p.v === 2 && p.iv && p.ct);
            } catch { return false; }
          };

          // Helper to try decrypting all fields with a given key.
          // Returns true if at least one field was successfully decrypted.
          // Does NOT replace text with friendly message — caller handles that after all strategies.
          const tryDecryptAllFields = async (key: CryptoKey): Promise<boolean> => {
            let anyDecrypted = false;

            // Try to decrypt text (skip if empty or not v2 JSON)
            if (text) {
              try {
                const textParsed = JSON.parse(text);
                if (textParsed.v === 2) {
                  const decryptedText = await e2eDecrypt(text, key);
                  if (!isStillEncrypted(decryptedText)) {
                    text = decryptedText;
                    anyDecrypted = true;
                  }
                }
              } catch { /* text is not v2 JSON — skip */ }
            }

            // Try to decrypt image
            if (image) {
              try {
                const imgParsed = JSON.parse(image);
                if (imgParsed.v === 2) {
                  const decryptedImg = await e2eDecrypt(image, key);
                  if (!isStillEncrypted(decryptedImg)) {
                    image = decryptedImg;
                    anyDecrypted = true;
                  } else {
                    image = undefined; // Can't decrypt — hide broken image
                  }
                }
              } catch { /* not encrypted or not JSON */ }
            }

            // Try to decrypt voice message
            if (voiceMessage?.audioUrl) {
              try {
                const voiceParsed = JSON.parse(voiceMessage.audioUrl);
                if (voiceParsed.v === 2) {
                  const decryptedAudio = await e2eDecrypt(voiceMessage.audioUrl, key);
                  if (!isStillEncrypted(decryptedAudio)) {
                    voiceMessage = { ...voiceMessage, audioUrl: decryptedAudio };
                    anyDecrypted = true;
                  }
                }
              } catch { /* not encrypted or not JSON */ }
            }

            return anyDecrypted;
          };

          if (isGroupConv && selectedConvId) {
            // Group decryption
            const groupKey = e2e.groupKeysRef.current.get(selectedConvId);
            if (groupKey) {
              let groupIsV2 = false;
              try { const p = JSON.parse(text); groupIsV2 = p.v === 2; } catch { /* not v2 */ }
              if (!groupIsV2 && image) {
                try { const p = JSON.parse(image); groupIsV2 = p.v === 2; } catch { /* not v2 */ }
              }
              if (groupIsV2) {
                const ok = await tryDecryptAllFields(groupKey);
                if (!ok) {
                  text = '\u{1F512} This message cannot be decrypted on this device';
                }
              }
            }
          } else if (selectedUserId) {
            // 1:1 decryption — try strategies in order:
            // 1) Deterministic V2 key (new default, cross-device safe)
            // 2) ECDH shared key (old V2 messages)
            // 3) Per-message ECDH key (old V2 messages with stored sender key)
            // 4) Legacy V1 (oldest messages)
            // Check if EITHER text or image is v2 encrypted
            let isV2 = false;
            try { const p = JSON.parse(text); isV2 = p.v === 2; } catch { /* not v2 text */ }
            if (!isV2 && image) {
              try { const p = JSON.parse(image); isV2 = p.v === 2; } catch { /* not v2 image */ }
            }

            if (isV2) {
              let decrypted = false;

              // Strategy 1: Deterministic key (works cross-device, cross-browser)
              try {
                const detKey = await getDeterministicSharedKey(uid, selectedUserId);
                decrypted = await tryDecryptAllFields(detKey);
              } catch (err) {
                console.warn('[E2EE] Deterministic decrypt failed:', err);
              }

              // Strategy 2: ECDH shared key (for old messages encrypted with ECDH)
              if (!decrypted) {
                const sharedKey = e2e.sharedKeysRef.current.get(selectedUserId);
                if (sharedKey) {
                  try {
                    decrypted = await tryDecryptAllFields(sharedKey);
                  } catch { /* ECDH decrypt failed */ }
                }
              }

              // Strategy 3: Per-message sender public key ECDH
              if (!decrypted) {
                const msgSenderPubKey = (rawMsg as Record<string, unknown>).senderPublicKey as ExportedPublicKey | undefined;
                const msgSenderId = (rawMsg as Record<string, unknown>).senderId as string;
                if (msgSenderPubKey && e2e.privateKeyRef.current) {
                  try {
                    const peerPubKey = msgSenderId === uid
                      ? (await getDoc(doc(db, 'users', selectedUserId))).data()?.e2ePublicKey as ExportedPublicKey
                      : msgSenderPubKey;
                    if (peerPubKey) {
                      const perMsgKey = await deriveSharedKey(e2e.privateKeyRef.current, peerPubKey);
                      decrypted = await tryDecryptAllFields(perMsgKey);
                    }
                  } catch { /* per-message ECDH failed */ }
                }
              }

              // All V2 strategies failed — show friendly message
              if (!decrypted) {
                text = '\u{1F512} This message cannot be decrypted on this device';
                image = undefined;
              }
            } else {
              // Not a v2 payload — try legacy v1 decrypt
              try {
                const convKey = generateConversationKey(uid, selectedUserId);
                if (text) text = decryptMessage(text, convKey);
              } catch {
                text = '[Encrypted]';
              }
            }
          }
        }

        msgs.push({ ...(rawMsg as Record<string, unknown>), id: (rawMsg as Record<string, unknown>).id as string, text, image, voiceMessage } as Message);
      }
      // If a newer snapshot started while we were decrypting, drop this stale
      // result — applying it would overwrite the newer list and make recent
      // messages disappear (Issue 1).
      if (mySeq !== seqRef.current) return;
      const initialLoad = !didInitialScroll;
      if (initialLoad) didInitialScroll = true;
      onMessages(msgs, initialLoad);

      // Mark unread messages from other user(s) as read
      if (convId && document.visibilityState === 'visible') {
        const unreadFromOthers = snap.docs.filter((d) => {
          const data = d.data();
          return data.senderId !== uid && !data.read;
        });
        if (unreadFromOthers.length > 0) {
          try {
            const batch = writeBatch(db);
            unreadFromOthers.forEach((d) => {
              batch.update(doc(db, 'conversations', convId, 'messages', d.id), {
                read: true,
                readAt: serverTimestamp(),
              });
            });
            // Also reset unreadCount and mark last message as read on the conversation doc
            batch.update(doc(db, 'conversations', convId), { unreadCount: 0, lastMessageRead: true });
            await batch.commit();
          } catch (err) {
            console.error('Error marking messages as read:', err);
          }
        }
      }
    },
    onError,
  );
}
