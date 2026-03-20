import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Star, Trash2, Globe } from 'lucide-react';
import { COUNTRY_ETHNICITY_MAP } from '@/constants/config';

// Flatten all countries
const ALL_COUNTRIES = COUNTRY_ETHNICITY_MAP.flatMap((r) => r.countries);

// Quick Selection countries
const QUICK_SELECT_NAMES = ['India', 'China', 'France', 'Hispanic or Latino'];
const QUICK_SELECT_COUNTRIES = QUICK_SELECT_NAMES
  .map((name) => ALL_COUNTRIES.find((c) => c.name === name))
  .filter(Boolean) as { name: string; ethnicities: string[] }[];
const REMAINING_COUNTRIES = ALL_COUNTRIES.filter(
  (c) => !QUICK_SELECT_NAMES.includes(c.name)
);

const PREFER_NOT_TO_SAY = 'Prefer not to say';
const scopedKey = (country: string, ethnicity: string) => `${country} - ${ethnicity}`;

interface EthnicityFilterDropdownProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** Single country row in the filter dropdown */
const FilterCountryRow: React.FC<{
  country: { name: string; ethnicities: string[] };
  selected: string[];
  isExpanded: boolean;
  onToggleExpand: (name: string) => void;
  onCountryCheck: (name: string) => void;
  onToggleEthnicity: (key: string) => void;
}> = ({ country, selected, isExpanded, onToggleExpand, onCountryCheck, onToggleEthnicity }) => {
  const hasSubCategories = country.ethnicities.length > 0;
  const selectedCount = country.ethnicities.filter((eth) =>
    selected.includes(scopedKey(country.name, eth))
  ).length;
  const hasAnySelected = selectedCount > 0;
  const allSelected = hasSubCategories && selectedCount === country.ethnicities.length;

  return (
    <div className="border-b border-aurora-border/50 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-aurora-surface-variant transition-colors">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = hasAnySelected && !allSelected;
          }}
          onChange={() => onCountryCheck(country.name)}
          className="w-3.5 h-3.5 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => onToggleExpand(country.name)}
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <span className="text-xs font-semibold text-aurora-text truncate text-left">
            {country.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {hasAnySelected && (
              <span className="text-[9px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
            {hasSubCategories && (
              <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </button>
      </div>

      {isExpanded && hasSubCategories && (
        <div className="bg-aurora-surface-variant/20 pb-0.5">
          {country.ethnicities.map((ethnicity) => {
            const key = scopedKey(country.name, ethnicity);
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 pl-8 pr-3 py-1 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-xs"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => onToggleEthnicity(key)}
                  className="w-3.5 h-3.5 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                />
                <span className="text-aurora-text">{ethnicity}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EthnicityFilterDropdown: React.FC<EthnicityFilterDropdownProps> = ({
  selected,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const toggleExpand = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  const handleCountryCheck = (countryName: string) => {
    // Find the country's ethnicities
    const country = ALL_COUNTRIES.find((c) => c.name === countryName);
    if (!country || country.ethnicities.length === 0) return;

    const allKeys = country.ethnicities.map((eth) => scopedKey(countryName, eth));
    const allSelected = allKeys.every((k) => selected.includes(k));

    if (allSelected) {
      // Deselect all sub-ethnicities for this country
      onChange(selected.filter((s) => !allKeys.includes(s)));
    } else {
      // Select all sub-ethnicities for this country
      const toAdd = allKeys.filter((k) => !selected.includes(k));
      onChange([...selected, ...toAdd]);
    }

    // Also expand so user can see what was selected
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      next.add(countryName);
      return next;
    });
  };

  const toggleEthnicity = (key: string) => {
    onChange(
      selected.includes(key)
        ? selected.filter((s) => s !== key)
        : [...selected, key]
    );
  };

  const clearAll = () => {
    onChange([]);
    setExpandedCountries(new Set());
  };

  const query = searchQuery.toLowerCase().trim();

  const filteredQuickSelect = useMemo(() => {
    if (!query) return QUICK_SELECT_COUNTRIES;
    return QUICK_SELECT_COUNTRIES
      .map((country) => {
        const countryMatch = country.name.toLowerCase().includes(query);
        const matchingEthnicities = country.ethnicities.filter((e) => e.toLowerCase().includes(query));
        if (countryMatch) return country;
        if (matchingEthnicities.length > 0) return { ...country, ethnicities: matchingEthnicities };
        return null;
      })
      .filter(Boolean) as { name: string; ethnicities: string[] }[];
  }, [query]);

  const filteredRemaining = useMemo(() => {
    if (!query) return REMAINING_COUNTRIES;
    return REMAINING_COUNTRIES
      .map((country) => {
        const countryMatch = country.name.toLowerCase().includes(query);
        const matchingEthnicities = country.ethnicities.filter((e) => e.toLowerCase().includes(query));
        if (countryMatch) return country;
        if (matchingEthnicities.length > 0) return { ...country, ethnicities: matchingEthnicities };
        return null;
      })
      .filter(Boolean) as { name: string; ethnicities: string[] }[];
  }, [query]);

  const effectiveExpanded = query
    ? new Set([...filteredQuickSelect, ...filteredRemaining].map((c) => c.name))
    : expandedCountries;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
          selected.length > 0
            ? 'bg-aurora-indigo/10 border-aurora-indigo text-aurora-indigo'
            : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:bg-aurora-surface-variant'
        }`}
      >
        <Globe size={12} />
        <span>EthniZity</span>
        {selected.length > 0 && (
          <span className="bg-aurora-indigo text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {selected.length}
          </span>
        )}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header with clear */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-b border-aurora-border flex items-center justify-between">
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
          )}

          {/* Selected tags */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-b border-aurora-border flex flex-wrap gap-1">
              {selected.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onChange(selected.filter((s) => s !== item))}
                  className="px-2 py-0.5 bg-aurora-indigo text-white rounded-full text-[10px] font-medium flex items-center gap-0.5 hover:bg-aurora-indigo/80 transition-colors"
                >
                  {item} <X size={8} />
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2 border-b border-aurora-border">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-7 py-1.5 border border-aurora-border rounded-lg text-xs text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40 bg-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="max-h-64 overflow-y-auto">
            {/* Quick Selection */}
            {filteredQuickSelect.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border-b border-aurora-border/50 flex items-center gap-1">
                  <Star size={10} className="text-amber-500" />
                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Quick Selection</span>
                </div>
                {filteredQuickSelect.map((country) => (
                  <FilterCountryRow
                    key={`qs-${country.name}`}
                    country={country}
                    selected={selected}
                    isExpanded={effectiveExpanded.has(country.name)}
                    onToggleExpand={toggleExpand}
                    onCountryCheck={handleCountryCheck}
                    onToggleEthnicity={toggleEthnicity}
                  />
                ))}
              </>
            )}

            {/* Divider */}
            {filteredQuickSelect.length > 0 && filteredRemaining.length > 0 && !query && (
              <div className="px-3 py-1.5 bg-aurora-surface-variant/30 border-b border-t border-aurora-border/50 flex items-center gap-2">
                <div className="flex-1 border-t border-dashed border-aurora-border" />
                <span className="text-[9px] font-bold text-aurora-text-muted uppercase tracking-wider">All Countries</span>
                <div className="flex-1 border-t border-dashed border-aurora-border" />
              </div>
            )}

            {/* All remaining countries */}
            {filteredRemaining.length === 0 && filteredQuickSelect.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-aurora-text-muted">
                {query ? <>No results for &ldquo;{searchQuery}&rdquo;</> : 'No countries available'}
              </div>
            )}

            {filteredRemaining.map((country) => (
              <FilterCountryRow
                key={country.name}
                country={country}
                selected={selected}
                isExpanded={effectiveExpanded.has(country.name)}
                onToggleExpand={toggleExpand}
                onCountryCheck={handleCountryCheck}
                onToggleEthnicity={toggleEthnicity}
              />
            ))}

            {/* Prefer not to say */}
            {!query && (
              <div className="border-t border-aurora-border">
                <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(PREFER_NOT_TO_SAY)}
                    onChange={() => {
                      if (selected.includes(PREFER_NOT_TO_SAY)) {
                        onChange(selected.filter((s) => s !== PREFER_NOT_TO_SAY));
                      } else {
                        onChange([PREFER_NOT_TO_SAY]);
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                  />
                  <span className="text-aurora-text font-medium">Prefer not to say</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EthnicityFilterDropdown;
