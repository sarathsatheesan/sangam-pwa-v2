import { useReducer, useState, useCallback } from 'react';

/**
 * Report/block moderation state (Session 50 — messages.tsx decomposition
 * tranche 2, "moderation" domain from docs/messages-state-decomposition-plan.md).
 *
 * Replaces ten useState hooks in messages.tsx:
 *   showReportModal, reportMessageId, reportMessageText, reportSenderId,
 *   reportReason, reportDetails, reportSubmitting, showBlockConfirm,
 *   blockTargetUser  → one reducer (they always transition together per modal)
 *   blockedUsers     → kept as useState so the page keeps the exact
 *                      Dispatch<SetStateAction<Set<string>>> shape it already
 *                      uses (direct set from the Firestore load effect,
 *                      functional `prev => new Set(prev).add(...)` in
 *                      handleBlockUser).
 *
 * STATE ONLY — all Firestore I/O (report submission, block writes,
 * blocked-users fetch) intentionally stays in messages.tsx handlers until
 * services/messages.ts exists (see plan doc, companion work).
 *
 * Naming preserves the page's existing local wrappers (`openReportModal`,
 * `openBlockConfirm`) and setter names (`setReportReason`, `setReportDetails`,
 * `setReportSubmitting`) so JSX/handler call sites are unchanged.
 *
 * `closeReportModal()` hides the modal AND clears reason/details — this
 * matches the submit-success path exactly; on the cancel/backdrop paths it is
 * unobservable extra clearing because `openReportModal` always resets the
 * form before the modal is next shown. `closeBlockConfirm()` likewise clears
 * `blockTargetUser` (previously left stale on cancel, but never read while
 * the modal is closed).
 */

export interface BlockTarget {
  uid: string;
  name: string;
}

interface ModerationState {
  showReportModal: boolean;
  reportMessageId: string | null;
  reportMessageText: string;
  reportSenderId: string | null;
  reportReason: string;
  reportDetails: string;
  reportSubmitting: boolean;
  showBlockConfirm: boolean;
  blockTargetUser: BlockTarget | null;
}

const initialState: ModerationState = {
  showReportModal: false,
  reportMessageId: null,
  reportMessageText: '',
  reportSenderId: null,
  reportReason: '',
  reportDetails: '',
  reportSubmitting: false,
  showBlockConfirm: false,
  blockTargetUser: null,
};

type ModerationAction =
  | { type: 'OPEN_REPORT'; msgId: string; msgText: string; senderId: string }
  | { type: 'CLOSE_REPORT' }
  | { type: 'SET_REPORT_REASON'; reason: string }
  | { type: 'SET_REPORT_DETAILS'; details: string }
  | { type: 'SET_REPORT_SUBMITTING'; submitting: boolean }
  | { type: 'OPEN_BLOCK_CONFIRM'; target: BlockTarget }
  | { type: 'CLOSE_BLOCK_CONFIRM' };

function moderationReducer(state: ModerationState, action: ModerationAction): ModerationState {
  switch (action.type) {
    case 'OPEN_REPORT':
      return {
        ...state,
        reportMessageId: action.msgId,
        reportMessageText: action.msgText,
        reportSenderId: action.senderId,
        reportReason: '',
        reportDetails: '',
        showReportModal: true,
      };
    case 'CLOSE_REPORT':
      return { ...state, showReportModal: false, reportReason: '', reportDetails: '' };
    case 'SET_REPORT_REASON':
      return { ...state, reportReason: action.reason };
    case 'SET_REPORT_DETAILS':
      return { ...state, reportDetails: action.details };
    case 'SET_REPORT_SUBMITTING':
      return { ...state, reportSubmitting: action.submitting };
    case 'OPEN_BLOCK_CONFIRM':
      return { ...state, blockTargetUser: action.target, showBlockConfirm: true };
    case 'CLOSE_BLOCK_CONFIRM':
      return { ...state, showBlockConfirm: false, blockTargetUser: null };
    default:
      return state;
  }
}

export function useChatModeration() {
  const [state, dispatch] = useReducer(moderationReducer, initialState);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  const openReportModal = useCallback((msgId: string, msgText: string, senderId: string) => {
    dispatch({ type: 'OPEN_REPORT', msgId, msgText, senderId });
  }, []);

  const closeReportModal = useCallback(() => dispatch({ type: 'CLOSE_REPORT' }), []);

  const setReportReason = useCallback((reason: string) => {
    dispatch({ type: 'SET_REPORT_REASON', reason });
  }, []);

  const setReportDetails = useCallback((details: string) => {
    dispatch({ type: 'SET_REPORT_DETAILS', details });
  }, []);

  const setReportSubmitting = useCallback((submitting: boolean) => {
    dispatch({ type: 'SET_REPORT_SUBMITTING', submitting });
  }, []);

  const openBlockConfirm = useCallback((uid: string, name: string) => {
    dispatch({ type: 'OPEN_BLOCK_CONFIRM', target: { uid, name } });
  }, []);

  const closeBlockConfirm = useCallback(() => dispatch({ type: 'CLOSE_BLOCK_CONFIRM' }), []);

  return {
    // report modal state
    showReportModal: state.showReportModal,
    reportMessageId: state.reportMessageId,
    reportMessageText: state.reportMessageText,
    reportSenderId: state.reportSenderId,
    reportReason: state.reportReason,
    reportDetails: state.reportDetails,
    reportSubmitting: state.reportSubmitting,
    // block confirm state
    showBlockConfirm: state.showBlockConfirm,
    blockTargetUser: state.blockTargetUser,
    // transitions
    openReportModal,
    closeReportModal,
    setReportReason,
    setReportDetails,
    setReportSubmitting,
    openBlockConfirm,
    closeBlockConfirm,
    // blocked users (I/O stays in the page for now)
    blockedUsers,
    setBlockedUsers,
  };
}
