import React from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 px-4',
        className
      )}
    >
      {icon && (
        <div className="mb-6 text-5xl opacity-40">
          {icon}
        </div>
      )}

      <h3 className="text-xl font-semibold text-aurora-text mb-2 text-center">
        {title}
      </h3>

      <p className="text-aurora-text-secondary text-center mb-6 max-w-sm">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 aurora-gradient text-white rounded-2xl hover:shadow-aurora-glow transition-all font-medium btn-press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
