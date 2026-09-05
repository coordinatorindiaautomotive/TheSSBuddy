'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Search, Download, TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { Button, StatCard, Pagination } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function LedgerPage() {
  const [partyId, setPartyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
    setCurrentPage(1);
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

  const paginatedEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AppShell title="Party Ledger" breadcrumb="Financial & Accounting">
      <div className="space-y-4 max-w-full">
        {/* Party Selector Toolbar */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              SELECT PARTY ACCOUNT
            </label>
            <select
              value={partyId}
              onChange={e => { setPartyId(e.target.value); setCurrentPage(1); }}
              className="input-enterprise w-full cursor-pointer font-medium"
            >
              <option value="">— Select a party to view ledger statement —</option>
              {partyList.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {partyId && (
            <div className="flex items-center gap-2 pt-2 sm:pt-4">
              <Button
                variant="secondary"
                size="md"
                onClick={exportExcel}
                icon={<Download size={14} className="text-slate-600" />}
              >
                Export Excel
              </Button>
            </div>
          )}
        </div>

        {/* Summary Metric Cards */}
        {statement && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
            <StatCard
              title="Opening Balance"
              value={`₹${Number(summary.openingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              subtitle="Initial statement period"
              icon={<Scale size={16} />}
            />
            <StatCard
              title="Total Credits"
              value={`₹${Number(summary.totalCredits ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              subtitle="Inward payments & adjustments"
              icon={<ArrowDownLeft size={16} />}
              trend={{ value: 'Credits', isPositive: true }}
            />
            <StatCard
              title="Total Debits"
              value={`₹${Number(summary.totalDebits ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              subtitle="Invoiced sales & charges"
              icon={<ArrowUpRight size={16} />}
            />
            <StatCard
              title="Closing Balance"
              value={`₹${Number(summary.closingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              subtitle="Net balance position"
              icon={<BookOpen size={16} />}
              trend={{ value: Number(summary.closingBalance) >= 0 ? 'Surplus' : 'Due', isPositive: Number(summary.closingBalance) >= 0 }}
            />
          </div>
        )}

        {/* Ledger Table */}
        {partyId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-[#053D3A]" />
                <h2 className="font-bold text-slate-900 text-xs">Account Statement Ledger ({entries.length} records)</h2>
              </div>
              {isLoading && <span className="text-xs text-[#053D3A] font-bold">Loading ledger...</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="table-enterprise text-center align-middle">
                <thead className="select-none">
                  <tr>
                    {['Date', 'Description', 'Reference', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'].map((h, idx, arr) => (
                      <th key={h} className={`px-4 py-3 text-center align-middle text-[11px] font-bold uppercase tracking-wider text-white ${idx < arr.length - 1 ? 'border-r border-white/10' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white font-medium text-slate-800 align-middle">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center align-middle py-12 border-b border-slate-200">
                        <BookOpen size={36} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-600 font-semibold text-xs">{isLoading ? 'Loading ledger...' : 'No ledger entries found for this party.'}</p>
                      </td>
                    </tr>
                  ) : paginatedEntries.map((e: any, idx: number) => (
                    <tr key={e.id || idx} className={`hover:bg-slate-50 transition border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-700 font-mono font-semibold whitespace-nowrap">
                        {e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-slate-900 font-bold text-xs uppercase">{e.description || e.narration || '—'}</td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-xs font-semibold text-slate-700">{e.referenceNo || e.voucherNo || '—'}</td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-rose-700 font-mono font-bold">
                        {e.debit > 0 ? Number(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 text-emerald-700 font-mono font-bold">
                        {e.credit > 0 ? Number(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-center align-middle font-mono font-bold ${Number(e.balance) >= 0 ? 'text-[#053D3A]' : 'text-rose-700'}`}>
                        {e.balance != null ? Number(e.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {entries.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={entries.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                itemName="entries"
              />
            )}
          </div>
        )}

        {!partyId && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <BookOpen size={44} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-bold text-sm">Select a party to view their ledger</p>
            <p className="text-slate-400 text-xs mt-1">Choose a customer, dealer, or distributor account from the dropdown above.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
