import React from 'react';
import type { Announcement } from '@/types/admin';
import { ToggleSwitch } from '@/components/admin';
import { Trash2, Plus, Megaphone } from 'lucide-react';

interface AnnouncementPanelProps {
  announcements: Announcement[];
  announcementTitle: string;
  announcementMessage: string;
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onAddAnnouncement: () => void;
  onDeleteAnnouncement: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export function AnnouncementPanel({
  announcements,
  announcementTitle,
  announcementMessage,
  onTitleChange,
  onMessageChange,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onToggleActive,
}: AnnouncementPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Announcements</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Create and manage platform-wide announcements</p>
      </div>

      <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
        <h3 className="font-bold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[#FF3008]" /> New Announcement
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Announcement title..."
            value={announcementTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30"
          />
          <textarea
            placeholder="Message content..."
            value={announcementMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 resize-none"
          />
          <button
            onClick={onAddAnnouncement}
            className="w-full px-6 py-2.5 bg-[#FF3008] text-white rounded-xl text-sm font-semibold hover:bg-[#E02A06] transition shadow-md"
          >
            Create Announcement
          </button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-8 text-center">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-[var(--aurora-text-secondary)]">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-[var(--aurora-text)]">{ann.title}</h4>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">{ann.message}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <ToggleSwitch enabled={ann.active} onChange={() => onToggleActive(ann.id, !ann.active)} />
                  <button onClick={() => onDeleteAnnouncement(ann.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
