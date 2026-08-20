'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Search, Download, TrendingUp, TrendingDown } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function LedgerPage() {
  const [partyId, setPartyId] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: statement, isLoading } = useSWR(
    partyId ? `/ledger/statement/${partyId}` : null,
    fetcher
  );

  const { data: parties } = useSWR('/parties?limit=200', fetcher);
  const rawParties = parties?.parties ?? parties?.data ?? parties;
  const partyList: any[] = Array.isArray(rawParties) ? rawParties : [];

  const handleSearch = () => {
    if (!searchInput.trim()) return toast.error('Enter a party ID or select from dropdown');
    setPartyId(searchInput.trim());
  };

  const exportExcel = async () => {
    if (!partyId) return;
    try {
      const res = await api.get(`/ledger/export/excel/${partyId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${partyId}.xlsx`;
      a.click();
      toast.success('Excel exported!');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const rawEntries = statement?.entries ?? statement?.transactions ?? [];
  const entries: any[] = Array.isArray(rawEntries) ? rawEntries : [];
  const summary = statement?.summary || {};

  return (
    <AppShell title="Party Ledger">
      <div className="max-w-6xl space-y-6">
        {/* Search */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Select Party</h2>
          <div className="flex gap-3">
            <select
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a party —</option>
              {partyList.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {partyId && (
              <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition">
                <Download size={15} /> Export Excel
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {statement && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Opening Balance', value: summary.openingBalance ?? 0, prefix: '₹', color: 'text-slate-800' },
              { label: 'Total Credits', value: summary.totalCredits ?? 0, prefix: '₹', color: 'text-emerald-600' },
              { label: 'Total Debits', value: summary.totalDebits ?? 0, prefix: '₹', color: 'text-red-600' },
              { label: 'Closing Balance', value: summary.closingBalance ?? 0, prefix: '₹', color: Number(summary.closingBalance) >= 0 ? 'text-blue-600' : 'text-red-600' },
            ].map(({ label, value, prefix, color }) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>
                  {prefix}{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Ledger Table */}
        {partyId && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" />
                <h2 className="font-extrabold text-slate-900 text-sm">Account Statement Ledger</h2>
              </div>
              {isLoading && <span className="text-xs text-blue-600 font-bold">Loading...</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center align-middle border-collapse">
                <thead className="table-header-navy select-none">
                  <tr>
                    {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map((h, idx, arr) => (
                      <th key={h} className={`px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase ${idx < arr.length - 1 ? 'border-r border-slate-700/80' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white font-medium text-slate-800 align-middle">
                  {entries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center align-middle py-12 border-b border-slate-200">
                      <BookOpen size={36} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-600 font-semibold text-sm">{isLoading ? 'Loading ledger...' : 'No ledger entries found'}</p>
                    </td></tr>
                  ) : entries.map((e: any, idx: number) => (
                    <tr key={e.id || idx} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-semibold whitespace-nowrap">
                        {e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-900 font-semibold text-xs uppercase">{e.description || e.narration || '—'}</td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-xs font-semibold text-slate-700">{e.referenceNo || e.voucherNo || '—'}</td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-rose-700 font-mono font-semibold">
                        {e.debit > 0 ? Number(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-emerald-700 font-mono font-semibold">
                        {e.credit > 0 ? Number(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-center align-middle font-mono font-semibold ${Number(e.balance) >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        {e.balance != null ? Number(e.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!partyId && (
          <div className="card p-12 text-center">
            <BookOpen size={44} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Select a party to view their ledger</p>
            <p className="text-slate-400 text-sm mt-1">Choose a party from the dropdown above</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
