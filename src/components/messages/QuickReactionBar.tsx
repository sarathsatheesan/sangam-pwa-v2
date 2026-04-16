/**
 * QuickReactionBar Component
 * Modal overlay with quick reaction emoji buttons
 */
export function QuickReactionBar({ onReact, onClose }: { onReact: (emoji: string) => void; onClose: () => void }) {
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="flex gap-2 p-3 rounded-full bg-white dark:bg-[var(--aurora-surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {reactions.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className="w-8 h-8 hover:scale-125 transition text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
