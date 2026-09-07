'use client';
import React from 'react';
import { Sliders, Check } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface BulkTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  bulkFlatAmount: string;
  setBulkFlatAmount: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
  bulkSaving: boolean;
  currentPeriodLabel: string;
  dealerCount: number;
}

export const BulkTargetModal: React.FC<BulkTargetModalProps> = ({
  isOpen,
  onClose,
  bulkFlatAmount,
  setBulkFlatAmount,
  onSave,
  bulkSaving,
  currentPeriodLabel,
  dealerCount,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Target Assignment"
      icon={<Sliders size={20} />}
      size="md"
    >
      <form onSubmit={onSave} className="space-y-4 text-xs">
        <div className="bg-blue-50/90 p-4 rounded-2xl border border-blue-200 text-blue-900">
          <p className="font-bold text-sm">
            Assigning target to {dealerCount} filtered dealers
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Target Period: <strong className="font-mono">{currentPeriodLabel}</strong>
          </p>
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-tight">
            Flat Target Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={bulkFlatAmount}
              onChange={(e) => setBulkFlatAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 100000"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={bulkSaving} icon={<Check size={14} />}>
            Apply Bulk Targets
          </Button>
        </div>
      </form>
    </Modal>
  );
};
