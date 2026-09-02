'use client';
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {children && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
