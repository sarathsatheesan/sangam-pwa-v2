import React, { useState, useEffect, useRef } from 'react';
import { MicOff, Send } from 'lucide-react';

/**
 * VoiceRecorder Component
 * Voice message recording UI with timer and waveform animation
 */
export function VoiceRecorder({ onSend, onCancel }: { onSend: (duration: number, audioBlob: Blob) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    // Start recording on mount
    (async () => {
      try {
        // Cross-browser: Check for mediaDevices API availability (iOS Safari, older Firefox)
        if (!navigator.mediaDevices?.getUserMedia) {
          setRecError('Microphone access not supported in your browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(200); // collect chunks every 200ms
      } catch {
        setRecError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      }
    })();
    return () => {
      // Cleanup on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const handleSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') { onCancel(); return; }
    const dur = seconds;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onSend(dur, blob);
    };
    recorder.stop();
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleCancel} onTouchStart={handleCancel} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {recError ? (
          <div className="text-red-500 text-sm text-center max-w-[250px]">{recError}</div>
        ) : (
          <>
            <div className="text-3xl font-bold text-aurora-indigo">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div className="flex gap-2 items-center">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-8 bg-aurora-indigo rounded animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </>
        )}
        <div className="flex gap-3">
          <button onClick={handleCancel} className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600">
            <MicOff size={18} />
          </button>
          {!recError && (
            <button onClick={handleSend} className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
