import React from 'react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'در حال دریافت اطلاعات...',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center space-y-3 ${className}`}
    >
      <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-600 rounded-full animate-spin" />
      {message && <p className="text-sm text-slate-500 font-medium">{message}</p>}
    </div>
  );
};

export default LoadingState;