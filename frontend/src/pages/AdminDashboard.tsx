import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, ChartNoAxesColumn } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageContainer from '@/components/PageContainer';
import StatCard from '@/components/StatCard';
import { dashboardKeys, dashboardService } from '@/services/dashboard.service';
import { currentSemester, semesterKeys, semesterService } from '@/services/semesters.service';

const numberFormat = new Intl.NumberFormat('fa-IR');

export default function AdminDashboard() {
  const [selectedId, setSelectedId] = useState<number>();
  const terms = useQuery({ queryKey: semesterKeys.lists(), queryFn: semesterService.list });
  const rows = terms.data ?? [];
  const semester = rows.find((row) => row.id === selectedId) ?? currentSemester(rows) ?? rows[0];
  const stats = useQuery({
    queryKey: dashboardKeys.adminStats(semester?.id),
    queryFn: () => dashboardService.adminStats(semester?.id),
    enabled: semester !== undefined,
  });

  const shortcuts = [
    { title: 'مدیریت نیم‌سال‌ها', path: '/admin-semester', icon: CalendarDays },
    { title: 'دروس این نیم‌سال', path: `/courses?semester_id=${semester?.id}`, icon: BookOpen },
    { title: 'پایش حجم کاری', path: `/workload?semester_id=${semester?.id}`, icon: ChartNoAxesColumn },
  ];

  return (
    <PageContainer
      title="داشبورد مدیریت"
      description="آمار دروس و دستیاران آموزشی هر نیم‌سال"
      actions={semester && (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <label htmlFor="admin-dashboard-semester">نیم‌سال</label>
          <select id="admin-dashboard-semester" className="rounded-xl border border-slate-200 bg-white px-3 py-2" value={semester.id} onChange={(event) => setSelectedId(Number(event.target.value))}>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </div>
      )}
    >
      {terms.isPending ? <LoadingState /> : terms.isError ? (
        <ErrorState message="دریافت نیم‌سال‌ها ناموفق بود." onRetry={() => void terms.refetch()} />
      ) : !semester ? (
        <>
          <EmptyState title="هنوز نیم‌سالی ثبت نشده است" description="پس از ثبت نیم‌سال، آمار دروس و دستیاران اینجا نمایش داده می‌شود." />
          <Link to="/admin-semester" className="inline-block rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">مدیریت نیم‌سال‌ها</Link>
        </>
      ) : (
        <>
          {stats.isPending ? <LoadingState message="در حال دریافت آمار…" /> : stats.isError ? (
            <ErrorState onRetry={() => void stats.refetch()} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard title="دروس نیم‌سال" value={numberFormat.format(stats.data.total_courses)} icon="📚" />
              <StatCard title="دستیاران آموزشی" value={numberFormat.format(stats.data.total_ta)} icon="🎓" />
              <StatCard title="سر دستیاران" value={numberFormat.format(stats.data.total_head_ta)} icon="🧭" />
              <StatCard title="دستیاران بدون تخصیص" value={numberFormat.format(stats.data.unassigned_ta)} icon="⏳" />
              <StatCard title="رسیده به سقف تخصیص" value={numberFormat.format(stats.data.at_cap_ta)} icon="📊" />
            </div>
          )}
          <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">دسترسی سریع</h2>
            <nav aria-label="میانبرهای مدیریت" className="grid gap-3 sm:grid-cols-3">
              {shortcuts.map(({ title, path, icon: Icon }) => (
                <Link key={path} to={path} className="flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                  <Icon size={18} aria-hidden="true" /> {title}
                </Link>
              ))}
            </nav>
          </section>
        </>
      )}
    </PageContainer>
  );
}
