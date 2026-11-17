import { useState, useEffect, useId, type ChangeEvent, type FormEvent } from 'react';
import type { Task } from '@/types/task';
import { Navigate, useParams, Link } from 'react-router-dom';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Modal from '@/components/Modal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { MOCK_COURSES } from '@/mocks/courses.mock';

// --- Interfaces ---
export interface TAMember {
    id: number;
    courseId: number;
    name: string;
    role: 'Instructor' | 'Head TA' | 'TA';
    email: string;
}


const initialMemberFormData = {
    name: '',
    role: 'TA' as 'Instructor' | 'Head TA' | 'TA',
    email: '',
};

const initialTaskFormData = {
    title: '',
    deadline: '',
    description: '',
};

/*
 * Course fixtures come from `@/mocks/courses.mock` — the same source the
 * directory page reads.
 *
 * This file used to keep its own copy whose ids disagreed with the shared
 * fixture (id 3 was CE301 here and CE101 there), so following a link from the
 * directory opened the details page for a *different* course. One fixture
 * makes that class of bug impossible.
 */

// نمونه اعضای تیم آموزشی
const mockMembers: TAMember[] = [
    { id: 1, courseId: 1, name: 'دکتر علی اکبری', role: 'Instructor', email: 'akbari@univ.ac.ir' },
    { id: 2, courseId: 1, name: 'امیرحسین رضایی', role: 'Head TA', email: 'rezaei@student.ac.ir' },
    { id: 3, courseId: 1, name: 'سارا احمدی', role: 'TA', email: 'ahmadi@student.ac.ir' },
    { id: 4, courseId: 1, name: 'محمد کریمی', role: 'TA', email: 'karimi@student.ac.ir' },
    // Courses 2 and 3 have their own staff: the page used to render course 1's
    // members for every :courseId, so these fixtures make the bug observable.
    { id: 5, courseId: 2, name: 'دکتر صمدی', role: 'Instructor', email: 'samadi@univ.ac.ir' },
    { id: 6, courseId: 2, name: 'نگار موسوی', role: 'TA', email: 'mousavi@student.ac.ir' },
    { id: 7, courseId: 2, name: 'حسین نادری', role: 'TA', email: 'naderi@student.ac.ir' },
    { id: 8, courseId: 3, name: 'دکتر مهدیانی', role: 'Instructor', email: 'mahdiani@univ.ac.ir' },
    { id: 9, courseId: 3, name: 'سارا محمدی', role: 'Head TA', email: 's.mohammadi@student.ac.ir' },
];

const mockTasks: Task[] = [
    {
        id: 1,
        assigneeId: 2, // امیرحسین رضایی (Head TA)
        title: 'آماده‌سازی داکیومنت پروژه',
        deadline: '1403/08/15',
        description: 'شامل نوشتن داکیومنت فاز اول و مشخص کردن معماری پروژه برای دانشجویان',
        status: 'in_progress'
    },
    {
        id: 2,
        assigneeId: 2,
        title: 'برگزاری جلسه توجیهی آنلاین',
        deadline: '1403/08/20',
        status: 'pending'
    },
    {
        id: 3,
        assigneeId: 3, // سارا احمدی (TA)
        title: 'تصحیح تمرین سری اول',
        deadline: '1403/08/25',
        description: 'لطفاً نمرات را در فایل اکسل آپلود کنید.',
        status: 'completed'
    },
    {
        id: 4,
        assigneeId: 4, // محمد کریمی (TA)
        title: 'پاسخگویی به سوالات فروم رفع اشکال',
        deadline: '1403/08/30',
        status: 'in_progress'
    }
];

export default function CourseTAsPage() {
    // The route is /courses/:courseId -> read the path param, not the query string.
    const { courseId } = useParams<{ courseId: string }>();
    const activeCourseId = Number(courseId);
    const isValidCourseId = courseId !== undefined && Number.isFinite(activeCourseId);

    // Header now reflects the requested course instead of always showing #1.
    // Replace with `coursesService.retrieve(activeCourseId)` once the API exists.
    const courseInfo =
        MOCK_COURSES.find((c) => c.id === activeCourseId) ?? {
            id: activeCourseId,
            code: `#${courseId ?? ''}`,
            title: 'درس نامشخص',
        };

    const [loading, setLoading] = useState<boolean>(true);
    const [members, setMembers] = useState<TAMember[]>([]);
    const [tasks, setTasks] = useState<Task[]>(mockTasks);

    // استیت‌های مودال افزودن/ویرایش عضو
    const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);
    const [editingMember, setEditingMember] = useState<TAMember | null>(null);
    /** Member awaiting delete confirmation; null closes the confirm dialog. */
    const [memberPendingDeletion, setMemberPendingDeletion] = useState<TAMember | null>(null);
    const [memberFormData, setMemberFormData] = useState(initialMemberFormData);

    // استیت‌های مودال جزئیات/تسک‌های دستیار
    const [isTasksModalOpen, setIsTasksModalOpen] = useState<boolean>(false);
    const [selectedTAForTasks, setSelectedTAForTasks] = useState<TAMember | null>(null);

    // استیت فرم افزودن تسک جدید درون مودال
    /**
     * Stable, unique ids for the two modal forms.
     *
     * These forms live inside dialogs, so hard-coded ids risk colliding with
     * other controls in the document; useId() guarantees uniqueness per instance.
     */
    const memberFormId = useId();
    const memberNameId = `${memberFormId}-name`;
    const memberRoleId = `${memberFormId}-role`;
    const memberEmailId = `${memberFormId}-email`;

    const taskFormId = useId();
    const taskTitleId = `${taskFormId}-title`;
    const taskDeadlineId = `${taskFormId}-deadline`;
    const taskDescId = `${taskFormId}-desc`;

    const [showAddTaskForm, setShowAddTaskForm] = useState<boolean>(false);
    const [newTaskData, setNewTaskData] = useState(initialTaskFormData);

    /*
     * Load the staff OF THE REQUESTED COURSE.
     *
     * This effect used to depend on `activeCourseId` but ignore it, assigning
     * the whole fixture, so /courses/3 listed course #1's members. It also
     * never re-entered the loading state, so switching courses showed the
     * previous course's rows with no skeleton in between.
     *
     * Swap the body for `coursesService.members(activeCourseId)` (via
     * useQuery) when the Django endpoint exists; the contract is the same.
     */
    useEffect(() => {
        if (!Number.isFinite(activeCourseId)) return;

        setLoading(true);
        const timer = setTimeout(() => {
            setMembers(mockMembers.filter((member) => member.courseId === activeCourseId));
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [activeCourseId]);

    // --- هندلرهای مودال اعضا ---
    const openAddMemberModal = () => {
        setEditingMember(null);
        setMemberFormData(initialMemberFormData);
        setIsMemberModalOpen(true);
    };

    const openEditMemberModal = (member: TAMember) => {
        setEditingMember(member);
        setMemberFormData({
            name: member.name,
            role: member.role,
            email: member.email,
        });
        setIsMemberModalOpen(true);
    };

    const closeMemberModal = () => {
        setIsMemberModalOpen(false);
        setEditingMember(null);
        setMemberFormData(initialMemberFormData);
    };

    const handleSubmitMember = (e: FormEvent) => {
        e.preventDefault();
        if (editingMember) {
            setMembers(prev => prev.map(m =>
                m.id === editingMember.id ? { ...m, ...memberFormData } : m
            ));
        } else {
            const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
            setMembers(prev => [...prev, {
                ...memberFormData,
                id: newId,
                courseId: activeCourseId
            }]);
        }
        closeMemberModal();
    };

    /*
     * Destructive actions go through <ConfirmDeleteModal>, never
     * `window.confirm`: confirm() blocks the event loop, cannot be styled or
     * translated, and behaved differently from the confirmation dialog used
     * elsewhere in the app.
     */
    const handleConfirmDeleteMember = () => {
        if (!memberPendingDeletion) return;
        setMembers(prev => prev.filter(m => m.id !== memberPendingDeletion.id));
        setMemberPendingDeletion(null);
    };

    const handleMemberFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setMemberFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- هندلرهای مودال تسک‌ها ---
    const openTasksModal = (ta: TAMember) => {
        setSelectedTAForTasks(ta);
        setShowAddTaskForm(false);
        setNewTaskData(initialTaskFormData);
        setIsTasksModalOpen(true);
    };

    const handleAddTask = (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTAForTasks) return;

        const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        const newTask: Task = {
            id: newId,
            assigneeId: selectedTAForTasks.id,
            title: newTaskData.title,
            deadline: newTaskData.deadline,
            ...(newTaskData.description.trim() ? { description: newTaskData.description.trim() } : {}),
            status: 'pending',
        };

        setTasks(prev => [...prev, newTask]);
        setNewTaskData(initialTaskFormData);
        setShowAddTaskForm(false);
    };

    // --- ساختار ستون‌های جدول اصلی ---
    const columns: Column<TAMember>[] = [
        {
            header: 'نام و نام خانوادگی',
            accessor: (item) => <span className="font-bold text-slate-800">{item.name}</span>,
            sortable: true
        },
        {
            header: 'نقش',
            accessor: (item) => {
                let badgeStyle = 'bg-slate-100 text-slate-700';
                let roleTitle = 'دستیار آموزشی';

                if (item.role === 'Instructor') {
                    badgeStyle = 'bg-purple-100 text-purple-800 font-semibold border border-purple-200';
                    roleTitle = 'استاد درس';
                } else if (item.role === 'Head TA') {
                    badgeStyle = 'bg-amber-100 text-amber-800 font-semibold border border-amber-200';
                    roleTitle = 'Head TA';
                } else {
                    badgeStyle = 'bg-blue-50 text-brand-700 border border-blue-100';
                    roleTitle = 'TA';
                }

                return (
                    <span className={`text-sm px-2.5 py-1 rounded-full ${badgeStyle}`}>
                        {roleTitle}
                    </span>
                );
            },
            sortable: true
        },
        {
            header: 'ایمیل / حساب کاربر',
            accessor: (item) => <span className="text-sm text-slate-600 font-mono dir-ltr">{item.email}</span>,
            sortable: true
        },
        {
            header: 'تعداد تسک‌ها',
            accessor: (item) => {
                // برای استاد تسک تعریف نمی‌شود
                if (item.role === 'Instructor') {
                    return <span className="text-sm text-slate-400 font-medium">—</span>;
                }
                const count = tasks.filter(t => t.assigneeId === item.id).length;
                return <span className="text-sm font-medium text-slate-700">{count} تسک</span>;
            }
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    {/* دکمه تسک‌ها فقط برای دستیاران (غیر از استاد) نمایش داده می‌شود */}
                    {item.role !== 'Instructor' && (
                        <button
                            onClick={() => openTasksModal(item)}
                            className="bg-brand-50 text-brand-600 hover:bg-brand-50 border border-transparent text-sm px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1 cursor-pointer"
                        >
                            جزئیات / تسک‌ها
                        </button>
                    )}
                    <button
                        onClick={() => openEditMemberModal(item)}
                        className="bg-transparent border border-slate-300 text-slate-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer font-medium"
                    >
                        ویرایش
                    </button>
                    <button
                        onClick={() => setMemberPendingDeletion(item)}
                        className="bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 text-sm px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                        حذف
                    </button>
                </div>
            )
        }
    ];

    // Invalid or missing :courseId -> 404 instead of silently showing course #1.
    if (!isValidCourseId) {
        return <Navigate to="/404" replace />;
    }

    return (
        <div className="w-full max-w-6xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1 text-slate-900">
                        مدیریت دستیاران درس {courseInfo.title} ({courseInfo.code})
                    </h1>
                    <p className="text-slate-500 text-sm">
                        مشاهده استاد، Head TA و لیست دستیاران آموزشی به همراه مدیریت تسک‌های اختصاص‌یافته.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        to="/courses"
                        className="bg-white border border-slate-200 text-slate-700 text-sm px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center"
                    >
                        بازگشت به دروس
                    </Link>
                    <button
                        onClick={openAddMemberModal}
                        className="bg-slate-900 text-white text-sm px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                        افزودن عضو جدید
                    </button>
                </div>
            </header>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                {loading ? (
                    <DataTableSkeleton rows={4} columns={5} />
                ) : (
                    <DataTable
                        data={members}
                        columns={columns}
                        pageSize={10}
                        emptyMessage="هیچ عضوی برای این درس ثبت نشده است."
                    />
                )}
            </section>

            {/* ۱. مودال افزودن / ویرایش عضو */}
            <Modal
                isOpen={isMemberModalOpen}
                onClose={closeMemberModal}
                title={editingMember ? 'ویرایش اطلاعات عضو' : 'افزودن عضو جدید'}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button type="button" onClick={closeMemberModal} className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium rounded-xl transition-colors cursor-pointer">انصراف</button>
                        {/* The footer sits outside <form>, so `form={memberFormId}` is what
                            submits it. Without this the button bypassed the form entirely and
                            with it every `required` check. */}
                        <button type="submit" form={memberFormId} className="px-5 py-2.5 bg-brand-600 text-white hover:bg-brand-700 text-sm font-medium rounded-xl transition-colors cursor-pointer">{editingMember ? 'ذخیره تغییرات' : 'افزودن'}</button>
                    </div>
                }
            >
                {/* Each control is associated with its label through htmlFor/id.
                    Ids come from useId() because this form lives in a dialog that can
                    coexist with other forms in the same document. */}
                <form id={memberFormId} className="space-y-4" onSubmit={handleSubmitMember}>
                    <div>
                        <label htmlFor={memberNameId} className="block text-sm font-medium text-slate-700 mb-1">نام و نام خانوادگی</label>
                        <input id={memberNameId} type="text" name="name" value={memberFormData.name} onChange={handleMemberFormChange} required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div>
                        <label htmlFor={memberRoleId} className="block text-sm font-medium text-slate-700 mb-1">نقش در درس</label>
                        <select id={memberRoleId} name="role" value={memberFormData.role} onChange={handleMemberFormChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
                            <option value="TA">TA (دستیار آموزشی)</option>
                            <option value="Head TA">Head TA (سر دستیار)</option>
                            <option value="Instructor">استاد درس</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor={memberEmailId} className="block text-sm font-medium text-slate-700 mb-1">ایمیل</label>
                        <input id={memberEmailId} type="email" name="email" value={memberFormData.email} onChange={handleMemberFormChange} required dir="ltr" className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-left focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                </form>
            </Modal>

            {/* ۲. مودال نمایش تسک‌های دستیار انتخاب‌شده */}
            <Modal
                isOpen={isTasksModalOpen}
                onClose={() => setIsTasksModalOpen(false)}
                title={`لیست تسک‌های: ${selectedTAForTasks?.name || ''}`}
            >
                <div className="space-y-4">
                    {/* دکمه ��فزودن تسک جدید */}
                    {!showAddTaskForm ? (
                        <button
                            onClick={() => setShowAddTaskForm(true)}
                            className="w-full py-2 bg-brand-50 border border-dashed border-brand-500/30 text-brand-600 rounded-xl text-sm font-semibold hover:bg-brand-50 transition-colors cursor-pointer"
                        >
                            + افزودن تسک جدید برای این دستیار
                        </button>
                    ) : (
                        /* فرم ثبت تسک */
                        <form onSubmit={handleAddTask} className="p-3 border border-brand-50 bg-brand-50/50 rounded-xl space-y-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold text-slate-800">تعریف تسک جدید</span>
                                <button type="button" onClick={() => setShowAddTaskForm(false)} className="text-sm text-slate-400 hover:text-slate-600">بستن</button>
                            </div>
                            <div>
                                <label htmlFor={taskTitleId} className="block text-sm font-medium text-slate-700 mb-1">عنوان تسک <span className="text-rose-500">*</span></label>
                                <input
                                    id={taskTitleId}
                                    type="text"
                                    required
                                    placeholder="مثلاً: تصحیح تمرین سری دوم"
                                    value={newTaskData.title}
                                    onChange={(e) => setNewTaskData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-none"
                                />
                            </div>
                            <div>
                                <label htmlFor={taskDeadlineId} className="block text-sm font-medium text-slate-700 mb-1">تاریخ / مهلت تحویل <span className="text-rose-500">*</span></label>
                                <input
                                    id={taskDeadlineId}
                                    type="text"
                                    required
                                    placeholder="مثلاً: 1403/09/01"
                                    value={newTaskData.deadline}
                                    onChange={(e) => setNewTaskData(prev => ({ ...prev, deadline: e.target.value }))}
                                    dir="ltr"
                                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-none text-left"
                                />
                            </div>
                            <div>
                                <label htmlFor={taskDescId} className="block text-sm font-medium text-slate-700 mb-1">توضیحات تکمیلی <span className="text-slate-400 font-normal">(اختیاری)</span></label>
                                <textarea
                                    id={taskDescId}
                                    rows={2}
                                    placeholder="توضیحات اختیاری را وارد کنید..."
                                    value={newTaskData.description}
                                    onChange={(e) => setNewTaskData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-none resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowAddTaskForm(false)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg">انصراف</button>
                                <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">ثبت تسک</button>
                            </div>
                        </form>
                    )}

                    {/* لیست تسک‌ها */}
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {tasks.filter(task => task.assigneeId === selectedTAForTasks?.id).map(task => (
                            <div key={task.id} className="p-3 border border-slate-100 rounded-xl bg-white shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-semibold text-slate-800">{task.title}</span>
                                        {task.description && (
                                            <p className="text-sm text-slate-500 leading-relaxed text-justify">
                                                {task.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`text-sm px-2 py-0.5 rounded shrink-0 ${task.status === 'completed' ? 'bg-green-50 text-green-600' :
                                            task.status === 'in_progress' ? 'bg-blue-50 text-brand-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {task.status === 'completed' ? 'تکمیل شده' : task.status === 'in_progress' ? 'در حال انجام' : 'در انتظار'}
                                    </span>
                                </div>

                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-1 border-t border-slate-100 pt-2">
                                    🗓 مهلت: <span className="font-medium text-rose-500 dir-ltr">{task.deadline}</span>
                                </div>
                            </div>
                        ))}

                        {tasks.filter(task => task.assigneeId === selectedTAForTasks?.id).length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-6">تسکی برای این شخص ثبت نشده است.</p>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmDeleteModal
                isOpen={memberPendingDeletion !== null}
                title="تأیید حذف عضو"
                message="آیا از حذف این عضو از تیم آموزشی اطمینان دارید؟"
                itemName={memberPendingDeletion ? `${memberPendingDeletion.name} - ${memberPendingDeletion.role}` : ''}
                onConfirm={handleConfirmDeleteMember}
                onClose={() => setMemberPendingDeletion(null)}
            />

        </div>
    );
}