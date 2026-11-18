import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toApiError } from '@/api/client';
import Button from '@/components/Button';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { EmptyState } from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageContainer from '@/components/PageContainer';
import { coursesKeys, coursesService, type CourseMember } from '@/services/courses.service';
import { assignmentsKeys, assignmentsService } from '@/services/assignments.service';
import { workloadKeys } from '@/services/workload.service';
import { dashboardKeys, dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/store/authStore';

export function LiveCourseDetails() {
  const { courseId } = useParams();
  const [params] = useSearchParams();
  const id = Number(courseId);
  const professorId = Number(params.get('professor_id')) || undefined;
  const queryClient = useQueryClient();
  const [pendingRemoval, setPendingRemoval] = useState<CourseMember | null>(null);
  const remove = useMutation({
    mutationFn: (assignmentId: number) => assignmentsService.remove(assignmentId),
    onSuccess: () => {
      setPendingRemoval(null);
      for (const queryKey of [coursesKeys.all, assignmentsKeys.all, dashboardKeys.all, workloadKeys.all]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  const semesterId = Number(params.get('semester_id')) || undefined;
  const validId = Number.isSafeInteger(id) && id > 0;
  const course = useQuery({
    queryKey: coursesKeys.detail(id, semesterId),
    queryFn: () => coursesService.retrieve(id, semesterId),
    enabled: validId,
  });
  const roster = useQuery({
    queryKey: coursesKeys.roster(id, semesterId),
    queryFn: () => coursesService.roster(id, semesterId),
    enabled: validId && course.isSuccess,
    retry: (count, error) => toApiError(error).status !== 403 && count < 1,
  });

  if (!validId) return <EmptyState title="درس یافت نشد" />;
  if (course.isPending) return <LoadingState />;
  if (course.isError) return <ErrorState onRetry={() => void course.refetch()} />;

  const members = roster.data && [
    ...roster.data.head_tas.map((member) => ({ ...member, isHead: true })),
    ...roster.data.tas.map((member) => ({ ...member, isHead: false })),
  ].filter((member) => professorId === undefined || member.professor_id === professorId);

  return (
    <PageContainer title={course.data.course_name} description={course.data.course_code}>
      <section className="space-y-2 rounded-xl border bg-white p-5">
        {!professorId && <p>استاد: {course.data.professor_name}</p>}
        <p>تعداد دستیاران: {members?.length ?? course.data.ta_count}</p>
      </section>
      {roster.isPending && <LoadingState />}
      {roster.isError && toApiError(roster.error).status !== 403 && (
        <ErrorState message="خطا در دریافت فهرست دستیاران" onRetry={() => void roster.refetch()} />
      )}
      {members && (
        <section className="space-y-3 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">دستیاران آموزشی</h2>
          {members.length ? (
            <ul className="divide-y">
              {members.map((member) => (
                <li key={member.assignment_id} className="flex items-center justify-between gap-3 py-2">
                  <span>{member.name}{member.isHead && ' (سر دستیار)'}</span>
                  {member.can_remove && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      remove.reset();
                      setPendingRemoval(member);
                    }}>
                      حذف تخصیص
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p>دستیار آموزشی ثبت نشده است.</p>}
        </section>
      )}
      <ConfirmDeleteModal
        isOpen={pendingRemoval !== null}
        isLoading={remove.isPending}
        itemName={pendingRemoval?.name ?? ''}
        onClose={() => {
          setPendingRemoval(null);
          remove.reset();
        }}
        onConfirm={() => {
          if (pendingRemoval) remove.mutate(pendingRemoval.assignment_id);
        }}
        message={remove.isError ? toApiError(remove.error).message : 'این دستیار از درس حذف شود؟'}
      />
    </PageContainer>
  );
}

export function LiveProfessorDashboard() {
  const userId = useAuthStore((state) => state.user?.id);
  const schedule = useQuery({
    queryKey: dashboardKeys.professorCourses(userId ?? 0),
    queryFn: () => dashboardService.professorCourses(userId!),
    enabled: userId !== undefined,
  });

  if (schedule.isPending) return <LoadingState />;
  if (schedule.isError) return <ErrorState onRetry={() => void schedule.refetch()} />;

  return (
    <PageContainer title="داشبورد استاد">
      {schedule.data.length === 0 ? <EmptyState title="درسی برای شما ثبت نشده است" /> : (
        <ul className="space-y-3">
          {schedule.data.map((course) => (
            <li key={course.id} className="rounded-xl border bg-white p-4">
              <Link className="font-semibold text-brand-700" to={`/courses/${course.course_id}?semester_id=${course.semester_id}`}>
                {course.course_name} ({course.course_code})
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                ترم {course.semester_name} · گروه {course.group} · سر دستیار: {course.head_ta_name ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

export function LiveAssignmentDashboard({ head }: { head: boolean }) {
  const { courseId } = useParams();
  const assignments = useQuery({ queryKey: dashboardKeys.myCourses(), queryFn: dashboardService.myCourses });
  if (assignments.isPending) return <LoadingState />;
  if (assignments.isError) return <ErrorState onRetry={() => void assignments.refetch()} />;

  const matches = assignments.data.filter((row) => (row.assignment_role === 'HEAD_TA') === head);
  const assignment = matches.find((row) => String(row.id) === courseId)
    ?? matches.find((row) => row.course_code === courseId);
  if (!assignment) return <EmptyState title="تخصیص درس یافت نشد" />;

  return (
    <PageContainer title={assignment.course_name} description={assignment.course_code}>
      <section className="space-y-2 rounded-xl border bg-white p-5">
        <p>ترم: {assignment.semester}</p>
        <p>استاد: {assignment.professor_name}</p>
        <p>سر دستیار: {assignment.head_ta_name ?? '—'}</p>
        <Link className="text-brand-700" to={`/courses/${assignment.course_id}?semester_id=${assignment.semester_id}&professor_id=${assignment.professor_id}`}>مشاهده جزئیات درس</Link>
      </section>
    </PageContainer>
  );
}
