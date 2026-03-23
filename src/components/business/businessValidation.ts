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
