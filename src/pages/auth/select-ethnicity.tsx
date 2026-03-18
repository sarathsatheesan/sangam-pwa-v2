import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountryEthnicitySelector from '@/components/CountryEthnicitySelector';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export const SelectEthnicityPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedEthnicity, setSelectedEthnicity] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* Ethnicity Selector */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 pb-6">
        <CountryEthnicitySelector
          selected={selectedEthnicity}
          onChange={setSelectedEthnicity}
          maxHeight="calc(100vh - 280px)"
        />
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
