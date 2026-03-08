import React from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = 'Search...', value, onChange, onClear, className, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aurora-text-muted pointer-events-none"
          size={20}
        />
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            'w-full pl-10 pr-10 py-2 bg-aurora-surface-variant border border-aurora-border rounded-xl',
            'focus:outline-none focus:ring-2 focus:ring-aurora-indigo focus:border-transparent',
            'placeholder:text-aurora-text-muted text-aurora-text',
            'transition-colors',
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-aurora-text-muted hover:text-aurora-text transition-colors"
            type="button"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
