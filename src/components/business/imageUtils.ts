// ═════════════════════════════════════════════════════════════════════════════════
// IMAGE UTILITIES
// Shared across business, housing, events modules
// ═════════════════════════════════════════════════════════════════════════════════

/** Maximum file size for photo uploads (5 MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Compresses an image file to JPEG, optionally scaling it down.
 * Works in all modern browsers (Chrome, Safari, Firefox, iOS Safari, Android Chrome).
 *
 * @returns Base64 data-URL of the compressed image
 */
export function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('Canvas error'); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
