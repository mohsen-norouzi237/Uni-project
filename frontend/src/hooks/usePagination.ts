import { useCallback, useState } from 'react';
import { totalPagesOf } from '@/types/api';
import type { Paginated } from '@/types/api';

/**
 * Server-driven pagination state.
 *
 * The page number lives here and is fed into the query key, so React Query
 * fetches the requested window from the backend instead of the UI slicing a
 * page it already holds. `totalPages` is derived from the envelope's `count`
 * (the full filtered total), never from `results.length`.
 *
 * Clamping happens on the STATE, not only on the rendered value. The previous
 * version clamped `currentPage` for display while leaving `page` (and therefore
 * the query key) out of range. The mock `paginate()` clamps internally so that
 * was invisible, but DRF answers an out-of-range `?page=` with 404 - the bug
 * would only have surfaced against the real backend.
 */
export const usePagination = (pageSize: number) => {
  const [page, setPage] = useState(1);

  /** Call whenever a filter changes, so the user is not left on a stale page. */
  const resetPage = useCallback(() => setPage(1), []);

  const bind = <T,>(data: Paginated<T> | undefined) => {
    const totalPages = totalPagesOf(data, pageSize);
    const currentPage = Math.min(page, totalPages);

    // Adjusting state during render is React's documented pattern for deriving
    // state from props/data: React re-renders immediately with the corrected
    // value, before anything is committed to the DOM. Guarded by `data` so a
    // pending/undefined envelope (totalPages === 1) can never reset the page.
    if (data !== undefined && currentPage !== page) {
      setPage(currentPage);
    }

    return {
      currentPage,
      totalPages,
      totalCount: data?.count ?? 0,
      canGoPrevious: currentPage > 1,
      canGoNext: currentPage < totalPages,
      goPrevious: () => setPage(Math.max(1, currentPage - 1)),
      goNext: () => setPage(Math.min(totalPages, currentPage + 1)),
    };
  };

  return { page, setPage, resetPage, bind };
};
