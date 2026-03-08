import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ETHNICITY_HIERARCHY } from '../../constants/config';
import { fuzzySearch, suggestEthnicity, formatCustomEthnicity } from '../../utils/fuzzySearch';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { ChevronDown } from 'lucide-react';

interface EthnicityItem {
  id: string;
  label: string;
  isCustom?: boolean;
}

export const SelectEthnicityPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEthnicity, setSelectedEthnicity] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedSubregions, setExpandedSubregions] = useState<Set<string>>(new Set());

  const flatEthnicityList = useMemo(() => {
    return ETHNICITY_HIERARCHY.flatMap(g => g.subregions.flatMap(s => s.ethnicities));
  }, []);

  const filteredGroups = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    if (!trimmedQuery) {
      return ETHNICITY_HIERARCHY;
    }

    const results = fuzzySearch(trimmedQuery, flatEthnicityList);
    const resultSet = new Set(results);

    return ETHNICITY_HIERARCHY
      .map(group => ({
        ...group,
        subregions: group.subregions
          .map(sub => ({
            ...sub,
            ethnicities: sub.ethnicities.filter(eth => resultSet.has(eth))
          }))
          .filter(sub => sub.ethnicities.length > 0)
      }))
      .filter(group => group.subregions.length > 0);
  }, [searchQuery, flatEthnicityList]);

  const suggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) {
      return [];
    }
    return suggestEthnicity(searchQuery);
  }, [searchQuery]);

  const shouldShowCustom = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) return false;

    const exactMatch = flatEthnicityList.some(
      (item) => item.toLowerCase() === trimmedQuery.toLowerCase()
    );

    return !exactMatch;
  }, [searchQuery, flatEthnicityList]);

  const toggleEthnicity = useCallback((ethnicity: string) => {
    setSelectedEthnicity((prev) =>
      prev.includes(ethnicity)
        ? prev.filter((item) => item !== ethnicity)
        : [...prev, ethnicity]
    );
    setError(null);
  }, []);

  const handleSelectEthnicity = useCallback(
    (ethnicity: string) => {
      toggleEthnicity(ethnicity);
    },
    [toggleEthnicity]
  );

  const handleSuggestedEthnicity = useCallback(
    (suggestion: string) => {
      setSearchQuery('');
      toggleEthnicity(suggestion);
    },
    [toggleEthnicity]
  );

  const handleContinue = async () => {
    if (selectedEthnicity.length === 0) {
      setError('Please select at least one heritage');
      return;
    }

    if (!auth.currentUser) {
      setError('User not authenticated. Please log in again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        heritage: selectedEthnicity,
        updatedAt: serverTimestamp(),
      });

      navigate('/feed');
    } catch (err) {
      console.error('Error updating heritage:', err);
      setError('Failed to save your selection. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/feed');
  };

  return (
    <div className="min-h-screen bg-aurora-surface-variant flex flex-col">
      {/* Header */}
      <div className="bg-aurora-indigo text-white pt-12 pb-8 rounded-b-3xl">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-2">Select Your Heritage</h1>
          <p className="text-aurora-indigo-light">Help us personalize your experience</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-2xl w-full mx-auto px-6 py-6">
        <input
          type="text"
          placeholder="Search ethnicity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          maxLength={50}
          disabled={isLoading}
          className="w-full px-4 py-3 border-2 border-aurora-border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo focus:border-transparent"
        />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="max-w-2xl w-full mx-auto px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={`suggestion_${index}`}
                onClick={() => handleSuggestedEthnicity(suggestion)}
                className="px-4 py-2 bg-aurora-danger/10 border-2 border-[#EA580C] text-aurora-warning rounded-full font-semibold hover:bg-aurora-danger/15 transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ethnicity List */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 pb-6 overflow-y-auto">
        {filteredGroups.length > 0 || shouldShowCustom ? (
          <div className="space-y-1 border border-aurora-border rounded-xl">
            {filteredGroups.map((group) => {
              const isRegionExpanded = expandedRegions.has(group.region) || searchQuery.trim().length > 0;
              const selectedInRegion = group.subregions.reduce((sum, sub) => sum + sub.ethnicities.filter((e) => selectedEthnicity.includes(e)).length, 0);

              return (
                <div key={group.region} className="border-b border-aurora-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpandedRegions((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.region)) next.delete(group.region);
                      else next.add(group.region);
                      return next;
                    })}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
                  >
                    <span className="text-xs font-bold text-aurora-text">{group.region}</span>
                    <div className="flex items-center gap-1.5">
                      {selectedInRegion > 0 && (
                        <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInRegion}</span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isRegionExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isRegionExpanded && (
                    <div className="bg-aurora-surface-variant/20">
                      {group.subregions.map((sub) => {
                        const isSubExpanded = expandedSubregions.has(sub.name);
                        const selectedInSub = sub.ethnicities.filter((e) => selectedEthnicity.includes(e)).length;
                        return (
                          <div key={sub.name}>
                            <button
                              type="button"
                              onClick={() => setExpandedSubregions((prev) => {
                                const next = new Set(prev);
                                if (next.has(sub.name)) next.delete(sub.name);
                                else next.add(sub.name);
                                return next;
                              })}
                              className="w-full pl-8 pr-4 py-2 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
                            >
                              <span className="text-xs font-semibold text-aurora-text-secondary">{sub.name}</span>
                              <div className="flex items-center gap-1.5">
                                {selectedInSub > 0 && (
                                  <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInSub}</span>
                                )}
                                <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                            {isSubExpanded && (
                              <div className="bg-aurora-surface-variant/30">
                                {sub.ethnicities.map((eth) => {
                                  const isSelected = selectedEthnicity.includes(eth);
                                  return (
                                    <label key={eth} className="flex items-center gap-3 pl-12 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleSelectEthnicity(eth)}
                                        className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                                      />
                                      <span className="text-aurora-text">{eth}</span>
                                      {isSelected && <span className="ml-auto text-lg font-bold">✓</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {shouldShowCustom && (
              <button
                onClick={() => handleSuggestedEthnicity(formatCustomEthnicity(searchQuery))}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-dashed border-[#EA580C] bg-aurora-danger/10 text-aurora-warning font-semibold transition hover:bg-aurora-danger/15"
              >
                + Add: {formatCustomEthnicity(searchQuery)}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-aurora-text-secondary font-semibold mb-2">No matching heritage found</p>
            {searchQuery.trim().length > 0 && (
              <p className="text-aurora-text-muted text-sm">
                Try different keywords or add as custom
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-2xl w-full mx-auto px-6 pb-4">
          <div className="bg-aurora-danger/10 border-2 border-red-300 rounded-xl p-3">
            <p className="text-aurora-danger text-sm font-semibold">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="max-w-2xl w-full mx-auto px-6 py-6 border-t border-aurora-border bg-aurora-surface">
        <button
          onClick={handleContinue}
          disabled={selectedEthnicity.length === 0 || isLoading}
          className={`w-full py-3 rounded-xl font-semibold transition mb-3 ${
            selectedEthnicity.length === 0 || isLoading
              ? 'bg-gray-200 text-aurora-text-secondary cursor-not-allowed'
              : 'bg-aurora-indigo text-white hover:bg-blue-800'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </span>
          ) : (
            `Continue ${selectedEthnicity.length > 0 ? `(${selectedEthnicity.length} selected)` : ''}`
          )}
        </button>

        <button
          onClick={handleSkip}
          disabled={isLoading}
          className="w-full text-aurora-warning font-semibold hover:underline py-3 disabled:text-aurora-text-muted"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};
