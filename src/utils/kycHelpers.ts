// ═════════════════════════════════════════════════════════════════════════════════
// KYC HELPERS — Feature-flag-aware utilities for Business Sign-Up & KYC
// Centralizes enabled-check logic so signup.tsx and admin pages stay clean.
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * Determine which KYC checks are enabled based on feature flags.
 * Pass the `isFeatureEnabled` function from FeatureSettingsContext.
 */
export interface KycEnabledChecks {
  signupEnabled: boolean;
  tinRequired: boolean;
  tinServerValidation: boolean;
  docUploadRequired: boolean;
  requireTwoDocs: boolean;
  sosLookup: boolean;
  photoIdRequired: boolean;
  beneficialOwnership: boolean;
  identityVerification: boolean;
  adminReviewRequired: boolean;
}

export function getKycEnabledChecks(
  isFeatureEnabled: (key: string) => boolean,
): KycEnabledChecks {
  return {
    signupEnabled: isFeatureEnabled('business_signup_enabled'),
    tinRequired: isFeatureEnabled('business_tin_required'),
    tinServerValidation: isFeatureEnabled('business_tin_validation'),
    docUploadRequired: isFeatureEnabled('business_doc_upload_required'),
    requireTwoDocs: isFeatureEnabled('business_doc_upload_count'),
    sosLookup: isFeatureEnabled('business_sos_lookup'),
    photoIdRequired: isFeatureEnabled('business_photo_id_required'),
    beneficialOwnership: isFeatureEnabled('business_beneficial_ownership'),
    identityVerification: isFeatureEnabled('business_identity_verification'),
    adminReviewRequired: isFeatureEnabled('business_admin_review_required'),
  };
}

/**
 * Returns true if ANY KYC verification step is enabled,
 * meaning business signup should show a KYC step.
 */
export function hasAnyKycStep(checks: KycEnabledChecks): boolean {
  return (
    checks.docUploadRequired ||
    checks.photoIdRequired ||
    checks.beneficialOwnership ||
    checks.sosLookup ||
    checks.identityVerification
  );
}

/**
 * US States for State of Incorporation dropdown
 */
export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

/**
 * Canadian Provinces for Province of Incorporation dropdown
 */
export const CA_PROVINCES = [
  'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador',
  'Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island',
  'Quebec','Saskatchewan','Yukon',
];
