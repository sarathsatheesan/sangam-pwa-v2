import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import ModuleSelector from '../components/layout/ModuleSelector';
import AppFooter from '../components/layout/AppFooter';
import { ToastContainer } from '../components/shared/Toast';
import GlobalCallOverlay from '../components/GlobalCallOverlay';
import GroupCallOverlay from '../components/GroupCallOverlay';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  // Hide footer in commerce-focused modules to maximize product content area
  const hideFooter = location.pathname.startsWith('/catering');

  return (
    <div className="flex flex-col overflow-hidden aurora-bg-subtle" style={{ height: 'var(--app-height, 100vh)' }}>
      {/* Header */}
      <AppHeader />

      {/* Module Selector */}
      <ModuleSelector />

      {/* Main content area — scrolls between header/module-selector and footer */}
      <main className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: 'var(--safe-bottom, 0px)' }}>
        <Outlet />
      </main>

      {/* Footer — hidden in catering module to maximize content area */}
      {!hideFooter && <AppFooter />}

      {/* Toast notifications */}
      <ToastContainer />

      {/* Global call overlay — persists across all route changes */}
      <GlobalCallOverlay />

      {/* Group call overlay — multi-party mesh calls */}
      <GroupCallOverlay />
    </div>
  );
};
