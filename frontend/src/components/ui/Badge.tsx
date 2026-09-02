'use client';
import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'brand'
  | 'accent';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  success: {
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100/70',
    dot: 'bg-emerald-600',
  },
  danger: {
    container: 'bg-rose-50 text-rose-800 border-rose-200/90 hover:bg-rose-100/70',
    dot: 'bg-rose-600',
  },
  warning: {
    container: 'bg-amber-50 text-amber-800 border-amber-200/90 hover:bg-amber-100/70',
    dot: 'bg-amber-600',
  },
  info: {
    container: 'bg-sky-50 text-sky-800 border-sky-200/90 hover:bg-sky-100/70',
    dot: 'bg-sky-600',
  },
  neutral: {
    container: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70',
    dot: 'bg-slate-500',
  },
  brand: {
    container: 'bg-[#EAF5F3] text-[#053D3A] border-[#DCEDEA] hover:bg-[#DCEDEA]/80 font-black',
    dot: 'bg-[#053D3A]',
  },
  accent: {
    container: 'bg-[#FFF8EC] text-[#9A6500] border-[#FFE2B8] hover:bg-[#FFE2B8]/70 font-black',
    dot: 'bg-[#9A6500]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2.5 py-0.5 leading-tight',
  md: 'text-xs px-3 py-1 leading-normal',
};

export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  icon,
}: BadgeProps) {
  const styles = variantStyles[variant] || variantStyles.neutral;
  const sizeCls = sizeStyles[size] || sizeStyles.sm;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border transition-colors shadow-2xs whitespace-nowrap select-none ${styles.container} ${sizeCls} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
