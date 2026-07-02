import React, { useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

/**
 * Promise-based confirmation dialog (Session 46) — drop-in replacement for
 * window.confirm() with identical control flow:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm('Are you sure you want to delete this post?', {
 *     title: 'Delete Post', confirmLabel: 'Delete', danger: true,
 *   }))) return;
 *   ...
 *   return (<> ... {confirmDialog} </>);
 *
 * Built on the shared <Modal> shell, so it gets ESC (resolves false),
 * focus trap, scroll lock, and mobile bottom-sheet for free.
 */

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  message: string;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // If a confirm is somehow already open, resolve it false first.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setState({ message, ...options });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirmDialog = (
    <Modal
      open={state !== null}
      onClose={() => settle(false)}
      title={state?.title ?? 'Are you sure?'}
      size="sm"
      layer="high"
      hideHeader
    >
      {state && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              state.danger ? 'bg-red-100 dark:bg-red-500/15' : 'bg-indigo-100 dark:bg-indigo-500/15'
            }`}>
              <AlertTriangle size={20} className={state.danger ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'} />
            </div>
            <h3 className="text-lg font-bold text-aurora-text">{state.title ?? 'Are you sure?'}</h3>
          </div>
          <p className="text-aurora-text-secondary mb-6">{state.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => settle(false)}
              className="flex-1 py-2.5 rounded-xl border border-aurora-border text-sm font-medium text-aurora-text-secondary hover:bg-aurora-bg transition-colors"
            >
              {state.cancelLabel ?? 'Cancel'}
            </button>
            <button
              onClick={() => settle(true)}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${
                state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {state.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );

  return { confirm, confirmDialog };
}
