'use client';
import React from 'react';

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: {
    value?: string | number;
    text?: string | number;
    isPositive?: boolean;
    positive?: boolean;
    label?: string;
  };
  className?: string;
  badge?: React.ReactNode;
}

export default function StatCard({
  title,
  label,
  value,
  subtitle,
  icon,
  iconBg = 'bg-[#EBF2FA] text-[#003366]',
  trend,
  className = '',
  badge,
}: StatCardProps) {
  const displayTitle = title || label || '';
  const trendValue = trend ? (trend.value ?? trend.text) : null;
  const isPositive = trend ? (trend.isPositive ?? trend.positive ?? true) : true;

  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all duration-200 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
          {displayTitle}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-100/80 shadow-2xs ${iconBg}`}>
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2">
        <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
          {value}
        </p>
      </div>

      {(subtitle || trendValue !== null) && (
        <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
          {trendValue !== null && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {trendValue}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] font-medium text-slate-500 truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
