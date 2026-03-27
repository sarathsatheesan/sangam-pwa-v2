// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS REGISTRATION PAGE
// Route: /business/register
// Gates on business_signup_enabled feature flag, renders the 5-step wizard.
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import BusinessRegistrationWizard from '../../components/business/registration/BusinessRegistrationWizard';

const BusinessRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatureSettings();

  // Gate: if business signup is disabled, show disabled state
  if (!isFeatureEnabled('business_signup_enabled')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-4">🏪</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--aurora-text-primary)' }}>
          Business Registration
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--aurora-text-secondary)' }}>
          Business registration is not currently available. Please check back later or contact support.
        </p>
        <button
          onClick={() => navigate('/business')}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--aurora-accent)' }}
        >
          Browse Businesses
        </button>
      </div>
    );
  }

  return <BusinessRegistrationWizard />;
};

export default BusinessRegisterPage;
