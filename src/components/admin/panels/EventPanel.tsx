import React from 'react';
import { Search, Calendar, EyeOff, Eye, Trash2, Sparkles } from 'lucide-react';
import type { EventRecord } from '@/types/admin';
import { SkeletonRow } from '@/components/admin';

interface EventPanelProps {
  loading: boolean;
  filteredAdminEvents: EventRecord[];
  eventSearch: string;
  onEventSearchChange: (search: string) => void;
  eventFilter: 'all' | 'promoted' | 'disabled' | 'past';
  onEventFilterChange: (filter: 'all' | 'promoted' | 'disabled' | 'past') => void;
  onTogglePromote: (event: EventRecord) => void;
  onToggleDisable: (event: EventRecord) => void;
  onDeleteEvent: (event: EventRecord) => void;
}

export function EventPanel({
  loading,
  filteredAdminEvents,
  eventSearch,
  onEventSearchChange,
  eventFilter,
  onEventFilterChange,
  onTogglePromote,
  onToggleDisable,
  onDeleteEvent,
}: EventPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Events</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Manage events, promotions, and visibility</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-secondary)]" />
          <input
            type="text"
            placeholder="Search events..."
            value={eventSearch}
            onChange={(e) => onEventSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'promoted', 'disabled', 'past'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onEventFilterChange(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                eventFilter === f
                  ? 'bg-[#FF3008] text-white shadow-md'
                  : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-variant)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)]">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filteredAdminEvents.length === 0 ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16 text-[var(--aurora-text-secondary)]">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>No events found</p>
        </div>
      ) : (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)] overflow-hidden">
          {filteredAdminEvents.map((evt) => {
            const isPast = (() => { try { return new Date(evt.fullDate) < new Date(); } catch { return false; } })();
            return (
              <div key={evt.id} className={`flex items-center gap-4 p-4 hover:bg-[var(--aurora-surface-variant)]/50 transition ${evt.isDisabled ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-[var(--aurora-surface-variant)] flex items-center justify-center flex-shrink-0 relative">
                  <Calendar size={16} className="text-orange-500" />
                  {evt.isDisabled && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                      <EyeOff size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm truncate ${evt.isDisabled ? 'text-[var(--aurora-text-secondary)] line-through' : 'text-[var(--aurora-text)]'}`}>{evt.title}</p>
                    {evt.promoted && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 flex items-center gap-0.5">
                        <Sparkles size={8} /> Featured
                      </span>
                    )}
                    {evt.isDisabled && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                        Disabled
                      </span>
                    )}
                    {isPast && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400">
                        Past
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--aurora-text-secondary)]">
                    By {evt.posterName} · {evt.type} · {evt.fullDate}{evt.location ? ` · ${evt.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onTogglePromote(evt)}
                    className={`p-2 rounded-lg transition ${evt.promoted ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                    title={evt.promoted ? 'Unfeature event' : 'Feature event'}
                  >
                    <Sparkles size={16} />
                  </button>
                  <button
                    onClick={() => onToggleDisable(evt)}
                    className={`p-2 rounded-lg transition ${evt.isDisabled ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                    title={evt.isDisabled ? 'Enable event' : 'Disable event'}
                  >
                    {evt.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => onDeleteEvent(evt)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    title="Delete event"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
