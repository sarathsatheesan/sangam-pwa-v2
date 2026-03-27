// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS FORM VALIDATION
// Pure functions — no React dependency, easily unit-testable
// ═════════════════════════════════════════════════════════════════════════════════

export const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /^https?:\/\/.+\..+/;

export interface BusinessFormData {
  name: string;
  category: string;
  desc: string;
  location: string;
  phone: string;
  website: string;
  email: string;
  hours: string;
  menu: string;
  services: string;
  priceRange: string;
  yearEstablished: number;
  paymentMethods: string[];
  deliveryOptions: string[];
  specialtyTags: string[];
}

/**
 * Validates a business form and returns a map of field → error message.
 * Returns an empty object when all fields are valid.
 */
export function validateBusinessForm(formData: BusinessFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) errors.name = 'Business name is required';
  if (!formData.category) errors.category = 'Category is required';
  if (!formData.location.trim()) errors.location = 'Location is required';

  if (!formData.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!PHONE_REGEX.test(formData.phone.trim())) {
    errors.phone = 'Please enter a valid phone number';
  }

  if (!formData.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(formData.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (formData.website.trim() && !URL_REGEX.test(formData.website.trim())) {
    errors.website = 'Please enter a valid URL (e.g., https://example.com)';
  }

  return errors;
}

// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS SIGN-UP VALIDATORS (Phase 1)
// ═════════════════════════════════════════════════════════════════════════════════

/** US EIN: XX-XXXXXXX (9 digits) */
export const US_EIN_REGEX = /^\d{2}-?\d{7}$/;

/** Canada Business Number: 9 digits (base BN, or 15-char program account) */
export const CA_BN_REGEX = /^\d{9}(\s?[A-Z]{2}\s?\d{4})?$/;

/** US ZIP code: 5 digits or ZIP+4 */
export const US_ZIP_REGEX = /^\d{5}(-\d{4})?$/;

/** Canada postal code: A1A 1A1 */
export const CA_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

/**
 * Validates a US EIN (Employer Identification Number).
 * Accepts with or without the dash: "12-3456789" or "123456789".
 */
export function validateEIN(ein: string): string | null {
  const cleaned = ein.trim();
  if (!cleaned) return 'EIN is required';
  if (!US_EIN_REGEX.test(cleaned)) return 'Enter a valid EIN (XX-XXXXXXX)';
  // IRS prefix validation: first two digits must be a valid campus prefix
  const prefix = parseInt(cleaned.replace('-', '').slice(0, 2), 10);
  const validPrefixes = [
    10, 12, 20, 21, 22, 23, 24, 25, 26, 27, 30, 32, 33, 34, 35, 36, 37, 38,
    39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 55, 56, 57,
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 91, 92, 93, 94, 95, 98, 99,
  ];
  if (!validPrefixes.includes(prefix)) return 'EIN prefix is not valid';
  return null;
}

/**
 * Validates a Canadian Business Number (BN).
 * Base BN = 9 digits. Program account = 15 chars (9 digits + 2 letters + 4 digits).
 */
export function validateBN(bn: string): string | null {
  const cleaned = bn.trim().toUpperCase();
  if (!cleaned) return 'Business Number is required';
  if (!CA_BN_REGEX.test(cleaned)) return 'Enter a valid BN (9 digits or 15-char program account)';
  return null;
}

/**
 * Validates a TIN based on country.
 */
export function validateTIN(tin: string, country: 'US' | 'CA'): string | null {
  return country === 'US' ? validateEIN(tin) : validateBN(tin);
}

/**
 * Validates a postal/zip code based on country.
 */
export function validatePostalCode(code: string, country: 'US' | 'CA'): string | null {
  const cleaned = code.trim();
  if (!cleaned) return 'Postal/ZIP code is required';
  if (country === 'US') {
    return US_ZIP_REGEX.test(cleaned) ? null : 'Enter a valid ZIP code (e.g., 12345 or 12345-6789)';
  }
  return CA_POSTAL_REGEX.test(cleaned) ? null : 'Enter a valid postal code (e.g., A1A 1A1)';
}

/**
 * Validates address components from Google Places autocomplete.
 */
export function validateAddressComponents(
  components: { street: string; city: string; state: string; zip: string; country: string } | undefined,
  country: 'US' | 'CA',
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!components) {
    errors.address = 'Please select an address from the autocomplete suggestions';
    return errors;
  }
  if (!components.street.trim()) errors.street = 'Street address is required';
  if (!components.city.trim()) errors.city = 'City is required';
  if (!components.state.trim()) errors.state = country === 'US' ? 'State is required' : 'Province is required';
  const zipError = validatePostalCode(components.zip, country);
  if (zipError) errors.zip = zipError;
  return errors;
}

/**
 * Validates the business sign-up wizard (step-aware).
 * Only validates fields relevant to the given step.
 */
export function validateSignupStep(
  step: number,
  formData: Record<string, any>,
  country: 'US' | 'CA',
  enabledChecks: {
    tinRequired?: boolean;
    docUploadRequired?: boolean;
    docUploadCount?: boolean;
    photoIdRequired?: boolean;
    beneficialOwnership?: boolean;
  } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (step) {
    case 1: // Identity
      if (!formData.name?.trim()) errors.name = 'Business name is required';
      if (!formData.category) errors.category = 'Category is required';
      if (!formData.email?.trim()) {
        errors.email = 'Email is required';
      } else if (!EMAIL_REGEX.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
      if (!formData.phone?.trim()) {
        errors.phone = 'Phone number is required';
      } else if (!PHONE_REGEX.test(formData.phone.trim())) {
        errors.phone = 'Please enter a valid phone number';
      }
      if (!formData.country) errors.country = 'Country is required';
      break;

    case 2: // Location
      if (!formData.location?.trim()) errors.location = 'Business address is required';
      const addrErrors = validateAddressComponents(formData.addressComponents, country);
      Object.assign(errors, addrErrors);
      break;

    case 3: // Verification
      if (enabledChecks.tinRequired) {
        const tinErr = validateTIN(formData.tin || '', country);
        if (tinErr) errors.tin = tinErr;
      }
      if (enabledChecks.docUploadRequired) {
        const docs = formData.verificationDocs || [];
        const minDocs = enabledChecks.docUploadCount ? 2 : 1;
        if (docs.length < minDocs) {
          errors.verificationDocs = `Please upload at least ${minDocs} verification document${minDocs > 1 ? 's' : ''}`;
        }
      }
      if (enabledChecks.photoIdRequired && !formData.photoIdUploaded) {
        errors.photoId = 'Government-issued photo ID is required';
      }
      if (enabledChecks.beneficialOwnership) {
        const owners = formData.beneficialOwners || [];
        if (owners.length === 0) {
          errors.beneficialOwners = 'At least one beneficial owner is required';
        }
      }
      break;

    case 4: // Details & Photos
      // Optional fields — minimal validation
      if (formData.website?.trim() && !URL_REGEX.test(formData.website.trim())) {
        errors.website = 'Please enter a valid URL (e.g., https://example.com)';
      }
      break;

    case 5: // Review & Submit — no validation, just confirmation
      break;
  }

  return errors;
}

// ── Fuzzy search helper ──
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (t.includes(q)) return true;
  const queryWords = q.split(/\s+/);
  return queryWords.every((word) => {
    if (t.includes(word)) return true;
    if (word.length <= 3) return false;
    for (let i = 0; i < word.length; i++) {
      const shortened = word.slice(0, i) + word.slice(i + 1);
      if (t.includes(shortened)) return true;
    }
    return false;
  });
}

// ── Google Maps URL builder ──
export function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
