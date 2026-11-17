import { useEffect, useId, useMemo, useState } from 'react';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Modal from '@/components/Modal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Badge from '@/components/Badge';
import type { Task } from '@/types/task';

// --- Interfaces ---
export interface Student {
    id: number;
    name: string;
    studentId: string;
    email: string;
}

/*
 * `Task` is imported from `@/types/task`.
 *
 * This file used to declare (and export) a second, incompatible `Task` with a
 * required `description` and no `status`, so the same entity had two shapes
 * depending on which module you imported from. One definition now.
 */

export interface TAAssignment {
    id: number;
    student: Student;
    role: string;
    tasks: Task[];
    isHeadTA?: boolean;
}

export interface CourseRowData {
    id: number;
    code: string;
    title: string;
    maxTAs: number;
    taList: TAAssignment[];
    remainingCapacity: number;
}

export interface ApplicationRowData {
    id: number;
    applicantName: string;
    applicantEmail: string;
    studentId: string;
    courseTitle: string;
    appliedAt: string;
}

// --- Mock Data ---
const initialCourses: CourseRowData[] = [
    {
        id: 1,
        code: 'CE-201',
        title: 'برنامه‌سازی پیشرفته',
        maxTAs: 4,
        remainingCapacity: 2,
        taList: [
            {
                id: 101,
                isHeadTA: true,
                role: 'طراحی کوئیز اول و هماهنگی جلسات',
                tasks: [
                    {
                        id: 1,
                        title: 'طراحی سوالات طراحی الگوریتم',
                        description: '۵ سوال ۴ گزینه‌ای و ۱ سوال تشریحی',
                        deadline: '۱۴۰۳/۰۶/۲۰',
                        status: 'pending'
                    }
                ],
                student: { id: 1, name: 'امیرحسین رضایی', studentId: '99100123', email: 'a.rezaei@univ.ac.ir' }
            },
            {
                id: 102,
                isHeadTA: false,
                role: 'تصحیح تمرین‌های سری اول',
                tasks: [],
                student: { id: 2, name: 'زهرا کاظمی', studentId: '99100456', email: 'z.kazemi@univ.ac.ir' }
            }
        ]
    },
    {
        id: 2,
        code: 'CE-202',
        title: 'ساختمان داده‌ها و الگوریتم‌ها',
        maxTAs: 3,
        remainingCapacity: 2,
        taList: [
            {
                id: 103,
                isHeadTA: true,
                role: 'رفع اشکال مبحث درخت‌ها',
                tasks: [],
                student: { id: 3, name: 'محمدجواد حسینی', studentId: '98100789', email: 'm.hoseini@univ.ac.ir' }
            }
        ]
    }
];

const initialApplications: ApplicationRowData[] = [
    {
        id: 1,
        applicantName: 'سارا احمدی',
        applicantEmail: 's.ahmadi@univ.ac.ir',
        studentId: '99104432',
        courseTitle: 'ساختمان داده‌ها و الگوریتم‌ها',
        appliedAt: '۱۴۰۳/۰۶/۰۲'
    },
    {
        id: 2,
        applicantName: 'علی کریمی',
        applicantEmail: 'a.karimi@univ.ac.ir',
        studentId: '99108811',
        courseTitle: 'برنامه‌سازی پیشرفته',
        appliedAt: '۱۴۰۳/۰۶/۰۳'
    }
];

export default function ProfessorDashboard() {
    const [courses, setCourses] = useState<CourseRowData[]>(initialCourses);
    const [applications, setApplications] = useState<ApplicationRowData[]>(initialApplications);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Single source of truth: only the id is stored, the object is derived.
    const selectedCourse = useMemo(
        () => courses.find((course) => course.id === selectedCourseId) ?? null,
        [courses, selectedCourseId],
    );

    // استیت‌های مربوط به فرم افزودن تسک
    /** TA awaiting removal confirmation; null closes the confirm dialog. */
    const [pendingRemoval, setPendingRemoval] = useState<{
        courseId: number;
        taId: number;
        name: string;
    } | null>(null);
    const [taskFormTAId, setTaskFormTAId] = useState<number | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState(''); // استیت اضافه شده برای مهلت

    /**
     * Unique ids for the add-task form controls.
     *
     * `useId()` is required rather than hard-coded strings: the form is rendered
     * once per TA inside the modal, so a static id would be duplicated in the
     * DOM and every <label htmlFor> would resolve to the first field on the page.
     */
    const taskFormId = useId();
    const taskTitleId = `${taskFormId}-title`;
    const taskDescId = `${taskFormId}-desc`;
    const taskDeadlineId = `${taskFormId}-deadline`;

    // Simulated initial fetch until the Django endpoint exists.
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const handleApprove = (id: number) => {
        setApplications((prev) => prev.filter((app) => app.id !== id));
    };

    const handleReject = (id: number) => {
        setApplications((prev) => prev.filter((app) => app.id !== id));
    };

    /*
     * Removal is confirmed through <ConfirmDeleteModal> rather than
     * `window.confirm`, which blocks the event loop and cannot be styled,
     * translated or focus-managed.
     */
    const handleRemoveTA = () => {
        if (!pendingRemoval) return;
        const { courseId, taId } = pendingRemoval;
        setPendingRemoval(null);

        setCourses((prevCourses) =>
            prevCourses.map((course) => {
                if (course.id === courseId) {
                    const updatedTaList = course.taList.filter((ta) => ta.id !== taId);
                    const currentCount = updatedTaList.length;
                    // `selectedCourse` is derived from `courses` via useMemo, so
                    // updating the list is enough - the modal re-renders itself.
                    return {
                        ...course,
                        taList: updatedTaList,
                        remainingCapacity: Math.max(0, course.maxTAs - currentCount)
                    };
                }
                return course;
            })
        );
    };

    /** Clears the inline add-task form; shared by cancel, submit and modal close. */
    const resetTaskForm = () => {
        setTaskFormTAId(null);
        setNewTaskTitle('');
        setNewTaskDesc('');
        setNewTaskDeadline('');
    };

    const handleAddTask = (courseId: number, taId: number) => {
        const title = newTaskTitle.trim();
        if (!title) return;

        // Typed explicitly so a missing field (e.g. `status`) is a compile error
        // here rather than an `unknown` shape flowing into `Task[]`.
        const newTask: Task = {
            id: Date.now(),
            title,
            description: newTaskDesc.trim() || undefined,
            deadline: newTaskDeadline.trim(),
            status: 'pending'
        };

        setCourses((prevCourses) =>
            prevCourses.map((course) => {
                if (course.id === courseId) {
                    const updatedTaList = course.taList.map((ta) => {
                        if (ta.id === taId) {
                            return { ...ta, tasks: [...ta.tasks, newTask] };
                        }
                        return ta;
                    });
                    return { ...course, taList: updatedTaList };
                }
                return course;
            })
        );

        // ریست کردن فرم
        resetTaskForm();
    };

    // ستون‌های جدول دروس
    const courseColumns: Column<CourseRowData>[] = [
        {
            header: 'کد درس',
            accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded">{item.code}</code>,
            sortable: true
        },
        {
            header: 'نام درس',
            accessor: 'title',
            sortable: true
        },
        {
            header: 'سرتیم (Head TA)',
            accessor: (item) => {
                const headTA = item.taList.find((t) => t.isHeadTA);
                return headTA ? (
                    <div>
                        <p className="font-medium text-gray-900 text-sm">{headTA.student.name}</p>
                        <p className="text-sm text-gray-500" dir="ltr">{headTA.student.email}</p>
                    </div>
                ) : (
                    <span className="text-sm text-gray-400 italic">تعیین نشده</span>
                );
            }
        },
        {
            header: 'تعداد ثبت‌شده',
            accessor: (item) => {
                const registeredCount = item.taList.length;
                // Guard against a zero capacity producing NaN / Infinity.
                const percentage = Math.round((registeredCount / Math.max(1, item.maxTAs)) * 100);

                let barColor = 'bg-emerald-500';
                if (percentage >= 80) {
                    barColor = 'bg-rose-500';
                } else if (percentage >= 50) {
                    barColor = 'bg-amber-500';
                }

                return (
                    <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">{registeredCount} از {item.maxTAs} نفر</span>
                            <span className="text-gray-400 text-sm">{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'ظرفیت باقی‌مانده',
            accessor: (item) => (
                <Badge variant={item.remainingCapacity > 0 ? 'info' : 'danger'}>
                    {item.remainingCapacity > 0 ? `${item.remainingCapacity} نفر` : 'تکمیل'}
                </Badge>
            ),
            sortable: true
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <button
                    onClick={() => setSelectedCourseId(item.id)}
                    className="bg-transparent border border-gray-300 text-gray-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer font-medium"
                >
                    اعضا
                </button>
            )
        }
    ];

    // ستون‌های جدول درخواست‌ها
    const applicationColumns: Column<ApplicationRowData>[] = [
        {
            header: 'متقاضی',
            accessor: (item) => (
                <div>
                    <p className="font-medium text-gray-900">{item.applicantName}</p>
                    <p className="text-sm text-gray-500" dir="ltr">{item.applicantEmail}</p>
                </div>
            ),
            sortable: true
        },
        {
            header: 'شماره دانشجویی',
            accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded">{item.studentId}</code>,
            sortable: true
        },
        {
            header: 'درس مربوطه',
            accessor: 'courseTitle',
            sortable: true
        },
        {
            header: 'تاریخ درخواست',
            accessor: 'appliedAt',
            sortable: true
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleApprove(item.id)}
                        className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                        تایید درخواست
                    </button>
                    <button
                        onClick={() => handleReject(item.id)}
                        className="bg-transparent text-gray-600 border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        رد
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">داشبورد استاد</h1>
                <p className="text-gray-600 text-sm">
                    مدیریت دروس، بررسی وضعیت دستیاران آموزشی (TA) و تایید درخواست‌های جدید.
                </p>
            </header>

            <section className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
                <h2 className="text-lg font-semibold mb-1 text-gray-900">دروس و تیم‌های دستیاری</h2>
                <p className="text-sm text-gray-500 mb-6">
                    وضعیت اختصاص سرتیم، ظرفیت مجاز و باقی‌مانده برای هر درس:
                </p>

                {loading ? (
                    <DataTableSkeleton rows={5} columns={6} />
                ) : (
                    <DataTable data={courses} columns={courseColumns} pageSize={5} />
                )}
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-1 text-gray-900">درخواست‌های معوق متقاضیان</h2>
                <p className="text-sm text-gray-500 mb-6">
                    دانشجویانی که برای دستیاری دروس شما درخواست فرستاده‌اند:
                </p>

                {loading ? (
                    <DataTableSkeleton rows={3} columns={5} />
                ) : (
                    <DataTable
                        data={applications}
                        columns={applicationColumns}
                        pageSize={5}
                        emptyMessage="هیچ درخواست معوقی وجود ندارد."
                    />
                )}
            </section>

            {/* مودال اعضای تیم و تکالیف */}
            <Modal
                isOpen={!!selectedCourse}
                onClose={() => setSelectedCourseId(null)}
                title={selectedCourse ? `اعضای تیم دستیاری: ${selectedCourse.title}` : ''}
                footer={
                    <button
                        onClick={() => setSelectedCourseId(null)}
                        className="px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        بستن
                    </button>
                }
            >
                {selectedCourse && (
                    <div className="space-y-4">
                        {selectedCourse.taList.length > 0 ? (
                            selectedCourse.taList.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                                >
                                    <div className="flex items-start justify-between p-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-brand-600 font-bold text-lg shadow-inner">
                                                {item.student.name.charAt(0)}
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-gray-900">{item.student.name}</span>
                                                    <Badge variant={item.isHeadTA ? 'info' : 'default'}>
                                                        {item.isHeadTA ? 'سرتیم' : 'TA'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500" dir="ltr">{item.student.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-3">
                                            <code className="text-sm bg-gray-800 text-white px-2.5 py-1 rounded-md shadow-sm tracking-widest">
                                                {item.student.studentId}
                                            </code>
                                            <button
                                                onClick={() =>
                                                    setPendingRemoval({
                                                        courseId: selectedCourse.id,
                                                        taId: item.id,
                                                        name: item.student.name,
                                                    })
                                                }
                                                className="flex items-center gap-1.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-200 px-2.5 py-1.5 rounded-lg border border-transparent transition-all cursor-pointer"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                حذف عضو
                                            </button>
                                        </div>
                                    </div>

                                    {/* بخش مدیریت تکالیف */}
                                    <div className="flex flex-col gap-3 p-4 bg-gray-50/80 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-1.5 w-2/3">
                                                <span className="text-sm text-gray-500 font-medium">نقش دستیار:</span>
                                                <span className="text-sm font-semibold text-gray-800 leading-tight">
                                                    {item.role}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => setTaskFormTAId(item.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-brand-700 hover:bg-blue-100 text-sm font-medium rounded-lg transition-colors border border-blue-200 cursor-pointer"
                                            >
                                                + اضافه کردن تسک
                                            </button>
                                        </div>

                                        {/* لیست تسک‌های ثبت شده */}
                                        {item.tasks.length > 0 && (
                                            <div className="flex flex-col gap-2 mt-2">
                                                {item.tasks.map((task) => (
                                                    <div key={task.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-sm font-bold text-gray-800">{task.title}</h4>
                                                            {task.deadline && (
                                                                <span className="flex items-center gap-1 text-sm bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium shrink-0">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    مهلت: {task.deadline}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{task.description}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* فرم افزودن تسک */}
                                        {taskFormTAId === item.id && (
                                            /*
                                             * A real <form>, not a <div>: `required` below is only
                                             * enforced by the browser inside a form, and this also
                                             * restores Enter-to-submit and native validation UI.
                                             */
                                            <form
                                                className="flex flex-col gap-2 mt-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm animate-slide-in-top"
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleAddTask(selectedCourse.id, item.id);
                                                }}
                                            >
                                                {/* Every control is explicitly associated with its label via
                                                    htmlFor/id. A placeholder is not an accessible name: it
                                                    disappears on input and is not reliably announced. */}
                                                <div className="flex flex-col gap-1">
                                                    <label htmlFor={taskTitleId} className="text-sm font-medium text-gray-700">
                                                        عنوان تسک <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        id={taskTitleId}
                                                        type="text"
                                                        required
                                                        placeholder="عنوان تسک..."
                                                        value={newTaskTitle}
                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <label htmlFor={taskDescId} className="text-sm font-medium text-gray-700">
                                                        توضیحات <span className="font-normal text-gray-400">(اختیاری)</span>
                                                    </label>
                                                    <textarea
                                                        id={taskDescId}
                                                        placeholder="توضیحات تسک..."
                                                        value={newTaskDesc}
                                                        onChange={(e) => setNewTaskDesc(e.target.value)}
                                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-16 transition-all"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <label htmlFor={taskDeadlineId} className="text-sm font-medium text-gray-700">
                                                        مهلت انجام <span className="font-normal text-gray-400">(اختیاری)</span>
                                                    </label>
                                                    <input
                                                        id={taskDeadlineId}
                                                        type="text"
                                                        placeholder="مثلاً ۱۴۰۳/۰۶/۲۵"
                                                        value={newTaskDeadline}
                                                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2 mt-1">
                                                    {/* type="button": inside a form an untyped button defaults to submit. */}
                                                    <button
                                                        type="button"
                                                        onClick={resetTaskForm}
                                                        className="text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                                                    >
                                                        انصراف
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={!newTaskTitle.trim()}
                                                        className="bg-brand-600 text-white text-sm px-4 py-1.5 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                    >
                                                        ثبت تسک
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 opacity-70">
                                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <p className="text-sm text-gray-500 font-medium">هنوز هیچ دستیاری ثبت نشده است.</p>
                            </div>
                        )}
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