import React from 'react';
import { Search, ClipboardList, Eye, EyeOff, Trash2, BadgeCheck } from 'lucide-react';
import type { Listing } from '@/types/admin';
import { SkeletonRow } from '@/components/admin';

interface ListingPanelProps {
  loading: boolean;
  filteredListings: Listing[];
  listingSearch: string;
  onListingSearchChange: (search: string) => void;
  listingFilter: 'all' | 'business' | 'housing' | 'travel' | 'disabled';
  onListingFilterChange: (filter: 'all' | 'business' | 'housing' | 'travel' | 'disabled') => void;
  sourceIcon: (source: string) => React.ReactNode;
  sourceLabel: (source: string) => string;
  onToggleVerify: (listing: Listing) => void;
  onToggleDisable: (listing: Listing) => void;
  onDeleteListing: (listing: Listing) => void;
}

export function ListingPanel({
  loading,
  filteredListings,
  listingSearch,
  onListingSearchChange,
  listingFilter,
  onListingFilterChange,
  sourceIcon,
  sourceLabel,
  onToggleVerify,
  onToggleDisable,
  onDeleteListing,
}: ListingPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Listings</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Manage businesses, housing, and travel posts</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-secondary)]" />
          <input
            type="text"
            placeholder="Search listings..."
            value={listingSearch}
            onChange={(e) => onListingSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'business', 'housing', 'travel', 'disabled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onListingFilterChange(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                listingFilter === f
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
      ) : filteredListings.length === 0 ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16 text-[var(--aurora-text-secondary)]">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>No listings found</p>
        </div>
      ) : (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)] overflow-hidden">
          {filteredListings.map((listing) => (
            <div key={listing.id} className={`flex items-center gap-4 p-4 hover:bg-[var(--aurora-surface-variant)]/50 transition ${listing.isDisabled ? 'opacity-60' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-[var(--aurora-surface-variant)] flex items-center justify-center flex-shrink-0 relative">
                {sourceIcon(listing.source)}
                {listing.isDisabled && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                    <EyeOff size={10} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold text-sm truncate ${listing.isDisabled ? 'text-[var(--aurora-text-secondary)] line-through' : 'text-[var(--aurora-text)]'}`}>{listing.title}</p>
                  {listing.source === 'business' && listing.verified && (
                    <BadgeCheck size={14} className="flex-shrink-0 text-blue-500" />
                  )}
                  {listing.isDisabled && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--aurora-text-secondary)]">
                  By {listing.posterName} · {listing.type}
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)]">
                {sourceIcon(listing.source)}
                {sourceLabel(listing.source)}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {listing.source === 'business' && (
                  <button
                    onClick={() => onToggleVerify(listing)}
                    className={`p-2 rounded-lg transition ${listing.verified ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                    title={listing.verified ? 'Remove verification' : 'Verify business'}
                  >
                    <BadgeCheck size={16} />
                  </button>
                )}
                <button
                  onClick={() => onToggleDisable(listing)}
                  className={`p-2 rounded-lg transition ${listing.isDisabled ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                  title={listing.isDisabled ? 'Enable listing' : 'Disable listing'}
                >
                  {listing.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => onDeleteListing(listing)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  title="Delete listing"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
