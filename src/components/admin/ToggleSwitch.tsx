export function ToggleSwitch({
  enabled,
  onChange,
  size = 'md',
}: {
  enabled: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const dot = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const translate = size === 'sm' ? (enabled ? 'translate-x-4' : 'translate-x-0.5') : (enabled ? 'translate-x-5.5' : 'translate-x-0.5');
  return (
    <button
      onClick={onChange}
      className={`${dims} rounded-full transition-colors duration-200 relative flex items-center ${
        enabled ? 'bg-[#FF3008]' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`${dot} rounded-full bg-white shadow-md transform transition-transform duration-200 ${translate}`}
      />
    </button>
  );
}
