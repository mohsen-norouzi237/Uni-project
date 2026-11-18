import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes/router';
import ErrorBoundary from '@/components/ErrorBoundary';
import { queryClient } from '@/app/queryClient';
import { useAuthStore } from '@/store/authStore';
import { AUTH_SESSION_EXPIRED_EVENT } from '@/api/client';

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const logout = useAuthStore((state) => state.logout);

  // Session bootstrap happens here, not at module import time.
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // The axios layer reports an unrecoverable 401 through this event instead of
  // doing `window.location.href = '/login'` (which caused redirect storms).
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [logout]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* The router object is defined outside the component tree, so routes
            can be rendered in tests with createMemoryRouter. */}
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
