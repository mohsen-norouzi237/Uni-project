import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  /**
   * Required to sort a column whose accessor is a render function.
   * Without it, `sortable` on a function accessor is ignored (and the arrow
   * is hidden) instead of silently doing nothing.
   */
  sortKey?: keyof T;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  pageSize?: number;
}

const renderPrimitive = (value: unknown): ReactNode => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'string' || typeof value === 'number') return value;
  // Objects/arrays need an explicit function accessor; never blindly cast.
  return String(value);
};

const compare = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fa');
};

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  emptyMessage = 'داده‌ای برای نمایش وجود ندارد.',
  pageSize = 5,
}: DataTableProps<T>) {
  const [sortColumnIndex, setSortColumnIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  /** A column can sort when it has a plain accessor or an explicit sortKey. */
  const sortKeyFor = (col: Column<T>): keyof T | null => {
    if (!col.sortable) return null;
    if (col.sortKey) return col.sortKey;
    return typeof col.accessor === 'function' ? null : col.accessor;
  };

  /**
   * Filtering into fewer pages must not strand the user on an empty page.
   *
   * Keyed off `data.length`, not `data`: the array identity changes on almost
   * every parent render (`tasks.filter(...)` and friends), which previously
   * snapped the user back to page 1 whenever they sorted a column.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, pageSize]);

  const handleSort = (index: number) => {
    if (sortColumnIndex === index) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumnIndex(index);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (sortColumnIndex === null) return data;

    const col = columns[sortColumnIndex];
    if (!col) return data; // noUncheckedIndexedAccess: index may be stale

    const key = sortKeyFor(col);
    if (!key) return data;

    return [...data].sort((a, b) => {
      const result = compare(a[key], b[key]);
      return sortDirection === 'asc' ? result : -result;
    });
  }, [data, sortColumnIndex, sortDirection, columns]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  return (
    <div className="w-full space-y-4">
      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-right text-sm text-gray-600">
          <thead className="border-b border-gray-200 bg-gray-50 text-sm uppercase text-gray-700">
            <tr>
              {columns.map((col, index) => {
                const canSort = sortKeyFor(col) !== null;
                const isSorted = sortColumnIndex === index;

                return (
                  <th
                    key={col.header}
                    scope="col"
                    aria-sort={
                      canSort
                        ? isSorted
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    className="select-none px-6 py-3 font-semibold"
                  >
                    {canSort ? (
                      <button
                        type="button"
                        // No onKeyDown: this is a native <button>, so Enter and
                        // Space already fire onClick. Handling them again made
                        // Space sort twice in some browsers.
                        onClick={() => handleSort(index)}
                        className="flex items-center gap-1 rounded hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        <span>{col.header}</span>
                        <span aria-hidden="true" className="text-sm text-gray-400">
                          {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, rowIndex) => (
                <tr key={item.id ?? rowIndex} className="transition-colors hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.header} className="whitespace-nowrap px-6 py-4">
                      {typeof col.accessor === 'function'
                        ? col.accessor(item)
                        : renderPrimitive(item[col.accessor])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="flex items-center justify-between px-2 py-2 text-sm text-gray-600">
          <div>
            صفحه <span className="font-semibold text-gray-800">{currentPage}</span> از{' '}
            <span className="font-semibold text-gray-800">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              قبلی
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
