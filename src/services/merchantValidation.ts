/**
 * Merchant TIN/EIN Validation Service
 *
 * Validates business EIN numbers using a multi-layer approach:
 * 1. Format validation (9 digits, valid IRS prefix)
 * 2. ProPublica Nonprofit Explorer API (free, no key — covers tax-exempt orgs)
 * 3. Business name consistency check
 * 4. Clear messaging about what was verified and what requires admin review
 */

export interface TINValidationResult {
  isValid: boolean;
  confidence: number; // 0-100
  message: string;
  flags: string[];
  checkedAt: string;
  verificationMethod?: string;
  entityName?: string; // Name found in public records, if any
}

// Common invalid/test TIN patterns
const INVALID_PATTERNS = [
  /^0{2,}/,            // Starting with multiple zeros
  /^1{9}/,             // All ones
  /^(.)\1{8,}/,        // Same digit repeated 9+ times
  /^123456789/,        // Sequential
  /^987654321/,        // Reverse sequential
  /^000000000/,        // All zeros
];

/**
 * Step 1: Validate EIN format.
 * Format: XX-XXXXXXX (9 digits total)
 */
function validateEINFormat(tin: string): { valid: boolean; normalized: string; flags: string[] } {
  const flags: string[] = [];

  // Remove formatting characters
  const cleaned = tin.replace(/[\s\-\.]/g, '');

  // Must be exactly 9 digits
  if (!/^\d{9}$/.test(cleaned)) {
    return { valid: false, normalized: cleaned, flags: ['Invalid format: must be 9 digits (XX-XXXXXXX)'] };
  }

  // Check for known invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(cleaned)) {
      flags.push('Known invalid/test number pattern detected');
      return { valid: false, normalized: cleaned, flags };
    }
  }

  // Check EIN prefixes — only reject those known to never be assigned by IRS
  const prefix = parseInt(cleaned.substring(0, 2), 10);
  const invalidPrefixes = new Set([
    0,                          // 00 is never assigned
    7, 8, 9,                    // 07-09 not assigned
    17, 18, 19,                 // 17-19 not assigned
    49,                         // 49 not assigned
    69, 70,                     // 69-70 not assigned
    89, 90, 91,                 // 89-91 not assigned
    96, 97,                     // 96-97 not assigned
  ]);

  if (invalidPrefixes.has(prefix)) {
    flags.push(`Invalid EIN prefix: ${cleaned.substring(0, 2)} is not an IRS-assigned prefix`);
    return { valid: false, normalized: cleaned, flags };
  }

  return { valid: true, normalized: cleaned, flags: [] };
}

/**
 * Step 2: Verify EIN against ProPublica Nonprofit Explorer API.
 * Free, no API key required. Covers IRS-registered tax-exempt organizations.
 * API docs: https://projects.propublica.org/nonprofits/api/
 *
 * Note: ProPublica doesn't send CORS headers, so direct browser fetch is blocked.
 * We use multiple CORS proxy strategies with fallback.
 */

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchWithCORSProxy(targetUrl: string): Promise<Response> {
  let lastError: Error | null = null;

  // Try direct fetch first (may work in some environments)
  try {
    const directResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (directResponse.ok || directResponse.status === 404) {
      return directResponse;
    }
  } catch {
    // CORS blocked — expected, try proxies
  }

  // Try each CORS proxy
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxiedUrl = proxyFn(targetUrl);
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok || response.status === 404) {
        return response;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All CORS proxy attempts failed');
}

async function verifyWithProPublica(
  ein: string
): Promise<{
  found: boolean;
  entityName: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  flags: string[];
}> {
  try {
    const url = `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`;
    const response = await fetchWithCORSProxy(url);

    if (response.status === 404) {
      // Not found in nonprofit database — not necessarily invalid, just not a nonprofit
      return { found: false, entityName: null, city: null, state: null, status: null, flags: [] };
    }

    if (!response.ok) {
      return {
        found: false,
        entityName: null,
        city: null,
        state: null,
        status: null,
        flags: [`ProPublica API returned status ${response.status}`],
      };
    }

    const data = await response.json();
    const org = data?.organization;

    if (org && org.name) {
      return {
        found: true,
        entityName: org.name,
        city: org.city || null,
        state: org.state || null,
        status: org.tax_period ? 'active' : (org.revocation_date ? 'revoked' : 'unknown'),
        flags: [],
      };
    }

    return { found: false, entityName: null, city: null, state: null, status: null, flags: [] };
  } catch (error) {
    // Network error or API unavailable — don't block validation
    return {
      found: false,
      entityName: null,
      city: null,
      state: null,
      status: null,
      flags: [`Public records check unavailable: ${error instanceof Error ? error.message : 'network error'}`],
    };
  }
}

/**
 * Basic business name sanity check.
 */
function checkBusinessNameConsistency(businessName: string): { flags: string[] } {
  const flags: string[] = [];
  const name = businessName.trim().toLowerCase();

  if (name.length < 2) {
    flags.push('Business name is too short');
  }
  if (/^(test|sample|demo|fake|xxx)/i.test(name)) {
    flags.push('Business name appears to be a test entry');
  }

  return { flags };
}

/**
 * Main EIN/TIN Validation function.
 * Multi-layer approach:
 *   1. Format validation (prefix, length, pattern)
 *   2. ProPublica Nonprofit Explorer API (entity lookup)
 *   3. Business name consistency check
 *   4. Clear result messaging
 */
export async function validateMerchantTIN(
  tin: string,
  _businessType: string,
  businessName: string = ''
): Promise<TINValidationResult> {
  const allFlags: string[] = [];

  // ── Step 1: Format validation ────────────────────────────────────
  const formatResult = validateEINFormat(tin);
  allFlags.push(...formatResult.flags);

  if (!formatResult.valid) {
    const errorDetail = allFlags.length > 0
      ? allFlags[0]
      : 'Please enter a valid 9-digit EIN (XX-XXXXXXX).';
    return {
      isValid: false,
      confidence: 95,
      message: errorDetail,
      flags: allFlags,
      checkedAt: new Date().toISOString(),
      verificationMethod: 'Format validation',
    };
  }

  // ── Step 2: Public records entity lookup ──────────────────────────
  const proPublicaResult = await verifyWithProPublica(formatResult.normalized);
  allFlags.push(...proPublicaResult.flags);

  // If found in ProPublica (nonprofit/tax-exempt org)
  if (proPublicaResult.found && proPublicaResult.entityName) {
    const location = [proPublicaResult.city, proPublicaResult.state].filter(Boolean).join(', ');
    const locationStr = location ? ` (${location})` : '';

    return {
      isValid: true,
      confidence: 95,
      message: `EIN verified! Entity found in IRS public records: "${proPublicaResult.entityName}"${locationStr}. Your account will be reviewed for final approval.`,
      flags: allFlags,
      checkedAt: new Date().toISOString(),
      verificationMethod: 'IRS Public Records (ProPublica Nonprofit Explorer)',
      entityName: proPublicaResult.entityName,
    };
  }

  // ── Step 3: Business name check ──────────────────────────────────
  if (businessName) {
    const nameResult = checkBusinessNameConsistency(businessName);
    allFlags.push(...nameResult.flags);
  }

  // Filter out network/API informational flags
  const realFlags = allFlags.filter(
    (f) => !f.includes('unavailable') && !f.includes('API returned status')
  );

  if (realFlags.length > 0) {
    return {
      isValid: false,
      confidence: 40,
      message: realFlags[0],
      flags: allFlags,
      checkedAt: new Date().toISOString(),
      verificationMethod: 'Format + name validation',
    };
  }

  // ── Step 4: Format valid but not found in public records ─────────
  // This is expected for most for-profit businesses (ProPublica only covers nonprofits).
  // We pass format validation and flag for admin review.
  return {
    isValid: true,
    confidence: 75,
    message: 'EIN format is valid. Entity was not found in free public records (IRS nonprofit database) — this is normal for for-profit businesses. Your account will be reviewed by our admin team for final verification.',
    flags: allFlags,
    checkedAt: new Date().toISOString(),
    verificationMethod: 'Format validation + IRS public records check (entity not in nonprofit database)',
  };
}
