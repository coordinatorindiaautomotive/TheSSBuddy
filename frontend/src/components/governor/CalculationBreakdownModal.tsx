'use client';
import React from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui';
import { IncentiveRecord } from './types';

interface CalculationBreakdownModalProps {
  record: IncentiveRecord | null;
  onClose: () => void;
}

export const CalculationBreakdownModal: React.FC<CalculationBreakdownModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title="Calculation Breakdown"
      icon={<Calculator size={20} />}
      size="md"
    >
      <div className="space-y-4 text-xs font-medium">
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
          <p className="font-bold text-slate-900 text-sm">{record.partyName}</p>
          <p className="text-xs text-slate-500 font-mono">
            Code: <strong className="text-blue-700">{record.originalPartyCode}</strong> • Base Branch: <strong>{record.baseBranch}</strong>
          </p>
        </div>

        <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-white">
          <div className="flex items-center justify-between text-slate-700">
            <span>Aggregated Net Sales (NRS):</span>
            <span className="font-mono font-bold text-slate-900">₹{Math.round(record.nrs).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>Applicable Rule / Slab:</span>
            <span className="font-bold text-blue-700">{record.applicableSlab}</span>
          </div>
          <div className="flex items-center justify-between text-blue-900 font-bold pt-2 border-t border-slate-100">
            <span>Gross Incentive:</span>
            <span className="font-mono text-sm">₹{Math.round(record.grossIncentive).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Less: Total Discount:</span>
            <span className="font-mono text-rose-600">- ₹{Math.round(record.totalDiscount).toLocaleString()}</span>
          </div>
        </div>

        <div className="p-4 bg-[#FFF8EC] border border-[#0052CC] rounded-2xl flex items-center justify-between text-[#003366]">
          <div>
            <span className="text-xs uppercase font-bold text-amber-900">Final Payable Incentive</span>
            <p className="text-xs text-slate-600 font-mono">Formula: MAX(Gross - Discount, 0)</p>
          </div>
          <span className="text-xl font-bold font-mono">
            ₹{Math.round(record.finalIncentive).toLocaleString()}
          </span>
        </div>

        {record.validationErrors && record.validationErrors.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Validation Alert:</strong>
              {record.validationErrors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
