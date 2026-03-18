import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Real-time hook that listens for incoming connection requests.
 * Returns the count of pending requests where the current user is the recipient.
 * Used by the nav badge and the Discover page.
 */
export function useIncomingRequestCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      return;
    }

    // Query connections where current user is a participant and status is pending
    // We need to find connections where initiatedBy !== current user (i.e., someone sent US a request)
    const q = query(
      collection(db, 'connections'),
      where('users', 'array-contains', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      let incoming = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        // Only count requests initiated by someone else (not by us)
        if (data.initiatedBy && data.initiatedBy !== user.uid) {
          incoming++;
        }
      });
      setCount(incoming);
    }, (err) => {
      console.error('[useIncomingRequests] Firestore listener error:', err);
      setCount(0);
    });

    return unsub;
  }, [user?.uid]);

  return count;
}
