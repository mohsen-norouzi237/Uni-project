import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: {
    value: string | number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  description?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  change,
  description,
  className = '',
}) => {
  return (
    <div
      className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-lg select-none">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {change && (
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              change.type === 'increase'
                ? 'bg-emerald-50 text-emerald-600'
                : change.type === 'decrease'
                ? 'bg-rose-50 text-rose-600'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {change.type === 'increase' && '↑'}
            {change.type === 'decrease' && '↓'}
            {change.value}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">{description}</p>
      )}
    </div>
  );
};

export default StatCard;