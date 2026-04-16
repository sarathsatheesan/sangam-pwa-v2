import { Bold, Italic, Strikethrough, Code } from 'lucide-react';

/**
 * FormattingToolbar Component
 * Inline formatting options for markdown syntax
 */
export function FormattingToolbar({ onFormat }: { onFormat: (label: string, wrap: string) => void }) {
  const buttons = [
    { icon: Bold, label: 'Bold', wrap: '**' },
    { icon: Italic, label: 'Italic', wrap: '*' },
    { icon: Strikethrough, label: 'Strike', wrap: '~~' },
    { icon: Code, label: 'Code', wrap: '`' },
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-[var(--aurora-surface)] border-t border-[var(--aurora-border)]">
      {buttons.map(({ icon: Icon, label, wrap }) => (
        <button
          key={label}
          onClick={() => onFormat(label, wrap)}
          className="p-1.5 rounded hover:bg-[var(--aurora-input)] transition text-aurora-text"
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
