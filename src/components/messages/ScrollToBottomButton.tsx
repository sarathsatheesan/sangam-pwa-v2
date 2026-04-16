import { ChevronDown } from 'lucide-react';

/**
 * ScrollToBottomButton Component
 * Floating button to jump to latest messages
 */
export function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-aurora-indigo text-white shadow-lg hover:bg-opacity-90 transition"
      title="Scroll to bottom"
    >
      <ChevronDown size={18} />
    </button>
  );
}
