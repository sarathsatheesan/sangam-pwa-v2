import { ChevronDown, AlertCircle } from 'lucide-react';
import type { OrderForContext } from '@/services/cateringService';
import { useState } from 'react';

interface OrderForSelectorProps {
  value: OrderForContext;
  onChange: (ctx: OrderForContext) => void;
  errors?: { recipientName?: string; recipientContact?: string; organizationName?: string };
  onBlur?: (field: string) => void;
}

const relationships = ['Colleague', 'Family', 'Friend', 'Client', 'Other'];

export default function OrderForSelector({
  value,
  onChange,
  errors,
  onBlur,
}: OrderForSelectorProps) {
  const [expandedOption, setExpandedOption] = useState<
    'self' | 'individual' | 'organization' | 'anonymous'
  >(value.type);

  const handleTypeChange = (
    type: 'self' | 'individual' | 'organization' | 'anonymous'
  ) => {
    setExpandedOption(type);
    if (type === 'self') {
      onChange({ type: 'self' });
    } else if (type === 'individual') {
      onChange({
        type: 'individual',
        recipientName: '',
        recipientContact: '',
        relationship: 'Colleague',
      });
    } else if (type === 'organization') {
      onChange({
        type: 'organization',
        organizationName: '',
        department: '',
      });
    } else {
      onChange({ type: 'anonymous' });
    }
  };

  return (
    <div className="space-y-4">
      {/* For Myself */}
      <button
        onClick={() => handleTypeChange('self')}
        className={`w-full text-left p-4 border rounded-lg transition-all ${
          value.type === 'self'
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              value.type === 'self'
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-gray-300'
            }`}
          />
          <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>For Myself</span>
        </div>
      </button>

      {/* On Behalf of Someone */}
      <div>
        <button
          onClick={() => handleTypeChange('individual')}
          className={`w-full text-left p-4 border rounded-lg transition-all ${
            value.type === 'individual'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border-2 transition-colors ${
                value.type === 'individual'
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-gray-300'
              }`}
            />
            <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
              On Behalf of Someone
            </span>
          </div>
        </button>

        {value.type === 'individual' && (
          <div className="mt-3 ml-8 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                Recipient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Full name"
                value={value.recipientName || ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    recipientName: e.target.value,
                  })
                }
                onBlur={() => onBlur?.('recipientName')}
                className={`w-full rounded-lg border px-4 py-2.5 focus:ring-2 outline-none transition-colors ${
                  errors?.recipientName ? 'border-red-400 focus:ring-red-300 focus:border-red-500' : 'focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                style={!errors?.recipientName ? { borderColor: 'var(--aurora-border)' } : {}}
              />
              {errors?.recipientName && (
                <p className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                  <AlertCircle size={12} /> {errors.recipientName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                Recipient Contact <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Email or phone number"
                value={value.recipientContact || ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    recipientContact: e.target.value,
                  })
                }
                onBlur={() => onBlur?.('recipientContact')}
                className={`w-full rounded-lg border px-4 py-2.5 focus:ring-2 outline-none transition-colors ${
                  errors?.recipientContact ? 'border-red-400 focus:ring-red-300 focus:border-red-500' : 'focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                style={!errors?.recipientContact ? { borderColor: 'var(--aurora-border)' } : {}}
              />
              {errors?.recipientContact && (
                <p className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                  <AlertCircle size={12} /> {errors.recipientContact}
                </p>
              )}
            </div>

            <div className="relative">
              <select
                value={value.relationship || 'Colleague'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    relationship: e.target.value,
                  })
                }
                className="w-full rounded-lg border px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-colors bg-white pr-10"
                style={{ borderColor: 'var(--aurora-border)' }}
              >
                {relationships.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--aurora-text-secondary)' }} />
            </div>
          </div>
        )}
      </div>

      {/* For a Team/Department */}
      <div>
        <button
          onClick={() => handleTypeChange('organization')}
          className={`w-full text-left p-4 border rounded-lg transition-all ${
            value.type === 'organization'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border-2 transition-colors ${
                value.type === 'organization'
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-gray-300'
              }`}
            />
            <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
              For a Team/Department
            </span>
          </div>
        </button>

        {value.type === 'organization' && (
          <div className="mt-3 ml-8 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Company or organization name"
                value={value.organizationName || ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    organizationName: e.target.value,
                  })
                }
                onBlur={() => onBlur?.('organizationName')}
                className={`w-full rounded-lg border px-4 py-2.5 focus:ring-2 outline-none transition-colors ${
                  errors?.organizationName ? 'border-red-400 focus:ring-red-300 focus:border-red-500' : 'focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                style={!errors?.organizationName ? { borderColor: 'var(--aurora-border)' } : {}}
              />
              {errors?.organizationName && (
                <p className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                  <AlertCircle size={12} /> {errors.organizationName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                Department (optional)
              </label>
              <input
                type="text"
                placeholder="Department name"
                value={value.department || ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    department: e.target.value,
                  })
                }
                className="w-full rounded-lg border px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Prefer Not to Say */}
      <button
        onClick={() => handleTypeChange('anonymous')}
        className={`w-full text-left p-4 border rounded-lg transition-all ${
          value.type === 'anonymous'
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              value.type === 'anonymous'
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-gray-300'
            }`}
          />
          <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Prefer Not to Say</span>
        </div>
      </button>
    </div>
  );
}
