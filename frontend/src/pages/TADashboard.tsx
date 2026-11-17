import { useState, useEffect } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import DataTableSkeleton from '../components/DataTableSkeleton';
import Badge from '../components/Badge';

interface MyTask {
    id: number;
    title: string;
    status: 'pending' | 'done';
    dueDate: string;
    description?: string;
}

const initialTasks: MyTask[] = [
    { id: 1, title: 'تصحیح تمرین‌های سری اول', status: 'pending', dueDate: '۱۴۰۳/۰۶/۱۰', description: 'فایل‌های ارسالی در سامانه را بررسی و نمرات را وارد کنید.' },
    { id: 2, title: 'طراحی سوالات کوئیز دوم', status: 'done', dueDate: '۱۴۰۳/۰۶/۰۵' }
];

export default function TADashboard() {
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<MyTask[]>(initialTasks);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const toggleTaskStatus = (taskId: number) => {
        setTasks(prev => prev.map(task =>
            task.id === taskId
                ? { ...task, status: task.status === 'pending' ? 'done' : 'pending' }
                : task
        ));
    };

    const columns: Column<MyTask>[] = [
        { header: 'عنوان وظیفه', accessor: 'title', sortable: true },
        {
            header: 'توضیحات',
            accessor: (item) => <span className="text-sm text-gray-500">{item.description || '---'}</span>
        },
        { header: 'مهلت انجام', accessor: (item) => <span className="text-sm text-gray-700">{item.dueDate}</span>, sortable: true },
        {
            header: 'وضعیت',
            accessor: (item) => (
                <Badge variant={item.status === 'done' ? 'success' : 'warning'}>
                    {item.status === 'done' ? 'انجام شده' : 'در انتظار'}
                </Badge>
            ),
            sortable: true
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <button
                    onClick={() => toggleTaskStatus(item.id)}
                    className={`text-sm px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer font-medium ${item.status === 'pending'
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    {item.status === 'pending' ? 'ثبت به عنوان انجام شده' : 'لغو انجام'}
                </button>
            )
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">داشبورد دستیار آموزشی (TA)</h1>
                <p className="text-gray-600 text-sm">لیست وظایف محول شده به شما توسط سرتیم یا استاد.</p>
            </header>

            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-6 text-gray-900">تکالیف من</h2>

                {loading ? (
                    <DataTableSkeleton rows={3} columns={5} />
                ) : (
                    <DataTable
                        data={tasks}
                        columns={columns}
                        pageSize={10}
                        emptyMessage="هیچ وظیفه‌ای برای شما ثبت نشده است."
                    />
                )}
            </section>
        </div>
    );
}