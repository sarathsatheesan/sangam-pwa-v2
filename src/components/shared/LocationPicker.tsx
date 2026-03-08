import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Search, ChevronDown } from 'lucide-react';
import { useLocation } from '../../contexts/LocationContext';

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'gps' | 'city' | 'zip';

export const LocationPicker: React.FC<LocationPickerProps> = ({ isOpen, onClose }) => {
  const {
    selectedLocation,
    allStates,
    citiesForState,
    setLocationByGeo,
    setLocationByZip,
    setLocationByStateCity,
    clearLocation,
  } = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>('gps');
  const [zipCode, setZipCode] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  // Update cities when state changes
  useEffect(() => {
    if (selectedState) {
      const c = citiesForState(selectedState);
      setCities(c);
      setSelectedCity('');
    } else {
      setCities([]);
      setSelectedCity('');
    }
  }, [selectedState, citiesForState]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseMyLocation = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await setLocationByGeo();
      setSuccess('Location detected successfully!');
      setTimeout(() => onClose(), 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleZipSearch = async () => {
    if (zipCode.length < 5) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const found = await setLocationByZip(zipCode);
      if (found) {
        setSuccess('Location set!');
        setTimeout(() => onClose(), 1200);
      } else {
        setError('Zip code not found. Please try another.');
      }
    } catch {
      setError('Error looking up zip code');
    } finally {
      setLoading(false);
    }
  };

  const handleStateCitySubmit = () => {
    if (!selectedState) {
      setError('Please select a state');
      return;
    }
    if (!selectedCity) {
      setError('Please select a city');
      return;
    }
    setError('');
    setLocationByStateCity(selectedState, selectedCity);
    setSuccess('Location set!');
    setTimeout(() => onClose(), 800);
  };

  const handleClearLocation = () => {
    clearLocation();
    onClose();
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'gps', label: 'Use GPS', icon: <Navigation size={16} /> },
    { key: 'zip', label: 'Zip Code', icon: <Search size={16} /> },
    { key: 'city', label: 'State/City', icon: <MapPin size={16} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] bg-aurora-surface rounded-2xl shadow-aurora-4 border border-aurora-border-glass z-50 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-aurora-border">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-aurora-mint" />
            <h2 className="text-lg font-bold text-aurora-text">Set Location</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} className="text-aurora-text-muted" />
          </button>
        </div>

        {/* Current location display */}
        {selectedLocation && (
          <div className="mx-5 mt-4 px-4 py-3 bg-aurora-indigo/10 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-aurora-indigo" />
              <span className="text-sm font-medium text-aurora-indigo-light">
                {selectedLocation.city}, {selectedLocation.stateAbbr}
                {selectedLocation.zip ? ` ${selectedLocation.zip}` : ''}
              </span>
            </div>
            <button
              onClick={handleClearLocation}
              className="text-xs text-aurora-danger hover:text-red-400 font-medium"
            >
              Clear
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mx-5 mt-4 bg-aurora-surface-variant rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(''); setSuccess(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-aurora-indigo text-white shadow-aurora-glow'
                  : 'text-aurora-text-muted hover:text-aurora-text'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-aurora-danger/10 text-aurora-danger text-sm rounded-xl border border-aurora-danger/20">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 bg-aurora-success/10 text-aurora-success text-sm rounded-xl border border-aurora-success/20">
              {success}
            </div>
          )}

          {/* GPS Tab */}
          {activeTab === 'gps' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-aurora-indigo/15 rounded-full flex items-center justify-center">
                <Navigation size={28} className="text-aurora-indigo" />
              </div>
              <div>
                <p className="text-aurora-text font-medium">Detect my location</p>
                <p className="text-sm text-aurora-text-muted mt-1">
                  We'll use your device's GPS to find your city and state
                </p>
              </div>
              <button
                onClick={handleUseMyLocation}
                disabled={loading}
                className="w-full py-3 aurora-gradient text-white rounded-xl font-semibold hover:shadow-aurora-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Navigation size={18} />
                    Use My Location
                  </>
                )}
              </button>
            </div>
          )}

          {/* Zip Code Tab */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-aurora-text-secondary mb-2">
                  Enter ZIP Code
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="e.g. 10001"
                    className="flex-1 px-4 py-3 bg-aurora-surface-variant border border-aurora-border rounded-xl text-lg tracking-wider text-center text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo focus:border-transparent placeholder:text-aurora-text-muted"
                    onKeyDown={(e) => e.key === 'Enter' && handleZipSearch()}
                  />
                  <button
                    onClick={handleZipSearch}
                    disabled={loading || zipCode.length < 5}
                    className="px-6 py-3 aurora-gradient text-white rounded-xl font-semibold hover:shadow-aurora-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Search size={20} />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-aurora-text-muted text-center">
                Enter a US zip code to find your city and state
              </p>
            </div>
          )}

          {/* State/City Tab */}
          {activeTab === 'city' && (
            <div className="space-y-4">
              {/* State selector */}
              <div>
                <label className="block text-sm font-medium text-aurora-text-secondary mb-2">State</label>
                <div className="relative">
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-4 py-3 bg-aurora-surface-variant border border-aurora-border rounded-xl appearance-none text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo focus:border-transparent"
                  >
                    <option value="">Select a state...</option>
                    {allStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted pointer-events-none" />
                </div>
              </div>

              {/* City selector */}
              <div>
                <label className="block text-sm font-medium text-aurora-text-secondary mb-2">City</label>
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    disabled={!selectedState || cities.length === 0}
                    className="w-full px-4 py-3 bg-aurora-surface-variant border border-aurora-border rounded-xl appearance-none text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!selectedState
                        ? 'Select a state first...'
                        : cities.length === 0
                        ? 'No cities available'
                        : 'Select a city...'}
                    </option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted pointer-events-none" />
                </div>
              </div>

              <button
                onClick={handleStateCitySubmit}
                disabled={!selectedState || !selectedCity}
                className="w-full py-3 aurora-gradient text-white rounded-xl font-semibold hover:shadow-aurora-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set Location
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LocationPicker;
