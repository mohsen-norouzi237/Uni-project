import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Pagination from '@/components/Pagination';
import CapacityBar from '@/components/CapacityBar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePagination } from '@/hooks/usePagination';
import { workloadKeys, workloadService } from '@/services/workload.service';
import { MOCK_DEPARTMENTS } from '@/mocks/courses.mock';
import { ANY } from '@/types/course';
import type { WorkloadFilterState } from '@/types/workload';
import { DEFAULT_WORKLOAD_FILTERS } from '@/types/workload';

const ITEMS_PER_PAGE = 10;

export const WorkloadMonitoringPage = () => {
  const [filters, setFilters] = useState<WorkloadFilterState>(DEFAULT_WORKLOAD_FILTERS);
  const { page, resetPage, bind } = usePagination(ITEMS_PER_PAGE);

  const setFilter = <K extends keyof WorkloadFilterState>(key: K, value: WorkloadFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetPage();
  };

  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const query = { ...filters, search: debouncedSearch, page, pageSize: ITEMS_PER_PAGE };

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: workloadKeys.list(query),
    queryFn: () => workloadService.list(query),
    placeholderData: keepPreviousData,
  });

  const { data: summary = [] } = useQuery({
    queryKey: workloadKeys.summary(),
    queryFn: () => workloadService.summary(),
  });

  const users = data?.results ?? [];
  const pagination = bind(data);

  const distribution = useMemo(() => {
    const counts = { one: 0, two: 0, threeOrMore: 0 };
    summary.forEach((user) => {
      const length = user.assignedCourses.length;
      if (length === 1) counts.one += 1;
      else if (length === 2) counts.two += 1;
      else if (length >= 3) counts.threeOrMore += 1;
    });
    return counts;
  }, [summary]);

  // Guarded denominator: an empty summary must not produce NaN bar heights.
  const total = Math.max(summary.length, 1);

  const bars = [
    { label: '۱ درس', value: distribution.one, color: 'bg-brand-700' },
    { label: '۲ درس', value: distribution.two, color: 'bg-brand-700' },
    { label: '۳ درس (تکمیل ظرفیت)', value: distribution.threeOrMore, color: 'bg-brand-500' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">پایش حجم کاری دستیاران</h1>
        <p className="mt-1 text-sm text-slate-500">
          بررسی ظرفیت تخصیص دستیاران آموزشی و وضعیت تکمیل سقف مجاز ترم
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">توزیع حجم کاری دستیاران</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
            کل دستیاران پایش‌شده: {summary.length} نفر
          </span>
        </div>

        <div className="grid h-40 grid-cols-3 items-end gap-4 border-b border-slate-100 pb-2 pt-4">
          {bars.map((bar) => (
            <div key={bar.label} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="text-sm font-bold text-slate-700">{bar.value} نفر</span>
              <div
                className={`w-full max-w-[80px] rounded-t-xl ${bar.color} transition-all`}
                style={{ height: `${Math.max((bar.value / total) * 100, 15)}%` }}
              />
              <span className="text-center text-sm font-medium text-slate-500">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold text-slate-800">وضعیت حجم کاری دستیاران</h2>
            <label
              htmlFor="workload-overloaded"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"
            >
              <input
                id="workload-overloaded"
                type="checkbox"
                checked={filters.onlyOverloaded}
                onChange={(event) => setFilter('onlyOverloaded', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-slate-700">فقط تکمیل ظرفیت</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="workload-department" className="sr-only">
                گرایش
              </label>
              <select
                id="workload-department"
                value={filters.department}
                onChange={(event) => setFilter('department', event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value={ANY}>همه گرایش‌ها</option>
                {MOCK_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="workload-search" className="sr-only">
                جستجو
              </label>
              <input
                id="workload-search"
                type="search"
                placeholder="جستجوی نام یا درس..."
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
        </div>

        {isPending ? (
          <DataTableSkeleton rows={ITEMS_PER_PAGE} columns={5} />
        ) : isError ? (
          <ErrorState message="خطا در دریافت اطلاعات حجم کاری" onRetry={() => void refetch()} />
        ) : users.length === 0 ? (
          <EmptyState
            title="موردی یافت نشد"
            description="هیچ دستیار آموزشی با شرایط انتخابی پیدا نشد."
            actionLabel="پاکسازی فیلترها"
            onAction={() => {
              setFilters(DEFAULT_WORKLOAD_FILTERS);
              resetPage();
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-sm font-semibold text-slate-500">
                    <th scope="col" className="p-4">نام دستیار</th>
                    <th scope="col" className="p-4">گروه</th>
                    <th scope="col" className="p-4">دروس تخصیص‌یافته</th>
                    <th scope="col" className="p-4 text-center">سقف مجاز</th>
                    <th scope="col" className="p-4 text-center">وضعیت بار کاری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="p-4 font-semibold text-slate-900">{user.name}</td>
                      <td className="p-4 text-slate-600">{user.department}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {user.assignedCourses.map((code) => (
                            <span
                              key={code}
                              dir="ltr"
                              className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-700"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center font-medium">{user.semesterLimit}</td>
                      <td className="p-4 text-center">
                        {/* Single capacity-bar implementation; the inline LoadBar
                            (unguarded division → NaN width) has been deleted. */}
                        <CapacityBar
                          compact
                          current={user.assignedCourses.length}
                          max={user.semesterLimit}
                          height={10}
                          fullLabel="FULL"
                        />
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
    </div>
  );
};

export default WorkloadMonitoringPage;
