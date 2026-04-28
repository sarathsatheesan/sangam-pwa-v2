/**
 * Import ordering convention for this project:
 * 1. React / React DOM
 * 2. Third-party libraries (firebase, framer-motion, lucide-react, etc.)
 * 3. Project contexts (@/contexts/*)
 * 4. Project hooks (@/hooks/*)
 * 5. Project services (@/services/*)
 * 6. Project components (@/components/*)
 * 7. Project utilities (@/utils/*)
 * 8. Project types (@/types/*)
 * 9. Project constants (@/constants/*)
 * 10. CSS / assets
 *
 * Blank line between each group. This is a convention, not enforced by tooling.
 */

/**
 * Enhanced logger with structured error reporting and alerting.
 * Usage: import { logger } from '@/utils/logger';
 *        logger.info('[Profile]', 'loading user', userId);
 *        logger.report('Payment failed', 'high', { orderId, reason });
 *        logger.alert('Duplicate order detected', { quoteId });
 *
 * In production (import.meta.env.PROD === true), debug/info/warn are silenced.
 * Errors and alerts are always logged for monitoring.
 */
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

const noop = (..._args: any[]) => {};

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorReport {
  message: string;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: number;
  userAgent?: string;
}

// In-memory error buffer for batching
const errorBuffer: ErrorReport[] = [];
const MAX_BUFFER_SIZE = 100;

function reportError(report: ErrorReport): void {
  errorBuffer.push(report);
  if (errorBuffer.length > MAX_BUFFER_SIZE) errorBuffer.shift();

  // In production, could POST to an error reporting endpoint
  // For now, structured console output for log aggregation
  console.error(JSON.stringify({
    level: 'error',
    severity: report.severity,
    message: report.message,
    context: report.context,
    timestamp: new Date(report.timestamp).toISOString(),
  }));
}

export const logger = {
  log: isProd ? noop : console.log.bind(console),
  info: isProd ? noop : console.info.bind(console),
  warn: isProd ? noop : console.warn.bind(console),
  error: console.error.bind(console),
  debug: isProd ? noop : console.debug.bind(console),

  /** Structured error report for monitoring */
  report(message: string, severity: ErrorSeverity = 'medium', context?: Record<string, any>): void {
    reportError({
      message,
      severity,
      context,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
  },

  /** Alert on critical business logic violations */
  alert(message: string, context?: Record<string, any>): void {
    reportError({
      message: `[ALERT] ${message}`,
      severity: 'critical',
      context,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
  },

  /** Get recent errors for debugging */
  getRecentErrors(): ErrorReport[] {
    return [...errorBuffer];
  },
};
