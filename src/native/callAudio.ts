import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Bridge to the native CallAudio plugin (Android AudioManager).
 *
 * No-op on web/desktop: browsers route call audio to the OS default output, so
 * Bluetooth/car/speaker already follow the system there. Only the Android app
 * needs explicit AudioManager control. Every call is wrapped so a failure can
 * never break the in-progress call's audio.
 */
interface CallAudioPlugin {
  startCallAudio(): Promise<void>;
  stopCallAudio(): Promise<void>;
  setSpeaker(options: { on: boolean }): Promise<{ speaker: boolean }>;
}

const CallAudio = registerPlugin<CallAudioPlugin>('CallAudio');

const isNative = (): boolean => Capacitor.isNativePlatform();

/** Enter communication mode + auto-route to Bluetooth/car if connected. */
export async function startCallAudioRouting(): Promise<void> {
  if (!isNative()) return;
  try {
    await CallAudio.startCallAudio();
  } catch (err) {
    console.warn('[callAudio] startCallAudio failed:', err);
  }
}

/** Restore normal audio mode on hang-up. */
export async function stopCallAudioRouting(): Promise<void> {
  if (!isNative()) return;
  try {
    await CallAudio.stopCallAudio();
  } catch (err) {
    console.warn('[callAudio] stopCallAudio failed:', err);
  }
}

/** Toggle speakerphone (turns Bluetooth off when on). Returns the applied state. */
export async function setCallSpeaker(on: boolean): Promise<boolean> {
  if (!isNative()) return on;
  try {
    const res = await CallAudio.setSpeaker({ on });
    return res?.speaker ?? on;
  } catch (err) {
    console.warn('[callAudio] setSpeaker failed:', err);
    return on;
  }
}

/** True on platforms where the speaker toggle is meaningful (native only). */
export const callAudioControlsAvailable = (): boolean => isNative();
