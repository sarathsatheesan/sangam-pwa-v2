import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BusinessExtras, IndividualExtras } from '../../services/auth';
import { signUpWithEmail } from '../../services/auth';
import { getFeatureFlag } from '../../services/featureFlags';
import { AVATAR_OPTIONS, BUSINESS_TYPES, ETHNICITY_HIERARCHY } from '../../constants/config';
import { validateMerchantTIN } from '../../services/merchantValidation';
import { ChevronDown } from 'lucide-react';

type SignupStep = 0 | 1 | 2 | 3;

const INTEREST_OPTIONS = [
  'Technology', 'Arts & Culture', 'Sports', 'Music', 'Food & Cooking', 'Travel',
  'Reading', 'Fitness', 'Photography', 'Gaming', 'Movies & TV', 'Fashion',
  'Business', 'Education', 'Volunteering', 'Gardening',
];

interface FormData {
  accountType: 'individual' | 'business' | '';
  email: string;
  password: string;
  name: string;
  preferredName: string;
  phone: string;
  businessName: string;
  avatar: string;
  heritage: string[];
  city: string;
  profession: string;
  interests: string[];
  businessType: string;
  customBusinessType: string;
  isRegistered: boolean | null;
  tinNumber: string;
  profitStatus: 'profit' | 'non-profit' | '';
  tinValidationStatus: 'pending' | 'valid' | 'invalid' | 'not_checked';
  tinValidationMessage: string;
}

interface StepErrors {
  [key: string]: string;
}

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SignupStep>(0);
  const [formData, setFormData] = useState<FormData>({
    accountType: '',
    email: '',
    password: '',
    name: '',
    preferredName: '',
    phone: '',
    businessName: '',
    avatar: '',
    heritage: [],
    city: '',
    profession: '',
    interests: [],
    businessType: '',
    customBusinessType: '',
    isRegistered: null,
    tinNumber: '',
    profitStatus: '',
    tinValidationStatus: 'not_checked',
    tinValidationMessage: '',
  });
  const [errors, setErrors] = useState<StepErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedSubregions, setExpandedSubregions] = useState<Set<string>>(new Set());

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep0 = () => {
    const newErrors: StepErrors = {};
    if (!formData.accountType) {
      newErrors.accountType = 'Please select an account type';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep1 = () => {
    const newErrors: StepErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.phone.trim()) {
      if (formData.accountType === 'business') {
        newErrors.phone = 'Phone number is required for business accounts';
      }
    } else {
      const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    if (formData.accountType === 'business') {
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!formData.businessType) {
        newErrors.businessType = 'Please select a business type';
      }
      if (formData.businessType === 'Other' && !formData.customBusinessType.trim()) {
        newErrors.customBusinessType = 'Please specify your business type';
      }
      if (formData.isRegistered === null) {
        newErrors.isRegistered = 'Please indicate if your business is registered';
      }
      if (formData.isRegistered === true && !formData.tinNumber.trim()) {
        newErrors.tinNumber = 'TIN/EIN number is required for registered businesses';
      }
      if (!formData.profitStatus) {
        newErrors.profitStatus = 'Please select profit classification';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: StepErrors = {};
    if (!formData.avatar) {
      newErrors.avatar = 'Please select an avatar';
    }
    if (formData.heritage.length === 0) {
      newErrors.heritage = 'Please select your heritage';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: StepErrors = {};
    if (!formData.profession.trim()) {
      newErrors.profession = 'Profession is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleValidateTIN = async () => {
    if (!formData.tinNumber.trim()) return;

    updateFormData('tinValidationStatus', 'pending');
    updateFormData('tinValidationMessage', '');

    try {
      const result = await validateMerchantTIN(
        formData.tinNumber,
        formData.businessType,
        formData.businessName
      );

      setFormData((prev) => ({
        ...prev,
        tinValidationStatus: result.isValid ? 'valid' : 'invalid',
        tinValidationMessage: result.message,
      }));
    } catch (error) {
      setFormData((prev) => ({
        ...prev,
        tinValidationStatus: 'invalid',
        tinValidationMessage: 'Validation service unavailable. Your account will be reviewed.',
      }));
    }
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (validateStep0()) setCurrentStep(1);
    } else if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => (prev - 1) as SignupStep);
      setErrors({});
    } else {
      navigate('/auth/login');
    }
  };

  const handleCreateAccount = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const interests = formData.interests;

      let extras: BusinessExtras | IndividualExtras;

      if (formData.accountType === 'business') {
        const isUnregistered = formData.isRegistered === false;
        extras = {
          accountType: 'business',
          phone: formData.phone,
          businessName: formData.businessName,
          businessType: formData.businessType === 'Other'
            ? formData.customBusinessType
            : formData.businessType,
          customBusinessType: formData.businessType === 'Other'
            ? formData.customBusinessType
            : undefined,
          isRegistered: formData.isRegistered ?? false,
          tinNumber: formData.tinNumber || '',
          tinValidationStatus: isUnregistered
            ? 'not_checked'
            : formData.tinValidationStatus === 'pending'
              ? 'not_checked'
              : formData.tinValidationStatus,
          tinValidationDetails: formData.tinValidationMessage
            ? {
                checkedAt: new Date().toISOString(),
                message: formData.tinValidationMessage,
                confidence: formData.tinValidationStatus === 'valid' ? 90 : 50,
              }
            : undefined,
          profitStatus: formData.profitStatus as 'profit' | 'non-profit',
          adminReviewRequired: isUnregistered || formData.tinValidationStatus === 'invalid',
        };
      } else {
        extras = {
          accountType: 'individual',
          phone: formData.phone || undefined,
        };
      }

      const emailVerificationEnabled = await getFeatureFlag('auth_emailVerification', false);

      await signUpWithEmail(
        formData.email,
        formData.password,
        {
          name: formData.name,
          preferredName: formData.preferredName,
          avatar: formData.avatar,
          heritage: formData.heritage.join(', '),
          city: formData.city,
          profession: formData.profession,
          interests,
        },
        extras,
        emailVerificationEnabled
      );

      if (emailVerificationEnabled) {
        navigate('/auth/verify');
      } else if (formData.accountType === 'business' && formData.isRegistered === false) {
        alert('Account created! Your unregistered business profile is pending admin approval. Please allow 2-3 business days for verification before you can post listings.');
        navigate('/feed');
      } else {
        navigate('/feed');
      }
    } catch (error: any) {
      const errorMessage =
        error?.code === 'auth/email-already-in-use'
          ? 'Email is already registered'
          : error?.code === 'auth/weak-password'
            ? 'Password is too weak'
            : error?.message || 'Account creation failed';

      alert(`Sign Up Failed - ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep0 = () => (
    <div>
      <h2 className="text-2xl font-bold text-aurora-text mb-6">Select Account Type</h2>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => updateFormData('accountType', 'individual')}
          className={`p-6 rounded-xl text-center border-2 transition ${
            formData.accountType === 'individual'
              ? 'border-aurora-indigo bg-aurora-indigo/10'
              : 'border-aurora-border bg-aurora-surface hover:border-aurora-indigo'
          }`}
        >
          <div className="text-4xl mb-3">👤</div>
          <h3 className="text-lg font-bold text-aurora-text mb-1">Individual</h3>
          <p className="text-xs text-aurora-text-secondary">Personal account for community members</p>
        </button>

        <button
          onClick={() => updateFormData('accountType', 'business')}
          className={`p-6 rounded-xl text-center border-2 transition ${
            formData.accountType === 'business'
              ? 'border-aurora-indigo bg-aurora-indigo/10'
              : 'border-aurora-border bg-aurora-surface hover:border-aurora-indigo'
          }`}
        >
          <div className="text-4xl mb-3">🏢</div>
          <h3 className="text-lg font-bold text-aurora-text mb-1">Business</h3>
          <p className="text-xs text-aurora-text-secondary">For businesses serving the community</p>
        </button>
      </div>

      {errors.accountType && <p className="text-aurora-danger text-sm mt-3">{errors.accountType}</p>}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-bold text-aurora-text mb-6">
        {formData.accountType === 'business' ? 'Business Information' : 'Personal Information'}
      </h2>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Full Name</label>
        <input
          type="text"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) => updateFormData('name', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.name ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {errors.name && <p className="text-aurora-danger text-sm mt-2">{errors.name}</p>}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Email Address *</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={(e) => updateFormData('email', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.email ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {errors.email && <p className="text-aurora-danger text-sm mt-2">{errors.email}</p>}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Password *</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="At least 6 characters"
            value={formData.password}
            onChange={(e) => updateFormData('password', e.target.value)}
            className={`w-full px-4 py-3 pr-12 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
              errors.password ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text transition-colors p-1"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        {errors.password && <p className="text-aurora-danger text-sm mt-2">{errors.password}</p>}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-aurora-text mb-2">
          {formData.accountType === 'business' ? 'Phone Number *' : 'Phone Number (Optional)'}
        </label>
        <input
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={formData.phone}
          onChange={(e) => updateFormData('phone', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.phone ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {formData.accountType === 'business' && (
          <p className="text-xs text-aurora-text-secondary mt-2 italic">
            Business accounts require both email and phone for verification
          </p>
        )}
        {errors.phone && <p className="text-aurora-danger text-sm mt-2">{errors.phone}</p>}
      </div>

      {formData.accountType === 'business' && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-aurora-text mb-2">Business Name *</label>
            <input
              type="text"
              placeholder="Your Business Name"
              value={formData.businessName}
              onChange={(e) => updateFormData('businessName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                errors.businessName ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
              }`}
            />
            {errors.businessName && <p className="text-aurora-danger text-sm mt-2">{errors.businessName}</p>}
          </div>

          <div className="bg-aurora-surface-variant rounded-xl p-4 mb-6 border border-aurora-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏢</span>
              <h3 className="text-lg font-bold text-aurora-indigo">Business Details</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-aurora-text mb-2">Business Type *</label>
              <select
                value={formData.businessType}
                onChange={(e) => updateFormData('businessType', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                  errors.businessType ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
                }`}
              >
                <option value="">Select a business type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.businessType && <p className="text-aurora-danger text-sm mt-2">{errors.businessType}</p>}
            </div>

            {formData.businessType === 'Other' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-aurora-text mb-2">Describe Your Business *</label>
                <input
                  type="text"
                  placeholder="Enter your business type"
                  value={formData.customBusinessType}
                  onChange={(e) => updateFormData('customBusinessType', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                    errors.customBusinessType ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
                  }`}
                />
                {errors.customBusinessType && <p className="text-aurora-danger text-sm mt-2">{errors.customBusinessType}</p>}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-aurora-text mb-3">Is your business registered? *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateFormData('isRegistered', true)}
                  className={`flex-1 py-2 px-4 rounded-full font-semibold transition ${
                    formData.isRegistered === true
                      ? 'bg-aurora-indigo text-white'
                      : 'bg-aurora-surface text-aurora-text border-2 border-aurora-border hover:border-aurora-indigo'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => updateFormData('isRegistered', false)}
                  className={`flex-1 py-2 px-4 rounded-full font-semibold transition ${
                    formData.isRegistered === false
                      ? 'bg-aurora-indigo text-white'
                      : 'bg-aurora-surface text-aurora-text border-2 border-aurora-border hover:border-aurora-indigo'
                  }`}
                >
                  No
                </button>
              </div>
              {errors.isRegistered && <p className="text-aurora-danger text-sm mt-2">{errors.isRegistered}</p>}
            </div>

            {formData.isRegistered === true && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-aurora-text mb-2">TIN / EIN Number *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="XX-XXXXXXX"
                    value={formData.tinNumber}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d-]/g, '');
                      value = value.replace(/-/g, '');
                      if (value.length > 2) {
                        value = value.slice(0, 2) + '-' + value.slice(2, 11);
                      }
                      updateFormData('tinNumber', value);
                    }}
                    maxLength={11}
                    className={`flex-1 px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                      errors.tinNumber ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
                    }`}
                  />
                  <button
                    onClick={handleValidateTIN}
                    disabled={formData.tinValidationStatus === 'pending'}
                    className="px-4 py-3 bg-aurora-indigo text-white font-semibold rounded-xl hover:bg-aurora-indigo-dark disabled:opacity-50 transition whitespace-nowrap"
                  >
                    Validate
                  </button>
                </div>
                {errors.tinNumber && <p className="text-aurora-danger text-sm mt-2">{errors.tinNumber}</p>}

                {formData.tinValidationStatus === 'pending' && (
                  <p className="text-aurora-indigo text-sm mt-2">Validating...</p>
                )}
                {formData.tinValidationStatus === 'valid' && (
                  <p className="text-aurora-success text-sm mt-2">✓ {formData.tinValidationMessage}</p>
                )}
                {formData.tinValidationStatus === 'invalid' && (
                  <div>
                    <p className="text-amber-600 text-sm mt-2">⚠ {formData.tinValidationMessage}</p>
                    <p className="text-aurora-text-secondary text-xs mt-1 italic">Your account will be reviewed by our team</p>
                  </div>
                )}
              </div>
            )}

            {formData.isRegistered === false && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Admin Approval Required</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Unregistered business accounts require admin approval before you can post listings.
                      Please allow 2-3 business days for profile verification.
                    </p>
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-amber-800 mb-1">TIN / EIN Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="XX-XXXXXXX (if available)"
                        value={formData.tinNumber}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^\d-]/g, '');
                          value = value.replace(/-/g, '');
                          if (value.length > 2) {
                            value = value.slice(0, 2) + '-' + value.slice(2, 11);
                          }
                          updateFormData('tinNumber', value);
                        }}
                        maxLength={11}
                        className="w-full px-3 py-2 border border-amber-300 rounded-xl text-aurora-text placeholder-aurora-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-aurora-surface"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-aurora-text mb-3">Business Classification *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateFormData('profitStatus', 'profit')}
                  className={`flex-1 py-2 px-4 rounded-full font-semibold transition ${
                    formData.profitStatus === 'profit'
                      ? 'bg-aurora-indigo text-white'
                      : 'bg-aurora-surface text-aurora-text border-2 border-aurora-border hover:border-aurora-indigo'
                  }`}
                >
                  For Profit
                </button>
                <button
                  onClick={() => updateFormData('profitStatus', 'non-profit')}
                  className={`flex-1 py-2 px-4 rounded-full font-semibold transition ${
                    formData.profitStatus === 'non-profit'
                      ? 'bg-aurora-indigo text-white'
                      : 'bg-aurora-surface text-aurora-text border-2 border-aurora-border hover:border-aurora-indigo'
                  }`}
                >
                  Non-Profit
                </button>
              </div>
              {errors.profitStatus && <p className="text-aurora-danger text-sm mt-2">{errors.profitStatus}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold text-aurora-text mb-6">Profile Setup</h2>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-aurora-text mb-3">Choose Your Avatar</label>
        <div className="grid grid-cols-6 gap-3">
          {AVATAR_OPTIONS.map((avatar, index) => (
            <button
              key={index}
              onClick={() => updateFormData('avatar', avatar)}
              className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition border-2 ${
                formData.avatar === avatar
                  ? 'border-aurora-indigo bg-aurora-indigo/10'
                  : 'border-aurora-border bg-aurora-surface hover:border-aurora-indigo'
              }`}
            >
              {avatar}
            </button>
          ))}
        </div>
        {errors.avatar && <p className="text-aurora-danger text-sm mt-2">{errors.avatar}</p>}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Preferred Name</label>
        <p className="text-xs text-aurora-text-secondary mb-2">What should we call you? (optional)</p>
        <input
          type="text"
          placeholder="e.g. Sam, Priya, Mike"
          value={formData.preferredName}
          onChange={(e) => updateFormData('preferredName', e.target.value)}
          className="w-full px-4 py-3 border border-aurora-border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
        />
      </div>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-aurora-text mb-3">Your Heritage</label>
        <p className="text-xs text-aurora-text-secondary mb-3">Select one or more</p>
        <div className="space-y-1 border border-aurora-border rounded-xl max-h-64 overflow-y-auto">
          {ETHNICITY_HIERARCHY.map((group) => {
            const isRegionExpanded = expandedRegions.has(group.region);
            const selectedInRegion = group.subregions.reduce((sum, sub) => sum + sub.ethnicities.filter((e) => formData.heritage.includes(e)).length, 0);
            return (
              <div key={group.region} className="border-b border-aurora-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedRegions((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.region)) next.delete(group.region);
                    else next.add(group.region);
                    return next;
                  })}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
                >
                  <span className="text-xs font-bold text-aurora-text">{group.region}</span>
                  <div className="flex items-center gap-1.5">
                    {selectedInRegion > 0 && (
                      <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInRegion}</span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isRegionExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isRegionExpanded && (
                  <div className="bg-aurora-surface-variant/20">
                    {group.subregions.map((sub) => {
                      const isSubExpanded = expandedSubregions.has(sub.name);
                      const selectedInSub = sub.ethnicities.filter((e) => formData.heritage.includes(e)).length;
                      return (
                        <div key={sub.name}>
                          <button
                            type="button"
                            onClick={() => setExpandedSubregions((prev) => {
                              const next = new Set(prev);
                              if (next.has(sub.name)) next.delete(sub.name);
                              else next.add(sub.name);
                              return next;
                            })}
                            className="w-full pl-8 pr-4 py-2 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
                          >
                            <span className="text-xs font-semibold text-aurora-text-secondary">{sub.name}</span>
                            <div className="flex items-center gap-1.5">
                              {selectedInSub > 0 && (
                                <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInSub}</span>
                              )}
                              <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {isSubExpanded && (
                            <div className="bg-aurora-surface-variant/30">
                              {sub.ethnicities.map((eth) => (
                                <label
                                  key={eth}
                                  className="flex items-center gap-3 pl-12 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.heritage.includes(eth)}
                                    onChange={() =>
                                      updateFormData('heritage',
                                        formData.heritage.includes(eth)
                                          ? formData.heritage.filter((h) => h !== eth)
                                          : [...formData.heritage, eth]
                                      )
                                    }
                                    className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                                  />
                                  <span className="text-aurora-text">{eth}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {errors.heritage && <p className="text-aurora-danger text-sm mt-2">{errors.heritage}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold text-aurora-text mb-2">City</label>
        <input
          type="text"
          placeholder="Your city"
          value={formData.city}
          onChange={(e) => updateFormData('city', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.city ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {errors.city && <p className="text-aurora-danger text-sm mt-2">{errors.city}</p>}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold text-aurora-text mb-6">Professional & Interests</h2>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Profession</label>
        <input
          type="text"
          placeholder="e.g., Software Engineer, Entrepreneur"
          value={formData.profession}
          onChange={(e) => updateFormData('profession', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.profession ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {errors.profession && <p className="text-aurora-danger text-sm mt-2">{errors.profession}</p>}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-aurora-text mb-3">Interests (Optional)</label>
        <p className="text-xs text-aurora-text-secondary mb-3">Tap to select your interests</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = formData.interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => {
                  const newInterests = isSelected
                    ? formData.interests.filter((i) => i !== interest)
                    : [...formData.interests, interest];
                  updateFormData('interests', newInterests);
                }}
                className={`px-4 py-2 rounded-full font-semibold transition border-2 ${
                  isSelected
                    ? 'bg-aurora-indigo text-white border-aurora-indigo'
                    : 'bg-aurora-surface text-aurora-text border-aurora-border hover:border-aurora-indigo'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      {formData.accountType === 'business' && (
        <div className="bg-aurora-surface-variant rounded-xl p-4 border border-aurora-border">
          <h3 className="font-bold text-aurora-text mb-3">Account Summary</h3>
          <p className="text-sm text-aurora-text-secondary mb-1">Type: Business Account</p>
          <p className="text-sm text-aurora-text-secondary mb-1">Business: {formData.businessName}</p>
          <p className="text-sm text-aurora-text-secondary mb-1">
            Category: {formData.businessType === 'Other' ? formData.customBusinessType : formData.businessType}
          </p>
          <p className="text-sm text-aurora-text-secondary mb-1">
            Classification: {formData.profitStatus === 'profit' ? 'For Profit' : 'Non-Profit'}
          </p>
          <p className="text-sm text-aurora-text-secondary mb-1">
            Registered: {formData.isRegistered ? 'Yes' : 'No'}
          </p>
          <p className="text-sm text-aurora-text-secondary">
            TIN Status:{' '}
            <span
              className={
                formData.tinValidationStatus === 'valid'
                  ? 'text-aurora-success font-semibold'
                  : formData.isRegistered === false
                    ? 'text-amber-600 font-semibold'
                    : 'text-amber-600 font-semibold'
              }
            >
              {formData.isRegistered === false
                ? 'Pending Admin Approval (2-3 days)'
                : formData.tinValidationStatus === 'valid'
                  ? 'Verified'
                  : formData.tinValidationStatus === 'invalid'
                    ? 'Under Review'
                    : 'Not Verified'}
            </span>
          </p>
        </div>
      )}
    </div>
  );

  const progressPercent = ((currentStep + 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-aurora-surface-variant flex flex-col">
      {/* Header with Progress */}
      <div className="bg-aurora-indigo text-white pt-8 pb-8">
        <div className="max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold mb-1">Create Your Account</h1>
          <p className="text-aurora-indigo-light text-sm mb-4">Step {currentStep + 1} of 4</p>
          <div className="w-full bg-aurora-indigo-dark rounded-full h-2">
            <div
              className="bg-aurora-danger/100 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-10">
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>

      {/* Navigation Buttons */}
      <div className="max-w-md w-full mx-auto px-6 py-6 flex gap-3">
        <button
          onClick={handleBack}
          disabled={loading}
          className="flex-1 bg-aurora-surface text-aurora-text py-3 rounded-xl font-semibold border-2 border-aurora-border hover:border-aurora-indigo disabled:opacity-50 transition"
        >
          {currentStep === 0 ? 'Back to Login' : 'Back'}
        </button>

        <button
          onClick={currentStep === 3 ? handleCreateAccount : handleNext}
          disabled={loading}
          className="flex-1 bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-aurora-indigo-dark disabled:opacity-50 transition"
        >
          {loading ? 'Processing...' : currentStep === 3 ? 'Create Account' : 'Next'}
        </button>
      </div>
    </div>
  );
};
