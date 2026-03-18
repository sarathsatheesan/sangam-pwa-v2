import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/services/firebase';

/**
 * Compress an image file to a reasonable size for profile photos.
 * Returns a Blob ready for upload.
 */
export async function compressImage(file: File, maxWidth = 512, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxWidth) {
        width = Math.round((width * maxWidth) / height);
        height = maxWidth;
      }

      // Draw to canvas and export as JPEG
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Upload a profile image to Firebase Storage and return the download URL.
 */
export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not configured');

  // Compress before uploading
  const compressed = await compressImage(file);

  // Upload to /profileImages/{userId}
  const storageRef = ref(storage, `profileImages/${userId}`);
  await uploadBytes(storageRef, compressed, {
    contentType: 'image/jpeg',
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  // Get the download URL
  return getDownloadURL(storageRef);
}

/**
 * Delete a user's profile image from Firebase Storage.
 */
export async function deleteProfileImage(userId: string): Promise<void> {
  if (!storage) return;
  try {
    const storageRef = ref(storage, `profileImages/${userId}`);
    await deleteObject(storageRef);
  } catch {
    // Image may not exist — that's fine
  }
}
