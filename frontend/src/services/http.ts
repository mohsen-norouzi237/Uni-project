/**
 * Shared plumbing for the service layer.
 *
 * Every service asks `USE_MOCKS` exactly once and returns the same shape in
 * both branches, so pages can never tell whether data came from a fixture or
 * from Django.
 */
export const USE_MOCKS = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

/** Simulated network latency, so loading states are actually exercised. */
export const delay = (ms = 400): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
