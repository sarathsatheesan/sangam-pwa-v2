import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, VolumeX, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

/**
 * VoiceMessageBubble Component
 * Displays voice message with play/pause button and duration
 */
export function VoiceMessageBubble({ duration, audioUrl, isMine, transcription, msgId, convId, voiceToTextEnabled = true }: { duration: number; audioUrl?: string; isMine: boolean; transcription?: string; msgId?: string; convId?: string; voiceToTextEnabled?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [localTranscription, setLocalTranscription] = useState<string | null>(transcription || null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const handleTranscribe = async () => {
    if (!audioUrl || !msgId || !convId || transcribing) return;
    if (audioUrl.startsWith('{')) {
      setTranscribeError('Audio is encrypted — cannot transcribe');
      return;
    }
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const transcribeVoice = httpsCallable(functions, 'transcribeVoiceMessage');
      const result = await transcribeVoice({ conversationId: convId, messageId: msgId, audioData: audioUrl });
      const data = result.data as { transcription?: string; error?: string };
      if (data.transcription) {
        setLocalTranscription(data.transcription);
      } else {
        setTranscribeError(data.error || 'No speech detected');
      }
    } catch (err: unknown) {
      console.error('[Transcribe] Error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTranscribeError(msg.includes('internal') ? 'Transcription failed. Check Speech API is enabled.' : msg);
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    if (!audioUrl) return;
    // Check if audioUrl is still encrypted JSON (decryption failed/pending)
    if (audioUrl.startsWith('{')) {
      console.warn('[VoiceMessage] audioUrl appears to be encrypted JSON, decryption may be pending');
      setAudioError(true);
      return;
    }
    setAudioError(false);

    // Convert data URL to blob URL for better cross-browser compatibility
    let objectUrl: string | null = null;
    try {
      if (audioUrl.startsWith('data:')) {
        const [header, b64Data] = audioUrl.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
        const binary = atob(b64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
      } else {
        objectUrl = audioUrl;
      }
    } catch (err) {
      console.error('[VoiceMessage] Failed to convert data URL to blob:', err);
      objectUrl = audioUrl; // fallback to raw URL
    }

    const audio = new Audio(objectUrl);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setCurrentTime(0); };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onerror = (e) => {
      console.error('[VoiceMessage] Audio playback error:', e);
      setAudioError(true);
    };
    return () => {
      audio.pause();
      audio.src = '';
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || audioError) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch((err) => {
        console.error('[VoiceMessage] play() failed:', err);
        setAudioError(true);
      });
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayTime = playing ? Math.floor(currentTime) : 0;
  const mins = Math.floor((playing ? displayTime : duration) / 60);
  const secs = (playing ? displayTime : duration) % 60;

  return (
    <div className="py-1">
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: audioError ? 'var(--aurora-danger)' : 'var(--aurora-accent)' }} title={audioError ? 'Unable to play audio' : undefined}>
          {audioError ? <VolumeX size={16} className="text-white" /> : playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" style={{ marginLeft: '2px' }} />}
        </button>
        <div className="flex gap-[3px] items-end flex-1">
          {[...Array(20)].map((_, i) => {
            const barProgress = (i + 1) / 20;
            const isActive = playing && barProgress <= progress;
            return (
              <div
                key={i}
                className="w-[2.5px] rounded-full transition-colors"
                style={{
                  height: `${4 + Math.abs(Math.sin(i * 0.8)) * 14}px`,
                  backgroundColor: isActive ? 'var(--aurora-accent)' : '#A5B4FC',
                }}
              />
            );
          })}
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--msg-secondary)' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      {/* Transcription display or button */}
      {localTranscription ? (
        <div className="mt-1.5 px-1">
          <div className="flex items-center gap-1 mb-0.5">
            <FileText size={10} style={{ color: 'var(--msg-secondary)' }} />
            <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--msg-secondary)' }}>Transcript</span>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--msg-text)', opacity: 0.85 }}>{localTranscription}</p>
        </div>
      ) : voiceToTextEnabled ? (
        <button
          onClick={handleTranscribe}
          onTouchStart={handleTranscribe}
          disabled={transcribing || !audioUrl}
          className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
          style={{ color: transcribeError ? 'var(--aurora-danger)' : 'var(--aurora-accent)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          {transcribing ? (
            <><Loader2 size={12} className="animate-spin" /> Transcribing...</>
          ) : transcribeError ? (
            <><AlertCircle size={12} /> {transcribeError}</>
          ) : (
            <><FileText size={12} /> Transcribe</>
          )}
        </button>
      ) : null}
    </div>
  );
}
