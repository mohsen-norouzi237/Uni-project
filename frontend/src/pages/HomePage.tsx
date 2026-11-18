import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, GraduationCap, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import { ADMIN_ROLES, ROLES, TA_ROLES } from '@/constants/roles';
import { USE_MOCKS } from '@/services/http';
import { currentSemester, semesterKeys, semesterService } from '@/services/semesters.service';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  const { data: semesters = [] } = useQuery({
    queryKey: semesterKeys.lists(), queryFn: semesterService.list, enabled: !USE_MOCKS,
  });
  const semester = currentSemester(semesters);
  const name = user && (`${user.first_name} ${user.last_name}`.trim() || user.username);
  const shortcuts = [{ path: '/courses', label: 'دایرکتوری دروس', icon: BookOpen }];

  if (user && ADMIN_ROLES.includes(user.role)) {
    shortcuts.unshift(
      { path: '/admin-dashboard', label: 'داشبورد مدیریت', icon: LayoutDashboard },
      { path: '/admin-semester', label: 'مدیریت نیم‌سال‌ها', icon: CalendarDays },
    );
  } else if (user?.role === ROLES.PROFESSOR) {
    shortcuts.unshift({ path: '/professor-dashboard', label: 'داشبورد استاد', icon: GraduationCap });
  } else if (user && TA_ROLES.includes(user.role)) {
    shortcuts.unshift({ path: '/my-ta-courses', label: 'کلاس‌های من', icon: GraduationCap });
  }

  return (
    <PageContainer
      title={name ? `خوش آمدید، ${name}` : 'خانه'}
      description="سامانه مدیریت دستیاران آموزشی"
    >
      {semester && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">نیم‌سال جاری</h2>
            <p className="mt-1 text-lg font-bold text-brand-700">{semester.name}</p>
          </div>
          <Link to={`/courses?semester_id=${semester.id}`} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-100">
            مشاهده دروس نیم‌سال
          </Link>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">دسترسی سریع</h2>
        <nav aria-label="میانبرهای خانه" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-brand-200">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><Icon size={20} aria-hidden="true" /></span>
              {label}
            </Link>
          ))}
        </nav>
      </section>
    </PageContainer>
  );
}
