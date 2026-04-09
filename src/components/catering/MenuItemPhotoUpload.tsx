import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, Loader2, AlertCircle } from 'lucide-react';
import { compressImage, MAX_FILE_SIZE } from '@/components/business/imageUtils';

interface MenuItemPhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoChange: (base64DataUrl: string) => void;
  onPhotoRemove: () => void;
  disabled?: boolean;
}

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const COMPRESSION_WIDTH = 800;
const COMPRESSION_QUALITY = 0.7;

const MenuItemPhotoUpload: React.FC<MenuItemPhotoUploadProps> = ({
  currentPhotoUrl,
  onPhotoChange,
  onPhotoRemove,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showLiabilityNotice, setShowLiabilityNotice] = useState(false);

  // Check if liability acknowledgement has been shown this session
  const checkLiabilityAck = useCallback(() => {
    const ack = sessionStorage.getItem('photoLiabilityAck');
    return !ack; // Return true if we should show the notice
  }, []);

  // Validate image resolution
  const validateImageResolution = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const isValid = img.width >= MIN_WIDTH && img.height >= MIN_HEIGHT;
          resolve(isValid);
        };
        img.onerror = () => resolve(false);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError('');
      setLoading(true);

      try {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          setError(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
          setLoading(false);
          return;
        }

        // Check file format
        const validFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!validFormats.includes(file.type)) {
          setError('Format must be JPEG, PNG, WebP, or HEIC');
          setLoading(false);
          return;
        }

        // Validate resolution
        const isValidResolution = await validateImageResolution(file);
        if (!isValidResolution) {
          setError(`Image must be at least ${MIN_WIDTH}×${MIN_HEIGHT} pixels`);
          setLoading(false);
          return;
        }

        // Compress image
        const compressedBase64 = await compressImage(
          file,
          COMPRESSION_WIDTH,
          COMPRESSION_QUALITY
        );

        // Check if we need to show liability notice
        if (checkLiabilityAck()) {
          setShowLiabilityNotice(true);
        }

        // Set liability acknowledgement in session storage
        sessionStorage.setItem('photoLiabilityAck', 'true');

        // Call callback with compressed image
        onPhotoChange(compressedBase64);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        setError('Failed to process image. Please try again.');
        console.error('Image processing error:', err);
      } finally {
        setLoading(false);
      }
    },
    [onPhotoChange, checkLiabilityAck]
  );

  // Handle remove photo
  const handleRemovePhoto = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPhotoRemove();
      setShowLiabilityNotice(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onPhotoRemove]
  );

  // Handle click on upload area
  const handleUploadAreaClick = useCallback(() => {
    if (!disabled && !loading) {
      fileInputRef.current?.click();
    }
  }, [disabled, loading]);

  return (
    <div className="flex flex-col gap-3">
      {/* Upload area */}
      <div
        onClick={handleUploadAreaClick}
        className={`relative w-[120px] h-[120px] rounded-xl cursor-pointer transition-all ${
          currentPhotoUrl
            ? 'border border-solid border-[var(--aurora-border)]'
            : 'border-2 border-dashed border-[var(--aurora-muted)]'
        } ${!disabled && !loading ? 'hover:border-[var(--aurora-accent)]' : ''} ${
          disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {/* Current photo */}
        {currentPhotoUrl && (
          <>
            <img
              src={currentPhotoUrl}
              alt="Menu item"
              className="w-full h-full object-cover rounded-xl"
            />
            {/* Remove button */}
            {!disabled && (
              <button
                onClick={handleRemovePhoto}
                className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors"
                aria-label="Remove photo"
              >
                <X size={14} className="text-gray-700" />
              </button>
            )}
          </>
        )}

        {/* Placeholder */}
        {!currentPhotoUrl && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {loading ? (
              <Loader2
                size={32}
                className="text-[var(--aurora-muted)] animate-spin"
              />
            ) : (
              <>
                <Camera
                  size={32}
                  className="text-[var(--aurora-muted)] mb-1"
                />
                <span className="text-xs font-medium text-[var(--aurora-muted)]">
                  Add Photo
                </span>
              </>
            )}
          </div>
        )}

        {/* Loading spinner overlay */}
        {loading && currentPhotoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
            <Loader2
              size={32}
              className="text-white animate-spin"
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Liability acknowledgement notice */}
      {showLiabilityNotice && (
        <p className="text-xs text-[var(--aurora-muted)] italic">
          By uploading, I confirm this photo accurately represents my menu item.
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileSelect}
        disabled={disabled || loading}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};

export default MenuItemPhotoUpload;
