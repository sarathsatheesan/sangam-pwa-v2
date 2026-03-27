// ═════════════════════════════════════════════════════════════════════════════════
// STEP 3 — VERIFICATION
// KYC-toggle-aware: only renders fields that admin has enabled via feature flags.
// TIN entry, document upload, photo ID, beneficial ownership disclosure.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { useFeatureSettings } from '../../../contexts/FeatureSettingsContext';
import type { BusinessFormData } from '../../../reducers/businessReducer';
import { FormField } from './StepIdentity';
import type { StepProps } from './StepIdentity';

interface StepVerificationProps extends StepProps {
  enabledChecks: {
    tinRequired?: boolean;
    docUploadRequired?: boolean;
    docUploadCount?: boolean;
    photoIdRequired?: boolean;
    beneficialOwnership?: boolean;
  };
}

// ── Input style helper ──

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  background: 'var(--aurora-surface)',
  border: `1.5px solid ${hasError ? '#ef4444' : 'var(--aurora-border)'}`,
  color: 'var(--aurora-text-primary)',
  borderRadius: '0.75rem',
});

// ── Beneficial Owner row ──

interface OwnerEntry {
  name: string;
  title: string;
  ownershipPct: number;
  dob?: string;
}

const OwnerRow: React.FC<{
  owner: OwnerEntry;
  index: number;
  onUpdate: (index: number, field: keyof OwnerEntry, value: string | number) => void;
  onRemove: (index: number) => void;
}> = ({ owner, index, onUpdate, onRemove }) => (
  <div
    className="rounded-xl p-3 border mb-2"
    style={{ background: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold" style={{ color: 'var(--aurora-text-secondary)' }}>
        Owner #{index + 1}
      </span>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-xs text-red-500 font-medium"
      >
        Remove
      </button>
    </div>
    <div className="space-y-2">
      <input
        type="text"
        value={owner.name}
        onChange={(e) => onUpdate(index, 'name', e.target.value)}
        placeholder="Full legal name"
        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
        style={inputStyle(false)}
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={owner.title}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
          placeholder="Title (e.g., CEO)"
          className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
          style={inputStyle(false)}
        />
        <input
          type="number"
          value={owner.ownershipPct || ''}
          onChange={(e) => onUpdate(index, 'ownershipPct', parseInt(e.target.value) || 0)}
          placeholder="%"
          min={1}
          max={100}
          className="w-20 px-3 py-2 text-sm rounded-lg outline-none text-center"
          style={inputStyle(false)}
        />
      </div>
    </div>
  </div>
);

// ── Component ──

const StepVerification: React.FC<StepVerificationProps> = ({
  formData,
  updateField,
  errors,
  country,
  enabledChecks,
}) => {
  const { isFeatureEnabled } = useFeatureSettings();
  const [photoIdFile, setPhotoIdFile] = useState<File | null>(null);

  // Check if ANY verification is enabled
  const hasAnyVerification =
    enabledChecks.tinRequired ||
    enabledChecks.docUploadRequired ||
    enabledChecks.photoIdRequired ||
    enabledChecks.beneficialOwnership ||
    isFeatureEnabled('business_sos_lookup') ||
    isFeatureEnabled('business_identity_verification');

  // Beneficial owners handlers
  const owners = (formData.beneficialOwners || []) as OwnerEntry[];

  const addOwner = useCallback(() => {
    const updated = [...owners, { name: '', title: '', ownershipPct: 0 }];
    updateField('beneficialOwners', updated);
  }, [owners, updateField]);

  const updateOwner = useCallback((index: number, field: keyof OwnerEntry, value: string | number) => {
    const updated = [...owners];
    updated[index] = { ...updated[index], [field]: value };
    updateField('beneficialOwners', updated);
  }, [owners, updateField]);

  const removeOwner = useCallback((index: number) => {
    const updated = owners.filter((_, i) => i !== index);
    updateField('beneficialOwners', updated);
  }, [owners, updateField]);

  // If no verification is enabled, show a pass-through message
  if (!hasAnyVerification) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--aurora-text-primary)' }}>
          No Verification Required
        </h3>
        <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
          Your admin has not enabled additional verification steps.
          Click Continue to proceed.
        </p>
      </div>
    );
  }

  const tinLabel = country === 'CA' ? 'Business Number (BN)' : 'Employer Identification Number (EIN)';
  const tinPlaceholder = country === 'CA' ? '123456789' : '12-3456789';
  const minDocs = enabledChecks.docUploadCount ? 2 : 1;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          Business Verification
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
          Complete the verification steps below to prove your business is legitimate.
        </p>
      </div>

      {/* ── TIN / EIN / BN ── */}
      {enabledChecks.tinRequired && (
        <div
          className="rounded-xl p-4 border mb-4"
          style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔢</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
              Tax Identification
            </h3>
          </div>

          <FormField label={tinLabel} error={errors.tin} required>
            <input
              type="text"
              value={formData.tin || ''}
              onChange={(e) => updateField('tin', e.target.value)}
              placeholder={tinPlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
              style={inputStyle(!!errors.tin)}
              maxLength={country === 'CA' ? 15 : 10}
            />
          </FormField>

          {isFeatureEnabled('business_tin_validation') && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-tertiary)' }}>
              Your {country === 'CA' ? 'BN' : 'EIN'} will be verified against{' '}
              {country === 'CA' ? 'CRA' : 'IRS'} records.
            </p>
          )}
        </div>
      )}

      {/* ── Document Upload ── */}
      {enabledChecks.docUploadRequired && (
        <div
          className="rounded-xl p-4 border mb-4"
          style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📄</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
              Business Documents
            </h3>
          </div>

          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
            Upload at least {minDocs} document{minDocs > 1 ? 's' : ''}: articles of incorporation,
            business license, or registration certificate.
          </p>

          <div
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-indigo-400"
            style={{ borderColor: errors.verificationDocs ? '#ef4444' : 'var(--aurora-border)' }}
            onClick={() => document.getElementById('doc-upload')?.click()}
            role="button"
            aria-label="Upload verification documents"
          >
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-primary)' }}>
              Tap to upload documents
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-tertiary)' }}>
              PDF, JPG, or PNG — max 10 MB each
            </p>
            <input
              id="doc-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const existing = formData.verificationDocs || [];
                updateField('verificationDocs', [...existing, ...files] as any);
              }}
            />
          </div>

          {/* Uploaded file list */}
          {(formData.verificationDocs as File[] | undefined)?.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--aurora-surface)', border: '1px solid var(--aurora-border)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">📄</span>
                <span className="text-xs truncate" style={{ color: 'var(--aurora-text-primary)' }}>
                  {file.name}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--aurora-text-tertiary)' }}>
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = [...(formData.verificationDocs as File[] || [])];
                  updated.splice(i, 1);
                  updateField('verificationDocs', updated as any);
                }}
                className="text-red-500 text-xs font-medium ml-2"
              >
                ✕
              </button>
            </div>
          ))}

          {errors.verificationDocs && (
            <p className="mt-2 text-xs text-red-500" role="alert">{errors.verificationDocs}</p>
          )}
        </div>
      )}

      {/* ── Photo ID ── */}
      {enabledChecks.photoIdRequired && (
        <div
          className="rounded-xl p-4 border mb-4"
          style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🪪</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
              Government Photo ID
            </h3>
          </div>

          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
            Upload a clear photo of your government-issued ID (driver's license, passport, or state ID).
          </p>

          {isFeatureEnabled('business_identity_verification') ? (
            <div
              className="rounded-xl p-4 text-center border"
              style={{
                background: 'var(--aurora-surface)',
                borderColor: 'var(--aurora-accent)',
              }}
            >
              <div className="text-2xl mb-2">🔒</div>
              <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-primary)' }}>
                Stripe Identity Verification
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-tertiary)' }}>
                Widget integration coming in Phase 5
              </p>
            </div>
          ) : (
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-indigo-400"
              style={{ borderColor: errors.photoId ? '#ef4444' : 'var(--aurora-border)' }}
              onClick={() => document.getElementById('photo-id-upload')?.click()}
              role="button"
              aria-label="Upload government photo ID"
            >
              {photoIdFile ? (
                <div className="flex items-center justify-center gap-2">
                  <span>🪪</span>
                  <span className="text-sm" style={{ color: 'var(--aurora-text-primary)' }}>
                    {photoIdFile.name}
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-2">🪪</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-primary)' }}>
                    Tap to upload photo ID
                  </p>
                </>
              )}
              <input
                id="photo-id-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoIdFile(file);
                    // Mark as uploaded in form data for validation
                    updateField('verificationDocs', [
                      ...((formData.verificationDocs as File[]) || []),
                      file,
                    ] as any);
                  }
                }}
              />
            </div>
          )}

          {errors.photoId && (
            <p className="mt-2 text-xs text-red-500" role="alert">{errors.photoId}</p>
          )}
        </div>
      )}

      {/* ── Beneficial Ownership ── */}
      {enabledChecks.beneficialOwnership && (
        <div
          className="rounded-xl p-4 border mb-4"
          style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">👥</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
              Beneficial Ownership
            </h3>
          </div>

          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
            List all individuals who own 25% or more of the business.
          </p>

          {owners.map((owner, i) => (
            <OwnerRow
              key={i}
              owner={owner}
              index={i}
              onUpdate={updateOwner}
              onRemove={removeOwner}
            />
          ))}

          <button
            type="button"
            onClick={addOwner}
            className="w-full py-2 rounded-xl text-sm font-medium border-2 border-dashed transition-colors hover:border-indigo-400"
            style={{
              color: 'var(--aurora-accent)',
              borderColor: 'var(--aurora-border)',
            }}
          >
            + Add Owner
          </button>

          {errors.beneficialOwners && (
            <p className="mt-2 text-xs text-red-500" role="alert">{errors.beneficialOwners}</p>
          )}
        </div>
      )}

      {/* ── SOS Lookup info ── */}
      {isFeatureEnabled('business_sos_lookup') && (
        <div
          className="rounded-xl p-3 border flex items-start gap-2 mb-4"
          style={{
            background: 'var(--aurora-surface-alt)',
            borderColor: 'var(--aurora-border)',
          }}
        >
          <span className="text-sm mt-0.5">🏛️</span>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Your business will be verified against the{' '}
            {country === 'CA'
              ? 'Provincial Business Registry'
              : 'Secretary of State records'}
            {formData.stateOfIncorp ? ` in ${formData.stateOfIncorp}` : ''}.
            This happens automatically after submission.
          </p>
        </div>
      )}

      {/* Admin review notice */}
      {isFeatureEnabled('business_admin_review_required') && (
        <div
          className="rounded-xl p-3 border flex items-start gap-2"
          style={{
            background: 'oklch(0.95 0.02 250)',
            borderColor: 'oklch(0.8 0.05 250)',
          }}
        >
          <span className="text-sm mt-0.5">ℹ️</span>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Your listing will be reviewed by an admin before it goes live.
            You'll be notified once it's approved.
          </p>
        </div>
      )}
    </div>
  );
};

export default StepVerification;
