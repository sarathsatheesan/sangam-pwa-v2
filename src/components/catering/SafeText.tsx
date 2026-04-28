import React from 'react';
import { sanitizeText } from '@/utils/sanitize';

interface SafeTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders user-provided text after sanitization.
 * Use this for specialInstructions, notes, and other user-input text.
 * Prevents XSS attacks by removing HTML tags, scripts, and dangerous patterns.
 */
export function SafeText({ text, className, style }: SafeTextProps) {
  return <span className={className} style={style}>{sanitizeText(text)}</span>;
}
