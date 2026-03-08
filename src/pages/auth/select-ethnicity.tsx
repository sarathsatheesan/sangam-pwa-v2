import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ETHNICITY_OPTIONS } from '../../constants/config';
import { fuzzySearch, suggestEthnicity, formatCustomEthnicity } from '../../utils/fuzzySearch';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

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

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return ETHNICITY_OPTIONS.map((item) => ({
        id: item,
        label: item,
        isCustom: false,
      }));
    }

    const results = fuzzySearch(searchQuery, ETHNICITY_OPTIONS);
    return results.map((item) => ({
      id: item,
      label: item,
      isCustom: false,
    }));
  }, [searchQuery]);

  const suggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) {
      return [];
    }
    return suggestEthnicity(searchQuery);
  }, [searchQuery]);

  const shouldShowCustom = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) return false;

    const exactMatch = ETHNICITY_OPTIONS.some(
      (item) => item.toLowerCase() === trimmedQuery.toLowerCase()
    );

    return !exactMatch;
  }, [searchQuery]);

  const displayList: EthnicityItem[] = useMemo(() => {
    const list = [...filteredOptions];

    if (shouldShowCustom) {
      const customLabel = formatCustomEthnicity(searchQuery);
      list.push({
        id: customLabel,
        label: customLabel,
        isCustom: true,
      });
    }

    return list;
  }, [filteredOptions, shouldShowCustom, searchQuery]);

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
        {displayList.length > 0 ? (
          <div className="space-y-1">
            {displayList.map((item) => {
              const isSelected = selectedEthnicity.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectEthnicity(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-aurora-indigo/10 border-aurora-indigo text-aurora-indigo font-semibold'
                      : 'bg-aurora-surface border-aurora-border text-aurora-text hover:border-aurora-indigo'
                  } ${item.isCustom ? 'border-dashed border-[#EA580C]' : ''}`}
                >
                  <span>
                    {item.isCustom && '+ Add: '}
                    {item.label}
                  </span>
                  {isSelected && <span className="text-lg font-bold">✓</span>}
                </button>
              );
            })}
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
