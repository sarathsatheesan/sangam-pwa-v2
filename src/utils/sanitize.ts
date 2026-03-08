/**
 * Robust input sanitization for ethniCity App
 * Provides XSS prevention without external dependencies
 */

// HTML entity map for encoding
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHTML(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize user input text - removes all HTML tags, script injections,
 * and dangerous patterns while preserving safe text content.
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Remove all HTML tags (including malformed ones)
  sanitized = sanitized.replace(/<[^>]*>?/g, '');

  // 2. Remove javascript: protocol (case-insensitive, with whitespace tricks)
  sanitized = sanitized.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');

  // 3. Remove data: URIs that could contain scripts
  sanitized = sanitized.replace(/data\s*:/gi, '');

  // 4. Remove vbscript: protocol
  sanitized = sanitized.replace(/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');

  // 5. Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // 6. Remove HTML entities that decode to dangerous content
  sanitized = sanitized.replace(/&#x?[0-9a-f]+;?/gi, (match) => {
    // Decode and check if it's a < or > or other dangerous char
    try {
      const decoded = match.replace(/&#x?([0-9a-f]+);?/i, (_, hex) => {
        const code = match.includes('x') ? parseInt(hex, 16) : parseInt(hex, 10);
        return String.fromCharCode(code);
      });
      if (decoded === '<' || decoded === '>' || decoded === '"' || decoded === "'") {
        return '';
      }
      return match;
    } catch {
      return '';
    }
  });

  // 7. Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // 8. Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate and sanitize a URL - only allows http:// and https:// protocols
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();

  // Only allow http and https protocols
  if (!/^https?:\/\//i.test(trimmed)) {
    // If no protocol, prepend https://
    if (/^[a-zA-Z0-9]/.test(trimmed) && trimmed.includes('.')) {
      return `https://${trimmed}`;
    }
    return ''; // Invalid URL
  }

  // Block javascript: data: vbscript: etc. even if disguised
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

/**
 * Sanitize a display name - allows letters, numbers, spaces, and common punctuation
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  // Remove anything that's not a letter, number, space, period, hyphen, or apostrophe
  return name.replace(/[^a-zA-Z0-9\s.\-']/g, '').trim().slice(0, 100);
}

/**
 * Sanitize email for display (not validation)
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.replace(/[^a-zA-Z0-9@._\-+]/g, '').trim().toLowerCase();
}
