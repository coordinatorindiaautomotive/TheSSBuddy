'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Edit, Eye, UserCheck, Ban, CheckCircle2 } from 'lucide-react';

interface AnchoredActionDropdownMenuProps {
  party: any;
  anchor: { top: number; left: number };
  isSuperAdmin: boolean;
  onClose: () => void;
  onEditBank: () => void;
  onEditMaster: () => void;
  onPreview: () => void;
  onAssignExec: () => void;
  onToggleStatus: () => void;
}

export const AnchoredActionDropdownMenu: React.FC<AnchoredActionDropdownMenuProps> = ({
  party,
  anchor,
  isSuperAdmin,
  onClose,
  onEditBank,
  onEditMaster,
  onPreview,
  onAssignExec,
  onToggleStatus,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mounted || typeof document === 'undefined' || !party) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-auto select-none">
      <div className="fixed inset-0 bg-transparent" onClick={onClose} />
      <div
        style={{ top: `${anchor.top}px`, left: `${anchor.left}px` }}
        className="fixed z-[10000] w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 text-left font-sans animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10"
      >
        <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
          <p className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">
            {party.name || party.consPartyName}
          </p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-blue-600 font-mono font-semibold">
              Code: {party.code || party.consPartyCode}
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
              party.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {party.isActive !== false ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditBank}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition cursor-pointer"
        >
          <CreditCard size={14} className="text-blue-600 shrink-0" />
          <span>Bank & KYC Details</span>
        </button>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={onEditMaster}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Edit size={14} className="text-slate-600 shrink-0" />
            <span>Edit Party Master</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <Eye size={14} className="text-slate-600 shrink-0" />
          <span>Quick Preview</span>
        </button>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={onAssignExec}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <UserCheck size={14} className="text-slate-600 shrink-0" />
            <span>Assign Executive</span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            type="button"
            onClick={onToggleStatus}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold transition cursor-pointer border-t border-slate-100 ${
              party.isActive !== false
                ? 'text-rose-700 hover:bg-rose-50'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {party.isActive !== false ? (
              <>
                <Ban size={14} className="text-rose-600 shrink-0" />
                <span>Disable Party (Hide from Branch)</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Enable Party Code</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
