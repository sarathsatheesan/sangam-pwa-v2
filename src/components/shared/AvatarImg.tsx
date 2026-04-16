import React from 'react';

/**
 * Returns true when a string looks like an image URL / data-URI rather than an emoji.
 * Checks for common image URL patterns (http, data-uri, blob, relative paths).
 */
export const isImageUrl = (val?: string): val is string =>
  !!val && (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('/'));

/**
 * AvatarImg Component
 *
 * Renders an avatar value as an <img> when it's a URL, or as emoji text otherwise.
 * Provides a flexible, composable way to display avatar images or emoji fallbacks.
 *
 * @param value - The avatar value (URL or emoji string)
 * @param fallback - Default emoji to show if value is empty (default: '👤')
 * @param className - CSS classes to apply to the element (default: Tailwind rounded-full object-cover)
 *
 * @example
 * // Display user avatar from URL
 * <AvatarImg value="https://example.com/user.jpg" />
 *
 * @example
 * // Display emoji avatar
 * <AvatarImg value="😊" />
 *
 * @example
 * // Display fallback emoji
 * <AvatarImg value={undefined} fallback="🙏" />
 *
 * @example
 * // Custom styling
 * <AvatarImg
 *   value={user.avatar}
 *   className="w-10 h-10 rounded-full border-2 border-blue-500"
 * />
 */
const AvatarImg: React.FC<{ value?: string; fallback?: string; className?: string }> = ({
  value,
  fallback = '👤',
  className = 'w-full h-full rounded-full object-cover',
}) => (
  isImageUrl(value)
    ? <img src={value} alt="avatar" className={className} />
    : <>{value || fallback}</>
);

export default AvatarImg;
