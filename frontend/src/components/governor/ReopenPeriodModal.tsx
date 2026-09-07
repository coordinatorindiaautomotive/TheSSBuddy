'use client';
import React, { useState } from 'react';
import { Unlock } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface ReopenPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReopen: (reason: string) => void;
  selectedYear: number;
}

export const ReopenPeriodModal: React.FC<ReopenPeriodModalProps> = ({
  isOpen,
  onClose,
  onReopen,
  selectedYear,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onReopen(reason);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reopen Incentive Period"
      icon={<Unlock size={20} />}
      size="md"
    >
      <div className="space-y-4 text-xs font-medium">
        <p className="text-slate-600">
          Reopening will unlock {selectedYear} for recalculation. A mandatory audit log will be created.
        </p>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Reopen Reason (Mandatory Audit Requirement)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide detailed business justification for unlocking this period..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052CC] text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Reopen Period
          </Button>
        </div>
      </div>
    </Modal>
  );
};
