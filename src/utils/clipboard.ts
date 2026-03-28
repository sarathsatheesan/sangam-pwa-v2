/**
 * Cross-browser clipboard write utility.
 * Uses navigator.clipboard when available, falls back to
 * the legacy document.execCommand('copy') approach for
 * older browsers (Safari < 13.1, older Firefox/Edge).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern API – available in secure contexts (HTTPS / localhost)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy approach
    }
  }

  // Legacy fallback – works in virtually every browser
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Prevent scroll jump
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
