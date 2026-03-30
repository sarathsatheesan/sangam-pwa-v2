// ═════════════════════════════════════════════════════════════════════════════════
// MULTI-DATE PICKER
// Calendar component for selecting multiple dates.
// Used for recurring order skip dates (Phase 7 Sprint 2).
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MultiDatePickerProps {
  selectedDates: string[];          // ISO format: YYYY-MM-DD
  onChange: (dates: string[]) => void;
  disablePast?: boolean;
  label?: string;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getTodayIso(): string {
  return toIso(new Date());
}

export default function MultiDatePicker({
  selectedDates,
  onChange,
  disablePast = true,
  label,
}: MultiDatePickerProps) {
  const today = getTodayIso();
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{ date: string; day: number; inMonth: boolean; isPast: boolean }> = [];

    // Padding for days before the 1st
    for (let i = 0; i < startDow; i++) {
      const d = new Date(viewYear, viewMonth, -startDow + i + 1);
      days.push({ date: toIso(d), day: d.getDate(), inMonth: false, isPast: toIso(d) < today });
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      days.push({ date: toIso(d), day, inMonth: true, isPast: toIso(d) < today });
    }

    // Padding for days after the last (fill to 42 = 6 rows)
    while (days.length < 42) {
      const d = new Date(viewYear, viewMonth + 1, days.length - startDow - daysInMonth + 1);
      days.push({ date: toIso(d), day: d.getDate(), inMonth: false, isPast: toIso(d) < today });
    }

    return days;
  }, [viewYear, viewMonth, today]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const toggleDate = (iso: string) => {
    if (selectedSet.has(iso)) {
      onChange(selectedDates.filter((d) => d !== iso));
    } else {
      onChange([...selectedDates, iso].sort());
    }
  };

  const removeDate = (iso: string) => {
    onChange(selectedDates.filter((d) => d !== iso));
  };

  const formatChip = (iso: string): string => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--aurora-text, #374151)' }}>
          {label}
        </label>
      )}

      {/* Calendar */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--aurora-surface, #fff)', borderColor: 'var(--aurora-border, #E5E7EB)' }}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: 'var(--aurora-text-muted, #9CA3AF)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map(({ date, day, inMonth, isPast }) => {
            const isSelected = selectedSet.has(date);
            const isToday = date === today;
            const isDisabled = disablePast && isPast;

            return (
              <button
                key={date}
                type="button"
                disabled={isDisabled}
                onClick={() => toggleDate(date)}
                className={`relative h-8 w-full rounded-lg text-xs font-medium transition-all ${
                  !inMonth ? 'opacity-30' : ''
                } ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50'}`}
                style={{
                  backgroundColor: isSelected ? '#6366F1' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--aurora-text)',
                  ...(isToday && !isSelected ? { boxShadow: 'inset 0 0 0 1.5px #6366F1' } : {}),
                }}
                aria-label={`${isSelected ? 'Remove' : 'Select'} ${date}`}
                aria-pressed={isSelected}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected dates as chips */}
      {selectedDates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDates.map((iso) => (
            <span
              key={iso}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#4F46E5' }}
            >
              {formatChip(iso)}
              <button
                type="button"
                onClick={() => removeDate(iso)}
                className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${iso}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
