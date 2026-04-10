// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS REGISTRATION PAGE
// Route: /business/register
// Two modes:
//   1. Wizard mode: full 5-step registration when business_signup_enabled is ON
//   2. Disabled state: shows message + Browse Businesses link when flag is OFF
// Both modes are cross-browser safe (no non-existent CSS vars).
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBusinessSwitcher } from '../../contexts/BusinessSwitcherContext';
import BusinessRegistrationWizard from '../../components/business/registration/BusinessRegistrationWizard';

const BusinessRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatureSettings();
  const { userProfile } = useAuth();
  const { businesses } = useBusinessSwitcher();

  // Gate: if business signup is disabled, show disabled state
  if (!isFeatureEnabled('business_signup_enabled')) {
    const isExistingVendor = businesses.length > 0 || userProfile?.accountType === 'business';
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-4">🏪</div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: 'var(--aurora-text, #1a1a2e)' }}
        >
          Business Registration
        </h2>
        <p
          className="text-sm mb-6 max-w-sm"
          style={{ color: 'var(--aurora-text-secondary, #6b7280)' }}
        >
          {isExistingVendor
            ? 'The registration wizard is currently disabled. You can still manage your existing businesses from Settings or your Vendor dashboard.'
            : 'Business registration is not currently available. Please check back later or contact support.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/business')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{
              backgroundColor: '#6366F1',
              minHeight: '44px',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            Browse Businesses
          </button>
          {isExistingVendor && (
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                color: '#6366F1',
                minHeight: '44px',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              My Businesses
            </button>
          )}
        </div>
      </div>
    );
  }

  return <BusinessRegistrationWizard />;
};

export default BusinessRegisterPage;
