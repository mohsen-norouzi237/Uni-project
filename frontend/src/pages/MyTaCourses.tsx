import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Badge from '@/components/Badge';
import ErrorState from '@/components/ErrorState';
import { dashboardKeys, dashboardService, type MyCourseRow } from '@/services/dashboard.service';

/**
 * Wired to GET /api/dashboards/me/ (dashboards/views.py::UserDashboardAPIView).
 * The page requests the current user's assignments across their semesters.
 * `role` is get_role_display() output ("Head TA" / "Teaching Assistant").
 */
export default function MyTACourses() {
    const navigate = useNavigate();

    const { data: courses, isPending, isError, refetch } = useQuery({
        queryKey: dashboardKeys.myCourses(),
        queryFn: () => dashboardService.myCourses(),
    });

    const handleNavigate = (course: MyCourseRow) => {
        if (course.assignment_role === 'HEAD_TA') {
            navigate(`/head-ta-dashboard/${course.id}`);
        } else {
            navigate(`/ta-dashboard/${course.id}`);
        }
    };

    const columns: Column<MyCourseRow>[] = [
        { header: 'کد درس', accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded">{item.course_code}</code>, sortable: true, sortKey: 'course_code' },
        { header: 'نام درس', accessor: 'course_name', sortable: true },
        { header: 'استاد', accessor: (item) => item.professor_name || '—' },
        { header: 'سرتیم', accessor: (item) => item.head_ta_name || '—' },
        { header: 'ترم', accessor: 'semester', sortable: true },
        {
            header: 'نقش شما',
            accessor: (item) => (
                <Badge variant={item.assignment_role === 'HEAD_TA' ? 'info' : 'default'}>
                    {item.assignment_role === 'HEAD_TA' ? 'سرتیم (Head TA)' : 'دستیار (TA)'}
                </Badge>
            ),
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <button
                    onClick={() => handleNavigate(item)}
                    className="bg-blue-50 text-brand-600 border border-transparent hover:border-blue-200 text-sm px-4 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                >
                    ورود به داشبورد
                </button>
            )
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">کلاس‌های من</h1>
                <p className="text-gray-600 text-sm">لیست دروسی که در آن‌ها به عنوان دستیار آموزشی فعالیت دارید.</p>
            </header>

            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                {isPending ? (
                    <DataTableSkeleton rows={3} columns={7} />
                ) : isError ? (
                    <ErrorState onRetry={() => void refetch()} />
                ) : (
                    <DataTable data={courses ?? []} columns={columns} pageSize={10} emptyMessage="شما در هیچ درسی دستیار نیستید." />
                )}
            </section>
        </div>
    );
}
