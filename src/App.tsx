import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureSettingsProvider } from './contexts/FeatureSettingsContext';
import { LocationProvider } from './contexts/LocationContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import { CulturalThemeProvider } from './contexts/CulturalThemeContext';
import { PrivateRoute } from './components/shared/PrivateRoute';
import { NotificationProviderWrapper } from './components/shared/NotificationProviderWrapper';
import './index.css';

// Lazy load auth routes
const LoginPage = lazy(() => import('./pages/auth/login').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/auth/signup').then(m => ({ default: m.SignupPage })));
const VerifyPage = lazy(() => import('./pages/auth/verify').then(m => ({ default: m.VerifyPage })));
const SelectEthnicityPage = lazy(() => import('./pages/auth/select-ethnicity').then(m => ({ default: m.SelectEthnicityPage })));

// Lazy load main routes (all use default exports)
const MainLayout = lazy(() => import('./layouts/MainLayout').then(m => ({ default: m.MainLayout })));
const FeedPage = lazy(() => import('./pages/feed'));
const DiscoverPage = lazy(() => import('./pages/discover'));
const BusinessPage = lazy(() => import('./pages/business'));
const HousingPage = lazy(() => import('./pages/housing'));
const EventsPage = lazy(() => import('./pages/events'));
const TravelPage = lazy(() => import('./pages/travel'));
const ForumPage = lazy(() => import('./pages/forum'));
const MessagesPage = lazy(() => import('./pages/messages'));
const ProfilePage = lazy(() => import('./pages/profile'));
const AdminPage = lazy(() => import('./pages/admin'));
const MarketplacePage = lazy(() => import('./pages/marketplace'));
const SettingsPage = lazy(() => import('./pages/settings'));
const BusinessRegisterPage = lazy(() => import('./pages/business/register'));
const CateringPage = lazy(() => import('./pages/catering'));
const HomePage = lazy(() => import('./pages/main/home'));
const NotificationCenterPage = lazy(() => import('./components/shared/NotificationCenter'));
const NotificationSettingsPage = lazy(() => import('./components/shared/NotificationSettings'));
const NotificationAnalyticsPage = lazy(() => import('./components/shared/NotificationAnalytics'));

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
        <UserSettingsProvider>
        <FeatureSettingsProvider>
          <CulturalThemeProvider>
          <LocationProvider>
            <ToastProvider>
            <NotificationProviderWrapper>
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
                    <Route path="/notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationCenterPage /></Suspense>} />
                    <Route path="/notifications/settings" element={<Suspense fallback={<LoadingSpinner />}><NotificationSettingsPage /></Suspense>} />
                    <Route path="/notifications/analytics" element={<Suspense fallback={<LoadingSpinner />}><NotificationAnalyticsPage /></Suspense>} />
                  </Route>
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </NotificationProviderWrapper>
            </ToastProvider>
          </LocationProvider>
          </CulturalThemeProvider>
        </FeatureSettingsProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
