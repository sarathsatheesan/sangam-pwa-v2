export function SkeletonCard() {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="w-16 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}
