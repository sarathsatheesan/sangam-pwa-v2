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

// ── #41: Parallel Image Compression ─────────────────────────────────────────

export interface CompressResult {
  /** Successfully compressed base64 data-URLs */
  images: string[];
  /** Number of files that failed to compress */
  failCount: number;
}

/**
 * Compresses multiple images in parallel using Promise.allSettled.
 * Calls onProgress after each image finishes (success or fail) with
 * the count of completed items so far vs. total.
 *
 * @param files     Array of File objects to compress
 * @param onProgress  Callback: (completed, total) => void
 * @param maxWidth  Max pixel width (default 800)
 * @param quality   JPEG quality 0-1 (default 0.7)
 * @returns CompressResult with images array (in original order) and failCount
 */
export async function compressImagesParallel(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  maxWidth = 800,
  quality = 0.7,
): Promise<CompressResult> {
  const total = files.length;
  let completed = 0;

  const results = await Promise.allSettled(
    files.map((file) =>
      compressImage(file, maxWidth, quality).finally(() => {
        completed++;
        onProgress?.(completed, total);
      }),
    ),
  );

  const images: string[] = [];
  let failCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      images.push(result.value);
    } else {
      console.error('Image compression failed:', result.reason);
      failCount++;
    }
  }

  return { images, failCount };
}
