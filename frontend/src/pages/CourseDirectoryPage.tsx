import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Pagination from '@/components/Pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePagination } from '@/hooks/usePagination';
import { coursesKeys, coursesService } from '@/services/courses.service';
import type { CourseFilterState, StaffingStatus } from '@/types/course';
import { ANY, DEFAULT_COURSE_FILTERS, STAFFING_STATUS_LABELS } from '@/types/course';

// Showcase departments matching the Persian UI context
const MOCK_DEPARTMENTS = [
  'مهندسی کامپیوتر',
  'مهندسی برق',
  'علوم ریاضی',
  'فیزیک',
  'مهندسی صنایع'
];

const ITEMS_PER_PAGE = 10;

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  fully_staffed: { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  missing_head_ta: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  missing_tas: { badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

const StatusBadge = ({ status }: { status: StaffingStatus | string | null }) => {
  // Use the predefined style, or default to a neutral gray badge if the status is unknown/null
  const style = STATUS_STYLES[status as string] || { 
    badge: 'bg-slate-50 text-slate-700', 
    dot: 'bg-slate-400' 
  };
  
  // Use the predefined label, or default to the raw status text, or 'نامشخص' (Unknown)
  const label = (STAFFING_STATUS_LABELS as Record<string, string>)[status as string] || status || 'نامشخص';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${style.badge}`}
    >
      {label}
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
    </span>
  );
};

/* Narrowing helper: keeps the `status` filter a union instead of a bare string. */
const isStaffingStatus = (value: string): value is StaffingStatus =>
  value === 'fully_staffed' || value === 'missing_head_ta' || value === 'missing_tas';

export const CourseDirectoryPage = () => {
  const [filters, setFilters] = useState<CourseFilterState>(DEFAULT_COURSE_FILTERS);
  const { page, resetPage, bind } = usePagination(ITEMS_PER_PAGE);

  const setFilter = <K extends keyof CourseFilterState>(key: K, value: CourseFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetPage();
  };

  // One request per pause in typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  /*
   - The page number is part of the query object and therefore part of the query
   - key. That is what hands pagination to the server: changing the page issues
   - a new request for that window rather than re-slicing data already in memory.
   */
  const query = { ...filters, search: debouncedSearch, page, pageSize: ITEMS_PER_PAGE };

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: coursesKeys.list(query),
    queryFn: () => coursesService.list(query),
    // Keep the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: coursesKeys.instructors(),
    queryFn: () => coursesService.instructors(),
  });

  const courses = data?.results ?? [];
  // Derived from count (the full server-side total), never from results.length.
  const pagination = bind(data);

  const handleResetFilters = () => {
    setFilters(DEFAULT_COURSE_FILTERS);
    resetPage();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">دایرکتوری و کاتالوگ دروس</h1>
        <p className="mt-1 text-sm text-slate-500">
          لیست دروس ترم جاری با قابلیت فیلتر بر اساس گروه، استاد و وضعیت تخصیص دستیار
        </p>
      </div>

      {/* Filters stay mounted while data loads, so focus is never stolen mid-typing. */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="course-search" className="mb-1 block text-sm font-medium text-slate-600">
            جستجو
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="کد یا نام درس..."
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label htmlFor="course-department" className="mb-1 block text-sm font-medium text-slate-600">
            گروه آموزشی
          </label>
          <select
            id="course-department"
            value={filters.department}
            onChange={(event) => setFilter('department', event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value={ANY}>همه گروه‌ها</option>
            {MOCK_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="course-instructor" className="mb-1 block text-sm font-medium text-slate-600">
            استاد درس
          </label>
          <select
            id="course-instructor"
            value={filters.instructor}
            onChange={(event) => setFilter('instructor', event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value={ANY}>همه اساتید</option>
            {instructors.map((instructor) => (
              <option key={instructor} value={instructor}>
                {instructor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="course-status" className="mb-1 block text-sm font-medium text-slate-600">
            وضعیت تخصیص
          </label>
          <select
            id="course-status"
            value={filters.status}
            onChange={(event) => {
              const next = event.target.value;
              setFilter('status', isStaffingStatus(next) ? next : ANY);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value={ANY}>همه وضعیت‌ها</option>
            <option value="fully_staffed">{STAFFING_STATUS_LABELS.fully_staffed}</option>
            <option value="missing_head_ta">{STAFFING_STATUS_LABELS.missing_head_ta}</option>
            <option value="missing_tas">{STAFFING_STATUS_LABELS.missing_tas}</option>
          </select>
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton rows={ITEMS_PER_PAGE} columns={7} />
      ) : isError ? (
        <ErrorState message="خطا در دریافت لیست دروس" onRetry={() => void refetch()} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="درسی یافت نشد"
          description="هیچ درسی با فیلترهای انتخابی پیدا نشد."
          actionLabel="پاکسازی فیلترها"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-sm font-semibold text-slate-500">
                  <th scope="col" className="p-4">کد درس</th>
                  <th scope="col" className="p-4">نام درس</th>
                  <th scope="col" className="p-4">استاد</th>
                  <th scope="col" className="p-4">سر دستیار</th>
                  <th scope="col" className="p-4 text-center">تعداد دستیاران</th>
                  <th scope="col" className="p-4 text-center">وضعیت</th>
                  <th scope="col" className="p-4 text-center">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {courses.map((course) => (
                  <tr key={course.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="p-4 font-mono font-semibold text-brand-600" dir="ltr">
                      {course.code}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">{course.title}</td>
                    <td className="p-4">{course.instructor}</td>
                    <td className="p-4 text-slate-600">{course.headTa}</td>
                    <td className="p-4 text-center font-medium">{course.taCount} نفر</td>
                    <td className="p-4 text-center">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="p-4 text-center">
                      <Link
                        to={`/courses/${course.id}`}
                        aria-label={`مشاهده جزئیات درس ${course.title}`}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-50 px-3 py-1.5 font-medium text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        اطلاعات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            onPrevious={pagination.goPrevious}
            onNext={pagination.goNext}
            isFetching={isFetching}
          />
        </div>
      )}
    </div>
  );
};

export default CourseDirectoryPage;