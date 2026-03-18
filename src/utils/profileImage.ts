/**
 * Compress a profile image to a base64 data URL.
 * Stores directly in Firestore (same approach as feed/message images).
 * Compresses to 256px max dimension and lower quality to keep Firestore doc small.
 */
export function compressProfileImage(file: File, maxWidth = 256, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        // Scale down maintaining aspect ratio
        if (w > h) {
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
        } else {
          if (h > maxWidth) {
            w = Math.round((w * maxWidth) / h);
            h = maxWidth;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas error'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        console.log('[ProfileImage] Compressed:', (dataUrl.length / 1024).toFixed(0), 'KB');
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
