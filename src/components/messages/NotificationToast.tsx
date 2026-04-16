import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import type { NotificationType } from '@/types/messages';

/**
 * NotificationToast Component
 * General-purpose notification toast with configurable type and auto-dismiss
 */
export function NotificationToast({
  message,
  type = 'info',
  onDismiss,
  duration = 3000,
}: {
  message: string;
  type?: NotificationType;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const bgColor = {
    success: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  };

  const textColor = {
    success: 'text-green-700 dark:text-green-200',
    error: 'text-red-700 dark:text-red-200',
    info: 'text-blue-700 dark:text-blue-200',
    warning: 'text-yellow-700 dark:text-yellow-200',
  };

  const iconColor = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-yellow-500',
  };

  const Icon = type === 'error' ? AlertCircle : CheckCircle;

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-md ${bgColor[type]} rounded-xl shadow-2xl p-4 flex items-start gap-3 border ${textColor[type]}`}
      style={{ borderColor: type === 'error' ? '#fca5a5' : type === 'success' ? '#86efac' : type === 'warning' ? '#fde047' : '#93c5fd' }}
    >
      <Icon size={20} className={`${iconColor[type]} shrink-0 mt-0.5`} />
      <span className="text-sm font-medium leading-snug flex-1">{message}</span>
      <button onClick={onDismiss} onTouchStart={onDismiss} className="shrink-0 ml-1" style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
        <X size={18} />
      </button>
    </div>
  );
}
