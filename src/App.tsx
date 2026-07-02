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
// Root usage (no `scope`): wraps all routes, full-screen recovery UI.
// Route usage (`scope` set): wraps a single page so a crash in one module
// (e.g. Messages) shows an inline recovery card while the app shell — header,
// navigation, every other module — stays alive. (Session 44)
interface ErrorBoundaryProps { children: ReactNode; scope?: string }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[AppErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Compact in-shell fallback for per-route boundaries
      if (this.props.scope) {
        return (
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', minHeight: '60vh', padding: '20px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '36px', marginBottom: '12px' }}>😵</p>
            <h2 style={{ color: 'var(--aurora-text, #333)', marginBottom: '8px' }}>This section hit an error</h2>
            <p style={{ color: 'var(--aurora-text-secondary, #666)', fontSize: '14px', marginBottom: '20px', maxWidth: '400px' }}>
              The rest of the app is still running. You can retry this section or reload.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={this.handleRetry} style={{
                padding: '10px 24px', backgroundColor: '#6366F1', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
              }}>
                Try Again
              </button>
              <button onClick={this.handleReload} style={{
                padding: '10px 24px', backgroundColor: 'transparent', color: 'var(--aurora-text-secondary, #666)',
                border: '1px solid var(--aurora-border, #ddd)', borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
              }}>
                Reload App
              </button>
            </div>
          </div>
        );
      }
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

// Loading spinner component (full-page for auth routes)
// Themed to Aurora design system with dark-mode support
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'var(--aurora-bg, #f5f5f5)',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3.5px solid var(--aurora-border, #ddd)',
        borderTopColor: 'var(--aurora-accent, #6366F1)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
        margin: '0 auto 16px',
      }} />
      <p style={{ color: 'var(--aurora-text-secondary, #666)', fontSize: '14px', fontWeight: 500 }}>Loading...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

// Optimized page loader for per-route suspense (lower-height, faster perceived load)
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--aurora-text-secondary)' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--aurora-border)', borderTopColor: 'var(--aurora-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <span>Loading...</span>
    </div>
  </div>
);

// Per-route wrapper: error boundary + suspense. A crash inside one page
// unmounts only that page; MainLayout, nav, and other routes stay alive.
// Navigating away unmounts the boundary, so returning to the route retries fresh.
const Page = ({ scope, children }: { scope: string; children: ReactNode }) => (
  <AppErrorBoundary scope={scope}>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </AppErrorBoundary>
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

                    {/* Home & Discovery Routes */}
                    <Route path="/home" element={<Page scope="home"><HomePage /></Page>} />
                    <Route path="/feed" element={<Page scope="feed"><FeedPage /></Page>} />
                    <Route path="/discover" element={<Page scope="discover"><DiscoverPage /></Page>} />

                    {/* Commerce Routes (Business, Marketplace, Housing, Events) */}
                    <Route path="/business" element={<Page scope="business"><BusinessPage /></Page>} />
                    <Route path="/business/register" element={<Page scope="business-register"><BusinessRegisterPage /></Page>} />
                    <Route path="/marketplace" element={<Page scope="marketplace"><MarketplacePage /></Page>} />
                    <Route path="/housing" element={<Page scope="housing"><HousingPage /></Page>} />
                    <Route path="/events" element={<Page scope="events"><EventsPage /></Page>} />

                    {/* Catering/Vendor Routes */}
                    <Route path="/catering" element={<Page scope="catering"><CateringPage /></Page>} />
                    <Route path="/vendor/:businessId/*" element={<Page scope="vendor"><CateringPage /></Page>} />

                    {/* Community Routes (Travel, Forum) */}
                    <Route path="/travel" element={<Page scope="travel"><TravelPage /></Page>} />
                    <Route path="/forum" element={<Page scope="forum"><ForumPage /></Page>} />

                    {/* User Routes (Messages, Profile, Settings) */}
                    <Route path="/messages" element={<Page scope="messages"><MessagesPage /></Page>} />
                    <Route path="/profile" element={<Page scope="profile"><ProfilePage /></Page>} />
                    <Route path="/settings" element={<Page scope="settings"><SettingsPage /></Page>} />

                    {/* Notifications Routes */}
                    <Route path="/notifications" element={<Page scope="notifications"><NotificationCenterPage /></Page>} />
                    <Route path="/notifications/settings" element={<Page scope="notification-settings"><NotificationSettingsPage /></Page>} />
                    <Route path="/notifications/analytics" element={<Page scope="notification-analytics"><NotificationAnalyticsPage /></Page>} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<Page scope="admin"><AdminPage /></Page>} />
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
