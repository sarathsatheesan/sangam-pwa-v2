import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';

/**
 * Banned screen — blocks access entirely and signs the user out.
 */
function BannedScreen() {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      // force reload as fallback
      window.location.href = '/auth/login';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-red-700 dark:text-red-400">Account Banned</h1>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Your account has been permanently banned for violating our community guidelines.
          You are no longer able to access ethniCity.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you believe this was a mistake, please contact our support team at{' '}
          <a href="mailto:support@ethnicity.com" className="text-blue-600 dark:text-blue-400 underline">
            support@ethnicity.com
          </a>
        </p>
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

/**
 * Disabled / suspended screen — temporary hold, user can sign out and wait.
 */
function DisabledScreen() {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      window.location.href = '/auth/login';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-amber-700 dark:text-amber-400">Account Temporarily Suspended</h1>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Your account has been temporarily suspended by an administrator.
          This may be due to a pending review or a minor policy concern.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you have questions, please reach out to our support team at{' '}
          <a href="mailto:support@ethnicity.com" className="text-blue-600 dark:text-blue-400 underline">
            support@ethnicity.com
          </a>
        </p>
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export const PrivateRoute: React.FC = () => {
  const { user, loading, isBanned, isDisabled } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          textAlign: 'center',
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #ddd',
            borderTop: '4px solid #007AFF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px',
          }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Banned takes priority — permanent block
  if (isBanned) {
    return <BannedScreen />;
  }

  // Disabled — temporary suspension
  if (isDisabled) {
    return <DisabledScreen />;
  }

  return <Outlet />;
};
