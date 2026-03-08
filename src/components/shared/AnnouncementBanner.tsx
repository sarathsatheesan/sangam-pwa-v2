import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Megaphone, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt?: any;
}

const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dismissed_announcements');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Announcement[] = snapshot.docs.map((d) => ({
        id: d.id,
        title: d.data().title || '',
        message: d.data().message || '',
        active: d.data().active,
        createdAt: d.data().createdAt,
      }));
      // Sort client-side to avoid composite index requirement
      items.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });
      setAnnouncements(items.slice(0, 5));
    }, (error) => {
      console.error('Error loading announcements:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    const updated = new Set(dismissed);
    updated.add(id);
    setDismissed(updated);
    localStorage.setItem('dismissed_announcements', JSON.stringify([...updated]));
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  const current = visibleAnnouncements[currentIndex % visibleAnnouncements.length];
  if (!current) return null;

  return (
    <div className="bg-gradient-to-r from-aurora-indigo/10 via-purple-500/10 to-aurora-indigo/10 border-b border-aurora-indigo/20">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-aurora-indigo/15 flex items-center justify-center">
          <Megaphone size={14} className="text-aurora-indigo" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-[var(--aurora-text)]">
            <span className="font-bold">{current.title}</span>
            {current.message && (
              <span className="text-[var(--aurora-text-secondary)]"> — {current.message}</span>
            )}
          </p>
        </div>

        {visibleAnnouncements.length > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + visibleAnnouncements.length) % visibleAnnouncements.length)}
              className="p-1 rounded hover:bg-[var(--aurora-surface-variant)] transition"
            >
              <ChevronLeft size={14} className="text-[var(--aurora-text-muted)]" />
            </button>
            <span className="text-[10px] text-[var(--aurora-text-muted)] font-medium tabular-nums">
              {(currentIndex % visibleAnnouncements.length) + 1}/{visibleAnnouncements.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % visibleAnnouncements.length)}
              className="p-1 rounded hover:bg-[var(--aurora-surface-variant)] transition"
            >
              <ChevronRight size={14} className="text-[var(--aurora-text-muted)]" />
            </button>
          </div>
        )}

        <button
          onClick={() => handleDismiss(current.id)}
          className="flex-shrink-0 p-1 rounded hover:bg-[var(--aurora-surface-variant)] transition"
          aria-label="Dismiss announcement"
        >
          <X size={14} className="text-[var(--aurora-text-muted)]" />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
