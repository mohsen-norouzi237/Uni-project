import React from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'خطا در برقراری ارتباط',
  message = 'متأسفانه مشکلی در دریافت داده‌ها پیش آمده است. لطفاً دوباره تلاش کنید.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-rose-50/40 border border-rose-100 rounded-2xl ${className}`}
    >
      <div className="w-12 h-12 mb-3 text-rose-500 flex items-center justify-center bg-rose-100/70 rounded-full text-xl select-none">
        ⚠️
      </div>
      <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
      <p className="text-sm text-rose-600/90 mt-1 max-w-sm leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span>↻</span>
          <span>تلاش مجدد</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;