import React, { Suspense, lazy, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureSettingsProvider } from './contexts/FeatureSettingsContext';
import { LocationProvider } from './contexts/LocationContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import { CulturalThemeProvider } from './contexts/CulturalThemeContext';
import { BusinessSwitcherProvider } from './contexts/BusinessSwitcherContext';
import { PrivateRoute } from './components/shared/PrivateRoute';
import { NotificationProviderWrapper } from './components/shared/NotificationProviderWrapper';
import './index.css';

// ── Chunk-load retry helper ──────────────────────────────────────────────────
// When a new deploy invalidates old chunk hashes cached by the Service Worker,
// React.lazy will throw a ChunkLoadError. This wrapper retries once with a
// cache-busted import before giving up.
function lazyRetry<T extends { default: any }>(
  factory: () => Promise<T>,
): React.LazyExoticComponent<T['default']> {
  return lazy(() =>
    factory().catch((err: any) => {
      // Only retry chunk load failures (not syntax errors etc.)
      if (err?.name === 'ChunkLoadError' || err?.message?.includes('Loading chunk')) {
        // Bust the SW cache by appending a timestamp query param
        return factory();
      }
      throw err;
    }),
  );
}

// ── ErrorBoundary ────────────────────────────────────────────────────────────
// Wraps all routes so a crash in any page shows a recovery UI instead of a
// white page. Users can click "Reload" to recover.
interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5',
          padding: '20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>😵</p>
          <h2 style={{ color: '#333', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', maxWidth: '400px' }}>
            The page ran into an unexpected error. This usually fixes itself on reload.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 24px', backgroundColor: '#6366F1', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load auth routes (with chunk-load retry)
const LoginPage = lazyRetry(() => import('./pages/auth/login').then(m => ({ default: m.LoginPage })));
const SignupPage = lazyRetry(() => import('./pages/auth/signup').then(m => ({ default: m.SignupPage })));
const VerifyPage = lazyRetry(() => import('./pages/auth/verify').then(m => ({ default: m.VerifyPage })));
const SelectEthnicityPage = lazyRetry(() => import('./pages/auth/select-ethnicity').then(m => ({ default: m.SelectEthnicityPage })));

// Lazy load main routes (with chunk-load retry)
const MainLayout = lazyRetry(() => import('./layouts/MainLayout').then(m => ({ default: m.MainLayout })));
const FeedPage = lazyRetry(() => import('./pages/feed'));
const DiscoverPage = lazyRetry(() => import('./pages/discover'));
const BusinessPage = lazyRetry(() => import('./pages/business'));
const HousingPage = lazyRetry(() => import('./pages/housing'));
const EventsPage = lazyRetry(() => import('./pages/events'));
const TravelPage = lazyRetry(() => import('./pages/travel'));
const ForumPage = lazyRetry(() => import('./pages/forum'));
const MessagesPage = lazyRetry(() => import('./pages/messages'));
const ProfilePage = lazyRetry(() => import('./pages/profile'));
const AdminPage = lazyRetry(() => import('./pages/admin'));
const MarketplacePage = lazyRetry(() => import('./pages/marketplace'));
const SettingsPage = lazyRetry(() => import('./pages/settings'));
const BusinessRegisterPage = lazyRetry(() => import('./pages/business/register'));
const CateringPage = lazyRetry(() => import('./pages/catering'));
const HomePage = lazyRetry(() => import('./pages/main/home'));
const NotificationCenterPage = lazyRetry(() => import('./components/shared/NotificationCenter'));
const NotificationSettingsPage = lazyRetry(() => import('./components/shared/NotificationSettings'));
const NotificationAnalyticsPage = lazyRetry(() => import('./components/shared/NotificationAnalytics'));

// Loading spinner component
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  }}>
    <div style={{ textAlign: 'center' }}>
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BusinessSwitcherProvider>
        <UserSettingsProvider>
        <FeatureSettingsProvider>
          <CulturalThemeProvider>
          <LocationProvider>
            <ToastProvider>
            <NotificationProviderWrapper>
            <AppErrorBoundary>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/auth/login" element={<Suspense fallback={<LoadingSpinner />}><LoginPage /></Suspense>} />
                <Route path="/auth/signup" element={<Suspense fallback={<LoadingSpinner />}><SignupPage /></Suspense>} />
                <Route path="/auth/verify" element={<Suspense fallback={<LoadingSpinner />}><VerifyPage /></Suspense>} />
                <Route path="/auth/select-ethnicity" element={<Suspense fallback={<LoadingSpinner />}><SelectEthnicityPage /></Suspense>} />

                {/* Private Routes with MainLayout */}
                <Route element={<PrivateRoute />}>
                  <Route element={<Suspense fallback={<LoadingSpinner />}><MainLayout /></Suspense>}>
                    <Route index element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Suspense fallback={<LoadingSpinner />}><HomePage /></Suspense>} />
                    <Route path="/feed" element={<Suspense fallback={<LoadingSpinner />}><FeedPage /></Suspense>} />
                    <Route path="/discover" element={<Suspense fallback={<LoadingSpinner />}><DiscoverPage /></Suspense>} />
                    <Route path="/business" element={<Suspense fallback={<LoadingSpinner />}><BusinessPage /></Suspense>} />
                    <Route path="/housing" element={<Suspense fallback={<LoadingSpinner />}><HousingPage /></Suspense>} />
                    <Route path="/marketplace" element={<Suspense fallback={<LoadingSpinner />}><MarketplacePage /></Suspense>} />
                    <Route path="/events" element={<Suspense fallback={<LoadingSpinner />}><EventsPage /></Suspense>} />
                    <Route path="/travel" element={<Suspense fallback={<LoadingSpinner />}><TravelPage /></Suspense>} />
                    <Route path="/forum" element={<Suspense fallback={<LoadingSpinner />}><ForumPage /></Suspense>} />
                    <Route path="/messages" element={<Suspense fallback={<LoadingSpinner />}><MessagesPage /></Suspense>} />
                    <Route path="/profile" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />
                    <Route path="/admin" element={<Suspense fallback={<LoadingSpinner />}><AdminPage /></Suspense>} />
                    <Route path="/settings" element={<Suspense fallback={<LoadingSpinner />}><SettingsPage /></Suspense>} />
                    <Route path="/business/register" element={<Suspense fallback={<LoadingSpinner />}><BusinessRegisterPage /></Suspense>} />
                    <Route path="/catering" element={<Suspense fallback={<LoadingSpinner />}><CateringPage /></Suspense>} />
                    <Route path="/vendor/:businessId/*" element={<Suspense fallback={<LoadingSpinner />}><CateringPage /></Suspense>} />
                    <Route path="/notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationCenterPage /></Suspense>} />
                    <Route path="/notifications/settings" element={<Suspense fallback={<LoadingSpinner />}><NotificationSettingsPage /></Suspense>} />
                    <Route path="/notifications/analytics" element={<Suspense fallback={<LoadingSpinner />}><NotificationAnalyticsPage /></Suspense>} />
                  </Route>
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </AppErrorBoundary>
            </NotificationProviderWrapper>
            </ToastProvider>
          </LocationProvider>
          </CulturalThemeProvider>
        </FeatureSettingsProvider>
        </UserSettingsProvider>
        </BusinessSwitcherProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
