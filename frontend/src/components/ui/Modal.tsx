'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeOnClickOutside?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-[95vw] sm:max-w-5xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'lg',
  children,
  footer,
  className = '',
  closeOnClickOutside = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={closeOnClickOutside ? onClose : undefined}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl w-full ${sizeClasses[size] || sizeClasses.lg} max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 ${className}`}
      >
        {/* ─── MODAL HEADER (MARUTI SUZUKI NAVY & RED ACCENT) ─── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 bg-[#003366] border-b-[3px] border-[#ED1C24] text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="p-1.5 rounded-xl bg-[#002B55] border border-[#0041A3] text-cyan-400 shrink-0 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white tracking-wide truncate">
                {title}
              </h3>
              {subtitle && (
                typeof subtitle === 'string' ? (
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    {subtitle}
                  </p>
                ) : (
                  <div className="text-[11px] text-slate-300 truncate mt-0.5">
                    {subtitle}
                  </div>
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-[#002B55] transition cursor-pointer shrink-0 ml-2"
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── MODAL BODY ─── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs text-slate-800 scrollbar-thin scrollbar-thumb-slate-200">
          {children}
        </div>

        {/* ─── OPTIONAL FOOTER ─── */}
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
