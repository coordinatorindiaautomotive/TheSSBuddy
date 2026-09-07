'use client';
import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface CommitPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: () => void;
  committing: boolean;
  selectedYear: number;
  selectedCount: number;
  totalNrs: number;
  totalDiscount: number;
  totalGrossIncentive: number;
  totalFinalIncentive: number;
}

export const CommitPeriodModal: React.FC<CommitPeriodModalProps> = ({
  isOpen,
  onClose,
  onCommit,
  committing,
  selectedYear,
  selectedCount,
  totalNrs,
  totalDiscount,
  totalGrossIncentive,
  totalFinalIncentive,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Period Lock & Commit"
      icon={<Lock size={20} />}
      size="md"
    >
      <div className="space-y-4 text-xs font-medium">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
          <strong className="font-bold flex items-center gap-1.5 text-rose-800">
            <AlertTriangle size={16} />
            <span>IMPORTANT PERIOD LOCK WARNING:</span>
          </strong>
          <p>
            Once committed, the period for {selectedYear} will be locked for normal Dynamic Calculation and Pre-Calculated Upload. Reopening requires admin authorization.
          </p>
        </div>

        <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Selected Parties:</span>
            <span className="font-mono font-bold text-slate-900">{selectedCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Sales NRS:</span>
            <span className="font-mono font-bold text-slate-900">₹{Math.round(totalNrs).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Discount:</span>
            <span className="font-mono font-bold text-slate-700">₹{Math.round(totalDiscount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-blue-900 font-bold pt-2 border-t border-slate-200">
            <span>Gross Incentive:</span>
            <span className="font-mono">₹{Math.round(totalGrossIncentive).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[#003366] font-bold text-sm pt-2 border-t border-slate-200">
            <span>Final Payable Incentive:</span>
            <span className="font-mono">₹{Math.round(totalFinalIncentive).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onCommit} isLoading={committing}>
            Confirm & Lock Period
          </Button>
        </div>
      </div>
    </Modal>
  );
};
