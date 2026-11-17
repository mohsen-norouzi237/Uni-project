/**
 * Shapes shared by every Django REST Framework endpoint.
 * Keeping them here means a change in the backend contract is a one-file edit.
 */

/** DRF's default pagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Query params every paginated list endpoint accepts.
 * DRF's PageNumberPagination reads `page` and (with `page_size_query_param`)
 * `page_size`; the mapping to snake_case happens in the service layer.
 */
export interface PageQuery {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_QUERY: PageQuery = { page: 1, pageSize: 10 };

/**
 * Builds a DRF-shaped pagination envelope from an in-memory array.
 *
 * This is the mock counterpart of server-side pagination: `count` is the size
 * of the WHOLE filtered set (not of the returned slice), which is exactly the
 * contract the real API follows. Pages are therefore computed from `count`,
 * so the UI behaves identically against mocks and against Django.
 */
export const paginate = <T>(items: T[], { page, pageSize }: PageQuery): Paginated<T> => {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    count: items.length,
    next: start + safePageSize < items.length ? `?page=${safePage + 1}` : null,
    previous: safePage > 1 ? `?page=${safePage - 1}` : null,
    results: items.slice(start, start + safePageSize),
  };
};

/** Total number of pages for a given envelope. Never returns 0. */
export const totalPagesOf = (
  data: Pick<Paginated<unknown>, 'count'> | undefined,
  pageSize: number,
): number => Math.max(1, Math.ceil((data?.count ?? 0) / Math.max(1, pageSize)));
