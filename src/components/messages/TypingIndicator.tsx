/**
 * TypingIndicator Component
 * Animated typing indicator with bouncing dots
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--aurora-accent)' }}>
      <span>typing</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
}
