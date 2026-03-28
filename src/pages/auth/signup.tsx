import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BusinessExtras, IndividualExtras } from '../../services/auth';
import { signUpWithEmail } from '../../services/auth';
import { getFeatureFlag, getFeatureFlags } from '../../services/featureFlags';
import { AVATAR_OPTIONS, BUSINESS_TYPES } from '../../constants/config';
import CountryEthnicitySelector from '../../components/CountryEthnicitySelector';
import { validateMerchantTIN } from '../../services/merchantValidation';
import { ChevronDown } from 'lucide-react';
import { useGooglePlaces } from '../../hooks/useGooglePlaces';
import type { PlacePrediction } from '../../hooks/useGooglePlaces';
import { hasAnyKycStep, US_STATES, CA_PROVINCES } from '../../utils/kycHelpers';
import type { KycEnabledChecks } from '../../utils/kycHelpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';

// ── Constants ──

const INTEREST_OPTIONS = [
  'Technology', 'Arts & Culture', 'Sports', 'Music', 'Food & Cooking', 'Travel',
  'Reading', 'Fitness', 'Photography', 'Gaming', 'Movies & TV', 'Fashion',
  'Business', 'Education', 'Volunteering', 'Gardening',
];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// ── Form Data ──

interface FormData {
  // Step 0
  accountType: 'individual' | 'business' | '';
  // Step 1 — common
  email: string;
  password: string;
  name: string;
  preferredName: string;
  phone: string;
  // Step 1 — business basics
  businessName: string;
  businessType: string;
  customBusinessType: string;
  isRegistered: boolean | null;
  tinNumber: string;
  profitStatus: 'profit' | 'non-profit' | '';
  tinValidationStatus: 'pending' | 'valid' | 'invalid' | 'not_checked';
  tinValidationMessage: string;
  // Step 1 — business address (Google Places)
  businessStreet: string;
  businessCity: string;
  businessState: string;
  businessZip: string;
  businessCountry: string;
  businessLat: number;
  businessLng: number;
  businessFormattedAddress: string;
  stateOfIncorp: string;
  // Step 2 — profile
  avatar: string;
  heritage: string[];
  city: string;
  // Step 3 — KYC (business only, conditional)
  verificationDocs: File[];
  photoIdFile: File | null;
  beneficialOwners: { name: string; title: string; ownershipPct: number }[];
  // Step 4 (or 3 for individual) — professional & interests
  profession: string;
  interests: string[];
}

interface StepErrors {
  [key: string]: string;
}

// ── Helpers ──

/** Check if email already exists in Firestore users collection */
async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase().trim()),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false; // fail open — Firebase Auth will catch dupes anyway
  }
}

// ── Component ──

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  // ── Load KYC feature flags directly from Firestore (works without auth) ──
  const [kycChecks, setKycChecks] = useState<KycEnabledChecks>({
    signupEnabled: false,
    tinRequired: false,
    tinServerValidation: false,
    docUploadRequired: false,
    requireTwoDocs: false,
    sosLookup: false,
    photoIdRequired: false,
    beneficialOwnership: false,
    identityVerification: false,
    adminReviewRequired: false,
  });
  const [kycFlagsLoaded, setKycFlagsLoaded] = useState(false);

  useEffect(() => {
    const KYC_FLAG_KEYS = [
      'business_signup_enabled',
      'business_tin_required',
      'business_tin_validation',
      'business_doc_upload_required',
      'business_doc_upload_count',
      'business_sos_lookup',
      'business_photo_id_required',
      'business_beneficial_ownership',
      'business_identity_verification',
      'business_admin_review_required',
    ];
    // Default all to false — same as DEFAULT_FEATURES for KYC flags
    const defaults: Record<string, boolean> = {};
    KYC_FLAG_KEYS.forEach((k) => { defaults[k] = false; });

    getFeatureFlags(KYC_FLAG_KEYS, defaults).then((flags) => {
      setKycChecks({
        signupEnabled: flags.business_signup_enabled ?? false,
        tinRequired: flags.business_tin_required ?? false,
        tinServerValidation: flags.business_tin_validation ?? false,
        docUploadRequired: flags.business_doc_upload_required ?? false,
        requireTwoDocs: flags.business_doc_upload_count ?? false,
        sosLookup: flags.business_sos_lookup ?? false,
        photoIdRequired: flags.business_photo_id_required ?? false,
        beneficialOwnership: flags.business_beneficial_ownership ?? false,
        identityVerification: flags.business_identity_verification ?? false,
        adminReviewRequired: flags.business_admin_review_required ?? false,
      });
      setKycFlagsLoaded(true);
    });
  }, []);

  const showKycStep = hasAnyKycStep(kycChecks);

  // For business accounts: steps are 0,1,2,3(KYC),4(interests)
  // For individual accounts: steps are 0,1,2,3(interests)
  // If no KYC flags enabled for business: 0,1,2,3(interests) same as individual
  const isBusiness = (accountType: string) => accountType === 'business';
  const getTotalSteps = (accountType: string) => {
    if (isBusiness(accountType) && showKycStep) return 5;
    return 4;
  };
  const getLastStep = (accountType: string) => getTotalSteps(accountType) - 1;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    accountType: '',
    email: '',
    password: '',
    name: '',
    preferredName: '',
    phone: '',
    businessName: '',
    businessType: '',
    customBusinessType: '',
    isRegistered: null,
    tinNumber: '',
    profitStatus: '',
    tinValidationStatus: 'not_checked',
    tinValidationMessage: '',
    businessStreet: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    businessCountry: '',
    businessLat: 0,
    businessLng: 0,
    businessFormattedAddress: '',
    stateOfIncorp: '',
    avatar: '',
    heritage: [],
    city: '',
    verificationDocs: [],
    photoIdFile: null,
    beneficialOwners: [],
    profession: '',
    interests: [],
  });
  const [errors, setErrors] = useState<StepErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // ── Google Places ──
  const {
    isLoaded: placesLoaded,
    loadError: placesError,
    predictions,
    isSearching: placesSearching,
    getPlacePredictions,
    getPlaceDetails,
    clearPredictions,
  } = useGooglePlaces({
    apiKey: GOOGLE_MAPS_API_KEY,
    country: (formData.businessCountry as 'US' | 'CA' | '') || '',
    types: ['street_address', 'premise', 'subpremise', 'route'],
  });
  // Fall back to manual entry if Google Places fails to load
  const placesAvailable = placesLoaded && !placesError;

  const [addressInput, setAddressInput] = useState('');
  const [showPredictions, setShowPredictions] = useState(false);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);

  const handleAddressInputChange = useCallback(
    (value: string) => {
      setAddressInput(value);
      if (addressDebounce.current) clearTimeout(addressDebounce.current);
      if (value.trim().length < 3) {
        clearPredictions();
        setShowPredictions(false);
        return;
      }
      addressDebounce.current = setTimeout(() => {
        getPlacePredictions(value);
        setShowPredictions(true);
      }, 300);
    },
    [getPlacePredictions, clearPredictions],
  );

  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setAddressInput(prediction.description);
      setShowPredictions(false);
      clearPredictions();

      const details = await getPlaceDetails(prediction.place_id);
      if (details) {
        setFormData((prev) => ({
          ...prev,
          businessStreet: details.addressComponents.street,
          businessCity: details.addressComponents.city,
          businessState: details.addressComponents.state,
          businessZip: details.addressComponents.zip,
          businessCountry: details.addressComponents.country,
          businessLat: details.latitude,
          businessLng: details.longitude,
          businessFormattedAddress: details.formattedAddress,
        }));
      }
    },
    [getPlaceDetails, clearPredictions],
  );

  // Close predictions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (predictionsRef.current && !predictionsRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Validations ──

  const validateStep0 = () => {
    const newErrors: StepErrors = {};
    if (!formData.accountType) newErrors.accountType = 'Please select an account type';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep1 = async () => {
    const newErrors: StepErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    } else {
      // Duplicate email check
      setEmailChecking(true);
      try {
        const exists = await checkEmailExists(formData.email);
        if (exists) newErrors.email = 'This email is already registered. Please use a different email or sign in.';
      } finally {
        setEmailChecking(false);
      }
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
      if (!phoneRegex.test(formData.phone)) newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.accountType === 'business') {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!formData.businessType) newErrors.businessType = 'Please select a business type';
      if (formData.businessType === 'Other' && !formData.customBusinessType.trim()) {
        newErrors.customBusinessType = 'Please specify your business type';
      }
      if (formData.isRegistered === null) newErrors.isRegistered = 'Please indicate if your business is registered';
      if (formData.isRegistered === true && !formData.tinNumber.trim()) {
        newErrors.tinNumber = 'TIN/EIN number is required for registered businesses';
      }
      if (!formData.profitStatus) newErrors.profitStatus = 'Please select profit classification';

      // Address validation
      if (!formData.businessStreet.trim() && !addressInput.trim()) {
        newErrors.businessStreet = 'Business address is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: StepErrors = {};
    if (!formData.avatar) newErrors.avatar = 'Please select an avatar';
    if (formData.heritage.length === 0) newErrors.heritage = 'Please select your heritage';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateKycStep = () => {
    const newErrors: StepErrors = {};
    const minDocs = kycChecks.requireTwoDocs ? 2 : 1;

    if (kycChecks.docUploadRequired && formData.verificationDocs.length < minDocs) {
      newErrors.verificationDocs = `Please upload at least ${minDocs} document${minDocs > 1 ? 's' : ''}`;
    }
    if (kycChecks.photoIdRequired && !formData.photoIdFile) {
      newErrors.photoId = 'Government photo ID is required';
    }
    if (kycChecks.beneficialOwnership && formData.beneficialOwners.length === 0) {
      newErrors.beneficialOwners = 'Please add at least one beneficial owner';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateInterestsStep = () => {
    const newErrors: StepErrors = {};
    if (!formData.profession.trim()) newErrors.profession = 'Profession is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── TIN Validation ──

  const handleValidateTIN = async () => {
    if (!formData.tinNumber.trim()) return;
    updateFormData('tinValidationStatus', 'pending');
    updateFormData('tinValidationMessage', '');
    try {
      const result = await validateMerchantTIN(
        formData.tinNumber,
        formData.businessType,
        formData.businessName,
      );
      setFormData((prev) => ({
        ...prev,
        tinValidationStatus: result.isValid ? 'valid' : 'invalid',
        tinValidationMessage: result.message,
      }));
    } catch {
      setFormData((prev) => ({
        ...prev,
        tinValidationStatus: 'invalid',
        tinValidationMessage: 'Validation service unavailable. Your account will be reviewed.',
      }));
    }
  };

  // ── Navigation ──

  const handleNext = async () => {
    if (currentStep === 0) {
      if (validateStep0()) setCurrentStep(1);
    } else if (currentStep === 1) {
      const valid = await validateStep1();
      if (valid) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) {
        // For business with KYC: go to KYC step (3)
        // For business without KYC or individual: go to interests step (3)
        setCurrentStep(3);
      }
    } else if (currentStep === 3 && isBusiness(formData.accountType) && showKycStep) {
      // Validate KYC step, then go to interests
      if (validateKycStep()) setCurrentStep(4);
    }
    // Last step is handled by handleCreateAccount
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setErrors({});
    } else {
      navigate('/auth/login');
    }
  };

  // ── Upload documents to Firebase Storage ──
  const uploadDocuments = async (uid: string): Promise<{ docUrls: string[]; photoIdUrl: string }> => {
    const docUrls: string[] = [];
    let photoIdUrl = '';

    // Upload verification docs
    for (const file of formData.verificationDocs) {
      try {
        const storageRef = ref(storage, `business-verification/${uid}/docs/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        docUrls.push(url);
      } catch (err) {
        console.warn('Failed to upload doc:', file.name, err);
      }
    }

    // Upload photo ID
    if (formData.photoIdFile) {
      try {
        const storageRef = ref(storage, `business-verification/${uid}/photo-id/${Date.now()}_${formData.photoIdFile.name}`);
        await uploadBytes(storageRef, formData.photoIdFile);
        photoIdUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn('Failed to upload photo ID:', err);
      }
    }

    return { docUrls, photoIdUrl };
  };

  // ── Create Account ──

  const handleCreateAccount = async () => {
    if (!validateInterestsStep()) return;
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
          adminReviewRequired: isUnregistered || formData.tinValidationStatus === 'invalid' || kycChecks.adminReviewRequired,
          // New address fields
          businessAddress: {
            street: formData.businessStreet,
            city: formData.businessCity,
            state: formData.businessState,
            zip: formData.businessZip,
            country: formData.businessCountry,
            lat: formData.businessLat,
            lng: formData.businessLng,
            formattedAddress: formData.businessFormattedAddress,
          },
          stateOfIncorp: formData.stateOfIncorp,
          // KYC data placeholders — actual URLs set after upload
          beneficialOwners: formData.beneficialOwners.length > 0 ? formData.beneficialOwners : undefined,
        } as any;
      } else {
        extras = {
          accountType: 'individual',
          phone: formData.phone || undefined,
        };
      }

      const emailVerificationEnabled = await getFeatureFlag('auth_emailVerification', false);

      const user = await signUpWithEmail(
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
        emailVerificationEnabled,
      );

      // Upload documents after user is created (need uid for storage path)
      if (formData.accountType === 'business' && (formData.verificationDocs.length > 0 || formData.photoIdFile)) {
        try {
          const { docUrls, photoIdUrl } = await uploadDocuments(user.uid);
          // Update user doc with uploaded file URLs
          const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
          const userDocRef = firestoreDoc(db, 'users', user.uid);
          const updateData: Record<string, any> = {};
          if (docUrls.length > 0) updateData.verificationDocUrls = docUrls;
          if (photoIdUrl) updateData.photoIdUrl = photoIdUrl;
          if (Object.keys(updateData).length > 0) {
            await updateDoc(userDocRef, updateData);
          }
        } catch (err) {
          console.warn('Document upload after signup failed:', err);
          // Non-fatal — account is created, admin can request docs later
        }
      }

      if (emailVerificationEnabled) {
        navigate('/auth/verify');
      } else if (formData.accountType === 'business' && (formData.isRegistered === false || kycChecks.adminReviewRequired)) {
        alert('Account created! Your business profile is pending admin approval. Please allow 2-3 business days for verification before you can post listings.');
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

  // ═══════════════════════════════════════════════════════════
  // STEP RENDERERS
  // ═══════════════════════════════════════════════════════════

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

      {/* Full Name */}
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

      {/* Email */}
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
        {emailChecking && <p className="text-aurora-indigo text-xs mt-1">Checking email availability...</p>}
        {errors.email && <p className="text-aurora-danger text-sm mt-2">{errors.email}</p>}
      </div>

      {/* Password */}
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

      {/* Phone */}
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

      {/* ── Business-specific fields ── */}
      {formData.accountType === 'business' && (
        <>
          {/* Business Name */}
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

          {/* ── Business Details Card ── */}
          <div className="bg-aurora-surface-variant rounded-xl p-4 mb-6 border border-aurora-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏢</span>
              <h3 className="text-lg font-bold text-aurora-indigo">Business Details</h3>
            </div>

            {/* Business Type */}
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
                  <option key={type} value={type}>{type}</option>
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

            {/* Is Registered */}
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

            {/* TIN for registered */}
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
                      if (value.length > 2) value = value.slice(0, 2) + '-' + value.slice(2, 11);
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
                {formData.tinValidationStatus === 'pending' && <p className="text-aurora-indigo text-sm mt-2">Validating...</p>}
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

            {/* Unregistered notice */}
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
                          if (value.length > 2) value = value.slice(0, 2) + '-' + value.slice(2, 11);
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

            {/* Profit status */}
            <div className="mb-4">
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

          {/* ── Business Address ── */}
          <div className="bg-aurora-surface-variant rounded-xl p-4 mb-6 border border-aurora-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📍</span>
              <h3 className="text-lg font-bold text-aurora-indigo">Business Address</h3>
            </div>

            {/* Google Places Autocomplete (only when available) */}
            {placesAvailable && (
              <div className="mb-4 relative" ref={predictionsRef}>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Search Address</label>
                <input
                  type="text"
                  placeholder="Start typing your business address..."
                  value={addressInput}
                  onChange={(e) => handleAddressInputChange(e.target.value)}
                  onFocus={() => { if (predictions.length > 0) setShowPredictions(true); }}
                  className="w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo border-aurora-border"
                />
                {placesSearching && (
                  <div className="absolute right-3 top-[42px]">
                    <div className="w-4 h-4 border-2 border-aurora-indigo border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Predictions dropdown */}
                {showPredictions && predictions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {predictions.map((pred) => (
                      <button
                        key={pred.place_id}
                        type="button"
                        onClick={() => handleSelectPrediction(pred)}
                        className="w-full text-left px-4 py-3 hover:bg-aurora-surface-variant transition border-b border-aurora-border last:border-b-0"
                      >
                        <p className="text-sm font-medium text-aurora-text truncate">
                          {pred.structured_formatting?.main_text || pred.description}
                        </p>
                        {pred.structured_formatting?.secondary_text && (
                          <p className="text-xs text-aurora-text-secondary truncate">
                            {pred.structured_formatting.secondary_text}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Loading state indicator */}
            {!placesAvailable && !placesError && GOOGLE_MAPS_API_KEY && (
              <div className="mb-3 flex items-center gap-2 text-xs text-aurora-text-secondary">
                <div className="w-3 h-3 border-2 border-aurora-indigo border-t-transparent rounded-full animate-spin" />
                Loading address autocomplete...
              </div>
            )}

            {/* Error or no API key — show manual entry notice */}
            {(placesError || !GOOGLE_MAPS_API_KEY) && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                {placesError
                  ? 'Address autocomplete unavailable. Please enter your address manually below.'
                  : 'Google Places API key not configured. Please enter your address manually below.'}
              </div>
            )}

            {/* Manual address fields — always visible (editable after autocomplete, or for manual entry) */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">Street Address *</label>
                <input
                  type="text"
                  placeholder="123 Main Street"
                  value={formData.businessStreet}
                  onChange={(e) => updateFormData('businessStreet', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-sm text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                    errors.businessStreet ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
                  }`}
                />
                {errors.businessStreet && <p className="text-aurora-danger text-xs mt-1">{errors.businessStreet}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">City</label>
                  <input
                    type="text"
                    placeholder="City"
                    value={formData.businessCity}
                    onChange={(e) => updateFormData('businessCity', e.target.value)}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl text-sm text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">State / Province</label>
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.businessState}
                    onChange={(e) => updateFormData('businessState', e.target.value)}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl text-sm text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">ZIP / Postal Code</label>
                  <input
                    type="text"
                    placeholder="ZIP"
                    value={formData.businessZip}
                    onChange={(e) => updateFormData('businessZip', e.target.value)}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl text-sm text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">Country</label>
                  <select
                    value={formData.businessCountry}
                    onChange={(e) => updateFormData('businessCountry', e.target.value)}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  >
                    <option value="">Select...</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>
              </div>

              {/* State of Incorporation */}
              <div>
                <label className="block text-xs font-semibold text-aurora-text-secondary mb-1">
                  {formData.businessCountry === 'CA' ? 'Province of Incorporation' : 'State of Incorporation'}
                </label>
                <select
                  value={formData.stateOfIncorp}
                  onChange={(e) => updateFormData('stateOfIncorp', e.target.value)}
                  className="w-full px-3 py-2 border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                >
                  <option value="">Select...</option>
                  {(formData.businessCountry === 'CA' ? CA_PROVINCES : US_STATES).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
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
        <p className="text-xs text-aurora-text-secondary mb-3">Select your country and EthniZity</p>

        <CountryEthnicitySelector
          selected={formData.heritage}
          onChange={(val) => updateFormData('heritage', val)}
          maxHeight="320px"
        />
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

  // ── KYC Step (business only, feature-flag gated) ──
  const renderKycStep = () => {
    const minDocs = kycChecks.requireTwoDocs ? 2 : 1;

    return (
      <div>
        <h2 className="text-2xl font-bold text-aurora-text mb-2">Business Verification</h2>
        <p className="text-sm text-aurora-text-secondary mb-6">
          Complete the verification steps below to prove your business is legitimate.
        </p>

        {/* ── Document Upload ── */}
        {kycChecks.docUploadRequired && (
          <div className="bg-aurora-surface-variant rounded-xl p-4 border border-aurora-border mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📄</span>
              <h3 className="text-sm font-bold text-aurora-text">Business Documents</h3>
            </div>
            <p className="text-xs text-aurora-text-secondary mb-3">
              Upload at least {minDocs} document{minDocs > 1 ? 's' : ''}: articles of incorporation,
              business license, or registration certificate.
            </p>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-aurora-indigo ${
                errors.verificationDocs ? 'border-red-500' : 'border-aurora-border'
              }`}
              onClick={() => document.getElementById('signup-doc-upload')?.click()}
              role="button"
            >
              <div className="text-3xl mb-2">📎</div>
              <p className="text-sm font-medium text-aurora-text">Tap to upload documents</p>
              <p className="text-[10px] mt-1 text-aurora-text-secondary">PDF, JPG, or PNG — max 10 MB each</p>
              <input
                id="signup-doc-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setFormData((prev) => ({
                    ...prev,
                    verificationDocs: [...prev.verificationDocs, ...files],
                  }));
                }}
              />
            </div>
            {formData.verificationDocs.map((file, i) => (
              <div key={i} className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg bg-aurora-surface border border-aurora-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">📄</span>
                  <span className="text-xs text-aurora-text truncate">{file.name}</span>
                  <span className="text-[10px] text-aurora-text-secondary flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      verificationDocs: prev.verificationDocs.filter((_, idx) => idx !== i),
                    }));
                  }}
                  className="text-red-500 text-xs font-medium ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
            {errors.verificationDocs && <p className="text-aurora-danger text-xs mt-2">{errors.verificationDocs}</p>}
          </div>
        )}

        {/* ── Photo ID ── */}
        {kycChecks.photoIdRequired && (
          <div className="bg-aurora-surface-variant rounded-xl p-4 border border-aurora-border mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🪪</span>
              <h3 className="text-sm font-bold text-aurora-text">Government Photo ID</h3>
            </div>
            <p className="text-xs text-aurora-text-secondary mb-3">
              Upload a clear photo of your government-issued ID (driver's license, passport, or state ID).
            </p>

            {kycChecks.identityVerification ? (
              <div className="rounded-xl p-4 text-center border border-aurora-border bg-aurora-surface">
                <div className="text-2xl mb-2">🔒</div>
                <p className="text-sm font-medium text-aurora-text">Stripe Identity Verification</p>
                <p className="text-[10px] mt-1 text-aurora-text-secondary">Widget integration coming soon</p>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-aurora-indigo ${
                  errors.photoId ? 'border-red-500' : 'border-aurora-border'
                }`}
                onClick={() => document.getElementById('signup-photo-id')?.click()}
                role="button"
              >
                {formData.photoIdFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <span>🪪</span>
                    <span className="text-sm text-aurora-text">{formData.photoIdFile.name}</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">🪪</div>
                    <p className="text-sm font-medium text-aurora-text">Tap to upload photo ID</p>
                  </>
                )}
                <input
                  id="signup-photo-id"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    updateFormData('photoIdFile', file);
                  }}
                />
              </div>
            )}
            {errors.photoId && <p className="text-aurora-danger text-xs mt-2">{errors.photoId}</p>}
          </div>
        )}

        {/* ── Beneficial Ownership ── */}
        {kycChecks.beneficialOwnership && (
          <div className="bg-aurora-surface-variant rounded-xl p-4 border border-aurora-border mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👥</span>
              <h3 className="text-sm font-bold text-aurora-text">Beneficial Ownership</h3>
            </div>
            <p className="text-xs text-aurora-text-secondary mb-3">
              List all individuals who own 25% or more of the business.
            </p>

            {formData.beneficialOwners.map((owner, i) => (
              <div key={i} className="rounded-xl p-3 border border-aurora-border bg-aurora-surface mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-aurora-text-secondary">Owner #{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        beneficialOwners: prev.beneficialOwners.filter((_, idx) => idx !== i),
                      }));
                    }}
                    className="text-xs text-red-500 font-medium"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={owner.name}
                    onChange={(e) => {
                      const updated = [...formData.beneficialOwners];
                      updated[i] = { ...updated[i], name: e.target.value };
                      updateFormData('beneficialOwners', updated);
                    }}
                    placeholder="Full legal name"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-aurora-border text-aurora-text bg-aurora-surface focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={owner.title}
                      onChange={(e) => {
                        const updated = [...formData.beneficialOwners];
                        updated[i] = { ...updated[i], title: e.target.value };
                        updateFormData('beneficialOwners', updated);
                      }}
                      placeholder="Title (e.g., CEO)"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-aurora-border text-aurora-text bg-aurora-surface focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                    />
                    <input
                      type="number"
                      value={owner.ownershipPct || ''}
                      onChange={(e) => {
                        const updated = [...formData.beneficialOwners];
                        updated[i] = { ...updated[i], ownershipPct: parseInt(e.target.value) || 0 };
                        updateFormData('beneficialOwners', updated);
                      }}
                      placeholder="%"
                      min={1}
                      max={100}
                      className="w-20 px-3 py-2 text-sm rounded-lg border border-aurora-border text-aurora-text bg-aurora-surface text-center focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  beneficialOwners: [...prev.beneficialOwners, { name: '', title: '', ownershipPct: 0 }],
                }));
              }}
              className="w-full py-2 rounded-xl text-sm font-medium border-2 border-dashed border-aurora-border text-aurora-indigo transition-colors hover:border-aurora-indigo"
            >
              + Add Owner
            </button>
            {errors.beneficialOwners && <p className="text-aurora-danger text-xs mt-2">{errors.beneficialOwners}</p>}
          </div>
        )}

        {/* ── SOS Lookup info ── */}
        {kycChecks.sosLookup && (
          <div className="rounded-xl p-3 border border-aurora-border bg-aurora-surface-variant flex items-start gap-2 mb-4">
            <span className="text-sm mt-0.5">🏛️</span>
            <p className="text-xs text-aurora-text-secondary">
              Your business will be verified against the{' '}
              {formData.businessCountry === 'CA' ? 'Provincial Business Registry' : 'Secretary of State records'}
              {formData.stateOfIncorp ? ` in ${formData.stateOfIncorp}` : ''}.
              This happens automatically after submission.
            </p>
          </div>
        )}

        {/* Admin review notice */}
        {kycChecks.adminReviewRequired && (
          <div className="rounded-xl p-3 border border-blue-200 bg-blue-50 flex items-start gap-2">
            <span className="text-sm mt-0.5">ℹ️</span>
            <p className="text-xs text-blue-700">
              Your listing will be reviewed by an admin before it goes live.
              You'll be notified once it's approved.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderInterestsStep = () => (
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

      {/* Account Summary for business */}
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
          {formData.businessFormattedAddress && (
            <p className="text-sm text-aurora-text-secondary mb-1">
              Address: {formData.businessFormattedAddress}
            </p>
          )}
          <p className="text-sm text-aurora-text-secondary">
            TIN Status:{' '}
            <span
              className={
                formData.tinValidationStatus === 'valid'
                  ? 'text-aurora-success font-semibold'
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
          {formData.verificationDocs.length > 0 && (
            <p className="text-sm text-aurora-text-secondary mt-1">
              Documents: {formData.verificationDocs.length} uploaded
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ── Determine what to render for each step ──

  const renderCurrentStep = () => {
    if (currentStep === 0) return renderStep0();
    if (currentStep === 1) return renderStep1();
    if (currentStep === 2) return renderStep2();

    // Step 3+: depends on account type and KYC flags
    if (isBusiness(formData.accountType) && showKycStep) {
      if (currentStep === 3) return renderKycStep();
      if (currentStep === 4) return renderInterestsStep();
    }

    // Individual or business without KYC
    if (currentStep === 3) return renderInterestsStep();

    return null;
  };

  const totalSteps = getTotalSteps(formData.accountType);
  const lastStep = getLastStep(formData.accountType);
  const isLastStep = currentStep === lastStep;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="bg-aurora-surface-variant flex flex-col" style={{ minHeight: 'var(--app-height, 100vh)' }}>
      {/* Header with Progress */}
      <div className="bg-aurora-indigo text-white pt-8 pb-8">
        <div className="max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold mb-1">Create Your Account</h1>
          <p className="text-aurora-indigo-light text-sm mb-4">Step {currentStep + 1} of {totalSteps}</p>
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
        {renderCurrentStep()}
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
          onClick={isLastStep ? handleCreateAccount : handleNext}
          disabled={loading || emailChecking}
          className="flex-1 bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-aurora-indigo-dark disabled:opacity-50 transition"
        >
          {loading ? 'Processing...' : isLastStep ? 'Create Account' : 'Next'}
        </button>
      </div>
    </div>
  );
};
