import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

/**
 * ConnectionDetail interface
 * Tracks status, who initiated the connection, and timestamps
 */
export interface ConnectionDetail {
  status: 'pending' | 'connected';
  initiatedBy: string;
  connectedAt?: any;
  createdAt?: any;
}

/**
 * useConnections hook
 *
 * Manages all connection-related state and handlers:
 * - Real-time connection data via onSnapshot
 * - Connection lifecycle (connect, accept, decline, disconnect)
 * - Legacy migration from old connection structure
 * - Computed connection counts
 *
 * @param userId - Current user's UID
 * @param onToastMessage - Callback to display toast messages
 * @returns Connection state and handlers
 */
export function useConnections(
  userId: string | undefined,
  onToastMessage: (message: string) => void
) {
  // Connection state
  const [connections, setConnections] = useState<Map<string, 'pending' | 'connected'>>(
    new Map()
  );
  const [connectionDetails, setConnectionDetails] = useState<Map<string, ConnectionDetail>>(
    new Map()
  );
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Disconnect confirmation state
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectPersonId, setDisconnectPersonId] = useState<string | null>(null);

  // Accept animation state
  const [acceptAnimatingId, setAcceptAnimatingId] = useState<string | null>(null);

  // Legacy migration tracking
  const migrationAttemptedRef = useRef(false);

  /**
   * Helper: Generate a unique connection ID from two user IDs
   */
  const getConnectionId = useCallback((uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  }, []);

  /**
   * Real-time listener for connections
   * Includes legacy migration from old connection structure
   */
  useEffect(() => {
    if (!userId) return;

    migrationAttemptedRef.current = false;
    const q1 = query(collection(db, 'connections'), where('users', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q1,
      async (connSnap) => {
        const connMap = new Map<string, 'pending' | 'connected'>();
        const detailsMap = new Map<string, ConnectionDetail>();

        connSnap.forEach((d) => {
          const data = d.data();
          const otherUid = (data.users as string[]).find((uid: string) => uid !== userId);
          if (otherUid) {
            const status = data.status || 'connected';
            connMap.set(otherUid, status);
            detailsMap.set(otherUid, {
              status,
              initiatedBy: data.initiatedBy || '',
              connectedAt: data.connectedAt || null,
              createdAt: data.createdAt || null,
            });
          }
        });

        // #2.4: Legacy migration runs once per mount, gated by localStorage + ref
        if (!migrationAttemptedRef.current) {
          migrationAttemptedRef.current = true;
          const migrationKey = `discover_migrated_${userId}`;
          if (localStorage.getItem(migrationKey) !== 'true') {
            try {
              const legacySnap = await getDocs(collection(db, 'users', userId, 'connections'));
              for (const d of legacySnap.docs) {
                if (!connMap.has(d.id)) {
                  const connId = getConnectionId(userId, d.id);
                  try {
                    await setDoc(doc(db, 'connections', connId), {
                      users: [userId, d.id].sort(),
                      status: 'connected',
                      connectedAt: d.data().connectedAt || serverTimestamp(),
                      migratedAt: serverTimestamp(),
                    });
                    connMap.set(d.id, 'connected');
                    detailsMap.set(d.id, {
                      status: 'connected',
                      initiatedBy: '',
                      connectedAt: d.data().connectedAt,
                    });
                  } catch {
                    connMap.set(d.id, d.data().status || 'connected');
                    detailsMap.set(d.id, {
                      status: d.data().status || 'connected',
                      initiatedBy: '',
                    });
                  }
                }
              }
            } catch {
              // Legacy subcollection may not exist
            }
            localStorage.setItem(migrationKey, 'true');
          }
        }

        setConnections(connMap);
        setConnectionDetails(detailsMap);
      },
      (err) => {
        console.error('Error listening to connections:', err);
      }
    );

    return () => unsubscribe();
  }, [userId, getConnectionId]);

  /**
   * Handle connect/disconnect/withdraw flow
   * - Connected: show disconnect confirmation
   * - Pending (initiated by user): withdraw request
   * - No status: send connection request
   */
  const handleConnect = useCallback(
    async (personId: string) => {
      if (!userId || connectingId) return;

      const currentStatus = connections.get(personId);
      if (currentStatus === 'connected') {
        // Show disconnect confirmation modal
        setDisconnectPersonId(personId);
        setShowDisconnectConfirm(true);
        return;
      }

      setConnectingId(personId);
      const connId = getConnectionId(userId, personId);

      try {
        if (currentStatus === 'pending') {
          // Withdraw pending request
          await deleteDoc(doc(db, 'connections', connId));
          setConnections((prev) => {
            const m = new Map(prev);
            m.delete(personId);
            return m;
          });
          setConnectionDetails((prev) => {
            const m = new Map(prev);
            m.delete(personId);
            return m;
          });
        } else {
          // Send connection request
          await setDoc(doc(db, 'connections', connId), {
            users: [userId, personId].sort(),
            status: 'pending',
            initiatedBy: userId,
            connectedAt: null,
            createdAt: serverTimestamp(),
          });
          setConnections((prev) => new Map(prev).set(personId, 'pending'));
          setConnectionDetails((prev) =>
            new Map(prev).set(personId, { status: 'pending', initiatedBy: userId })
          );
        }
      } catch (err) {
        console.error('Error toggling connection:', err);
        onToastMessage('Connection failed. Please try again.');
      } finally {
        setConnectingId(null);
      }
    },
    [userId, connectingId, connections, getConnectionId, onToastMessage]
  );

  /**
   * Confirm disconnect from a person
   */
  const confirmDisconnect = useCallback(async () => {
    if (!disconnectPersonId || !userId) return;
    setConnectingId(disconnectPersonId);
    const connId = getConnectionId(userId, disconnectPersonId);
    try {
      await deleteDoc(doc(db, 'connections', connId));
      try {
        await deleteDoc(doc(db, 'users', userId, 'connections', disconnectPersonId));
      } catch {}
      try {
        await deleteDoc(doc(db, 'users', disconnectPersonId, 'connections', userId));
      } catch {}
      setConnections((prev) => {
        const m = new Map(prev);
        m.delete(disconnectPersonId);
        return m;
      });
      setConnectionDetails((prev) => {
        const m = new Map(prev);
        m.delete(disconnectPersonId);
        return m;
      });
    } catch (err) {
      console.error('Error disconnecting:', err);
      onToastMessage('Failed to disconnect. Please try again.');
    } finally {
      setConnectingId(null);
      setShowDisconnectConfirm(false);
      setDisconnectPersonId(null);
    }
  }, [disconnectPersonId, userId, getConnectionId, onToastMessage]);

  /**
   * Accept an incoming connection request
   */
  const handleAcceptConnection = useCallback(
    async (personId: string) => {
      if (!userId || connectingId) return;
      setConnectingId(personId);
      const connId = getConnectionId(userId, personId);
      try {
        const connRef = doc(db, 'connections', connId);
        const connSnap = await getDoc(connRef);
        if (connSnap.exists()) {
          // Existing pending request — update status to connected
          await updateDoc(connRef, {
            status: 'connected',
            connectedAt: serverTimestamp(),
          });
        } else {
          // No existing doc (edge case) — create fresh
          await setDoc(connRef, {
            users: [userId, personId].sort(),
            status: 'connected',
            initiatedBy: personId,
            createdAt: serverTimestamp(),
            connectedAt: serverTimestamp(),
          });
        }
        setConnections((prev) => new Map(prev).set(personId, 'connected'));
        setConnectionDetails((prev) =>
          new Map(prev).set(personId, {
            status: 'connected',
            initiatedBy: connectionDetails.get(personId)?.initiatedBy || personId,
            connectedAt: new Date(),
          })
        );
        // #3.9: Trigger accept animation
        setAcceptAnimatingId(personId);
        setTimeout(() => setAcceptAnimatingId(null), 2000);
        onToastMessage('Connection accepted! 🎉');
      } catch (err) {
        console.error('Error accepting connection:', err);
        onToastMessage('Failed to accept connection. Please try again.');
      } finally {
        setConnectingId(null);
      }
    },
    [userId, connectingId, connectionDetails, getConnectionId, onToastMessage]
  );

  /**
   * Decline an incoming connection request
   */
  const handleDeclineConnection = useCallback(
    async (personId: string) => {
      if (!userId || connectingId) return;
      setConnectingId(personId);
      const connId = getConnectionId(userId, personId);
      try {
        await deleteDoc(doc(db, 'connections', connId));
        setConnections((prev) => {
          const m = new Map(prev);
          m.delete(personId);
          return m;
        });
        setConnectionDetails((prev) => {
          const m = new Map(prev);
          m.delete(personId);
          return m;
        });
      } catch (err) {
        console.error('Error declining connection:', err);
        onToastMessage('Failed to decline connection. Please try again.');
      } finally {
        setConnectingId(null);
      }
    },
    [userId, connectingId, getConnectionId, onToastMessage]
  );

  /**
   * Computed: Total number of connected users
   */
  const connectedCount = Array.from(connections.values()).filter((s) => s === 'connected')
    .length;

  /**
   * Computed: Number of pending incoming requests (not initiated by current user)
   */
  const pendingCount = Array.from(connections.entries()).filter(
    ([pid, s]) => s === 'pending' && connectionDetails.get(pid)?.initiatedBy !== userId
  ).length;

  return {
    // State
    connections,
    connectionDetails,
    connectingId,
    showDisconnectConfirm,
    disconnectPersonId,
    acceptAnimatingId,

    // State setters
    setShowDisconnectConfirm,
    setDisconnectPersonId,
    setAcceptAnimatingId,

    // Handlers
    handleConnect,
    confirmDisconnect,
    handleAcceptConnection,
    handleDeclineConnection,

    // Computed values
    connectedCount,
    pendingCount,
  };
}
