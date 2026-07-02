/**
 * Central client-side error reporter (Session 44).
 *
 * Policy: `.catch(() => {})` is allowed ONLY for pure telemetry (see
 * services/businessAnalytics.ts). Anything a user or vendor would notice
 * when it fails must route through reportError so it is at least logged
 * with a searchable operation tag, and optionally surfaced as a toast.
 *
 * Usage:
 *   somePromise.catch((err) => reportError(err, { op: 'notify-vendors-rfq' }));
 *   somePromise.catch((err) =>
 *     reportError(err, { op: 'submit-order', toast: addToast,
 *       toastMessage: 'Order saved, but notifications may be delayed.' }));
 */

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;

export interface ReportErrorContext {
  /** Short searchable tag for the operation, e.g. 'notify-vendors-rfq'. */
  op: string;
  /** Pass the ToastContext addToast to surface the failure to the user. */
  toast?: ToastFn;
  /** User-facing message. Defaults to a generic retry prompt. */
  toastMessage?: string;
}

export function reportError(err: unknown, ctx: ReportErrorContext): void {
  // Always logged — a swallowed error is a bug you can never see.
  console.error(`[${ctx.op}]`, err);
  if (ctx.toast) {
    ctx.toast(
      ctx.toastMessage ?? `Something went wrong (${ctx.op}). Please try again.`,
      'error',
      6000,
    );
  }
}
