import React, { useState, useRef } from 'react';
import { ImagePlus, Loader2, Check, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { WALLPAPER_PRESETS, WALLPAPER_COLORS } from '@/constants/messages';
import { compressImage } from '@/utils/messageHelpers';
import { wallpaperToStyle, type Wallpaper } from '@/hooks/useChatAppearance';

/**
 * WallpaperPicker (Session 57 rebuild) — presets, solid colors, and a custom
 * photo, with a live preview showing sample bubbles over the draft choice so
 * readability is visible before Apply. Global wallpaper (all chats).
 */
export function WallpaperPicker({
  current,
  onApply,
  onClose,
}: {
  current: Wallpaper;
  onApply: (wp: Wallpaper) => boolean; // false = couldn't save (quota)
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'preset' | 'color' | 'photo'>(current.type === 'image' ? 'photo' : current.type === 'color' ? 'color' : 'preset');
  const [draft, setDraft] = useState<Wallpaper>(current);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isActive = (wp: Wallpaper) => draft.type === wp.type && draft.value === wp.value;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setError('Image too large. Pick one under 12MB.'); return; }
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await compressImage(file, 1280, 0.72);
      setDraft({ type: 'image', value: dataUrl });
    } catch {
      setError('Could not process that image. Try another.');
    } finally {
      setUploading(false);
    }
  };

  const apply = () => {
    const ok = onApply(draft);
    if (!ok) { setError('Not enough space to save this photo. Try a smaller image.'); return; }
    onClose();
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === id ? 'bg-aurora-indigo text-white' : 'text-aurora-text-secondary hover:bg-aurora-bg'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal open onClose={onClose} title="Chat Wallpaper" size="md">
      <div className="p-4 space-y-4">
        {/* Live preview */}
        <div className="rounded-2xl border border-aurora-border overflow-hidden">
          <div className="h-40 p-3 flex flex-col justify-end gap-2" style={wallpaperToStyle(draft)}>
            <div className="self-start max-w-[70%] px-3 py-2 rounded-2xl rounded-bl-md text-[13px] shadow-sm"
              style={{ backgroundColor: 'var(--aurora-surface)', color: 'var(--msg-text)' }}>
              How's this wallpaper? 👀
            </div>
            <div className="self-end max-w-[70%] px-3 py-2 rounded-2xl rounded-br-md text-[13px] shadow-sm"
              style={{ backgroundColor: 'var(--msg-own-bubble)', color: 'var(--msg-text)' }}>
              Looks great!
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-aurora-bg">
          {tabBtn('preset', 'Presets')}
          {tabBtn('color', 'Colors')}
          {tabBtn('photo', 'Photo')}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Presets */}
        {tab === 'preset' && (
          <div className="grid grid-cols-3 gap-2.5 max-h-52 overflow-y-auto">
            {Object.entries(WALLPAPER_PRESETS).map(([key, { label, style }]) => {
              const active = isActive({ type: 'preset', value: key });
              return (
                <button
                  key={key}
                  onClick={() => setDraft({ type: 'preset', value: key })}
                  className={`relative h-16 rounded-xl border-2 flex items-end justify-center pb-1 transition ${active ? 'border-aurora-indigo' : 'border-aurora-border'}`}
                  style={style}
                >
                  {active && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-aurora-indigo flex items-center justify-center"><Check size={11} className="text-white" /></span>}
                  <span className="text-[10px] font-medium text-aurora-text bg-aurora-surface/70 px-1.5 rounded">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Colors */}
        {tab === 'color' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2.5">
              {WALLPAPER_COLORS.map(({ label, value }) => {
                const active = isActive({ type: 'color', value });
                return (
                  <button
                    key={value}
                    onClick={() => setDraft({ type: 'color', value })}
                    title={label}
                    className={`relative h-14 rounded-xl border-2 transition ${active ? 'border-aurora-indigo' : 'border-aurora-border'}`}
                    style={{ backgroundColor: value }}
                  >
                    {active && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-aurora-indigo flex items-center justify-center"><Check size={11} className="text-white" /></span>}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-3 text-sm text-aurora-text-secondary">
              Custom color
              <input
                type="color"
                value={draft.type === 'color' ? draft.value : '#F5F6FA'}
                onChange={(e) => setDraft({ type: 'color', value: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer bg-transparent"
              />
              {draft.type === 'color' && <span className="text-xs font-mono">{draft.value}</span>}
            </label>
          </div>
        )}

        {/* Photo */}
        {tab === 'photo' && (
          <div className="space-y-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-4 border-2 border-dashed border-aurora-border rounded-xl flex items-center justify-center gap-2 text-aurora-text-secondary hover:border-aurora-indigo hover:text-aurora-indigo transition disabled:opacity-50"
            >
              {uploading ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : <><ImagePlus size={18} /> {draft.type === 'image' ? 'Choose a different photo' : 'Choose a photo'}</>}
            </button>
            <p className="text-xs text-aurora-text-muted text-center">Pick an image from your device. A subtle overlay keeps messages readable.</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => setDraft({ type: 'preset', value: 'default' })} className="flex items-center gap-1.5 text-sm text-aurora-text-secondary hover:text-aurora-text">
            <RotateCcw size={14} /> Reset
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium border border-aurora-border text-aurora-text-secondary hover:bg-aurora-bg">Cancel</button>
            <button onClick={apply} className="px-4 py-2 rounded-xl text-sm font-semibold bg-aurora-indigo text-white hover:bg-aurora-indigo/90">Apply</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
