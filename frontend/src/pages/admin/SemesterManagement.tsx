import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Modal from '@/components/Modal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import ErrorState from '@/components/ErrorState';
import { semesterKeys, semesterService, type Semester } from '@/services/semesters.service';

// Re-export so existing deep imports keep working during the transition.
export type { Semester };

// --- Form shape (mirrors SemesterPayload on the wire) ---
const initialFormData = {
    name: '',
    start_date: '',
    end_date: '',
    max_ta_courses_limit: 0
};
type FormData = typeof initialFormData;

/**
 * Wired to /api/v1/semesters/ (semesters/urls.py -> SemesterViewSet):
 *   GET / POST / PUT / DELETE — Super Admin only for writes (403 otherwise).
 */
export default function SemesterManagement() {
    const queryClient = useQueryClient();

    const { data: semesters, isPending, isError, refetch } = useQuery({
        queryKey: semesterKeys.lists(),
        queryFn: () => semesterService.list(),
    });

    // استیت‌های مربوط به مودال و فرم
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    /** Semester awaiting delete confirmation; null closes the confirm dialog. */
    const [pendingDeletion, setPendingDeletion] = useState<Semester | null>(null);

    /**
     * Unique ids for the semester form controls, matching the htmlFor/id
     * pattern used by every other form in the app. `useId()` rather than
     * hard-coded strings so a second instance of the page can never produce
     * duplicate ids in the DOM.
     */
    const formId = useId();
    /*
     * The submit button lives in the Modal's `footer`, which is rendered as a
     * sibling of this <form>, not a descendant. Wiring the button to the form
     * with `form={formElementId}` (instead of calling handleSubmit on click)
     * is what makes the browser run constraint validation.
     */
    const formElementId = `${formId}-form`;
    const nameId = `${formId}-name`;
    const startDateId = `${formId}-start-date`;
    const endDateId = `${formId}-end-date`;
    const taLimitId = `${formId}-ta-limit`;

    // --- Mutations -----------------------------------------------------------

    const saveMutation = useMutation({
        mutationFn: (payload: typeof initialFormData) =>
            editingSemester
                ? semesterService.update(editingSemester.id, payload)
                : semesterService.create(payload),
        onSuccess: () => {
            closeModal();
            void queryClient.invalidateQueries({ queryKey: semesterKeys.all });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => semesterService.remove(id),
        onSuccess: () => {
            setPendingDeletion(null);
            void queryClient.invalidateQueries({ queryKey: semesterKeys.all });
        },
    });

    // --- توابع مدیریت فرم و مودال ---

    const openAddModal = () => {
        setEditingSemester(null);
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const openEditModal = (semester: Semester) => {
        setEditingSemester(semester);
        setFormData({
            name: semester.name,
            start_date: semester.start_date,
            end_date: semester.end_date,
            max_ta_courses_limit: semester.max_ta_courses_limit
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSemester(null);
        setFormData(initialFormData);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'max_ta_courses_limit' ? Number(value) : value
        }));
    };

    // --- Columns Definition ---
    const columns: Column<Semester>[] = [
        {
            header: 'شناسه',
            accessor: (item) => <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600 tracking-widest">{item.id}</code>,
            sortable: true
        },
        {
            header: 'عنوان نیم‌سال',
            accessor: (item) => <span className="font-bold text-gray-800">{item.name}</span>,
            sortable: true
        },
        {
            header: 'تاریخ شروع',
            accessor: (item) => <span className="text-sm text-gray-600">{item.start_date}</span>,
            sortable: true
        },
        {
            header: 'تاریخ پایان',
            accessor: (item) => <span className="text-sm text-gray-600">{item.end_date}</span>,
            sortable: true
        },
        {
            header: 'سقف واحد دستیار',
            accessor: (item) => (
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-700">{item.max_ta_courses_limit}</span>
                    <span className="text-sm text-gray-400">واحد</span>
                </div>
            ),
            sortable: true
        },
        {
            header: 'عملیات',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <Link
                        to={`/courses?semesterId=${item.id}`}
                        className="bg-blue-50 text-blue-600 border border-transparent hover:border-blue-200 text-sm px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        درس‌ها
                    </Link>

                    <button
                        onClick={() => openEditModal(item)}
                        className="bg-transparent border border-gray-300 text-gray-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer font-medium"
                    >
                        ویرایش
                    </button>

                    <button
                        onClick={() => setPendingDeletion(item)}
                        className="bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 text-sm px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                        حذف
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto ">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">مدیریت نیم‌سال‌های تحصیلی</h1>
                    <p className="text-gray-600 text-sm">
                        مشاهده، افزودن و ویرایش ترم‌ها و تعیین سقف واحد دستیار در هر ترم.
                    </p>
                </div>

                <button
                    onClick={openAddModal}
                    className="bg-gray-800 text-white text-sm px-5 py-2.5 rounded-xl font-medium hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    افزودن نیم‌سال جدید
                </button>
            </header>

            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">لیست ترم‌ها</h2>
                </div>

                {isPending ? (
                    <DataTableSkeleton rows={4} columns={6} />
                ) : isError ? (
                    <ErrorState onRetry={() => void refetch()} />
                ) : (
                    <DataTable
                        data={semesters ?? []}
                        columns={columns}
                        pageSize={10}
                        emptyMessage="هیچ نیم‌سالی در سیستم ثبت نشده است."
                    />
                )}
            </section>

            {/* مودال فرم افزودن/ویرایش */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingSemester ? 'ویرایش نیم‌سال' : 'ایجاد نیم‌سال جدید'}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                        >
                            انصراف
                        </button>
                        <button
                            type="submit"
                            form={formElementId}
                            disabled={saveMutation.isPending}
                            className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                        >
                            {editingSemester ? 'ذخیره تغییرات' : 'ایجاد نیم‌سال'}
                        </button>
                    </div>
                }
            >
                <form id={formElementId} className="space-y-4" onSubmit={handleSubmit}>
                    {saveMutation.isError && (
                        <p className="text-sm text-rose-600">ذخیره ناموفق بود. لطفاً دوباره تلاش کنید.</p>
                    )}
                    <div>
                        <label htmlFor={nameId} className="block text-sm font-medium text-gray-700 mb-1">عنوان نیم‌سال</label>
                        <input
                            id={nameId}
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="مثال: نیم‌سال اول ۱۴۰۳-۱۴۰۴"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={startDateId} className="block text-sm font-medium text-gray-700 mb-1">تاریخ شروع</label>
                            <input
                                id={startDateId}
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor={endDateId} className="block text-sm font-medium text-gray-700 mb-1">تاریخ پایان</label>
                            <input
                                id={endDateId}
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor={taLimitId} className="block text-sm font-medium text-gray-700 mb-1">سقف واحد دستیار در ترم (max_ta_courses_limit)</label>
                        <input
                            id={taLimitId}
                            type="number"
                            name="max_ta_courses_limit"
                            value={formData.max_ta_courses_limit}
                            onChange={handleChange}
                            min="1"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            required
                        />
                    </div>
                </form>
            </Modal>

            <ConfirmDeleteModal
                isOpen={pendingDeletion !== null}
                isLoading={deleteMutation.isPending}
                title="تأیید حذف نیم‌سال"
                message="آیا از حذف این نیم‌سال اطمینان دارید؟ تمامی دروس زیرمجموعه آن نیز ممکن است تحت تاثیر قرار گیرند."
                itemName={pendingDeletion?.name ?? ''}
                onConfirm={() => pendingDeletion && deleteMutation.mutate(pendingDeletion.id)}
                onClose={() => setPendingDeletion(null)}
            />
        </div>
    );
}
