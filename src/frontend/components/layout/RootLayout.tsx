import { Outlet } from '@tanstack/react-router';
import { GlobalNotifications } from '../ui/GlobalNotifications';
import { OfflineDetector } from '../ui/OfflineDetector';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export const RootLayout = () => {
  return (
    <ErrorBoundary>
      <OfflineDetector />
      <GlobalNotifications />
      <Outlet />
    </ErrorBoundary>
  );
};
