'use client';
import React, { useState } from 'react';
import { Upload, Info, CheckCircle2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Modal, Button } from '@/components/ui';
import { MONTH_NAMES_SHORT } from './types';

interface BankPayoutUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSuccess: () => void;
}

export const BankPayoutUploadModal: React.FC<BankPayoutUploadModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onSuccess,
}) => {
  const [payoutMonth, setPayoutMonth] = useState<number>(selectedMonth);
  const [payoutYear, setPayoutYear] = useState<number>(selectedYear);
  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [isUploadingPayout, setIsUploadingPayout] = useState(false);
  const [payoutResult, setPayoutResult] = useState<any>(null);

  const handleUploadPayoutFile = async () => {
    if (!payoutFile) {
      toast.error('Please select a Bank Transfer Excel file first.');
      return;
    }

    setIsUploadingPayout(true);
    setPayoutResult(null);

    try {
      const formData = new FormData();
      formData.append('file', payoutFile);
      formData.append('year', String(payoutYear));
      formData.append('month', String(payoutMonth));

      const res = await api.post('/incentive-governor/upload-bank-payout', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data && res.data.success) {
        setPayoutResult(res.data);
        toast.success(`Bank Payout reconciled! ${res.data.matchedCount} records updated.`);
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error uploading file';
      toast.error(msg);
    } finally {
      setIsUploadingPayout(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Bank Incentive Transfer Excel"
      icon={<Upload size={20} />}
      size="lg"
    >
      <div className="space-y-4 text-xs font-medium">
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 space-y-1">
          <strong className="font-bold flex items-center gap-1.5 text-blue-800">
            <Info size={16} />
            <span>Bank Payout Reconciliation Module:</span>
          </strong>
          <p className="text-xs leading-relaxed">
            Upload the Bank Incentive Transfer file fetched from bank portal (e.g. <code className="font-mono bg-blue-100 px-1 rounded">May'2026.xlsx</code>). The module matches Party Codes from <strong>Column I (Debit narration)</strong> and updates payout amounts, dates, account numbers, IFSC, UTR numbers, and status in the Committed Register.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Month</label>
            <select
              value={payoutMonth}
              onChange={(e) => setPayoutMonth(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0052CC] text-xs"
            >
              {MONTH_NAMES_SHORT.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name} ({idx + 1})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Year</label>
            <select
              value={payoutYear}
              onChange={(e) => setPayoutYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0052CC] text-xs"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Select Bank Payout Excel File</label>
          <div className="border-2 border-dashed border-slate-300 hover:border-[#003366] rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPayoutFile(e.target.files[0]);
                  setPayoutResult(null);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <FileSpreadsheet size={28} className="mx-auto text-[#003366] mb-1" />
            {payoutFile ? (
              <div>
                <p className="font-bold text-slate-900 text-xs">{payoutFile.name}</p>
                <p className="text-xs text-slate-500 font-mono">{(payoutFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-700 text-xs">Click or Drag & Drop Excel File</p>
                <p className="text-xs text-slate-400">Supports .xlsx / .xls formats</p>
              </div>
            )}
          </div>
        </div>

        {payoutResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-950">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
              <CheckCircle2 size={16} />
              <span>Bank Reconciliation Complete!</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-1">
              <div className="p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="block text-xs text-slate-500 uppercase">File Rows</span>
                <span className="font-mono text-slate-900 font-bold">{payoutResult.totalRows}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="block text-xs text-emerald-600 uppercase">Matched</span>
                <span className="font-mono text-emerald-700 font-bold">{payoutResult.matchedCount}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-blue-100 shadow-2xs">
                <span className="block text-xs text-blue-600 uppercase">Auto-Created</span>
                <span className="font-mono text-blue-700 font-bold">{payoutResult.autoCreatedCount || 0}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                <span className="block text-xs text-indigo-600 uppercase">Credit Party</span>
                <span className="font-mono text-indigo-700 font-bold">{payoutResult.creditPartyCount || 0}</span>
              </div>
            </div>
            <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between text-xs font-bold px-3">
              <span className="text-slate-600">Total Transferred Payout:</span>
              <span className="font-mono text-emerald-700 font-bold text-sm">₹{Math.round(payoutResult.totalTransferred).toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleUploadPayoutFile}
            isLoading={isUploadingPayout}
            disabled={!payoutFile}
            icon={<Upload size={14} />}
          >
            Upload & Reconcile
          </Button>
        </div>
      </div>
    </Modal>
  );
};
