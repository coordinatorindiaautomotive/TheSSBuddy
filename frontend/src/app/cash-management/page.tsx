'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { ArrowDownCircle, ArrowUpCircle, Plus, CheckCircle2, X } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(r => r.data);

type CashFormData = {
  partyId: string;
  amount: number;
  remarks: string;
  referenceNo?: string;
};

function CashModal({ type, onClose, onSuccess }: { type: 'in' | 'out'; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CashFormData>();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: CashFormData) => {
    setLoading(true);
    try {
      await api.post(`/cashbook/cash-${type}`, { ...data, amount: Number(data.amount) });
      toast.success(`Cash ${type === 'in' ? 'In' : 'Out'} recorded!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create transaction');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 text-lg">
            {type === 'in' ? '💰 Cash In' : '💸 Cash Out'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Party ID</label>
            <input {...register('partyId', { required: 'Party ID is required' })}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter party ID" />
            {errors.partyId && <p className="text-red-500 text-xs mt-1">{errors.partyId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
            <input {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })}
              type="number" step="0.01"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference No. (optional)</label>
            <input {...register('referenceNo')}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cheque/UTR number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
            <textarea {...register('remarks', { required: 'Remarks are required' })}
              rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Enter remarks..." />
            {errors.remarks && <p className="text-red-500 text-xs mt-1">{errors.remarks.message}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition disabled:opacity-60 ${type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const swrOptions = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 15000,
  keepPreviousData: true,
};

const txCols = ['Party', 'Amount (₹)', 'Ref No.', 'Status', 'Date', 'Action'];

// Extract TxTable outside main component to prevent DOM unmounting on every re-render
function TxTable({ data, type, onApprove }: { data: any[]; type: 'in' | 'out'; onApprove: (type: 'in' | 'out', id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
      <table className="w-full text-xs text-center align-middle border-collapse">
        <thead className="table-header-navy select-none">
          <tr>
            {txCols.map((h, idx) => (
              <th key={h} className={`py-3 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wider text-white ${idx < txCols.length - 1 ? 'border-r border-slate-700/80' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white font-medium text-slate-800 align-middle">
          {!data || data.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center align-middle py-10 text-slate-400 font-semibold text-xs border-b border-slate-200">
                No transactions recorded for this period.
              </td>
            </tr>
          ) : (
            data.map((tx: any, idx: number) => (
              <tr key={tx.id || Math.random()} className={`hover:bg-blue-50/60 transition border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-900 font-semibold text-xs uppercase">
                  {tx.partyId || tx.partyName || tx.party?.name || '—'}
                </td>
                <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900 text-xs">
                  {Number(tx.amount || 0).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-semibold text-xs">
                  {tx.referenceNo || '—'}
                </td>
                <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold shadow-xs ${
                      tx.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : tx.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {tx.status || 'PENDING'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-semibold text-xs">
                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-center align-middle">
                  {tx.status === 'PENDING' && (
                    <button
                      onClick={() => onApprove(type, tx.id)}
                      className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CashManagementPage() {
  const [modal, setModal] = useState<'in' | 'out' | null>(null);
  const { data: cashIn, mutate: mutateIn } = useSWR('/cashbook/cash-in', fetcher, swrOptions);
  const { data: cashOut, mutate: mutateOut } = useSWR('/cashbook/cash-out', fetcher, swrOptions);

  const approve = async (type: 'in' | 'out', id: string) => {
    try {
      await api.post(`/cashbook/cash-${type}/${id}/approve`);
      toast.success('Transaction approved successfully!');
      type === 'in' ? mutateIn() : mutateOut();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Approval failed');
    }
  };

  const cashInList = Array.isArray(cashIn?.transactions)
    ? cashIn.transactions
    : Array.isArray(cashIn)
    ? cashIn
    : [];

  const cashOutList = Array.isArray(cashOut?.transactions)
    ? cashOut.transactions
    : Array.isArray(cashOut)
    ? cashOut
    : [];

  return (
    <AppShell title="Cashbook" breadcrumb="Financial & Ledger">
      {modal && (
        <CashModal
          type={modal}
          onClose={() => setModal(null)}
          onSuccess={() => {
            mutateIn();
            mutateOut();
          }}
        />
      )}

      {/* Action Buttons Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setModal('in')}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer"
        >
          <ArrowDownCircle size={17} /> Record Cash In
        </button>

        <button
          onClick={() => setModal('out')}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer"
        >
          <ArrowUpCircle size={17} /> Record Cash Out
        </button>
      </div>

      <div className="space-y-6">
        {/* Cash In Table */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle size={20} className="text-emerald-600" />
              <h2 className="font-black text-slate-900 text-sm tracking-tight">
                Cash In Receipts ({cashInList.length})
              </h2>
            </div>
          </div>
          <TxTable data={cashInList} type="in" onApprove={approve} />
        </div>

        {/* Cash Out Table */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle size={20} className="text-rose-600" />
              <h2 className="font-black text-slate-900 text-sm tracking-tight">
                Cash Out Disbursements ({cashOutList.length})
              </h2>
            </div>
          </div>
          <TxTable data={cashOutList} type="out" onApprove={approve} />
        </div>
      </div>
    </AppShell>
  );
}
