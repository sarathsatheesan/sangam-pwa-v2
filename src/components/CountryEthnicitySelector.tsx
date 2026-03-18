import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X, Star, Trash2 } from 'lucide-react';
import { COUNTRY_ETHNICITY_MAP } from '@/constants/config';

// Flatten all countries from all regions into a single list
const ALL_COUNTRIES = COUNTRY_ETHNICITY_MAP.flatMap((r) => r.countries);

// Quick Selection country names — shown at top for fast access
const QUICK_SELECT_NAMES = ['India', 'China', 'France', 'Hispanic or Latino'];
const QUICK_SELECT_COUNTRIES = QUICK_SELECT_NAMES
  .map((name) => ALL_COUNTRIES.find((c) => c.name === name))
  .filter(Boolean) as { name: string; ethnicities: string[] }[];

// Remaining countries (everything not in quick select)
const REMAINING_COUNTRIES = ALL_COUNTRIES.filter(
  (c) => !QUICK_SELECT_NAMES.includes(c.name)
);

const PREFER_NOT_TO_SAY = 'Prefer not to say';

/**
 * Build a country-scoped key: "Country - Ethnicity"
 * Ensures duplicate ethnicity names (e.g. Punjabi under India vs Pakistan)
 * are stored as unique values.
 */
const scopedKey = (country: string, ethnicity: string) => `${country} - ${ethnicity}`;

interface CountryEthnicitySelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  maxHeight?: string;
}

/** Renders a single country row with expandable sub-ethnicities */
const CountryRow: React.FC<{
  country: { name: string; ethnicities: string[] };
  selected: string[];
  isExpanded: boolean;
  isPreferNotSelected: boolean;
  onToggleExpand: (name: string) => void;
  onCountryCheck: (name: string) => void;
  onToggleEthnicity: (key: string) => void;
}> = ({ country, selected, isExpanded, isPreferNotSelected, onToggleExpand, onCountryCheck, onToggleEthnicity }) => {
  const hasSubCategories = country.ethnicities.length > 0;
  const selectedCount = country.ethnicities.filter((eth) =>
    selected.includes(scopedKey(country.name, eth))
  ).length;
  const hasAnySelected = selectedCount > 0;
  const allSelected = hasSubCategories && selectedCount === country.ethnicities.length;

  return (
    <div className="border-b border-aurora-border last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-aurora-surface-variant transition-colors">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = hasAnySelected && !allSelected;
          }}
          onChange={() => onCountryCheck(country.name)}
          disabled={isPreferNotSelected}
          className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => onToggleExpand(country.name)}
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <span className={`text-sm font-semibold truncate text-left ${isPreferNotSelected ? 'text-aurora-text-muted' : 'text-aurora-text'}`}>
            {country.name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasAnySelected && (
              <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
            {hasSubCategories && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        </button>
      </div>

      {isExpanded && hasSubCategories && (
        <div className="bg-aurora-surface-variant/20 pb-1">
          {country.ethnicities.map((ethnicity) => {
            const key = scopedKey(country.name, ethnicity);
            return (
              <label
                key={key}
                className="flex items-center gap-3 pl-10 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => onToggleEthnicity(key)}
                  disabled={isPreferNotSelected}
                  className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                />
                <span className={`${isPreferNotSelected ? 'text-aurora-text-muted' : 'text-aurora-text'}`}>
                  {ethnicity}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CountryEthnicitySelector: React.FC<CountryEthnicitySelectorProps> = ({
  selected,
  onChange,
  maxHeight = '360px',
}) => {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  const handleCountryCheck = (countryName: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      next.add(countryName);
      return next;
    });
  };

  const toggleEthnicity = (key: string) => {
    if (!selected.includes(key) && selected.includes(PREFER_NOT_TO_SAY)) {
      onChange([...selected.filter((s) => s !== PREFER_NOT_TO_SAY), key]);
      return;
    }
    onChange(
      selected.includes(key)
        ? selected.filter((s) => s !== key)
        : [...selected, key]
    );
  };

  const togglePreferNot = () => {
    if (selected.includes(PREFER_NOT_TO_SAY)) {
      onChange(selected.filter((s) => s !== PREFER_NOT_TO_SAY));
    } else {
      onChange([PREFER_NOT_TO_SAY]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setExpandedCountries(new Set());
  };

  const removeTag = (value: string) => {
    onChange(selected.filter((s) => s !== value));
  };

  // Search filtering — applies to remaining countries only (quick select always visible unless searching)
  const query = searchQuery.toLowerCase().trim();

  const filteredRemaining = useMemo(() => {
    if (!query) return REMAINING_COUNTRIES;
    return REMAINING_COUNTRIES
      .map((country) => {
        const countryMatch = country.name.toLowerCase().includes(query);
        const matchingEthnicities = country.ethnicities.filter((e) =>
          e.toLowerCase().includes(query)
        );
        if (countryMatch) return country;
        if (matchingEthnicities.length > 0) return { ...country, ethnicities: matchingEthnicities };
        return null;
      })
      .filter(Boolean) as { name: string; ethnicities: string[] }[];
  }, [query]);

  const filteredQuickSelect = useMemo(() => {
    if (!query) return QUICK_SELECT_COUNTRIES;
    return QUICK_SELECT_COUNTRIES
      .map((country) => {
        const countryMatch = country.name.toLowerCase().includes(query);
        const matchingEthnicities = country.ethnicities.filter((e) =>
          e.toLowerCase().includes(query)
        );
        if (countryMatch) return country;
        if (matchingEthnicities.length > 0) return { ...country, ethnicities: matchingEthnicities };
        return null;
      })
      .filter(Boolean) as { name: string; ethnicities: string[] }[];
  }, [query]);

  // Auto-expand countries when searching
  const effectiveExpanded = query
    ? new Set([...filteredQuickSelect, ...filteredRemaining].map((c) => c.name))
    : expandedCountries;

  const isPreferNotSelected = selected.includes(PREFER_NOT_TO_SAY);
  const hasSelections = selected.length > 0;

  return (
    <div>
      {/* Selected tags + Clear all */}
      {hasSelections && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">
              Selected ({selected.length})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={10} />
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => removeTag(item)}
                className="px-2.5 py-1 bg-aurora-indigo text-white rounded-full text-xs font-medium flex items-center gap-1 hover:bg-aurora-indigo/80 transition-colors"
              >
                {item} <X size={10} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aurora-text-muted" />
        <input
          type="text"
          placeholder="Search country or ethnicity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 border border-aurora-border rounded-xl text-sm text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 bg-transparent"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Main scrollable area */}
      <div
        className="border border-aurora-border rounded-xl overflow-y-auto"
        style={{ maxHeight }}
      >
        {/* Quick Selection */}
        {filteredQuickSelect.length > 0 && (
          <>
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-aurora-border flex items-center gap-1.5">
              <Star size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Quick Selection</span>
            </div>
            {filteredQuickSelect.map((country) => (
              <CountryRow
                key={`qs-${country.name}`}
                country={country}
                selected={selected}
                isExpanded={effectiveExpanded.has(country.name)}
                isPreferNotSelected={isPreferNotSelected}
                onToggleExpand={toggleExpand}
                onCountryCheck={handleCountryCheck}
                onToggleEthnicity={toggleEthnicity}
              />
            ))}
          </>
        )}

        {/* Divider between quick select and all countries */}
        {filteredQuickSelect.length > 0 && filteredRemaining.length > 0 && !query && (
          <div className="px-4 py-2 bg-aurora-surface-variant/30 border-b border-t border-aurora-border flex items-center gap-2">
            <div className="flex-1 border-t border-dashed border-aurora-border" />
            <span className="text-[10px] font-bold text-aurora-text-muted uppercase tracking-wider">All Countries</span>
            <div className="flex-1 border-t border-dashed border-aurora-border" />
          </div>
        )}

        {/* All remaining countries */}
        {filteredRemaining.length === 0 && filteredQuickSelect.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-aurora-text-muted">
            {query ? <>No results for &ldquo;{searchQuery}&rdquo;</> : 'No countries available'}
          </div>
        )}

        {filteredRemaining.map((country) => (
          <CountryRow
            key={country.name}
            country={country}
            selected={selected}
            isExpanded={effectiveExpanded.has(country.name)}
            isPreferNotSelected={isPreferNotSelected}
            onToggleExpand={toggleExpand}
            onCountryCheck={handleCountryCheck}
            onToggleEthnicity={toggleEthnicity}
          />
        ))}

        {/* Prefer not to say — always at bottom */}
        {!query && (
          <div className="border-t border-aurora-border">
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm">
              <input
                type="checkbox"
                checked={isPreferNotSelected}
                onChange={togglePreferNot}
                className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
              />
              <span className="text-aurora-text font-medium">Prefer not to say</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryEthnicitySelector;
