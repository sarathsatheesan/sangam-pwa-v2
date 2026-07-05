import { useState } from 'react';
import type { Message } from '@/types/messages';

/**
 * Message composer domain (Session 61 — messages.tsx decomposition tranche 9,
 * domain 9 of docs/messages-state-decomposition-plan.md).
 *
 * The composer is the app's most ref-entangled surface: `textareaRef`, its
 * auto-resize effect, and the markdown formatting handler all read/write this
 * state alongside the send pipeline. To keep this Med-High-risk extraction
 * behaviorally identical, the hook exposes RAW setters with the SAME names the
 * page already uses — so all ~34 call sites stay byte-identical and only the
 * declaration block moves. `textareaRef` + the resize effect + handleFormat
 * intentionally REMAIN in the page (they interleave with send logic and the
 * DOM node); a future pass can co-locate them here once domain 10 lands.
 */
export interface PendingFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

export function useComposer() {
  const [messageText, setMessageText] = useState('');
  const [showFormatting, setShowFormatting] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  return {
    messageText, setMessageText,
    showFormatting, setShowFormatting,
    editingMessage, setEditingMessage,
    replyingTo, setReplyingTo,
    recentEmojis, setRecentEmojis,
    showEmojiPicker, setShowEmojiPicker,
    showGifPicker, setShowGifPicker,
    isRecording, setIsRecording,
    pendingImage, setPendingImage,
    imageCompressing, setImageCompressing,
    pendingFile, setPendingFile,
  };
}
