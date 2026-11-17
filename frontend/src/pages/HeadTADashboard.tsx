import { useEffect, useMemo, useState, type FormEvent } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import DataTableSkeleton from '../components/DataTableSkeleton';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import Badge from '../components/Badge';

// --- Interfaces ---
export interface Assignment {
    id: number;
    title: string;
    status: 'pending' | 'done';
    dueDate: string;
    description?: string; // توضیحات سرتیم (حداکثر یک خط)
    taNote?: string;      // توضیحات ثبت شده توسط دستیار
}

export interface TAUser {
    id: number;
    name: string;
    studentId: string;
    email: string;
    assignments: Assignment[];
}

export interface TaskRequest {
    id: number;
    taId: number;
    taName: string;
    studentId: string;
    taskTitle: string;
    completedAt: string;
}

// --- Mock Data ---
const initialTAs: TAUser[] = [
    {
        id: 1,
        name: 'زهرا کاظمی',
        studentId: '99100456',
        email: 'z.kazemi@univ.ac.ir',
        assignments: [
            {
                id: 101,
                title: 'تصحیح تمرین‌های سری اول',
                status: 'done',
                dueDate: '۱۴۰۳/۰۶/۱۰',
                description: 'لطفاً بارم‌بندی بر اساس راهنمای تصحیح آپلود شده انجام شود.',
                taNote: 'نمرات در فایل اکسل ثبت شد. ۳ نفر از دانشجویان تاخیر داشتند که کسر نمره اعمال گردید.'
            },
            {
                id: 102,
                title: 'طراحی سوالات کوئیز دوم',
                status: 'pending',
                dueDate: '۱۴۰۳/۰۶/۱۵',
                description: 'سوالات فقط از مباحث فصل ۳ و ۴ طراحی شوند.'
            }
        ]
    }
];

const initialRequests: TaskRequest[] = [
    {
        id: 1,
        taId: 1,
        taName: 'زهرا کاظمی',
        studentId: '99100456',
        taskTitle: 'تصحیح تمرین‌های سری اول',
        completedAt: '۱۴۰۳/۰۶/۰۵ - ۱۸:۳۰'
    }
];

export default function HeadTADashboard() {
    const [loading, setLoading] = useState<boolean>(true);
    const [tas, setTas] = useState<TAUser[]>(initialTAs);
    const [requests, setRequests] = useState<TaskRequest[]>(initialRequests);
    const [selectedTAId, setSelectedTAId] = useState<number | null>(null);

    // Single source of truth: derive the selected TA from the list.
    const selectedTA = useMemo(
        () => tas.find((ta) => ta.id === selectedTAId) ?? null,
        [tas, selectedTAId],
    );

    // استیت‌های مربوط به فرم افزودن تکلیف جدید
    const [showAddTask, setShowAddTask] = useState<boolean>(false);
    const [newTaskTitle, setNewTaskTitle] = useState<string>('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
    const [newTaskDescription, setNewTaskDescription] = useState<string>(''); // توضیحات جدید

    // Simulated initial fetch until the Django endpoint exists.
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    /** TA awaiting removal confirmation; null closes the confirm dialog. */
    const [pendingRemoval, setPendingRemoval] = useState<{ id: number; name: string } | null>(null);

    /*
     * Confirmed through <ConfirmDeleteModal>, not `window.confirm`, which
     * blocks the event loop and cannot be styled or focus-managed.
     */
    const handleRemoveTA = () => {
        if (!pendingRemoval) return;
        setTas((prev) => prev.filter((ta) => ta.id !== pendingRemoval.id));
        setPendingRemoval(null);
    };

    const handleApproveRequest = (id: number) => {
        setRequests((prev) => prev.filter((req) => req.id !== id));
    };

    const handleRejectRequest = (id: number) => {
        setRequests((prev) => prev.filter((req) => req.id !== id));
    };

    // تابع افزودن تکلیف جدید به دستیار انتخابی
    const handleAddTask = (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTA || !newTaskTitle.trim() || !newTaskDueDate.trim()) return;

        const newAssignment: Assignment = {
            id: Date.now(),
            title: newTaskTitle.trim(),
            status: 'pending',
            dueDate: newTaskDueDate.trim(),
            description: newTaskDescription.trim() || undefined
        };

        // آپدیت لیست کل دستیاران
        setTas((prevTas) =>
            prevTas.map((ta) => {
                if (ta.id === selectedTA.id) {
                    return {
                        ...ta,
                        assignments: [...ta.assignments, newAssignment]
                    };
                }
                return ta;
            })
        );

        /*
         * No second update for the open modal: `selectedTA` is derived from
         * `tas` via useMemo, so updating the list re-renders the modal with the
         * new assignment. Mirroring the object into its own state was the
         * duplicate-source-of-truth pattern that let the two copies drift.
         */

        // ریست فرم
        setNewTaskTitle('');
        setNewTaskDueDate('');
        setNewTaskDescription('');
        setShowAddTask(false);
    };

    const handleCloseModal = () => {
        setSelectedTAId(null);
        setShowAddTask(false);
        setNewTaskTitle('');
        setNewTaskDueDate('');
        setNewTaskDescription('');
    };

    // ستون‌های جدول دستیاران
    const taColumns: Column<TAUser>[] = [
        {
            header: 'نام دستیار',
            accessor: (item) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-brand-600 font-bold text-sm">
                        {item.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500" dir="ltr">{item.email}</p>
                    </div>
                </div>
            ),
            sortable: true
        },
        {
            header: 'شماره دانشجویی',
            accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded tracking-widest">{item.studentId}</code>,
            sortable: true
        },
        {
            header: 'تکالیف فعال',
            accessor: (item) => {
                const pendingCount = item.assignments.filter(a => a.status === 'pending').length;
                return (
                    <Badge variant={pendingCount > 0 ? 'warning' : 'success'}>
                        {pendingCount > 0 ? `${pendingCount} در حال انجام` : 'آزاد'}
                    </Badge>
                );
            }
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedTAId(item.id)}
                        className="bg-transparent border border-gray-300 text-gray-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer font-medium"
                    >
                        اطلاعات
                    </button>
                    <button
                        onClick={() => setPendingRemoval({ id: item.id, name: item.name })}
                        className="bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 text-sm px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                        حذف
                    </button>
                </div>
            )
        }
    ];

    // ستون‌های جدول درخواست‌های بررسی کار
    const requestColumns: Column<TaskRequest>[] = [
        {
            header: 'دستیار (TA)',
            accessor: (item) => <span className="font-medium text-gray-900">{item.taName}</span>,
            sortable: true
        },
        {
            header: 'شماره دانشجویی',
            accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded tracking-widest">{item.studentId}</code>,
            sortable: true
        },
        {
            header: 'کار انجام شده',
            accessor: 'taskTitle',
            sortable: true
        },
        {
            header: 'تاریخ اتمام',
            accessor: (item) => <span className="text-sm text-gray-600">{item.completedAt}</span>,
            sortable: true
        },
        {
            header: 'عملیات بررسی',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleApproveRequest(item.id)}
                        className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                        تایید
                    </button>
                    <button
                        onClick={() => handleRejectRequest(item.id)}
                        className="bg-transparent text-gray-600 border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        رد کار
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">داشبورد سرتیم (Head TA)</h1>
                <p className="text-gray-600 text-sm">
                    مدیریت دستیاران زیرمجموعه، تخصیص وظایف و بررسی کارهای انجام شده.
                </p>
            </header>

            {/* بخش اول: لیست دستیاران */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
                <h2 className="text-lg font-semibold mb-1 text-gray-900">تیم دستیاران شما</h2>
                <p className="text-sm text-gray-500 mb-6">
                    لیست تی‌دی‌های زیرمجموعه جهت مدیریت تسک‌ها و وضعیت آن‌ها:
                </p>

                {loading ? (
                    <DataTableSkeleton rows={5} columns={4} />
                ) : (
                    <DataTable data={tas} columns={taColumns} pageSize={5} />
                )}
            </section>

            {/* بخش دوم: درخواست‌های تایید کار */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-1 text-gray-900">گزارش کارهای انجام شده (نیازمند بررسی)</h2>
                <p className="text-sm text-gray-500 mb-6">
                    کارهایی که توسط دستیاران تکمیل شده و منتظر تایید نهایی شما هستند:
                </p>

                {loading ? (
                    <DataTableSkeleton rows={3} columns={5} />
                ) : (
                    <DataTable
                        data={requests}
                        columns={requestColumns}
                        pageSize={5}
                        emptyMessage="هیچ کار در انتظار تاییدی وجود ندارد."
                    />
                )}
            </section>

            {/* مودال اطلاعات کامل و تسک‌های TA */}
            <Modal
                isOpen={!!selectedTA}
                onClose={handleCloseModal}
                title="پرونده دستیار آموزشی"
                footer={
                    <button
                        onClick={handleCloseModal}
                        className="px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        بستن
                    </button>
                }
            >
                {selectedTA && (
                    <div className="space-y-6">
                        {/* اطلاعات فردی */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-brand-600 font-bold text-2xl shadow-inner">
                                {selectedTA.name.charAt(0)}
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-gray-900 text-lg">{selectedTA.name}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span dir="ltr">{selectedTA.email}</span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <code className="tracking-widest">{selectedTA.studentId}</code>
                                </div>
                            </div>
                        </div>

                        {/* بخش لیست تسک‌ها و دکمه افزودن */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-800">لیست وظایف (Assignments)</h4>
                                <button
                                    type="button"
                                    onClick={() => setShowAddTask(!showAddTask)}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    {showAddTask ? 'انصراف' : 'افزودن تکلیف جدید'}
                                </button>
                            </div>

                            {/* فرم افزودن تکلیف جدید */}
                            {showAddTask && (
                                <form onSubmit={handleAddTask} className="mb-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                                    <h5 className="text-sm font-bold text-blue-900">تعریف تکلیف جدید برای {selectedTA.name}</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان تکلیف</label>
                                            <input
                                                type="text"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                placeholder="مثلاً: تصحیح کوییز سوم"
                                                required
                                                className="w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">مهلت تحویل</label>
                                            <input
                                                type="text"
                                                value={newTaskDueDate}
                                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                                placeholder="۱۴۰۳/۰۶/۲۰"
                                                required
                                                className="w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات تکمیلی (اختیاری - حداکثر یک خط)</label>
                                            <input
                                                type="text"
                                                value={newTaskDescription}
                                                onChange={(e) => setNewTaskDescription(e.target.value)}
                                                placeholder="مثلاً: بارم‌بندی بخش دوم سوالات ۲ نمره‌ای محاسبه شود."
                                                maxLength={120}
                                                className="w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAddTask(false);
                                                setNewTaskTitle('');
                                                setNewTaskDueDate('');
                                                setNewTaskDescription('');
                                            }}
                                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
                                        >
                                            انصراف
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-1.5 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                                        >
                                            ثبت تکلیف
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* لیست وظایف */}
                            <div className="flex flex-col gap-3">
                                {selectedTA.assignments.length > 0 ? (
                                    selectedTA.assignments.map((task) => (
                                        <div key={task.id} className="flex flex-col p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors bg-white shadow-sm gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-semibold text-gray-800">{task.title}</span>
                                                    <span className="text-sm text-gray-500 font-medium">مهلت: {task.dueDate}</span>
                                                </div>
                                                <Badge variant={task.status === 'done' ? 'success' : 'default'}>
                                                    {task.status === 'done' ? 'انجام شده' : 'در حال انجام'}
                                                </Badge>
                                            </div>

                                            {/* توضیحات سرتیم (محدود به تک‌خط) */}
                                            {task.description && (
                                                <p className="text-sm text-gray-600 truncate bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100" title={task.description}>
                                                    <span className="font-semibold text-gray-700">توضیحات: </span>
                                                    {task.description}
                                                </p>
                                            )}

                                            {/* باکس یادداشت دستیار */}
                                            {task.taNote && (
                                                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                                                    <span className="flex items-center gap-1.5 text-sm font-bold text-gray-500 mb-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        یادداشت دستیار:
                                                    </span>
                                                    <p className="text-sm text-gray-700 leading-relaxed pr-5">
                                                        {task.taNote}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <p className="text-sm text-gray-500 font-medium">هیچ وظیفه‌ای برای این دستیار ثبت نشده است.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmDeleteModal
                isOpen={pendingRemoval !== null}
                title="تأیید حذف دستیار"
                message="آیا از حذف این دستیار آموزشی اطمینان دارید؟"
                itemName={pendingRemoval?.name ?? ''}
                onConfirm={handleRemoveTA}
                onClose={() => setPendingRemoval(null)}
            />
        </div>
    );
}