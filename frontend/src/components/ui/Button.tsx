'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#0052CC] hover:bg-[#0041A3] active:bg-[#003380] text-white font-bold shadow-sm border border-[#0052CC]/90',
  secondary: 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold border border-slate-200/90 shadow-2xs',
  accent: 'bg-[#ED1C24] hover:bg-[#D0141B] active:bg-[#B70F16] text-white font-bold shadow-sm border border-[#ED1C24]',
  danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold shadow-sm border border-rose-600',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 font-medium',
  outline: 'bg-transparent hover:bg-slate-50 text-slate-700 font-semibold border border-slate-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs h-8 rounded-lg gap-1.5',
  md: 'px-3.5 py-2 text-xs h-9 rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm h-11 rounded-xl gap-2.5',
  icon: 'p-2 h-9 w-9 rounded-xl justify-center',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const vStyle = variantStyles[variant] || variantStyles.primary;
  const sStyle = sizeStyles[size] || sizeStyles.md;

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${vStyle} ${sStyle} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin shrink-0" /> : icon ? <span className="shrink-0">{icon}</span> : null}
      {children && <span>{children}</span>}
    </button>
  );
}
