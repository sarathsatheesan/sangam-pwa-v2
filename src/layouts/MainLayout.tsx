import React from 'react';
import { Outlet } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import ModuleSelector from '../components/layout/ModuleSelector';
import AppFooter from '../components/layout/AppFooter';
import { ToastContainer } from '../components/shared/Toast';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen aurora-bg-subtle">
      {/* Header */}
      <AppHeader />

      {/* Module Selector */}
      <ModuleSelector />

      {/* Main content area — scrolls between header/module-selector and footer */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>

      {/* Footer — fixed at bottom */}
      <AppFooter />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};
