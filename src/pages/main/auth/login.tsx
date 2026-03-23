import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmail, sendPhoneOTP, verifyPhoneOTP, resetPassword } from '../../../services/auth';
import { getFeatureFlags } from '../../../services/featureFlags';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';

type LoginStep = 0 | 1 | 2;
type LoginMethod = 'phone' | 'email';
type AccountType = 'individual' | 'business' | '';

const COUNTRY_CODES = [
  { code: '+1', label: '🇺🇸 +1', country: 'US' },
  { code: '+91', label: '🇮🇳 +91', country: 'IN' },
  { code: '+44', label: '🇬🇧 +44', country: 'UK' },
  { code: '+61', label: '🇦🇺 +61', country: 'AU' },
  { code: '+971', label: '🇦🇪 +971', country: 'UAE' },
  { code: '+65', label: '🇸🇬 +65', country: 'SG' },
  { code: '+1', label: '🇨🇦 +1', country: 'CA' },
  { code: '+49', label: '🇩🇪 +49', country: 'DE' },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading } = useAuth();

  // Step management
  const [step, setStep] = useState<LoginStep>(0);
  const [accountType, setAccountType] = useState<AccountType>('');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [accountTypeMismatch, setAccountTypeMismatch] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [otpStatus, setOtpStatus] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Feature flags for auth
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [phoneOTPEnabled, setPhoneOTPEnabled] = useState(false);
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  // Redirect already-authenticated users to home
  useEffect(() => {
    if (!authLoading && currentUser && !accountTypeMismatch) {
      navigate('/', { replace: true });
    }
  }, [currentUser, authLoading, accountTypeMismatch, navigate]);

  // Load auth feature flags on mount
  useEffect(() => {
    getFeatureFlags(
      ['auth_emailVerification', 'auth_phoneOTP'],
      { auth_emailVerification: false, auth_phoneOTP: false }
    )
      .then((flags) => {
        console.log('[Login] Feature flags loaded:', flags);
        setEmailVerificationEnabled(flags.auth_emailVerification);
        setPhoneOTPEnabled(flags.auth_phoneOTP);
        setFlagsLoaded(true);
      })
      .catch(() => {
        setFlagsLoaded(true);
      });
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Determine which step to show next
  const handleAccountTypeSelect = (type: 'individual' | 'business') => {
    setAccountType(type);
    if (phoneOTPEnabled) {
      setStep(1);
    } else {
      setLoginMethod('email');
      setStep(2);
    }
    setErrors({});
  };

  const handleBackButton = () => {
    if (step === 0) {
      return;
    } else if (step === 1) {
      setStep(0);
      setAccountType('');
      setLoginMethod('email');
    } else if (step === 2) {
      if (phoneOTPEnabled) {
        setStep(1);
      } else {
        setStep(0);
        setAccountType('');
      }
      setOtpSent(false);
      setOtpCode('');
      setLoginMethod('email');
    }
    setErrors({});
  };

  // Validation functions
  const validateEmail = (emailStr: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const validatePhone = (phoneStr: string): boolean => {
    const cleaned = phoneStr.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  // Email/Password validation
  const validateEmailPasswordForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (accountType === 'business') {
      if (!phone.trim()) {
        newErrors.phone = 'Phone is required for business accounts';
      } else if (!validatePhone(phone)) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Phone validation for OTP
  const validatePhoneForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // OTP validation
  const validateOtpForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!otpCode.trim()) {
      newErrors.otp = 'OTP code is required';
    } else if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      newErrors.otp = 'Please enter a valid 6-digit code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Phone OTP handlers
  const handleSendOtp = async () => {
    if (!validatePhoneForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    setOtpStatus('Initializing reCAPTCHA...');
    try {
      const formattedPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
      console.log('[Login] Sending OTP to:', formattedPhone);
      setOtpStatus(`Sending OTP to ${formattedPhone}...`);
      const result = await sendPhoneOTP(formattedPhone);

      if (result.sent) {
        setOtpSent(true);
        setResendCooldown(60);
        setErrors({});
        setOtpStatus('OTP sent successfully!');
      } else {
        setErrors({ phone: result.error || 'Failed to send OTP. Please try again.' });
        setOtpStatus('');
        console.error('[Login] OTP send failed:', result.error);
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to send OTP. Please try again.';
      setErrors({ phone: errorMessage });
      setOtpStatus('');
      console.error('[Login] OTP send exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateOtpForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    setAccountTypeMismatch(null);
    try {
      const result = await verifyPhoneOTP(otpCode);

      if (result.user) {
        // Check account type matches what user selected at login
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const storedAccountType = userData.accountType || 'individual';

          if (accountType === 'individual' && storedAccountType === 'business') {
            setAccountTypeMismatch('business');
            await signOut(auth);
            setStep(0);
            setAccountType('');
            setOtpSent(false);
            setOtpCode('');
            setLoading(false);
            return;
          }

          if (accountType === 'business' && storedAccountType !== 'business') {
            setAccountTypeMismatch('individual');
            await signOut(auth);
            setStep(0);
            setAccountType('');
            setOtpSent(false);
            setOtpCode('');
            setLoading(false);
            return;
          }
        }

        navigate('/');
      } else {
        setErrors({ otp: result.error || 'OTP verification failed' });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Verification failed. Please try again.';
      setErrors({ otp: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) {
      return;
    }
    await handleSendOtp();
  };

  // Email/Password handlers
  const handleSignIn = async () => {
    if (!validateEmailPasswordForm()) {
      return;
    }

    setLoading(true);
    setAccountTypeMismatch(null);
    try {
      const result = await signInWithEmail(email, password);

      if (result.needsVerification && emailVerificationEnabled) {
        alert('Email Not Verified - Please check your inbox and verify your email for full access.');
        navigate('/auth/verify');
        return;
      }

      // Check account type matches what user selected at login
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const storedAccountType = userData.accountType || 'individual';

        if (accountType === 'individual' && storedAccountType === 'business') {
          // Sign out immediately before showing message
          setAccountTypeMismatch('business');
          await signOut(auth);
          setStep(0);
          setAccountType('');
          setLoading(false);
          return;
        }

        if (accountType === 'business' && storedAccountType !== 'business') {
          setAccountTypeMismatch('individual');
          await signOut(auth);
          setStep(0);
          setAccountType('');
          setLoading(false);
          return;
        }
      }

      navigate('/');
    } catch (error: any) {
      const errorMessage =
        error?.code === 'auth/user-not-found'
          ? 'Email not found. Please check your email or sign up.'
          : error?.code === 'auth/wrong-password'
            ? 'Incorrect password. Please try again.'
            : error?.code === 'auth/invalid-email'
              ? 'Invalid email address.'
              : error?.code === 'auth/invalid-credential'
                ? 'Invalid email or password. Please try again.'
                : error?.code === 'auth/too-many-requests'
                  ? 'Too many failed attempts. Please try again later.'
                  : error?.message || 'Sign in failed. Please try again.';

      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert('Email Required - Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      alert('Invalid Email - Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      alert('Password Reset Email Sent - Check your email for instructions to reset your password.');
    } catch (error: any) {
      const errorMessage =
        error?.code === 'auth/user-not-found'
          ? 'Email not found'
          : error?.message || 'Failed to send reset email';

      alert(`Error - ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate('/auth/signup');
  };

  // Render functions for each step
  const renderAccountTypeSelection = () => (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-aurora-text mb-2">Welcome Back</h2>
      <p className="text-aurora-text-secondary mb-6">How would you like to sign in?</p>

      {/* Account type mismatch banner */}
      {accountTypeMismatch && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-amber-900 font-semibold text-sm">
            {accountTypeMismatch === 'business'
              ? 'This email is registered as a Business account. Please select "Business" to sign in.'
              : 'This email is registered as an Individual account. Please select "Individual" to sign in.'}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Individual Card */}
        <button
          onClick={() => {
            setAccountTypeMismatch(null);
            handleAccountTypeSelect('individual');
          }}
          className={`flex-1 border-2 rounded-2xl p-6 text-center hover:border-aurora-indigo hover:bg-aurora-indigo/10 transition ${
            accountTypeMismatch === 'individual'
              ? 'border-green-400 bg-aurora-success/10'
              : 'border-aurora-border'
          }`}
        >
          <div className="text-4xl mb-3">👤</div>
          <h3 className="text-lg font-bold text-aurora-text mb-1">Individual</h3>
          <p className="text-sm text-aurora-text-secondary">Personal account</p>
          {accountTypeMismatch === 'individual' && (
            <p className="text-xs text-aurora-success font-semibold mt-2">Select this one</p>
          )}
        </button>

        {/* Business Card */}
        <button
          onClick={() => {
            setAccountTypeMismatch(null);
            handleAccountTypeSelect('business');
          }}
          className={`flex-1 border-2 rounded-2xl p-6 text-center hover:border-aurora-indigo hover:bg-aurora-indigo/10 transition ${
            accountTypeMismatch === 'business'
              ? 'border-green-400 bg-aurora-success/10'
              : 'border-aurora-border'
          }`}
        >
          <div className="text-4xl mb-3">🏢</div>
          <h3 className="text-lg font-bold text-aurora-text mb-1">Business</h3>
          <p className="text-sm text-aurora-text-secondary">Business account</p>
          {accountTypeMismatch === 'business' && (
            <p className="text-xs text-aurora-success font-semibold mt-2">Select this one</p>
          )}
        </button>
      </div>
    </div>
  );

  const renderLoginMethodSelection = () => (
    <div className="w-full">
      <button
        onClick={handleBackButton}
        className="mb-6 text-aurora-indigo font-semibold hover:underline"
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold text-aurora-text mb-2">How do you want to sign in?</h2>
      <p className="text-aurora-text-secondary mb-6">Choose your preferred method</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <button
          onClick={() => setLoginMethod('email')}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
            loginMethod === 'email'
              ? 'bg-aurora-indigo text-white border-2 border-aurora-indigo'
              : 'bg-aurora-surface text-aurora-text-secondary border-2 border-aurora-border'
          }`}
        >
          Email/Password
        </button>

        <button
          onClick={() => setLoginMethod('phone')}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
            loginMethod === 'phone'
              ? 'bg-aurora-indigo text-white border-2 border-aurora-indigo'
              : 'bg-aurora-surface text-aurora-text-secondary border-2 border-aurora-border'
          }`}
        >
          Phone OTP
        </button>
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={loading}
        className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-70 transition"
      >
        Continue
      </button>
    </div>
  );

  const renderPhoneOtpLogin = () => (
    <div className="w-full">
      <button
        onClick={handleBackButton}
        className="mb-6 text-aurora-indigo font-semibold hover:underline"
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold text-aurora-text mb-2">Sign In with Phone</h2>
      <p className="text-aurora-text-secondary mb-6">We'll send you a verification code</p>

      {otpStatus && (
        <div className="bg-aurora-indigo/10 border border-blue-200 rounded-xl p-3 mb-6 text-center text-aurora-indigo text-sm">
          {otpStatus}
        </div>
      )}

      {!otpSent ? (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-aurora-text mb-2">Phone Number</label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="px-3 py-3 bg-aurora-surface-variant border border-aurora-border rounded-xl text-sm font-semibold text-aurora-text hover:bg-gray-100 transition min-w-fit"
              >
                {countryCode} ▾
              </button>
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) {
                    const { phone, ...rest } = errors;
                    setErrors(rest);
                  }
                }}
                disabled={loading}
                maxLength={15}
                className={`flex-1 px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                  errors.phone ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
                }`}
              />
            </div>

            {showCountryPicker && (
              <div className="mt-2 bg-aurora-surface border border-aurora-border rounded-xl max-h-48 overflow-y-auto">
                {COUNTRY_CODES.map((cc, idx) => (
                  <button
                    key={`${cc.country}-${idx}`}
                    onClick={() => {
                      setCountryCode(cc.code);
                      setShowCountryPicker(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-aurora-surface-variant text-sm border-b border-aurora-border last:border-0"
                  >
                    {cc.label} ({cc.country})
                  </button>
                ))}
              </div>
            )}

            {errors.phone && <p className="text-aurora-danger text-sm mt-2">{errors.phone}</p>}
          </div>

          <button
            onClick={handleSendOtp}
            disabled={loading}
            className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-70 transition"
          >
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-aurora-text mb-2">Enter 6-Digit Code</label>
            <p className="text-sm text-aurora-text-secondary mb-3">
              Code sent to {countryCode}
              {phone.replace(/\D/g, '')}
            </p>
            <input
              type="text"
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, ''));
                if (errors.otp) {
                  const { otp, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              disabled={loading}
              className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted text-2xl font-semibold text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
                errors.otp ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
              }`}
            />
            {errors.otp && <p className="text-aurora-danger text-sm mt-2">{errors.otp}</p>}
          </div>

          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-70 transition mb-4"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>

          <button
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || loading}
            className="w-full text-aurora-indigo font-semibold hover:underline disabled:text-aurora-text-muted transition text-center py-2"
          >
            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
          </button>
        </>
      )}
    </div>
  );

  const renderEmailPasswordLogin = () => (
    <div className="w-full">
      <button
        onClick={handleBackButton}
        className="mb-6 text-aurora-indigo font-semibold hover:underline"
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold text-aurora-text mb-2">
        {accountType === 'business' ? 'Business Login' : 'Sign In'}
      </h2>
      <p className="text-aurora-text-secondary mb-8">
        {accountType === 'business'
          ? 'Enter your business credentials'
          : 'Enter your email and password'}
      </p>

      {/* Email Input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Email Address</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email || errors.general) {
              const { email, general, ...rest } = errors;
              setErrors(rest);
            }
          }}
          disabled={loading}
          className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
            errors.email ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
          }`}
        />
        {errors.email && <p className="text-aurora-danger text-sm mt-2">{errors.email}</p>}
      </div>

      {/* Phone Input (Business only) */}
      {accountType === 'business' && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-aurora-text mb-2">Phone Number</label>
          <p className="text-xs text-aurora-text-secondary mb-2 italic">
            Business accounts require both email and phone verification
          </p>
          <input
            type="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) {
                const { phone, ...rest } = errors;
                setErrors(rest);
              }
            }}
            disabled={loading}
            maxLength={14}
            className={`w-full px-4 py-3 border rounded-xl text-aurora-text placeholder-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo ${
              errors.phone ? 'border-red-500 bg-aurora-danger/10' : 'border-aurora-border'
            }`}
          />
          {errors.phone && <p className="text-aurora-danger text-sm mt-2">{errors.phone}</p>}
        </div>
      )}

      {/* Password Input */}
      <div className="mb-2">
        <label className="block text-sm font-semibold text-aurora-text mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password || errors.general) {
                const { password, general, ...rest } = errors;
                setErrors(rest);
              }
            }}
            disabled={loading}
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

      {/* Forgot Password */}
      <button
        onClick={handleForgotPassword}
        disabled={loading}
        className="text-aurora-indigo text-sm font-semibold hover:underline mb-6 disabled:text-aurora-text-muted"
      >
        Forgot Password?
      </button>

      {/* General Error Message */}
      {errors.general && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm font-medium">{errors.general}</p>
        </div>
      )}

      {/* Sign In Button */}
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-70 transition mb-6"
      >
        {loading ? 'Signing In...' : 'Sign In'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="text-aurora-text-secondary text-sm">or</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      {/* Google Sign In Button */}
      <button
        onClick={() => alert('Google Sign-in is coming soon!')}
        disabled={loading}
        className="w-full bg-aurora-surface text-aurora-indigo py-3 rounded-xl font-semibold border-2 border-aurora-indigo hover:bg-aurora-indigo/10 disabled:opacity-70 transition"
      >
        Sign in with Google
      </button>
    </div>
  );

  // Determine which step to render
  let stepContent;
  if (!flagsLoaded) {
    stepContent = (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aurora-indigo"></div>
      </div>
    );
  } else if (step === 0) {
    stepContent = renderAccountTypeSelection();
  } else if (step === 1) {
    stepContent = renderLoginMethodSelection();
  } else if (step === 2) {
    if (loginMethod === 'phone') {
      stepContent = renderPhoneOtpLogin();
    } else {
      stepContent = renderEmailPasswordLogin();
    }
  }

  return (
    <div className="bg-aurora-surface-variant flex flex-col" style={{ minHeight: 'var(--app-height, 100vh)' }}>
      {/* Hero section with community image + CSS branding overlay */}
      <div className="relative overflow-hidden rounded-b-3xl">
        {/* Background image */}
        <img
          src="/ethnicity-hero.jpg"
          alt="Diverse community members"
          className="w-full h-48 sm:h-64 md:h-80 object-cover object-[center_35%]"
        />
        {/* Gradient overlay to cover original text and provide contrast */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(13,79,90,0.92) 0%, rgba(13,79,90,0.82) 30%, rgba(13,79,90,0.75) 55%, rgba(13,79,90,0.85) 100%)',
          }}
        />
        {/* Branding text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <img src="/ethnicity-logo.svg" alt="" className="hidden sm:block w-10 h-10 md:w-12 md:h-12 drop-shadow-lg" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              <span style={{ color: '#f4a261' }}>Ethni</span><span className="font-black" style={{ color: '#ffffff' }}>Zity</span>
            </h1>
          </div>
          <p className="text-sm sm:text-base md:text-lg font-medium tracking-wide drop-shadow-md" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            Our Culture, Connected.
          </p>
        </div>
      </div>

      {/* Main Content — two-column on desktop */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row md:gap-10 md:items-stretch">
          {/* Left column — branding card (desktop only) */}
          <div className="hidden md:flex md:w-1/2 flex-col">
            <div className="w-full flex-1 rounded-2xl flex flex-col items-center justify-center p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d4f5a 0%, #1a6b5a 50%, #0d4f5a 100%)' }}>
              <img src="/ethnicity-logo.svg" alt="EthniZity" className="w-28 h-28 mb-6 drop-shadow-lg opacity-90" />
              <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                <span style={{ color: '#f4a261' }}>Ethni</span><span>Zity</span>
              </h3>
              <div className="w-12 h-0.5 bg-white/30 rounded-full mb-3" />
              <p className="text-white/80 text-sm text-center px-4 leading-relaxed">
                Our Culture, Connected.
              </p>
            </div>
          </div>

          {/* Right column — form */}
          <div className="w-full md:w-1/2">
            {stepContent}

            {/* Sign Up Link */}
            {(step === 0 || step === 2) && (
              <div className="text-center mt-8">
                <p className="text-aurora-text-secondary">
                  Don't have an account?{' '}
                  <button
                    onClick={handleSignUp}
                    disabled={loading}
                    className="text-aurora-indigo font-bold hover:underline disabled:text-aurora-text-muted"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
