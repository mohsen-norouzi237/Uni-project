import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
      <h1 className="text-6xl font-black text-slate-300 mb-4">۴۰۴</h1>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">صفحه مورد نظر یافت نشد!</h2>
      <p className="text-slate-500 mb-6">آدرسی که وارد کرده‌اید وجود ندارد یا منتقل شده است.</p>
      <Link
        to="/"
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        بازگشت به صفحه اصلی
      </Link>
    </div>
  )
}
