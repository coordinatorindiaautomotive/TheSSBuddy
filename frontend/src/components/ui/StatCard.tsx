'use client';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  badge?: React.ReactNode;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'bg-[#EAF5F3] text-[#053D3A]',
  trend,
  className = '',
  badge,
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all duration-200 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
          {title}
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

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
          {trend && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {trend.value}
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
