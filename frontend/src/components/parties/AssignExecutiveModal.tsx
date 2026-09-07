'use client';
import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Modal, Button } from '@/components/ui';

interface AssignExecutiveModalProps {
  party: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignExecutiveModal: React.FC<AssignExecutiveModalProps> = ({ party, onClose, onSuccess }) => {
  const [executive, setExecutive] = useState(party?.salesExecutive && party?.salesExecutive !== '-' ? party.salesExecutive : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!executive.trim()) {
      toast.error('Please enter executive name');
      return;
    }
    setLoading(true);
    try {
      const code = party?.code || party?.consPartyCode;
      await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, {
        salesExecutive: executive.trim(),
      });
      toast.success(`Executive assigned to ${party.name || party.consPartyName}`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to assign executive');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={!!party}
      onClose={onClose}
      title="Assign Sales Executive"
      icon={<UserCheck size={20} />}
      size="md"
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <p className="text-slate-500 font-semibold">Party:</p>
          <p className="font-bold text-slate-800 mt-0.5">{party?.name || party?.consPartyName}</p>
          <p className="text-slate-500 font-mono mt-0.5">Code: {party?.code || party?.consPartyCode}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Executive Name</label>
          <input
            type="text"
            value={executive}
            onChange={(e) => setExecutive(e.target.value)}
            placeholder="Enter Sales Executive Name"
            className="input-enterprise w-full text-xs"
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" variant="primary" onClick={handleSave} isLoading={loading} className="flex-1">
            Assign Executive
          </Button>
        </div>
      </div>
    </Modal>
  );
};
