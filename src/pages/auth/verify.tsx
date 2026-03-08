import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { resendVerificationEmail } from '../../services/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export const VerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pollEmailVerification = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();

          if (auth.currentUser.emailVerified) {
            setIsLoading(true);
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              verifiedAt: serverTimestamp(),
            });

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            if (cooldownIntervalRef.current) {
              clearInterval(cooldownIntervalRef.current);
            }

            navigate('/auth/select-ethnicity');
          }
        }
      } catch (err) {
        console.error('Error checking email verification:', err);
      }
    };

    pollingIntervalRef.current = setInterval(pollEmailVerification, 3000);
    pollEmailVerification();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    } else {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    }

    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      setError(null);

      if (!auth.currentUser) {
        setError('User not found. Please log in again.');
        return;
      }

      await resendVerificationEmail();
      setResendCooldown(60);
    } catch (err) {
      console.error('Error resending verification email:', err);
      setError('Failed to resend email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div className="min-h-screen bg-aurora-surface-variant flex flex-col">
      {/* Header */}
      <div className="bg-aurora-indigo text-white pt-12 pb-8 rounded-b-3xl">
        <div className="max-w-md mx-auto px-6">
          <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-aurora-indigo-light">Almost there!</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="max-w-md w-full mx-auto px-6 py-10 flex-1 flex flex-col">
        <div className="bg-aurora-surface rounded-2xl p-8 shadow-aurora-1 border border-aurora-border">
          <div className="text-5xl text-center mb-6">📧</div>

          <p className="text-center text-aurora-text-secondary mb-2">We sent a verification link to</p>

          <p className="text-center text-lg font-semibold text-aurora-text mb-6">
            {auth.currentUser?.email || ''}
          </p>

          <p className="text-center text-aurora-text-secondary mb-6">
            Click the link in your email to verify your account.
          </p>

          <div className="border-t border-aurora-border my-6"></div>

          {/* Resend Button */}
          <button
            onClick={handleResendVerification}
            disabled={isResending || resendCooldown > 0}
            className={`w-full py-3 rounded-xl font-semibold transition mb-4 ${
              isResending || resendCooldown > 0
                ? 'bg-gray-200 text-aurora-text-secondary cursor-not-allowed'
                : 'bg-aurora-indigo text-white hover:bg-blue-800'
            }`}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : isResending
                ? 'Sending...'
                : 'Resend Verification Email'}
          </button>

          {error && (
            <div className="text-aurora-danger text-sm text-center mb-4 p-3 bg-aurora-danger/10 rounded-xl">
              {error}
            </div>
          )}

          {/* Waiting Indicator */}
          <div className="flex items-center justify-center gap-3 py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-aurora-indigo"></div>
            <p className="text-aurora-text-secondary">Waiting for verification...</p>
          </div>
        </div>

        {/* Sign Out Link */}
        <div className="flex items-center justify-center mt-auto">
          <button
            onClick={handleSignOut}
            className="text-aurora-warning font-semibold hover:underline py-4"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
};
