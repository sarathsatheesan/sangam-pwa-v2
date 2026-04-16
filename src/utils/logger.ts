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
 * Lightweight logger that no-ops in production builds.
 * Usage: import { logger } from '@/utils/logger';
 *        logger.info('[Profile]', 'loading user', userId);
 *
 * In production (import.meta.env.PROD === true), all log calls are silenced.
 * This avoids console noise without requiring a build-time strip plugin.
 */
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

const noop = () => {};

export const logger = {
  log: isProd ? noop : console.log.bind(console),
  info: isProd ? noop : console.info.bind(console),
  warn: isProd ? noop : console.warn.bind(console),
  error: console.error.bind(console), // Always log errors, even in prod
  debug: isProd ? noop : console.debug.bind(console),
};
