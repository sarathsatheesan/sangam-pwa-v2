// Wrapper that extracts userId from AuthContext and passes it to NotificationProvider
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';

export function NotificationProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <NotificationProvider userId={user?.uid || null}>
      {children}
    </NotificationProvider>
  );
}
