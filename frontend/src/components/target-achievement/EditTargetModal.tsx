'use client';
import React from 'react';
import { Target, Check } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface EditTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: any;
  targetValue: string | number;
  setTargetValue: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
  savingTarget: boolean;
  currentPeriodLabel: string;
}

export const EditTargetModal: React.FC<EditTargetModalProps> = ({
  isOpen,
  onClose,
  row,
  targetValue,
  setTargetValue,
  onSave,
  savingTarget,
  currentPeriodLabel,
}) => {
  if (!isOpen || !row) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Define Custom Admin Target"
      icon={<Target size={20} />}
      size="md"
    >
      <form onSubmit={onSave} className="space-y-4 text-xs">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
          <p className="font-bold text-slate-900 text-sm">{row.partyName}</p>
          <p className="font-mono text-slate-500 text-xs">
            Code: <strong className="text-slate-800">{row.partyCode}</strong> | Branch: <strong className="text-slate-800">{row.branchCode}</strong>
          </p>
          <p className="text-slate-600 font-sans text-xs">
            Engine Weighted Base: <strong className="font-mono text-blue-700">{Math.round(row.weightedBase || 0).toLocaleString('en-IN')}</strong>
          </p>
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-tight">
            Admin Target Amount for {currentPeriodLabel}
          </label>
          <div className="relative">
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 150000"
              autoFocus
              required
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Overwrites the engine recommended target and updates qualification benchmarks.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={savingTarget} icon={<Check size={14} />}>
            Save Target
          </Button>
        </div>
      </form>
    </Modal>
  );
};
