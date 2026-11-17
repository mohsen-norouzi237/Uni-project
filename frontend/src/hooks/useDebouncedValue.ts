import { useEffect, useState } from 'react';

/**
 * Delays propagation of a rapidly-changing value.
 *
 * Used for search inputs: without it every keystroke produces a new React
 * Query key and therefore a new request to Django.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
