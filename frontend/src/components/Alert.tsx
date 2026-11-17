import React from 'react';

export type AlertType = 'success' | 'danger' | 'warning' | 'info';

interface AlertProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const typeStyles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  };

  const iconMap = {
    success: '✓',
    danger: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm leading-relaxed transition-all ${typeStyles[type]} ${className}`}
    >
      <span aria-hidden="true" className="font-bold text-sm select-none">{iconMap[type]}</span>
      <div className="flex-1 space-y-1">
        {title && <h4 className="font-semibold text-sm">{title}</h4>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="بستن"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
};

export default Alert;