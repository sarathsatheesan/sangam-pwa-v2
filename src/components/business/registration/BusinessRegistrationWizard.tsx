// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS REGISTRATION WIZARD — Shell
// 5-step wizard: Identity → Location → Verification → Details → Review
// Manages step state, validation gating, auto-save draft, and navigation.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useFeatureSettings } from '../../../contexts/FeatureSettingsContext';
import { validateSignupStep } from '../businessValidation';
import { submitBusinessRegistration, saveDraft, loadDraft } from '../../../services/businessRegistration';
import type { BusinessFormData, BusinessSignupDraft } from '../../../reducers/businessReducer';
import StepIdentity from './StepIdentity';
import StepLocation from './StepLocation';
import StepVerification from './StepVerification';
import StepDetails from './StepDetails';
import StepReview from './StepReview';

// ── Step metadata ──

const STEPS = [
  { id: 1, label: 'Identity', icon: '🏷️' },
  { id: 2, label: 'Location', icon: '📍' },
  { id: 3, label: 'Verification', icon: '🔐' },
  { id: 4, label: 'Details', icon: '📸' },
  { id: 5, label: 'Review', icon: '✅' },
] as const;

// ── Initial form state ──

function createInitialFormData(): Partial<BusinessFormData> {
  return {
    name: '',
    category: '',
    desc: '',
    location: '',
    phone: '',
    website: '',
    email: '',
    hours: '',
    country: '',
    tin: '',
    tinType: '',
    stateOfIncorp: '',
    verificationDocs: [],
    beneficialOwners: [],
  };
}

// ── Component ──

const BusinessRegistrationWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<BusinessFormData>>(createInitialFormData);
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Derive country for validators
  const country = (formData.country as 'US' | 'CA') || 'US';

  // Build enabled-checks from feature flags
  const enabledChecks = useMemo(() => ({
    tinRequired: isFeatureEnabled('business_tin_required'),
    docUploadRequired: isFeatureEnabled('business_doc_upload_required'),
    docUploadCount: isFeatureEnabled('business_doc_upload_count'),
    photoIdRequired: isFeatureEnabled('business_photo_id_required'),
    beneficialOwnership: isFeatureEnabled('business_beneficial_ownership'),
  }), [isFeatureEnabled]);

  // ── Field updater ──
  const updateField = useCallback(<K extends keyof BusinessFormData>(
    field: K,
    value: BusinessFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field on change
    setErrors((prev) => {
      if (prev[field as string]) {
        const next = { ...prev };
        delete next[field as string];
        return next;
      }
      return prev;
    });
  }, []);

  // ── Step validation ──
  const validateCurrentStep = useCallback((): boolean => {
    const stepErrors = validateSignupStep(currentStep, formData as Record<string, any>, country, enabledChecks);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [currentStep, formData, country, enabledChecks]);

  // ── Navigation ──
  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep((s) => Math.min(s + 1, 5));
  }, [currentStep, validateCurrentStep]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    setErrors({});
  }, []);

  const goToStep = useCallback((step: number) => {
    // Can only jump to completed steps or current+1 if current is valid
    if (step <= currentStep || completedSteps.has(step) || completedSteps.has(step - 1)) {
      setErrors({});
      setCurrentStep(step);
    }
  }, [currentStep, completedSteps]);

  // ── Submit to Firestore ──
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;
    if (!user) {
      setErrors({ submit: 'You must be signed in to register a business.' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitBusinessRegistration({
        formData,
        photos: formPhotos,
        coverPhotoIndex,
        userId: user.uid,
        userName: userProfile?.name || user.displayName || 'Unknown',
        userEmail: userProfile?.email || user.email || '',
        adminReviewRequired: isFeatureEnabled('business_admin_review_required'),
      });

      if (result.success) {
        setSubmitted(true);
        setCompletedSteps((prev) => new Set([...prev, 5]));
      } else {
        setErrors({ submit: result.error || 'Registration failed. Please try again.' });
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrors({ submit: err.message || 'An unexpected error occurred.' });
    } finally {
      setSubmitting(false);
    }
  }, [validateCurrentStep, user, userProfile, formData, formPhotos, coverPhotoIndex, isFeatureEnabled]);

  // ── Auto-save draft (debounced, every 5s after changes) ──
  useEffect(() => {
    if (!user?.uid || submitted) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      saveDraft(
        user.uid,
        currentStep,
        Array.from(completedSteps),
        formData,
      ).catch((err) => console.warn('Draft save failed:', err));
    }, 5000);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [user?.uid, currentStep, completedSteps, formData, submitted]);

  // ── Load draft on mount ──
  useEffect(() => {
    if (!user?.uid) return;
    loadDraft(user.uid).then((draft) => {
      if (draft) {
        setFormData((prev) => ({ ...prev, ...draft.formData }));
        setCurrentStep(draft.currentStep);
        setCompletedSteps(new Set(draft.completedSteps));
      }
    }).catch(() => {});
  }, [user?.uid]);

  // ── Step renderer ──
  const renderStep = () => {
    const stepProps = { formData, updateField, errors, country };

    switch (currentStep) {
      case 1:
        return <StepIdentity {...stepProps} />;
      case 2:
        return <StepLocation {...stepProps} formPhotos={formPhotos} />;
      case 3:
        return <StepVerification {...stepProps} enabledChecks={enabledChecks} />;
      case 4:
        return (
          <StepDetails
            {...stepProps}
            formPhotos={formPhotos}
            setFormPhotos={setFormPhotos}
            coverPhotoIndex={coverPhotoIndex}
            setCoverPhotoIndex={setCoverPhotoIndex}
          />
        );
      case 5:
        return (
          <StepReview
            {...stepProps}
            formPhotos={formPhotos}
            coverPhotoIndex={coverPhotoIndex}
            onGoToStep={goToStep}
          />
        );
      default:
        return null;
    }
  };

  // ── Progress bar width ──
  const progressPct = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  // ── Success state ──
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--aurora-success, #22c55e)' }}
        >
          <span className="text-4xl">✓</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--aurora-text-primary)' }}>
          Application Submitted!
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--aurora-text-secondary)' }}>
          {isFeatureEnabled('business_admin_review_required')
            ? "Your business registration is under review. You\u2019ll receive a notification once it\u2019s approved."
            : "Your business has been registered successfully! It should appear in the directory shortly."}
        </p>
        <button
          onClick={() => navigate('/business')}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--aurora-accent)' }}
        >
          Go to Business Directory
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 mb-2">
        <button
          onClick={() => navigate('/business')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--aurora-surface-alt)' }}
          aria-label="Back to business directory"
        >
          <span className="text-lg">←</span>
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
            Register Business
          </h1>
          <p className="text-xs" style={{ color: 'var(--aurora-text-tertiary)' }}>
            Step {currentStep} of {STEPS.length} — {STEPS[currentStep - 1].label}
          </p>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div className="px-4 mb-4">
        {/* Progress bar */}
        <div className="relative h-1 rounded-full mb-3" style={{ background: 'var(--aurora-border)' }}>
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: 'var(--aurora-accent)',
            }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-between">
          {STEPS.map((step) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = step.id === currentStep;
            const isClickable = step.id <= currentStep || isCompleted || completedSteps.has(step.id - 1);

            return (
              <button
                key={step.id}
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className="flex flex-col items-center gap-1 transition-opacity"
                style={{ opacity: isClickable ? 1 : 0.4 }}
                aria-label={`Step ${step.id}: ${step.label}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200"
                  style={{
                    background: isCurrent
                      ? 'var(--aurora-accent)'
                      : isCompleted
                        ? 'var(--aurora-success, #22c55e)'
                        : 'var(--aurora-surface-alt)',
                    color: isCurrent || isCompleted
                      ? 'white'
                      : 'var(--aurora-text-tertiary)',
                    boxShadow: isCurrent ? '0 0 0 3px rgba(99, 102, 241, 0.2)' : 'none',
                  }}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: isCurrent
                      ? 'var(--aurora-accent)'
                      : isCompleted
                        ? 'var(--aurora-success, #22c55e)'
                        : 'var(--aurora-text-tertiary)',
                  }}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="px-4">
        {renderStep()}
      </div>

      {/* ── Submit error banner ── */}
      {errors.submit && (
        <div className="px-4 mb-2">
          <div className="rounded-xl p-3 text-sm text-red-700 bg-red-50 border border-red-200" role="alert">
            {errors.submit}
          </div>
        </div>
      )}

      {/* ── Navigation buttons (fixed bottom) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-3 flex gap-3 border-t"
        style={{
          background: 'var(--aurora-bg)',
          borderColor: 'var(--aurora-border)',
          maxWidth: '32rem',
          margin: '0 auto',
        }}
      >
        {currentStep > 1 && (
          <button
            onClick={goBack}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{
              border: '1px solid var(--aurora-border)',
              color: 'var(--aurora-text-primary)',
              background: 'var(--aurora-surface)',
            }}
          >
            Back
          </button>
        )}

        {currentStep < 5 ? (
          <button
            onClick={goNext}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--aurora-accent)' }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--aurora-accent)' }}
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BusinessRegistrationWizard;
