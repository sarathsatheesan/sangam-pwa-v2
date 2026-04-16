import type { User, ConfirmationResult } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import {
  setDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UserProfile {
  name: string;
  preferredName?: string;
  avatar?: string;
  heritage?: string;
  city?: string;
  profession?: string;
  interests?: string[];
  bio?: string;
  messagingPrivacy?: 'everyone' | 'connections' | 'nobody';
}

export interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface BeneficialOwner {
  name: string;
  title: string;
  ownershipPct: number;
}

export interface BusinessExtras {
  accountType: 'business';
  phone: string;
  businessName: string;
  businessType: string;
  customBusinessType?: string;
  isRegistered: boolean;
  tinNumber: string;
  tinValidationStatus: 'valid' | 'invalid' | 'not_checked';
  tinValidationDetails?: {
    checkedAt: string;
    message: string;
    confidence: number;
  };
  profitStatus: 'profit' | 'non-profit';
  adminReviewRequired?: boolean;
  // Address fields
  businessAddress?: BusinessAddress;
  stateOfIncorp?: string;
  // KYC fields
  beneficialOwners?: BeneficialOwner[];
  verificationDocUrls?: string[];
  photoIdUrl?: string;
}

export interface IndividualExtras {
  accountType: 'individual';
  phone?: string;
}

export type SignupExtras = BusinessExtras | IndividualExtras;

export interface UserData extends UserProfile {
  email: string;
  uid: string;
  accountType?: 'individual' | 'business';
  phone?: string;
  businessName?: string;
  businessType?: string;
  customBusinessType?: string;
  isRegistered?: boolean;
  tinNumber?: string;
  tinValidationStatus?: 'valid' | 'invalid' | 'not_checked';
  tinValidationDetails?: {
    checkedAt: string;
    message: string;
    confidence: number;
  };
  profitStatus?: 'profit' | 'non-profit';
  adminReviewRequired?: boolean;
  verifiedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: any;
}

// Store for phone auth confirmation result and reCAPTCHA verifier
let phoneConfirmationResult: ConfirmationResult | null = null;
let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

/**
 * Sign up a new user with email and password
 * Creates auth account, sends verification email, and saves profile to Firestore
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  profile: UserProfile,
  extras?: SignupExtras,
  sendVerification: boolean = true
): Promise<User> => {
  try {
    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Only send verification email if enabled
    if (sendVerification) {
      try {
        await sendEmailVerification(user);
      } catch (_e) {
        console.warn('Could not send verification email:', _e);
      }
    }

    // Save user profile to Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userData: Record<string, any> = {
      email,
      uid: user.uid,
      name: profile.name,
      preferredName: profile.preferredName || '',
      avatar: profile.avatar || '',
      heritage: profile.heritage || '',
      city: profile.city || '',
      profession: profile.profession || '',
      interests: profile.interests || [],
      accountType: extras?.accountType || 'individual',
      phone: extras?.phone || '',
      verifiedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add business-specific fields
    if (extras?.accountType === 'business') {
      const biz = extras as BusinessExtras;
      userData.businessName = biz.businessName || '';
      userData.businessType = biz.businessType || '';
      userData.customBusinessType = biz.customBusinessType || '';
      userData.isRegistered = biz.isRegistered ?? false;
      userData.tinNumber = biz.tinNumber || '';
      userData.tinValidationStatus = biz.tinValidationStatus || 'not_checked';
      userData.tinValidationDetails = biz.tinValidationDetails || null;
      userData.profitStatus = biz.profitStatus || '';
      userData.adminReviewRequired = biz.adminReviewRequired || biz.tinValidationStatus === 'invalid' || !biz.isRegistered;
      userData.adminApproved = biz.isRegistered ? undefined : false;

      // Address fields
      if (biz.businessAddress) {
        userData.businessAddress = biz.businessAddress;
      }
      if (biz.stateOfIncorp) {
        userData.stateOfIncorp = biz.stateOfIncorp;
      }

      // KYC fields
      if (biz.beneficialOwners && biz.beneficialOwners.length > 0) {
        userData.beneficialOwners = biz.beneficialOwners;
      }
      if (biz.verificationDocUrls && biz.verificationDocUrls.length > 0) {
        userData.verificationDocUrls = biz.verificationDocUrls;
      }
      if (biz.photoIdUrl) {
        userData.photoIdUrl = biz.photoIdUrl;
      }
    }

    await setDoc(userDocRef, userData);

    // Save custom business type to collection if provided
    if (
      extras?.accountType === 'business' &&
      (extras as BusinessExtras).customBusinessType
    ) {
      try {
        const customType = (extras as BusinessExtras).customBusinessType!;
        await setDoc(doc(collection(db, 'customBusinessTypes')), {
          typeName: customType,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (_e) { /* non-fatal */ }
    }

    // Clear cookie consent so banner shows on first login
    try {
      localStorage.removeItem('@sangam_cookie_consent');
    } catch (_e) { /* non-fatal */ }

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Sign in user with email and password
 * Checks verification status and enforces 24-hour verification window
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User; needsVerification: boolean; verificationExpired: boolean }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Clear cookie consent so banner shows each login session
    try {
      localStorage.removeItem('@sangam_cookie_consent');
    } catch (_e) { /* non-fatal */ }

    // Report email verification status (login always succeeds)
    if (!user.emailVerified) {
      let verificationExpired = false;

      // Only attempt to resend verification email if > 24h old
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return { user, needsVerification: true, verificationExpired };
        const userData = userDoc.data();

        if (userData?.createdAt) {
          const createdAtMs = userData.createdAt.toMillis
            ? userData.createdAt.toMillis()
            : new Date(userData.createdAt).getTime();
          const hoursSinceCreation =
            (Date.now() - createdAtMs) / (1000 * 60 * 60);

          if (hoursSinceCreation > 24) {
            verificationExpired = true;
            // Try to resend, but don't block login if it fails
            try {
              await sendEmailVerification(user);
            } catch (_emailErr) {
              console.warn('Could not resend verification email:', _emailErr);
            }
          }
        }
      } catch (_docErr) {
        console.warn('Could not check user doc for verification:', _docErr);
      }

      return { user, needsVerification: true, verificationExpired };
    }

    return { user, needsVerification: false, verificationExpired: false };
  } catch (error) {
    throw error;
  }
};

/**
 * Initiate phone sign-in by sending an OTP
 * Returns a confirmation result that can be used to verify the code
 */
export const sendPhoneOTP = async (
  phoneNumber: string,
  _recaptchaContainerId: string = 'recaptcha-container'
): Promise<{ sent: boolean; error?: string }> => {
  try {
    console.log('[OTP] Starting sendPhoneOTP for:', phoneNumber);

    // Reuse existing verifier if available (avoids repeated challenges)
    if (!recaptchaVerifierInstance) {
      // Clean up any orphaned recaptcha elements from previous sessions
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[id^="recaptcha-otp-"]').forEach((el) => {
          try { el.parentElement?.removeChild(el); } catch (_e) { /* ignore */ }
        });
      }

      // Create a fresh container — must be visible enough for challenge popups
      const uniqueId = 'recaptcha-otp-' + Date.now();
      const freshContainer = document.createElement('div');
      freshContainer.id = uniqueId;
      // Keep it off-screen but not hidden — reCAPTCHA needs a "visible" container
      freshContainer.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;';
      document.body.appendChild(freshContainer);
      console.log('[OTP] Created fresh reCAPTCHA container:', uniqueId);

      console.log('[OTP] Creating new RecaptchaVerifier...');
      recaptchaVerifierInstance = new RecaptchaVerifier(auth, uniqueId, {
        size: 'invisible',
        callback: () => {
          console.log('[OTP] reCAPTCHA solved successfully');
        },
        'expired-callback': () => {
          console.log('[OTP] reCAPTCHA expired, clearing instance');
          try { recaptchaVerifierInstance?.clear(); } catch (_e) { /* ignore */ }
          recaptchaVerifierInstance = null;
        },
      });
    } else {
      console.log('[OTP] Reusing existing RecaptchaVerifier instance');
    }

    console.log('[OTP] Calling signInWithPhoneNumber...');
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifierInstance
    );

    // Store for later verification
    phoneConfirmationResult = confirmationResult;
    console.log('[OTP] OTP sent successfully!');

    return { sent: true };
  } catch (error: any) {
    console.error('[OTP] Phone OTP error:', error);
    console.error('[OTP] Error code:', error.code);
    console.error('[OTP] Error message:', error.message);

    // Clean up on failure so next attempt gets a fresh verifier
    if (recaptchaVerifierInstance) {
      try { recaptchaVerifierInstance.clear(); } catch (_e) { /* ignore */ }
      recaptchaVerifierInstance = null;
    }
    // Also clean up DOM elements
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[id^="recaptcha-otp-"]').forEach((el) => {
        try { el.parentElement?.removeChild(el); } catch (_e) { /* ignore */ }
      });
    }

    // Provide detailed user-facing error
    let userError: string;
    switch (error.code) {
      case 'auth/invalid-phone-number':
        userError = 'Invalid phone number. Please use format: +1XXXXXXXXXX';
        break;
      case 'auth/too-many-requests':
        userError = 'Too many attempts. Please wait a few minutes and try again.';
        break;
      case 'auth/operation-not-allowed':
        userError = 'Phone sign-in is not enabled. Admin needs to enable Phone provider in Firebase Console → Authentication → Sign-in method.';
        break;
      case 'auth/captcha-check-failed':
        userError = 'reCAPTCHA verification failed. Please refresh the page and try again.';
        break;
      case 'auth/missing-phone-number':
        userError = 'Phone number is missing. Please enter a valid phone number.';
        break;
      case 'auth/quota-exceeded':
        userError = 'SMS quota exceeded. Please try again later or contact support.';
        break;
      case 'auth/user-disabled':
        userError = 'This account has been disabled. Please contact support.';
        break;
      case 'auth/internal-error':
        userError = `Firebase internal error. Check that Phone Auth is enabled in Firebase Console. Details: ${error.message}`;
        break;
      default:
        userError = `OTP failed [${error.code || 'unknown'}]: ${error.message || 'Please try again.'}`;
    }

    return { sent: false, error: userError };
  }
};

/**
 * Verify a phone OTP code and sign in
 */
export const verifyPhoneOTP = async (
  code: string
): Promise<{ user: User | null; error?: string }> => {
  try {
    if (!phoneConfirmationResult) {
      return { user: null, error: 'No verification in progress. Please request a new code.' };
    }

    const result = await phoneConfirmationResult.confirm(code);
    phoneConfirmationResult = null;

    // Clear cookie consent
    try {
      localStorage.removeItem('@sangam_cookie_consent');
    } catch (_e) { /* non-fatal */ }

    // Check if user profile exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      // New phone-only user — create minimal profile
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: '',
        name: '',
        phone: result.user.phoneNumber || '',
        accountType: 'individual',
        verifiedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { user: result.user };
  } catch (error: any) {
    console.error('Phone verification error:', error);
    return {
      user: null,
      error: error.code === 'auth/invalid-verification-code'
        ? 'Invalid verification code. Please try again.'
        : error.code === 'auth/code-expired'
          ? 'Code has expired. Please request a new one.'
          : 'Verification failed. Please try again.',
    };
  }
};

/**
 * Look up user's account type by email
 */
export const getAccountTypeByEmail = async (
  email: string
): Promise<'individual' | 'business' | null> => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase().trim())
    );
    const snapshot = await getDocs(usersQuery);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return data.accountType || 'individual';
    }
    return null;
  } catch (_e) {
    return null;
  }
};

/**
 * Resend verification email to current user
 */
export const resendVerificationEmail = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    // Clear service worker caches to prevent stale chunks on next login
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    // Unregister service workers to force fresh load
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw error;
  }
};
