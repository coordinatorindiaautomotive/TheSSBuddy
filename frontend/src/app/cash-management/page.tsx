'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowDownCircle, ArrowUpCircle, Plus, CheckCircle2, X,
  Trash2, Upload, Calendar, Building2, Wallet, Settings,
  FileText, Check, AlertCircle, RefreshCw, Layers, SlidersHorizontal
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(r => r.data);

const swrOptions = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 15000,
  keepPreviousData: true,
};

interface EntryRow {
  id: string;
  category: string;
  amount: string | number;
  paymentMode: string;
  narration: string;
}

// ─── 1. NEW MULTI-ENTRY CASH MODAL (MATCHING USER SCREENSHOT) ─────────────────
function CashMultiEntryModal({
  type,
  onClose,
  onSuccess,
  branches,
  categories,
  paymentModes,
}: {
  type: 'in' | 'out';
  onClose: () => void;
  onSuccess: () => void;
  branches: Array<{ code: string; name: string }>;
  categories: string[];
  paymentModes: string[];
}) {
  const isOut = type === 'out';
  const todayStr = new Date().toISOString().split('T')[0];

  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [selectedBranch, setSelectedBranch] = useState<string>(branches[0]?.code || 'ALW');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [entries, setEntries] = useState<EntryRow[]>([
    {
      id: 'entry-1',
      category: categories[0] || (isOut ? 'Office Expense' : 'Customer Cash Collection'),
      amount: '',
      paymentMode: paymentModes[0] || 'NEFT',
      narration: '',
    },
  ]);

  // Compute live total across all rows
  const totalAmount = useMemo(() => {
    return entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [entries]);

  const handleAddEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        category: categories[0] || (isOut ? 'Office Expense' : 'Customer Cash Collection'),
        amount: '',
        paymentMode: paymentModes[0] || 'NEFT',
        narration: '',
      },
    ]);
  };

  const handleRemoveEntry = (id: string) => {
    if (entries.length <= 1) {
      toast.error('At least one entry is required.');
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleEntryChange = (id: string, field: keyof EntryRow, val: any) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
    }
  };

  const handleSubmitBatch = async (status: 'Draft' | 'Pending') => {
    if (!selectedBranch) {
      toast.error('Please select a Branch.');
      return;
    }

    const invalidEntry = entries.find((e) => !e.amount || Number(e.amount) <= 0);
    if (invalidEntry) {
      toast.error('Please enter a valid amount greater than 0 for all entries.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        paymentDate: paymentDate,
        receiptDate: paymentDate,
        branchCode: selectedBranch,
        attachmentPath: attachmentName || null,
        status: status,
        entries: entries.map((e) => ({
          expenseCategory: e.category,
          receiptType: e.category,
          amount: Number(e.amount),
          paymentMode: e.paymentMode,
          narration: e.narration.trim() || null,
        })),
      };

      const endpoint = isOut ? '/cashbook/cash-out/batch' : '/cashbook/cash-in/batch';
      await api.post(endpoint, payload);

      toast.success(
        `${isOut ? 'Cash Out Payment' : 'Cash In Receipt'} (${entries.length} entries) saved as ${status}!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit cash transaction batch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal-backdrop">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Dark Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${
                isOut ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
            >
              {isOut ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-tight leading-none">
                {isOut ? 'New Cash Out Payment' : 'New Cash In Receipt'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                {isOut ? 'Record an outgoing payment or expense.' : 'Record an incoming cash receipt.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Top Form Fields: Payment Date & Branch */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Branch <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A] transition"
              >
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Expense / Receipt Entries */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="font-mono text-slate-500">≡</span>
                  {isOut ? 'Expense Entries' : 'Receipt Entries'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                    isOut ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  Total: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddEntry}
                className="px-3 py-1 bg-white hover:bg-slate-50 border border-blue-600 text-blue-600 font-bold rounded-lg text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
              >
                <Plus size={13} /> Add Entry
              </button>
            </div>

            {/* Entry Rows Container */}
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/90 shadow-2xs transition hover:border-slate-300"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* 1. Category */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isOut ? 'Expense Category' : 'Receipt Type'} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.category}
                        onChange={(e) => handleEntryChange(entry.id, 'category', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Amount */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={entry.amount}
                        onChange={(e) => handleEntryChange(entry.id, 'amount', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    {/* 3. Payment Mode */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Payment Mode <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.paymentMode}
                        onChange={(e) => handleEntryChange(entry.id, 'paymentMode', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      >
                        {paymentModes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Narration */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Narration
                      </label>
                      <input
                        type="text"
                        placeholder="Payment details..."
                        value={entry.narration}
                        onChange={(e) => handleEntryChange(entry.id, 'narration', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    {/* 5. Delete Action */}
                    <div className="sm:col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(entry.id)}
                        disabled={entries.length <= 1}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Bill / Invoice Attachment */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Bill / Invoice Attachment
            </label>
            <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-300">
              <input
                type="file"
                id="cash-attachment"
                onChange={handleFileChange}
                className="text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Optional. Applies to all expense entries listed above.
            </p>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmitBatch('Draft')}
            className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            <span>💾 Save Draft</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmitBatch('Pending')}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer"
          >
            <span>✈ Submit for Approval</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2. ADMIN CATEGORY / DROPDOWN MANAGER MODAL ──────────────────────────────
function ManageCategoriesModal({
  onClose,
  onUpdated,
}: {
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { data: catData, mutate } = useSWR('/cashbook/categories/admin', fetcher, swrOptions);
  const [activeTab, setActiveTab] = useState<'EXPENSE_CATEGORY' | 'RECEIPT_TYPE' | 'PAYMENT_MODE'>('EXPENSE_CATEGORY');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const list: any[] = Array.isArray(catData) ? catData.filter((c: any) => c.type === activeTab) : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      await api.post('/cashbook/categories', {
        type: activeTab,
        name: newName.trim(),
      });
      toast.success(`Category "${newName}" added!`);
      setNewName('');
      mutate();
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await api.delete(`/cashbook/categories/${id}`);
      toast.success('Category removed');
      mutate();
      onUpdated();
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await api.put(`/cashbook/categories/${id}`, { isActive: !currentActive });
      mutate();
      onUpdated();
    } catch {
      toast.error('Failed to update category status');
    }
  };

  return (
    <div className="portal-modal-backdrop">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#053D3A] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-[#FFE2B8]" />
            <div>
              <h2 className="font-bold text-sm text-white">Dropdown & Category Master</h2>
              <p className="text-[11px] text-[#DCEDEA]">Configure categories that appear in Cash Out / Cash In dropdowns</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          {[
            { key: 'EXPENSE_CATEGORY', label: 'Expense Categories' },
            { key: 'RECEIPT_TYPE', label: 'Receipt Types' },
            { key: 'PAYMENT_MODE', label: 'Payment Modes' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[#053D3A] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Add New Category Form */}
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`Enter new ${activeTab === 'EXPENSE_CATEGORY' ? 'Expense Category' : activeTab === 'RECEIPT_TYPE' ? 'Receipt Type' : 'Payment Mode'}...`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A]"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="px-4 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-bold text-xs rounded-lg transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              {saving ? 'Adding...' : '+ Add'}
            </button>
          </form>

          {/* List of Existing Categories */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {list.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No categories found in this section.</div>
            ) : (
              list.map((cat: any) => (
                <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={`text-xs font-semibold ${cat.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(cat.id, cat.isActive)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        cat.isActive ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {cat.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                      title="Delete category"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 3. MAIN CASH MANAGEMENT PAGE ───────────────────────────────────────────
const txCols = ['Branch', 'Category / Type', 'Amount (₹)', 'Payment Mode', 'Narration', 'Status', 'Date', 'Action'];

function TxTable({
  data,
  type,
  onApprove,
}: {
  data: any[];
  type: 'in' | 'out';
  onApprove: (type: 'in' | 'out', id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
      <table className="w-full text-xs text-center align-middle border-collapse">
        <thead className="table-header-navy select-none">
          <tr>
            {txCols.map((h, idx) => (
              <th
                key={h}
                className={`py-3 px-3 text-center align-middle text-[11px] font-bold uppercase tracking-wider text-white ${
                  idx < txCols.length - 1 ? 'border-r border-slate-700/80' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white font-medium text-slate-800 align-middle">
          {!data || data.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center align-middle py-10 text-slate-400 font-semibold text-xs border-b border-slate-200">
                No transactions recorded for this period.
              </td>
            </tr>
          ) : (
            data.map((tx: any, idx: number) => (
              <tr
                key={tx.id || idx}
                className={`hover:bg-slate-100/80 transition border-b border-slate-200 ${
                  idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                }`}
              >
                {/* Branch */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-900 border border-slate-200 font-bold rounded-md text-[11px]">
                    {tx.branchCode || 'ALW'}
                  </span>
                </td>

                {/* Category / Type */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-900 font-bold text-xs truncate max-w-[160px]">
                  {tx.expenseCategory || tx.receiptType || tx.partyName || '—'}
                </td>

                {/* Amount */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-bold text-slate-900 text-xs">
                  ₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>

                {/* Payment Mode */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-semibold text-xs">
                  {tx.paymentMode || 'NEFT'}
                </td>

                {/* Narration */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-600 text-[11px] truncate max-w-[180px]" title={tx.narration || tx.remarks || '—'}>
                  {tx.narration || tx.remarks || '—'}
                </td>

                {/* Status */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold shadow-2xs ${
                      tx.status === 'Approved' || tx.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : tx.status === 'Rejected' || tx.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : tx.status === 'Draft'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {tx.status || 'Pending'}
                  </span>
                </td>

                {/* Date */}
                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-medium text-[11px]">
                  {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('en-IN') : tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : '—'}
                </td>

                {/* Action */}
                <td className="px-3 py-2.5 text-center align-middle">
                  {(tx.status === 'Pending' || tx.status === 'PENDING' || tx.status === 'Draft') && (
                    <button
                      onClick={() => onApprove(type, tx.id)}
                      className="text-xs px-2.5 py-1 bg-[#053D3A] hover:bg-[#074B47] text-white font-bold rounded-lg transition shadow-2xs inline-flex items-center gap-1 cursor-pointer"
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
  const { isSuperAdmin } = useAuth();
  const [modal, setModal] = useState<'in' | 'out' | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // SWR queries
  const { data: cashIn, mutate: mutateIn } = useSWR('/cashbook/cash-in', fetcher, swrOptions);
  const { data: cashOut, mutate: mutateOut } = useSWR('/cashbook/cash-out', fetcher, swrOptions);
  const { data: branchesData } = useSWR('/branches?pageSize=100', fetcher, swrOptions);
  const { data: categoryData, mutate: mutateCategories } = useSWR('/cashbook/categories', fetcher, swrOptions);

  const branches = useMemo(() => {
    const list = branchesData?.items || branchesData || [];
    return Array.isArray(list) ? list : [];
  }, [branchesData]);

  const expenseCategories = categoryData?.expenseCategories || [
    'Office Expense', 'Tea & Refreshments', 'Fuel & Conveyance', 'Courier & Postage',
    'Stationery & Printing', 'Repair & Maintenance', 'Travel Expenses', 'Electricity & Utilities',
    'Rent', 'Staff Welfare', 'Misc Expense'
  ];

  const receiptTypes = categoryData?.receiptTypes || [
    'Customer Cash Collection', 'Workshop Cash Sales', 'Scrap & Waste Sales',
    'Dealer Advance', 'Bank Interest', 'Misc Receipt'
  ];

  const paymentModes = categoryData?.paymentModes || [
    'NEFT', 'RTGS', 'UPI', 'CASH', 'CHEQUE', 'IMPS'
  ];

  const approve = async (type: 'in' | 'out', id: string) => {
    try {
      await api.post(`/cashbook/cash-${type}/${id}/approve`, { status: 'Approved' });
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

  const totalIn = cashInList.reduce((s: number, tx: any) => s + (Number(tx.amount) || 0), 0);
  const totalOut = cashOutList.reduce((s: number, tx: any) => s + (Number(tx.amount) || 0), 0);
  const netFlow = totalIn - totalOut;

  return (
    <AppShell title="Cashbook & Payments" breadcrumb="Financial & Ledger">
      {/* 1. Multi-Entry Create Modal */}
      {modal && (
        <CashMultiEntryModal
          type={modal}
          onClose={() => setModal(null)}
          onSuccess={() => {
            mutateIn();
            mutateOut();
          }}
          branches={branches.length > 0 ? branches : [{ code: 'ALW', name: 'ALWAR-SPR' }]}
          categories={modal === 'out' ? expenseCategories : receiptTypes}
          paymentModes={paymentModes}
        />
      )}

      {/* 2. Admin Category Dropdown Master Modal */}
      {categoryModalOpen && (
        <ManageCategoriesModal
          onClose={() => setCategoryModalOpen(false)}
          onUpdated={() => mutateCategories()}
        />
      )}

      {/* Summary Metric Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Receipts (In)</span>
            <span className="text-xl font-black text-emerald-800 font-mono mt-1 block">
              ₹{totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{cashInList.length} transactions</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <ArrowDownCircle size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Payments (Out)</span>
            <span className="text-xl font-black text-rose-800 font-mono mt-1 block">
              ₹{totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{cashOutList.length} transactions</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <ArrowUpCircle size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Net Cashflow</span>
            <span className={`text-xl font-black font-mono mt-1 block ${netFlow >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              ₹{netFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{netFlow >= 0 ? 'Surplus' : 'Deficit'}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#053D3A]/10 text-[#053D3A] flex items-center justify-center border border-[#053D3A]/20">
            <Wallet size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Configured Categories</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
              {expenseCategories.length + receiptTypes.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Dynamic dropdown options</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <Settings size={20} />
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModal('out')}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition shadow-md cursor-pointer"
          >
            <ArrowUpCircle size={16} /> New Cash Out Payment
          </button>

          <button
            onClick={() => setModal('in')}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-md cursor-pointer"
          >
            <ArrowDownCircle size={16} /> New Cash In Receipt
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
          >
            <Settings size={15} className="text-[#053D3A]" />
            <span>Manage Dropdowns</span>
          </button>

          <button
            onClick={() => {
              mutateIn();
              mutateOut();
            }}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-xl transition shadow-2xs cursor-pointer"
            title="Refresh transactions"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Cash Out Table (Disbursements) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle size={18} className="text-rose-600" />
              <h2 className="font-black text-slate-900 text-sm tracking-tight">
                Cash Out Payments ({cashOutList.length})
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-600">
              Total: ₹{totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <TxTable data={cashOutList} type="out" onApprove={approve} />
        </div>

        {/* Cash In Table (Receipts) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-emerald-600" />
              <h2 className="font-black text-slate-900 text-sm tracking-tight">
                Cash In Receipts ({cashInList.length})
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-600">
              Total: ₹{totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <TxTable data={cashInList} type="in" onApprove={approve} />
        </div>
      </div>
    </AppShell>
  );
}
