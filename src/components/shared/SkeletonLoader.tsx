import React from 'react';
import clsx from 'clsx';

interface SkeletonLoaderProps {
  variant?: 'text' | 'card' | 'avatar' | 'list';
  count?: number;
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  count = 1,
  className,
}) => {
  const shimmerClass = 'shimmer rounded-lg';

  const renderText = () => (
    <div className="space-y-3 w-full">
      <div className={clsx('h-4', shimmerClass, 'w-full')} />
      <div className={clsx('h-4', shimmerClass, 'w-5/6')} />
      <div className={clsx('h-4', shimmerClass, 'w-4/6')} />
    </div>
  );

  const renderCard = () => (
    <div className={clsx('rounded-2xl overflow-hidden bg-aurora-surface border border-aurora-border', className)}>
      <div className={clsx('h-40', shimmerClass, 'mb-4 rounded-none')} />
      <div className="space-y-3 px-4 pb-4">
        <div className={clsx('h-4', shimmerClass, 'w-full')} />
        <div className={clsx('h-4', shimmerClass, 'w-4/6')} />
      </div>
    </div>
  );

  const renderAvatar = () => (
    <div className="flex items-center gap-4">
      <div className={clsx('h-12 w-12 rounded-full', shimmerClass)} />
      <div className="flex-1 space-y-3">
        <div className={clsx('h-4', shimmerClass, 'w-32')} />
        <div className={clsx('h-3', shimmerClass, 'w-24')} />
      </div>
    </div>
  );

  const renderList = () => (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className={clsx('h-10 w-10 rounded-full', shimmerClass)} />
          <div className="flex-1 space-y-2">
            <div className={clsx('h-4', shimmerClass, 'w-32')} />
            <div className={clsx('h-3', shimmerClass, 'w-48')} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (variant) {
      case 'text':
        return renderText();
      case 'card':
        return renderCard();
      case 'avatar':
        return renderAvatar();
      case 'list':
        return renderList();
      default:
        return renderText();
    }
  };

  return (
    <div className={className}>
      {variant === 'list' ? (
        renderContent()
      ) : (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i}>{renderContent()}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkeletonLoader;
