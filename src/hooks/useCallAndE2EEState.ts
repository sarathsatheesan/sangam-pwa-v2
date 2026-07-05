import { useState } from 'react';
import { getCallManager, type CallState } from '@/utils/webrtc';
import { getGroupCallManager, type GroupCallState } from '@/utils/groupWebrtc';

/**
 * E2EE + calls state domain (Session 64 — messages.tsx decomposition tranche 11,
 * domain 11 of docs/messages-state-decomposition-plan.md — THE FINALE).
 *
 * The last and highest-risk domain because it interlocks with the CallManager /
 * GroupCallManager singletons and the E2EE key lifecycle. To stay behaviorally
 * identical, this hook owns ONLY the 5 useState values (raw setters, identical
 * names → all call sites unchanged). Everything that USES them stays in the
 * page: the callManagerRef/groupCallManagerRef singleton refs, the two
 * subscribe() effects, the active-group-call onSnapshot, the ECDH key-init +
 * shared/group-key derivation effects, and every call/join handler.
 *
 * callState/groupCallState seed from the singletons' CURRENT state (exact
 * parity with the page's prior `useState(getCallManager().getState())`), so a
 * call already in progress is reflected immediately on mount.
 */
export function useCallAndE2EEState() {
  const [e2eReady, setE2eReady] = useState(false);
  const [e2eKeyVersion, setE2eKeyVersion] = useState(0);
  const [callState, setCallState] = useState<CallState>(getCallManager().getState());
  const [groupCallState, setGroupCallState] = useState<GroupCallState>(getGroupCallManager().getState());
  const [activeGroupCallId, setActiveGroupCallId] = useState<string | null>(null);

  return {
    e2eReady, setE2eReady,
    e2eKeyVersion, setE2eKeyVersion,
    callState, setCallState,
    groupCallState, setGroupCallState,
    activeGroupCallId, setActiveGroupCallId,
  };
}
