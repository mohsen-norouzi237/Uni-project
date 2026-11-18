import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toApiError } from '@/api/client';
import Pagination from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { coursesKeys } from '@/services/courses.service';
import { dashboardKeys } from '@/services/dashboard.service';
import { workloadKeys } from '@/services/workload.service';
import Button from '@/components/Button';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import ErrorState from '@/components/ErrorState';
import PageContainer from '@/components/PageContainer';
import {
  assignmentsKeys,
  assignmentsService,
  type AssignmentRow,
} from '@/services/assignments.service';

interface Notification {
  message: string;
  type: 'success' | 'error';
}

/**
 * Wired to the Django backend (assignments/urls.py):
 *   GET    /api/v1/assignments/list/     — paginated list
 *   PATCH  /api/v1/assignments/:id/update/ — role change (TA <-> HEAD_TA)
 *   DELETE /api/v1/assignments/:id/      — revoke assignment
 */
export const ManageAssignmentsPage = () => {
  const queryClient = useQueryClient();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRow | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);

  const pageSize = 20;
  const { page, setPage, bind } = usePagination(pageSize);
  const params = { page, pageSize };
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: assignmentsKeys.list(params),
    queryFn: () => assignmentsService.list(params),
  });
  const pagination = bind(data);

  // Notifications auto-dismiss; previously they stayed on screen forever.
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const refreshStaffing = () => {
    for (const queryKey of [assignmentsKeys.lists(), coursesKeys.all, dashboardKeys.all, workloadKeys.all]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (assignment: AssignmentRow) => assignmentsService.remove(assignment.id),
    onSuccess: (_result, assignment) => {
      setNotification({ message: `تخصیص ${assignment.user_name} با موفقیت حذف شد.`, type: 'success' });
      if (page > 1 && data?.results.length === 1) setPage(page - 1);
      refreshStaffing();
    },
    onError: (error) => {
      setNotification({ message: toApiError(error, 'حذف ناموفق بود.').message, type: 'error' });
    },
    onSettled: () => setSelectedAssignment(null),
  });

  /** Toggle TA <-> HEAD_TA via PATCH /assignments/:id/update/. */
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: 'TA' | 'HEAD_TA' }) =>
      assignmentsService.update(id, role),
    onSuccess: () => {
      setNotification({ message: 'نقش دستیار به‌روزرسانی شد.', type: 'success' });
      refreshStaffing();
    },
    onError: (error) => {
      setNotification({
        message: toApiError(error, 'به‌روزرسانی نقش ناموفق بود.').message,
        type: 'error',
      });
    },
  });

  const columns: Column<AssignmentRow>[] = [
    { header: 'نام دستیار', accessor: 'user_name', sortable: true },
    {
      header: 'کد درس',
      accessor: (item) => <span className="font-mono text-brand-600">{item.course_code}</span>,
      sortKey: 'course_code',
      sortable: true,
    },
    { header: 'عنوان درس', accessor: 'course_name', sortable: true },
    { header: 'ترم', accessor: 'semester_name' },
    { header: 'استاد', accessor: 'professor_name' },
    {
      header: 'نقش',
      accessor: (item) => (
        <span
          className={`rounded-md border px-2 py-0.5 text-sm font-medium ${
            item.role === 'HEAD_TA'
              ? 'border-purple-200 bg-purple-50 text-purple-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {item.user_role}
        </span>
      ),
      sortKey: 'role',
      sortable: true,
    },
    {
      header: 'عملیات',
      accessor: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="border border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled={roleMutation.isPending}
            onClick={() =>
              roleMutation.mutate({
                id: item.id,
                role: item.role === 'HEAD_TA' ? 'TA' : 'HEAD_TA',
              })
            }
          >
            {item.role === 'HEAD_TA' ? 'تنزيل به TA' : 'ارتقا به Head TA'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border border-rose-200/60 text-rose-600 hover:bg-rose-50"
            onClick={() => setSelectedAssignment(item)}
          >
            حذف تخصیص
          </Button>
        </div>
      ),
    },
  ];

  const assignments = data?.results ?? EMPTY;

  return (
    <PageContainer
      title="مدیریت و حذف تخصیص‌ها"
      description="مشاهده، تغییر نقش و حذف دستیاران آموزشی تخصیص‌داده‌شده به دروس"
    >
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between rounded-xl p-4 text-sm font-semibold ${
            notification.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            aria-label="بستن"
            onClick={() => setNotification(null)}
            className="rounded text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* The shell above always renders; only this region swaps. */}
      {isPending ? (
        <DataTableSkeleton rows={4} columns={7} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            data={assignments}
            columns={columns}
            paginate={false}
            emptyMessage="هیچ تخصیصی یافت نشد."
          />
          <Pagination {...pagination} onPrevious={pagination.goPrevious} onNext={pagination.goNext} isFetching={isFetching || deleteMutation.isPending} />
        </>
      )}

      <ConfirmDeleteModal
        isOpen={selectedAssignment !== null}
        isLoading={deleteMutation.isPending}
        title="تأیید حذف تخصیص"
        confirmLabel="حذف تخصیص"
        message="آیا از لغو و حذف تخصیص این دستیار آموزشی اطمینان دارید؟"
        itemName={
          selectedAssignment
            ? `${selectedAssignment.user_name} - درس ${selectedAssignment.course_name}`
            : ''
        }
        onConfirm={() =>
          selectedAssignment && deleteMutation.mutate(selectedAssignment)
        }
        onClose={() => setSelectedAssignment(null)}
      />
    </PageContainer>
  );
};

/** Module-level constant: a fresh [] would be a new identity on every render. */
const EMPTY: AssignmentRow[] = [];

export default ManageAssignmentsPage;
