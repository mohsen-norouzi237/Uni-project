import React from 'react';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { dashboardKeys, dashboardService } from '@/services/dashboard.service';

/** Persian digits, matching the rest of the localized UI. */
const toFa = (value: number | string): string =>
  String(value).replace(/\d/g, (d) => ('۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d));

const AdminDashboard: React.FC = () => {
  // Wired to GET /api/dashboards/admin-stats/ (dashboards/views.py::AdminStatsAPIView).
  // The backend defaults to the latest semester when no semester_id is sent.
  const { data: stats, isPending, isError, refetch } = useQuery({
    queryKey: dashboardKeys.adminStats(),
    queryFn: () => dashboardService.adminStats(),
  });

  if (isPending) return <LoadingState message="در حال دریافت آمار داشبورد..." />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* هدر صفحه */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">داشبورد مدیر کل</h1>
        <p className="text-sm text-slate-500 mt-1">
          خلاصه آمار و وضعیت کلی سیستم مدیریت دستیاران آموزشی (TAMS)
        </p>
      </div>

      {/* کارت‌های آمار — bound to AdminStats fields from /api/dashboards/admin-stats/ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="کل دروس ترم جاری"
          value={toFa(stats?.total_courses ?? 0)}
          icon="📚"
          description="نقشه‌برداری استاد–درس در ترم انتخابی"
        />
        <StatCard
          title="دستیاران آموزشی (TA)"
          value={toFa(stats?.total_ta ?? 0)}
          icon="🎓"
          description="فعال در ترم جاری"
        />
        <StatCard
          title="سرتیم‌ها (Head TA)"
          value={toFa(stats?.total_head_ta ?? 0)}
          icon="🧭"
          description="مسئول هماهنگی تیم هر درس"
        />
        <StatCard
          title="دستیاران بدون تخصیص"
          value={toFa(stats?.unassigned_ta ?? 0)}
          icon="⏳"
          description="نیازمند تخصیص در این ترم"
        />
        <StatCard
          title="رسیده به سقف مجاز"
          value={toFa(stats?.at_cap_ta ?? 0)}
          icon="📊"
          description={`بر اساس سقف واحد دستیار ترم`}
        />
      </div>

      {/* بخش نگهدارنده برای توسعه‌های بعدی */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex items-center justify-center border-dashed">
        <p className="text-sm text-slate-400">
          بخش فعالیت‌های اخیر و میانبرهای سیستم (آماده برای توسعه‌های بعدی)
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;