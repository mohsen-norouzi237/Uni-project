import { QueryClient } from '@tanstack/react-query';

/**
 * One shared client. Defaults are tuned for an admin dashboard:
 * data is cheap to refetch, but we do not want a refetch storm on every
 * window focus while the user is filling in a form.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
