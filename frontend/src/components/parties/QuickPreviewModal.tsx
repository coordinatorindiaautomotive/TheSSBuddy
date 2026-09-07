'use client';
import React from 'react';
import { Building2, Link2 } from 'lucide-react';
import { Modal } from '@/components/ui';

interface QuickPreviewModalProps {
  party: any;
  onClose: () => void;
}

export const QuickPreviewModal: React.FC<QuickPreviewModalProps> = ({ party, onClose }) => {
  if (!party) return null;

  const code = party.code || party.consPartyCode || '-';
  const origCode = party.originalCode || code;
  const isMapped = origCode && origCode !== code && origCode !== '-';

  return (
    <Modal
      isOpen={!!party}
      onClose={onClose}
      title={party.name || party.consPartyName || 'Party Details'}
      subtitle={
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-blue-200/90 font-mono">Code: {code}</span>
          {isMapped && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-400/30">
              <Link2 size={11} /> Master: {origCode}
            </span>
          )}
        </div>
      }
      icon={<Building2 size={20} />}
      size="2xl"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Party Type</p>
            <p className="font-bold text-slate-800 text-sm mt-1">{party.type || party.partyType || 'DEALER'}</p>
          </div>
          <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-100">
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">Incentive Rule</p>
            <p className="font-bold text-slate-800 text-sm mt-1">{party.incentiveRule || party.incentiveType || 'Slab-Based'}</p>
          </div>
          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Location</p>
            <p className="font-bold text-slate-800 text-sm mt-1">{party.baseLoc || party.primaryBranchCode || 'All Branches'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact & Master Profile</h3>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Party Code:</span>
              <span className="font-mono font-bold text-blue-700">{code}</span>
            </div>
            {isMapped && (
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 bg-amber-50/60 px-2 rounded">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <Link2 size={12} /> Master Party Code:
                </span>
                <span className="font-mono font-bold text-amber-900">{origCode}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Sales Executive:</span>
              <span className="font-semibold text-slate-800">{party.salesExecutive || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Mobile Phone:</span>
              <span className="font-semibold text-slate-800 font-mono">{party.phone || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">GSTIN:</span>
              <span className="font-mono text-slate-800 text-xs font-semibold">{party.gstIn || party.gstin || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">PAN:</span>
              <span className="font-mono text-slate-800 text-xs font-semibold">{party.pan || '-'}</span>
            </div>
          </div>

          <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Master Setup</h3>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Bank Name:</span>
              <span className="font-semibold text-slate-800">{party.bankName || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Branch Name:</span>
              <span className="font-semibold text-slate-800">{party.branchName || party.bankBranch || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Account No:</span>
              <span className="font-mono text-slate-800 font-bold">{party.accountNumber && party.accountNumber !== '-' ? party.accountNumber : '⚠️ Pending Setup'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">IFSC Code:</span>
              <span className="font-mono text-slate-800 text-xs font-bold text-emerald-700">{party.ifscCode || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Account Holder:</span>
              <span className="font-semibold text-slate-800">{party.accountHolder || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Total Sales (YTD):</span>
              <span className="font-bold text-blue-700 tabular-nums font-mono">₹{Number(party.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
