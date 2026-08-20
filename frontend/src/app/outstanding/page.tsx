'use client';
import React, { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Receipt, TrendingUp, AlertTriangle, RefreshCw, Upload, Download,
  ChevronRight, ChevronDown, Building2, Search, Filter, RotateCcw,
  X, Check, Calendar, ArrowUpRight, ArrowDownRight, FileSpreadsheet,
  Layers, User, Eye, Sparkles, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── HELPER: Currency Formatter ───────────────────────────────────────────────
const formatInr = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  if (val === 0) return '-';
  return Math.round(val).toLocaleString('en-IN');
};

const formatInrStrict = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
};

// ─── 1. UPLOAD OUTSTANDING EXCEL MODAL ────────────────────────────────────────
function UploadOutstandingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rewrite, setRewrite] = useState(true);
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select an Excel file');
      return;
    }

    setUploading(true);
    setLogs(['[Client] Preparing file upload: ' + file.name]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rewrite', String(rewrite));
      formData.append('month', String(month));
      formData.append('year', String(year));

      setLogs(prev => [...prev, `[Client] Uploading for Period: ${month}/${year}...`]);
      const res = await api.post('/outstanding/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLogs(prev => [
        ...prev,
        `[Server] ${res.data?.message || 'Upload processed successfully!'}`,
        `[Server] Processed: ${res.data?.processedCount || res.data?.data?.length || 'Records synchronized'}`,
      ]);
      toast.success('Outstanding master updated successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Upload failed';
      setLogs(prev => [...prev, `[Error] ${msg}`]);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d1b33] text-white">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-400" />
            <h2 className="font-bold text-base tracking-wide">Upload Outstanding Master (Excel)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4 text-xs">
          {/* File Input */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase mb-1">
              Select Excel File (.xlsx / .xls) <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Supports dynamic headers e.g. <i>Particulars, Pending Bills, &lt;7 Days, 7-14 Days, etc.</i>
            </p>
          </div>

          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Target Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Target Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </div>
          </div>

          {/* Overwrite vs Accumulate */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rewrite}
                onChange={(e) => setRewrite(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-bold text-slate-800">
                Overwrite / Replace existing records for selected period
              </span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1 ml-5">
              If checked, cleans previous month balance records before inserting new file data.
            </p>
          </div>

          {/* Terminal Logs Window */}
          {logs.length > 0 && (
            <div className="p-3 bg-slate-900 text-sky-400 font-mono text-[11px] rounded-xl max-h-32 overflow-y-auto space-y-1 border border-slate-800">
              {logs.map((log, i) => (
                <p key={i}>{log}</p>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{uploading ? 'Processing...' : 'Upload & Sync'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN ADVANCED OUTSTANDING REGISTRY COMPONENT ─────────────────────────────
export default function AdvancedOutstandingRegistryPage() {
  const { isBranchUser, userBranch, isSuperAdmin, user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(8);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minOutstanding, setMinOutstanding] = useState('');
  const [maxOutstanding, setMaxOutstanding] = useState('');

  // Expand / Collapse branch groups state
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSyncingTally, setIsSyncingTally] = useState(false);

  const effectiveBranch = isBranchUser && userBranch ? userBranch : branchFilter;

  // Fetch live outstanding records
  const { data: rawItems, mutate, isLoading } = useSWR(
    `/outstanding?month=${selectedMonth}&year=${selectedYear}&branchFilter=${effectiveBranch}`,
    fetcher
  );

  const items: any[] = useMemo(() => (Array.isArray(rawItems) ? rawItems : []), [rawItems]);

  // Aggregate executive metrics
  const metrics = useMemo(() => {
    const totalOutstanding = items.reduce((sum, x) => sum + (Number(x.outstanding) || 0), 0);
    const overdue = items.reduce(
      (sum, x) =>
        sum +
        (Number(x.outstanding28To35Days) || 0) +
        (Number(x.outstanding35To50Days) || 0) +
        (Number(x.outstanding50To80Days) || 0) +
        (Number(x.outstandingMore80Days) || 0),
      0
    );
    const overduePercent = totalOutstanding > 0 ? Math.round((overdue * 100) / totalOutstanding) : 0;
    const collectionEfficiency = totalOutstanding > 0 ? Math.max(0, 100 - overduePercent) : 100;
    const activeDealers = items.filter(x => Number(x.outstanding) > 0).length;

    return { totalOutstanding, overdue, overduePercent, collectionEfficiency, activeDealers };
  }, [items]);

  // Distinct branches for dropdown
  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(x => {
      if (x.branchCode) set.add(x.branchCode);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [items]);

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter(x => {
      if (branchFilter !== 'ALL' && x.branchCode !== branchFilter) return false;

      const amt = Number(x.outstanding) || 0;
      if (minOutstanding && amt < Number(minOutstanding)) return false;
      if (maxOutstanding && amt > Number(maxOutstanding)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (x.partyCode || '').toLowerCase();
        const name = (x.partyName || '').toLowerCase();
        const br = (x.branchName || x.branchCode || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !br.includes(q)) return false;
      }

      return true;
    });
  }, [items, branchFilter, minOutstanding, maxOutstanding, searchQuery]);

  // Group items by Branch
  const branchGroups = useMemo(() => {
    const map = new Map<string, { branchCode: string; branchName: string; dealers: any[] }>();
    filteredItems.forEach(x => {
      const code = x.branchCode || 'OTHER';
      const name = x.branchName || x.branchCode || 'General';
      if (!map.has(code)) {
        map.set(code, { branchCode: code, branchName: name, dealers: [] });
      }
      map.get(code)!.dealers.push(x);
    });
    return Array.from(map.values()).sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [filteredItems]);

  // Toggle Branch Collapsed
  const toggleBranch = (code: string) => {
    const next = new Set(collapsedBranches);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setCollapsedBranches(next);
  };

  // Expand All / Collapse All
  const expandAll = () => setCollapsedBranches(new Set());
  const collapseAll = () => {
    const allCodes = new Set(branchGroups.map(g => g.branchCode));
    setCollapsedBranches(allCodes);
  };

  // Trigger Tally Sync
  const handleSyncTally = async () => {
    setIsSyncingTally(true);
    try {
      await api.post('/outstanding/sync', { month: selectedMonth, year: selectedYear });
      toast.success('Tally Gateway sync completed!');
      mutate();
    } catch {
      toast.error('Tally Gateway is currently offline');
    } finally {
      setIsSyncingTally(false);
    }
  };

  // Export to Excel
  const handleExport = () => {
    try {
      const rows = filteredItems.map((x, idx) => ({
        '#': idx + 1,
        'Branch Code': x.branchCode,
        'Branch Name': x.branchName || x.branchCode,
        'Party Code': x.partyCode,
        'Party Name': x.partyName,
        'Pending Bills': Number(x.outstanding) || 0,
        '< 7 Days': Number(x.outstandingLess7Days) || 0,
        '7 to 14 Days': Number(x.outstanding7To14Days) || 0,
        '14 to 21 Days': Number(x.outstanding14To21Days) || 0,
        '21 to 28 Days': Number(x.outstanding21To28Days) || 0,
        '28 to 35 Days': Number(x.outstanding28To35Days) || 0,
        '35 to 50 Days': Number(x.outstanding35To50Days) || 0,
        '50 to 80 Days': Number(x.outstanding50To80Days) || 0,
        '> 80 Days': Number(x.outstandingMore80Days) || 0,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Outstanding Ageing');
      XLSX.writeFile(wb, `Outstanding_Master_${selectedMonth}_${selectedYear}.xlsx`);
      toast.success('Outstanding Ageing report exported!');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <AppShell title="Party Wise Outstanding" breadcrumb="Financial & Ledger">
      {/* Upload Modal */}
      {isUploadModalOpen && (
        <UploadOutstandingModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => mutate()}
        />
      )}

      <div className="space-y-4 max-w-full">
        {/* 1. EXECUTIVE BENTO METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Outstanding */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-blue-600 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                TOTAL OUTSTANDING
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                ₹
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 leading-tight">
              {formatInrStrict(metrics.totalOutstanding)}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-medium">
              <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                <TrendingUp size={11} /> {metrics.activeDealers} Active Accounts
              </span>
              <span>across branch networks</span>
            </div>
          </div>

          {/* Card 2: Overdue (>28 Days) */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-rose-500 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                OVERDUE (&gt;28 DAYS)
              </span>
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle size={15} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-rose-600 leading-tight">
              {formatInrStrict(metrics.overdue)}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-medium">
              <span className="inline-flex items-center gap-0.5 text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-bold">
                {metrics.overduePercent}%
              </span>
              <span>of total pending portfolio</span>
            </div>
          </div>

          {/* Card 3: Collection Efficiency & Tally Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  EFFICIENCY
                </span>
                <p className="text-xl font-extrabold text-blue-900">{metrics.collectionEfficiency}%</p>
              </div>
              <div className="w-10 h-10">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeDasharray={`${metrics.collectionEfficiency}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-tr from-blue-50 to-indigo-50/80 rounded-xl p-3.5 shadow-sm border border-blue-200 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-blue-900 uppercase">TALLY SYNC</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">Live Connected</p>
              <p className="text-[10px] text-blue-700 mt-0.5 font-mono">Real-Time SSOT</p>
            </div>
          </div>
        </div>

        {/* 2. ADVANCED TOOLBAR & FILTERS */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-slate-800"
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period Selector — SuperAdmin Only */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-md">
                <Calendar size={15} className="text-blue-600 shrink-0" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-100 text-slate-900 font-extrabold text-xs focus:outline-none cursor-pointer rounded-lg px-2 py-1 border border-slate-300"
                >
                  <option value={1} className="text-slate-900 bg-white">Jan</option>
                  <option value={2} className="text-slate-900 bg-white">Feb</option>
                  <option value={3} className="text-slate-900 bg-white">Mar</option>
                  <option value={4} className="text-slate-900 bg-white">Apr</option>
                  <option value={5} className="text-slate-900 bg-white">May</option>
                  <option value={6} className="text-slate-900 bg-white">Jun</option>
                  <option value={7} className="text-slate-900 bg-white">Jul</option>
                  <option value={8} className="text-slate-900 bg-white">Aug</option>
                  <option value={9} className="text-slate-900 bg-white">Sep</option>
                  <option value={10} className="text-slate-900 bg-white">Oct</option>
                  <option value={11} className="text-slate-900 bg-white">Nov</option>
                  <option value={12} className="text-slate-900 bg-white">Dec</option>
                </select>
                {/* Year */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-100 text-slate-900 font-extrabold text-xs focus:outline-none cursor-pointer rounded-lg px-2 py-1 border border-slate-300"
                >
                  <option value={2026} className="text-slate-900 bg-white">2026</option>
                  <option value={2025} className="text-slate-900 bg-white">2025</option>
                  <option value={2024} className="text-slate-900 bg-white">2024</option>
                </select>
              </div>
            )}

            {/* Branch Filter */}
            {isSuperAdmin ? (
              <div className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-md">
                <Building2 size={15} className="text-blue-600 shrink-0" />
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Branches ({branchOptions.length - 1})</option>
                  {branchOptions.filter(b => b !== 'ALL').map(b => (
                    <option key={b} value={b} className="text-slate-900 bg-white">{b}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 rounded-2xl px-3.5 py-2 text-xs font-black shadow-md font-mono">
                <Lock size={13} className="text-slate-950" />
                <span>Branch: {userBranch || user?.branchCode || 'BSE'}</span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Dealer or Code..."
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-900 font-extrabold placeholder-slate-400 rounded-2xl text-xs w-56 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Expand / Collapse buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={expandAll}
                className="px-3 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-extrabold transition shadow-md border border-slate-200"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-extrabold transition shadow-md border border-slate-200"
              >
                Collapse
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncTally}
              disabled={isSyncingTally}
              className="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-md disabled:opacity-60"
            >
              <RefreshCw size={14} className={isSyncingTally ? 'animate-spin' : ''} />
              <span>{isSyncingTally ? 'Syncing...' : 'Sync Tally'}</span>
            </button>

            <button
              onClick={handleExport}
              className="px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-blue-600 font-extrabold text-xs flex items-center gap-1.5 transition shadow-md border border-slate-200"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-md"
              >
                <Upload size={13} />
                <span>Upload Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. GROUPED OUTSTANDING TABLE WITH HIGH VISIBILITY ENTERPRISE GRID */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center align-middle border-collapse">
              {/* Deep Navy Header matching Reference Design (#0A122C) */}
              <thead className="table-header-navy select-none sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase whitespace-nowrap min-w-[240px] text-left border-r border-slate-700/80">
                    BRANCH / PARTICULARS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase whitespace-nowrap min-w-[130px] border-r border-slate-700/80">
                    PARTY CODE
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap min-w-[120px] border-r border-slate-700/80">
                    PENDING BILLS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    &lt; 7 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    7 TO 14 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    14 TO 21 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    21 TO 28 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    28 TO 35 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    35 TO 50 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    50 TO 80 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap border-r border-slate-700/80">
                    &gt; 80 DAYS
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-white uppercase text-center whitespace-nowrap">
                    ACTIONS
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <span>Loading Outstanding Master Registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : branchGroups.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Receipt size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="font-semibold text-slate-600">No outstanding records found for this period.</p>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                      >
                        Upload Outstanding Excel File
                      </button>
                    </td>
                  </tr>
                ) : (
                  branchGroups.map(g => {
                    const isCollapsed = collapsedBranches.has(g.branchCode);
                    const branchTotal = g.dealers.reduce((s, x) => s + (Number(x.outstanding) || 0), 0);
                    const less7 = g.dealers.reduce((s, x) => s + (Number(x.outstandingLess7Days) || 0), 0);
                    const d7To14 = g.dealers.reduce((s, x) => s + (Number(x.outstanding7To14Days) || 0), 0);
                    const d14To21 = g.dealers.reduce((s, x) => s + (Number(x.outstanding14To21Days) || 0), 0);
                    const d21To28 = g.dealers.reduce((s, x) => s + (Number(x.outstanding21To28Days) || 0), 0);
                    const d28To35 = g.dealers.reduce((s, x) => s + (Number(x.outstanding28To35Days) || 0), 0);
                    const d35To50 = g.dealers.reduce((s, x) => s + (Number(x.outstanding35To50Days) || 0), 0);
                    const d50To80 = g.dealers.reduce((s, x) => s + (Number(x.outstanding50To80Days) || 0), 0);
                    const dMore80 = g.dealers.reduce((s, x) => s + (Number(x.outstandingMore80Days) || 0), 0);

                    return (
                      <React.Fragment key={g.branchCode}>
                        {/* Branch Summary Header Row */}
                        <tr
                          onClick={() => toggleBranch(g.branchCode)}
                          className="bg-blue-50/70 hover:bg-blue-100/70 cursor-pointer border-y border-blue-200/80 transition-colors select-none"
                        >
                          <td className="px-3 py-2.5 sticky left-0 z-10 bg-inherit flex items-center gap-2 border-r border-slate-200">
                            <span className="p-0.5 rounded text-blue-600 transition">
                              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                            </span>
                            <span className="text-blue-950 font-bold text-xs">{g.branchName}</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold border border-blue-200">
                              {g.dealers.length} Dealer{g.dealers.length > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500 font-mono text-[11px] border-r border-slate-200">{g.branchCode}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-blue-950 font-mono text-xs border-r border-slate-200">
                            {formatInr(branchTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(less7)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d7To14)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d14To21)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d21To28)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d28To35)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d35To50)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-800 font-semibold font-mono text-xs border-r border-slate-200">
                            {formatInr(d50To80)}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono border-r border-slate-200">
                            {dMore80 > 0 ? (
                              <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                                {formatInr(dMore80)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500 text-xs">
                            {isCollapsed ? 'Expand' : 'Collapse'}
                          </td>
                        </tr>

                        {/* Child Dealer Rows */}
                        {!isCollapsed &&
                          g.dealers.map((d, dIdx) => {
                            const name = d.partyName || 'Unknown Dealer';
                            const code = d.partyCode || '-';
                            const amt = Number(d.outstanding) || 0;
                            const m80 = Number(d.outstandingMore80Days) || 0;

                            return (
                              <tr
                                key={d.id || `${code}_${dIdx}`}
                                className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${dIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                              >
                                <td className="px-3 py-2.5 text-left align-middle border-r border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-semibold text-[10px] flex items-center justify-center shrink-0">
                                      {name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-semibold text-slate-900 uppercase text-xs truncate max-w-[220px]" title={name}>
                                      {name}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold text-[11px] border border-blue-200">
                                    {code}
                                  </span>
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900 text-xs">
                                  {formatInr(amt)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstandingLess7Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding7To14Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding14To21Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding21To28Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding28To35Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding35To50Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-medium font-mono text-xs">
                                  {formatInr(d.outstanding50To80Days)}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-xs">
                                  {m80 > 0 ? (
                                    <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                                      {formatInr(m80)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-medium">-</span>
                                  )}
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle whitespace-nowrap">
                                  <a
                                    href={`/parties?search=${encodeURIComponent(code)}`}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition inline-flex"
                                    title="View Dealer 360"
                                  >
                                    <Eye size={14} />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Grand Total Summary Row */}
              {branchGroups.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-blue-500 sticky bottom-0 z-20">
                  <tr>
                    <td className="px-3 py-3 text-left uppercase tracking-wider text-[11px] font-semibold text-blue-300 sticky left-0 z-30 bg-slate-900 border-r border-slate-700/80">
                      GRAND TOTAL ({filteredItems.length} DEALERS)
                    </td>
                    <td className="px-3 py-3 border-r border-slate-700/80"></td>
                    <td className="px-3 py-3 text-center text-amber-400 font-mono text-xs font-bold border-r border-slate-700/80">
                      {formatInrStrict(metrics.totalOutstanding)}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstandingLess7Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding7To14Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding14To21Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding21To28Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding28To35Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding35To50Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-white font-mono text-xs font-medium border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstanding50To80Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center text-rose-300 font-mono text-xs font-bold border-r border-slate-700/80">
                      {formatInr(filteredItems.reduce((s, x) => s + (Number(x.outstandingMore80Days) || 0), 0))}
                    </td>
                    <td className="px-3 py-3 text-center"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
