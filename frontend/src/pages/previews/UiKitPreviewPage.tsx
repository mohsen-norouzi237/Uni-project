import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Badge from '../components/Badge';
import DataTableSkeleton from '../components/DataTableSkeleton';
import Modal from '../components/Modal';
import Alert from '../components/Alert';

interface Professor {
  id: number;
  name: string;
  department: string;
  email: string;
  status: 'active' | 'pending' | 'inactive';
}

export default function UiKitPreviewPage() {
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(true);

  const handleReload = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  useEffect(() => {
    handleReload();
  }, []);

  const sampleData: Professor[] = [
    { id: 1, name: 'دکتر صادق علی اکبری', department: 'مهندسی کامپیوتر', email: 's_aliakbary [at] sbu.ac.ir', status: 'active' },
    { id: 2, name: 'دکتر حمیدرضا مهدیانی', department: 'مهندسی کامپیوتر', email: 'mahdiani [at] sbu.ac.ir', status: 'pending' },
    { id: 3, name: 'دکتر حامد ملک', department: 'مهندسی کامپیوتر', email: 'h_malek [at] sbu.ac.ir', status: 'inactive' },
  ];

  const columns: Column<Professor>[] = [
    { header: 'شناسه', accessor: 'id', sortable: true },
    { header: 'نام و نام خانوادگی', accessor: 'name', sortable: true },
    { header: 'دانشکده', accessor: 'department', sortable: true },
    { header: 'ایمیل', accessor: 'email', sortable: true },
    {
      header: 'وضعیت',
      accessor: (item) => (
        <Badge variant={item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'danger'}>
          {item.status === 'active' ? 'فعال' : item.status === 'pending' ? 'در انتظار' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* هدر صفحه */}
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">پیش‌نمایش UI Kit - تسک FE-05</h1>
          <p className="text-sm text-slate-500 mt-1">
            مجموعه کامپوننت‌های پایه UI Kit شامل DataTable, Badge, Skeleton, Modal, Alert
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            تست Modal
          </button>
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
          >
            تست مجدد بارگذاری
          </button>
        </div>
      </div>

      {/* بخش نمونه کامپوننت‌های Alert */}
      {showAlert && (
        <Alert
          type="info"
          title="تسک FE-05 - سیستم UI Kit پایه"
          onClose={() => setShowAlert(false)}
        >
          تمامی کامپوننت‌های این تسک آماده استفاده  هستند.
        </Alert>
      )}

      {/* بخش جدول داده‌ها */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">جدول لیست اساتید (نمونه کاربرد)</h2>
        
        {loading ? (
          <DataTableSkeleton rows={3} columns={5} />
        ) : (
          <DataTable data={sampleData} columns={columns} />
        )}
      </div>

      {/* مودال پیش‌نمایش */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="پیش‌نمایش کامپوننت Modal"
        footer={
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            متوجه شدم
          </button>
        }
      >
        <div className="space-y-2 text-gray-600 text-sm leading-relaxed">
          <p>این یک نمونه از کامپوننت <b>Modal</b> در UI Kit تسک FE-05 است.</p>
          <p>از این کامپوننت می‌توانید برای نمایش فرم‌ها، پیام‌های تأیید حذف و هشدارها در پروژه استفاده کنید.</p>
        </div>
      </Modal>
    </div>
  );
}