// ═════════════════════════════════════════════════════════════════════════════════
// STEP 5 — REVIEW & SUBMIT
// Read-only summary of all wizard data. Allows jumping back to any step to edit.
// Final submit button triggers Firestore write (placeholder for Phase 5 backend).
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useFeatureSettings } from '../../../contexts/FeatureSettingsContext';
import type { BusinessFormData } from '../../../reducers/businessReducer';
import type { StepProps } from './StepIdentity';

interface StepReviewProps extends StepProps {
  formPhotos: string[];
  coverPhotoIndex: number;
  onGoToStep: (step: number) => void;
}

// ── Section card ──

const ReviewSection: React.FC<{
  title: string;
  icon: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}> = ({ title, icon, step, onEdit, children }) => (
  <div
    className="rounded-xl border p-4 mb-3"
    style={{ background: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          {title}
        </h3>
      </div>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="text-xs font-semibold"
        style={{ color: 'var(--aurora-accent)' }}
      >
        Edit
      </button>
    </div>
    {children}
  </div>
);

// ── Field row ──

const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1 border-b last:border-b-0" style={{ borderColor: 'var(--aurora-border)' }}>
      <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{label}</span>
      <span className="text-xs font-medium text-right max-w-[55%] truncate" style={{ color: 'var(--aurora-text-primary)' }}>
        {String(value)}
      </span>
    </div>
  );
};

// ── Component ──

const StepReview: React.FC<StepReviewProps> = ({
  formData,
  formPhotos,
  coverPhotoIndex,
  onGoToStep,
  country,
}) => {
  const { isFeatureEnabled } = useFeatureSettings();
  const addr = formData.addressComponents;

  const formattedAddress = addr
    ? `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`
    : formData.location || 'Not provided';

  // Parse hours for display
  let hoursDisplay = 'Not set';
  try {
    if (formData.hours) {
      const parsed = JSON.parse(formData.hours);
      const openDays = Object.entries(parsed)
        .filter(([, v]: [string, any]) => !v.closed)
        .map(([d, v]: [string, any]) => `${d.slice(0, 3)} ${v.open}–${v.close}`);
      hoursDisplay = openDays.length > 0 ? openDays.join(', ') : 'All days closed';
    }
  } catch {
    hoursDisplay = formData.hours || 'Not set';
  }

  const tinLabel = country === 'CA' ? 'Business Number' : 'EIN';
  const maskedTin = formData.tin
    ? formData.tin.slice(0, 2) + '•'.repeat(Math.max(0, formData.tin.length - 4)) + formData.tin.slice(-2)
    : null;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          Review Your Listing
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
          Please review all details below before submitting.
          Tap "Edit" on any section to make changes.
        </p>
      </div>

      {/* Cover photo preview */}
      {formPhotos.length > 0 && (
        <div className="rounded-xl overflow-hidden border mb-3" style={{ borderColor: 'var(--aurora-border)' }}>
          <img
            src={formPhotos[coverPhotoIndex] || formPhotos[0]}
            alt="Cover preview"
            className="w-full h-36 object-cover"
          />
          <div
            className="px-3 py-1.5 text-[10px]"
            style={{ background: 'var(--aurora-surface-alt)', color: 'var(--aurora-text-tertiary)' }}
          >
            Cover photo • {formPhotos.length} photo{formPhotos.length !== 1 ? 's' : ''} total
          </div>
        </div>
      )}

      {/* ── Section 1: Identity ── */}
      <ReviewSection title="Business Identity" icon="🏷️" step={1} onEdit={onGoToStep}>
        <Field label="Business Name" value={formData.name} />
        <Field label="Category" value={formData.category} />
        <Field label="Country" value={country === 'CA' ? '🇨🇦 Canada' : '🇺🇸 United States'} />
        <Field label="Email" value={formData.email} />
        <Field label="Phone" value={formData.phone} />
        {formData.desc && <Field label="Description" value={formData.desc} />}
        <Field label="Service Radius" value={formData.serviceRadius ? `${formData.serviceRadius} miles` : undefined} />
        {(formData.cuisineTypes as string[] | undefined)?.length ? (
          <Field label="Cuisine Types" value={(formData.cuisineTypes as string[]).join(', ')} />
        ) : null}
      </ReviewSection>

      {/* ── Section 2: Location ── */}
      <ReviewSection title="Location" icon="📍" step={2} onEdit={onGoToStep}>
        <Field label="Address" value={formattedAddress} />
        {formData.stateOfIncorp && (
          <Field
            label={country === 'CA' ? 'Province of Incorp.' : 'State of Incorp.'}
            value={formData.stateOfIncorp}
          />
        )}
        {formData.latitude && formData.longitude && (
          <Field
            label="Coordinates"
            value={`${typeof formData.latitude === 'number' ? formData.latitude.toFixed(4) : '—'}, ${typeof formData.longitude === 'number' ? formData.longitude.toFixed(4) : '—'}`}
          />
        )}
      </ReviewSection>

      {/* ── Section 3: Verification ── */}
      <ReviewSection title="Verification" icon="🔐" step={3} onEdit={onGoToStep}>
        {maskedTin ? (
          <Field label={tinLabel} value={maskedTin} />
        ) : (
          <Field label={tinLabel} value={isFeatureEnabled('business_tin_required') ? 'Required — not provided' : 'Not required'} />
        )}
        <Field
          label="Documents"
          value={
            (formData.verificationDocs as File[] | undefined)?.length
              ? `${(formData.verificationDocs as File[]).length} uploaded`
              : isFeatureEnabled('business_doc_upload_required')
                ? 'Required — none uploaded'
                : 'Not required'
          }
        />
        {(formData.beneficialOwners as any[])?.length > 0 && (
          <Field
            label="Beneficial Owners"
            value={`${(formData.beneficialOwners as any[]).length} listed`}
          />
        )}
        {isFeatureEnabled('business_admin_review_required') && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs">ℹ️</span>
            <span className="text-[10px]" style={{ color: 'var(--aurora-text-tertiary)' }}>
              Admin review required before listing goes live
            </span>
          </div>
        )}
      </ReviewSection>

      {/* ── Section 4: Details ── */}
      <ReviewSection title="Details & Photos" icon="📸" step={4} onEdit={onGoToStep}>
        <Field label="Website" value={formData.website} />
        <Field label="Price Range" value={formData.priceRange} />
        <Field label="Year Established" value={formData.yearEstablished} />
        <Field label="Hours" value={hoursDisplay} />
        <Field label="Photos" value={formPhotos.length > 0 ? `${formPhotos.length} photo${formPhotos.length !== 1 ? 's' : ''}` : 'None'} />
        {(formData.menu || formData.services) && (
          <Field label="Menu/Services" value="Provided" />
        )}
      </ReviewSection>

      {/* ── Terms notice ── */}
      <div
        className="rounded-xl p-3 border flex items-start gap-2 mt-2"
        style={{
          background: 'var(--aurora-surface-alt)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <span className="text-sm mt-0.5">📋</span>
        <p className="text-[10px]" style={{ color: 'var(--aurora-text-secondary)' }}>
          By submitting, you confirm that all information provided is accurate and that you are
          authorized to register this business on ethniCity. Your listing will be subject to our
          community guidelines and terms of service.
        </p>
      </div>
    </div>
  );
};

export default StepReview;
