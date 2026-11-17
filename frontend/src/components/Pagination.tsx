interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Total number of records on the SERVER, not the length of the current page. */
  totalCount: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Shown while a page transition is in flight. */
  isFetching?: boolean;
}

/**
 * Shared pagination footer.
 *
 * Both list pages used to inline an identical copy of this markup, which is how
 * the `results.length` bug ended up duplicated. One component, one fix.
 */
export const Pagination = ({
  currentPage,
  totalPages,
  totalCount,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  isFetching = false,
}: PaginationProps) => (
  <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm text-slate-500">
    <span aria-live="polite">
      صفحه {currentPage} از {totalPages} (مجموع {totalCount} مورد)
      {isFetching && <span className="mr-2 text-slate-400">در حال بروزرسانی…</span>}
    </span>
    <nav className="flex items-center gap-2" aria-label="صفحه‌بندی">
      <button
        type="button"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        className="rounded-lg border border-slate-200 px-3 py-1.5 transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        قبلی
      </button>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={onNext}
        className="rounded-lg border border-slate-200 px-3 py-1.5 transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        بعدی
      </button>
    </nav>
  </div>
);

export default Pagination;
