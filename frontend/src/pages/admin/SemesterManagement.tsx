import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, CalendarRange, Clock3, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toApiError } from '@/api/client';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import PageContainer from '@/components/PageContainer';
import StatCard from '@/components/StatCard';
import { Input } from '@/components/ui-forms';
import { ROLES } from '@/constants/roles';
import { coursesKeys } from '@/services/courses.service';
import { dashboardKeys } from '@/services/dashboard.service';
import { semesterKeys, semesterService, semesterToday, type Semester, type SemesterPayload } from '@/services/semesters.service';
import { workloadKeys } from '@/services/workload.service';
import { useAuthStore } from '@/store/authStore';

const emptyForm: SemesterPayload = { name: '', start_date: '', end_date: '', max_ta_courses_limit: 3 };

const dateFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('fa-IR');

function formatDate(date: string) {
  return dateFormat.format(new Date(date + 'T00:00:00Z'));
}

function statusBadge(semester: Semester, today: string) {
  if (semester.start_date > today) return <Badge variant="info">پیش رو</Badge>;
  if (semester.end_date < today) return <Badge>پایان‌یافته</Badge>;
  return <Badge variant="success">در حال برگزاری</Badge>;
}

export default function SemesterManagement() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.user?.role === ROLES.SUPER_ADMIN);
  const list = useQuery({ queryKey: semesterKeys.lists(), queryFn: semesterService.list });
  const [editor, setEditor] = useState<{ id?: number; payload: SemesterPayload } | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Semester | null>(null);
  const [dateError, setDateError] = useState('');
  const formId = useId();

  const refreshSemesterData = () => {
    for (const queryKey of [semesterKeys.all, coursesKeys.all, dashboardKeys.all, workloadKeys.all]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const save = useMutation({
    mutationFn: ({ id, payload }: NonNullable<typeof editor>) =>
      id === undefined ? semesterService.create(payload) : semesterService.update(id, payload),
    onSuccess: () => {
      setEditor(null);
      refreshSemesterData();
    },
  });

  const remove = useMutation({
    mutationFn: semesterService.remove,
    onSuccess: () => {
      setPendingDeletion(null);
      refreshSemesterData();
    },
  });

  const openEditor = (semester?: Semester) => {
    save.reset();
    setDateError('');
    if (!semester) {
      setEditor({ payload: emptyForm });
      return;
    }
    const { id, name, start_date, end_date, max_ta_courses_limit } = semester;
    setEditor({ id, payload: { name, start_date, end_date, max_ta_courses_limit } });
  };

  const update = (changes: Partial<SemesterPayload>) => {
    setDateError('');
    setEditor((current) => current && { ...current, payload: { ...current.payload, ...changes } });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !editor || save.isPending) return;
    if (editor.payload.end_date <= editor.payload.start_date) {
      setDateError('تاریخ پایان باید بعد از تاریخ شروع باشد.');
      return;
    }
    save.mutate({ ...editor, payload: { ...editor.payload, name: editor.payload.name.trim() } });
  };

  const today = semesterToday();
  const rows = list.data ?? [];
  const ongoing = rows.filter((semester) => semester.start_date <= today && today <= semester.end_date);
  const upcoming = rows.filter((semester) => semester.start_date > today).length;

  const columns: Column<Semester>[] = [
    { header: 'کد نیم‌سال', accessor: 'name', sortable: true },
    { header: 'تاریخ شروع', accessor: (row) => formatDate(row.start_date), sortable: true, sortKey: 'start_date' },
    { header: 'تاریخ پایان', accessor: (row) => formatDate(row.end_date), sortable: true, sortKey: 'end_date' },
    { header: 'سقف تخصیص هر دستیار', accessor: 'max_ta_courses_limit', sortable: true },
    { header: 'وضعیت', accessor: (row) => statusBadge(row, today) },
    {
      header: 'عملیات',
      accessor: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/courses?semester_id=${row.id}`}
            aria-label={`دروس نیم‌سال ${row.name}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-100"
          >
            <BookOpen size={15} aria-hidden="true" />
            درس‌ها
          </Link>
          {canManage && (
            <>
              <Button variant="secondary" size="sm" onClick={() => openEditor(row)}>ویرایش</Button>
              <Button variant="ghost" size="sm" className="text-rose-700" onClick={() => {
                remove.reset();
                setPendingDeletion(row);
              }}>حذف</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const formError = save.isError ? toApiError(save.error, 'ذخیره نیم‌سال ناموفق بود.') : undefined;

  return (
    <PageContainer
      title="مدیریت نیم‌سال‌های تحصیلی"
      description="تقویم نیم‌سال‌ها، سقف تخصیص دستیار و فهرست دروس هر ترم"
      actions={canManage && (
        <Button onClick={() => openEditor()}>
          <Plus size={16} aria-hidden="true" />
          افزودن نیم‌سال
        </Button>
      )}
    >
      {list.isSuccess && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="نیم‌سال‌های ثبت‌شده" value={numberFormat.format(rows.length)} icon={<CalendarRange size={20} />} />
          <StatCard title="در حال برگزاری" value={numberFormat.format(ongoing.length)} icon={<CalendarDays size={20} />} description={ongoing.map((row) => row.name).join('، ') || 'نیم‌سال فعالی وجود ندارد'} />
          <StatCard title="نیم‌سال‌های پیش رو" value={numberFormat.format(upcoming)} icon={<Clock3 size={20} />} />
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">فهرست نیم‌سال‌ها</h2>
          {!canManage && <p className="mt-1 text-sm text-slate-500">افزودن، ویرایش و حذف برای مدیر کل سامانه در دسترس است.</p>}
        </div>
        {list.isPending ? <DataTableSkeleton rows={4} columns={6} /> : list.isError ? (
          <ErrorState message="دریافت فهرست نیم‌سال‌ها ناموفق بود." onRetry={() => void list.refetch()} />
        ) : rows.length ? (
          <DataTable data={rows} columns={columns} pageSize={10} />
        ) : (
          <EmptyState
            title="هنوز نیم‌سالی ثبت نشده است"
            description={canManage ? 'برای شروع، نخستین نیم‌سال تحصیلی را اضافه کنید.' : 'پس از ثبت نیم‌سال توسط مدیر کل، اینجا نمایش داده می‌شود.'}
            actionLabel={canManage ? 'افزودن نیم‌سال' : undefined}
            onAction={canManage ? () => openEditor() : undefined}
          />
        )}
      </section>

      {canManage && editor && (
        <Modal
          isOpen
          title={editor.id === undefined ? 'افزودن نیم‌سال' : 'ویرایش نیم‌سال'}
          onClose={() => { if (!save.isPending) setEditor(null); }}
          footer={<>
            <Button variant="secondary" disabled={save.isPending} onClick={() => setEditor(null)}>انصراف</Button>
            <Button type="submit" form={formId} disabled={save.isPending}>{save.isPending ? 'در حال ذخیره…' : 'ذخیره نیم‌سال'}</Button>
          </>}
        >
          <form id={formId} onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor={`${formId}-name`}>کد نیم‌سال</label>
              <Input id={`${formId}-name`} required maxLength={5} pattern=".*\S.*" placeholder="مثال: 4051" value={editor.payload.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${formId}-start`}>تاریخ شروع</label>
                <Input dir="ltr" id={`${formId}-start`} type="date" required value={editor.payload.start_date} onChange={(e) => update({ start_date: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${formId}-end`}>تاریخ پایان</label>
                <Input dir="ltr" id={`${formId}-end`} type="date" required value={editor.payload.end_date} onChange={(e) => update({ end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor={`${formId}-limit`}>سقف تخصیص هر دستیار</label>
              <Input id={`${formId}-limit`} type="number" min={1} max={2147483647} required value={editor.payload.max_ta_courses_limit || ''} onChange={(e) => update({ max_ta_courses_limit: Number(e.target.value) })} />
            </div>
            {(dateError || formError) && (
              <p role="alert" className="text-sm text-rose-700">
                {dateError || Object.values(formError?.fieldErrors ?? {}).flat().join(' ') || formError?.message}
              </p>
            )}
          </form>
        </Modal>
      )}

      <ConfirmDeleteModal
        isOpen={canManage && pendingDeletion !== null}
        isLoading={remove.isPending}
        title="حذف نیم‌سال"
        itemName={pendingDeletion?.name}
        message={remove.isError ? toApiError(remove.error, 'حذف نیم‌سال ناموفق بود.').message : 'این نیم‌سال حذف شود؟'}
        onConfirm={() => { if (pendingDeletion) remove.mutate(pendingDeletion.id); }}
        onClose={() => { if (!remove.isPending) setPendingDeletion(null); }}
      />
    </PageContainer>
  );
}
