'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Target, TrendingUp, TrendingDown, Building2, Calendar, Filter,
  Download, Eye, EyeOff, Sliders, RefreshCw, Search, Edit3, X,
  Check, ArrowUpRight, ArrowDownRight, Layers, Users, ChevronDown,
  Sparkles, ShieldCheck, DollarSign, BarChart3, Info, ArrowUpDown,
  CheckCircle2, AlertTriangle, XCircle, ChevronRight, Lock, Unlock,
  SlidersHorizontal, Calculator, Scale, PieChart, ShieldAlert, Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Badge, StatCard, Pagination } from '@/components/ui';
import {
  EditTargetModal,
  BulkTargetModal,
  Dealer360Drawer,
  TargetEngineStudioDrawer,
} from '@/components/target-achievement';

function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

const formatLakhs = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '0.00 Lakhs';
  const inLakhs = val / 100000;
  return `${inLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lakhs`;
};

const DEFAULT_PARTY_TYPES = [
  'MASS',
  'INDEPENDENT WORKSHOP',
  'TRADER/RETAILER',
  'WALK-IN CUSTOMER',
];

const ALL_POSSIBLE_PARTY_TYPES = [
  'MASS',
  'INDEPENDENT WORKSHOP',
  'TRADER/RETAILER',
  'WALK-IN CUSTOMER',
  'CO-DEALER',
  'CO-DISTRIBUTOR',
  'FINANCIER',
];

type SortField = 'rank' | 'currentSales' | 'finalTarget' | 'achievementPercent' | 'ytdSales' | 'yoyGrowthPercent' | 'partyName' | 'branchCode' | 'weightedBase';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'ACHIEVED' | 'ON_TRACK' | 'UNDER';

export default function TargetVsAchievementPage() {
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [month, setMonth] = useState<string>('Aug');
  const [branchCode, setBranchCode] = useState<string>('ALL');
  const [selectedPartyTypes, setSelectedPartyTypes] = useState<string[]>(DEFAULT_PARTY_TYPES);
  const [partCategory, setPartCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('currentSales');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [showPartyTypeDropdown, setShowPartyTypeDropdown] = useState<boolean>(false);
  const [partyDropdownPos, setPartyDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const partyTypeBtnRef = useRef<HTMLButtonElement>(null);

  const togglePartyDropdown = () => {
    if (!showPartyTypeDropdown && partyTypeBtnRef.current) {
      const rect = partyTypeBtnRef.current.getBoundingClientRect();
      setPartyDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
      });
    }
    setShowPartyTypeDropdown(!showPartyTypeDropdown);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        partyTypeBtnRef.current &&
        !partyTypeBtnRef.current.contains(e.target as Node)
      ) {
        const dropdownEl = document.getElementById('party-type-dropdown-portal');
        if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
          setShowPartyTypeDropdown(false);
        }
      }
    };
    if (showPartyTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPartyTypeDropdown]);

  const [showTargetCols, setShowTargetCols] = useState<boolean>(true);
  const [showWeightedBreakdown, setShowWeightedBreakdown] = useState<boolean>(false);

  // Target Engine Studio Drawer State
  const [engineDrawer, setEngineDrawer] = useState<boolean>(false);
  const [lyWeight, setLyWeight] = useState<number>(40);
  const [lmWeight, setLmWeight] = useState<number>(25);
  const [lqWeight, setLqWeight] = useState<number>(20);
  const [lfyWeight, setLfyWeight] = useState<number>(15);
  const [growthPercent, setGrowthPercent] = useState<number>(10);
  const [floorMultiplier, setFloorMultiplier] = useState<number>(1.15);

  // Edit Target Modal State
  const [editModal, setEditModal] = useState<{
    open: boolean;
    row?: any;
    targetValue?: string | number;
  }>({ open: false });
  const [savingTarget, setSavingTarget] = useState<boolean>(false);

  // Bulk Target Modal State
  const [bulkModal, setBulkModal] = useState<boolean>(false);
  const [bulkFlatAmount, setBulkFlatAmount] = useState<string>('100000');
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);

  // Dealer 360 Drawer State
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  const queryPartyTypes = useMemo(() => {
    if (selectedPartyTypes.length === 0 || selectedPartyTypes.length === ALL_POSSIBLE_PARTY_TYPES.length) {
      return 'ALL';
    }
    return selectedPartyTypes.join(',');
  }, [selectedPartyTypes]);

  // Dynamic Month & Year Period Labels
  const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const monthIdx = MONTH_ORDER.indexOf(month) >= 0 ? MONTH_ORDER.indexOf(month) : 4;
  const prevMonthName = monthIdx === 0 ? 'Mar' : MONTH_ORDER[monthIdx - 1];
  const prevMonthYear = monthIdx === 0 ? fiscalYear - 1 : fiscalYear;

  const shortYear = String(fiscalYear).slice(-2);
  const prevShortYear = String(fiscalYear - 1).slice(-2);
  const prevMonthShortYear = String(prevMonthYear).slice(-2);

  const currentPeriodLabel = `${month}'${shortYear}`;
  const prevPeriodLabel = `${prevMonthName}'${prevMonthShortYear}`;
  const lyPeriodLabel = `${month}'${prevShortYear}`;
  const { isSuperAdmin, isBranchUser, userBranch, user } = useAuth();
  const effectiveBranchCode = isSuperAdmin ? branchCode : (userBranch || user?.branchCode || 'BSE');
  const effectiveFiscalYear = isSuperAdmin ? fiscalYear : 2026;

  const ytdLabel = `FY${shortYear} YTD`;

  const queryParams = new URLSearchParams({
    fiscalYear: String(effectiveFiscalYear),
    month,
    branchCode: effectiveBranchCode,
    partyType: queryPartyTypes,
    partCategoryCode: partCategory,
    pageSize: '5000',
  }).toString();

  const { data, mutate, isLoading } = useSWR(
    `/reports/target-vs-achievement?${queryParams}`,
    fetcher
  );

  const { data: dashboardData } = useSWR('/dashboard/executive-kpis', fetcher);
  const branchesList = dashboardData?.filters?.branches || [];

  const rawRows: any[] = useMemo(() => data?.items || data?.data || [], [data]);
  const summary = data?.summary || {};
  const guardrail = summary?.guardrail || {};
  const isLocked = summary?.targetStatus === 'LOCKED';

  const statusCounts = useMemo(() => {
    let achieved = 0;
    let onTrack = 0;
    let under = 0;
    rawRows.forEach((r) => {
      const ach = r.achievementPercent || 0;
      if (ach >= 100) achieved++;
      else if (ach >= 70) onTrack++;
      else under++;
    });
    return { all: rawRows.length, achieved, onTrack, under };
  }, [rawRows]);

  const processedRows = useMemo(() => {
    let list = [...rawRows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.partyCode && r.partyCode.toLowerCase().includes(q)) ||
          (r.partyName && r.partyName.toLowerCase().includes(q)) ||
          (r.branchCode && r.branchCode.toLowerCase().includes(q)) ||
          (r.branchName && r.branchName.toLowerCase().includes(q)) ||
          (r.executiveName && r.executiveName.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'ACHIEVED') {
      list = list.filter((r) => r.achievementPercent >= 100);
    } else if (statusFilter === 'ON_TRACK') {
      list = list.filter((r) => r.achievementPercent >= 70 && r.achievementPercent < 100);
    } else if (statusFilter === 'UNDER') {
      list = list.filter((r) => r.achievementPercent < 70);
    }

    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [rawRows, search, statusFilter, sortField, sortOrder]);

  const totalCount = processedRows.length;
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return processedRows;
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const togglePartyType = (pt: string) => {
    setSelectedPartyTypes((prev) =>
      prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]
    );
    setPage(1);
  };

  const resetPartyTypesToDefault = () => {
    setSelectedPartyTypes(DEFAULT_PARTY_TYPES);
    toast.success('Reset to default 4 party types');
    setPage(1);
  };

  const selectAllPartyTypes = () => {
    setSelectedPartyTypes(ALL_POSSIBLE_PARTY_TYPES);
    toast.success('Selected all party types');
    setPage(1);
  };

  const handleRunWeightedEngine = async () => {
    const totalWeights = Number(lyWeight) + Number(lmWeight) + Number(lqWeight) + Number(lfyWeight);
    if (totalWeights !== 100) {
      toast.error(`Weights must sum to 100% (Current sum: ${totalWeights}%)`);
      return;
    }

    setIsRecalculating(true);
    const toastId = toast.loading(`Executing Target Engine (${lyWeight}% LY, ${lmWeight}% LM, ${lqWeight}% LQ, ${lfyWeight}% LFY) + Guardrail Floor...`);
    try {
      const res = await api.post('/reports/target-vs-achievement/refresh', {
        fiscalYear,
        month,
        lyWeight: Number(lyWeight) / 100,
        lmWeight: Number(lmWeight) / 100,
        lqWeight: Number(lqWeight) / 100,
        lfyWeight: Number(lfyWeight) / 100,
        growthPercent: Number(growthPercent),
        floorMultiplier: Number(floorMultiplier),
      });

      const g = res.data?.guardrail;
      toast.success(
        `Target Engine calculated ${res.data?.count || 0} parties! Status: ${g?.status || 'OPTIMIZED'}`,
        { id: toastId, duration: 4000 }
      );
      setEngineDrawer(false);
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Target Engine execution failed', { id: toastId });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleToggleLock = async () => {
    if (isLocked) {
      const confirmed = window.confirm(`Unlock target matrix for ${month} ${fiscalYear} back to DRAFT state?`);
      if (!confirmed) return;
      try {
        await api.post('/reports/target-engine/unlock', { fiscalYear, month });
        toast.success('Target Matrix unlocked to DRAFT state');
        mutate();
      } catch (err: any) {
        toast.error('Failed to unlock target matrix');
      }
    } else {
      const confirmed = window.confirm(
        `Approve & Lock Final Targets for ${month} ${fiscalYear}?\n\nOnce locked, incentive schemes and sales benchmarks will strictly bind to these targets.`
      );
      if (!confirmed) return;
      try {
        await api.post('/reports/target-engine/lock', { fiscalYear, month });
        toast.success(`Targets for ${month} ${fiscalYear} APPROVED & LOCKED!`);
        mutate();
      } catch (err: any) {
        toast.error('Failed to lock target matrix');
      }
    }
  };

  const handleSaveSingleTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.row) return;

    setSavingTarget(true);
    try {
      await api.post('/reports/target-vs-achievement/update-target', {
        partyCode: editModal.row.partyCode,
        partyName: editModal.row.partyName,
        branchCode: editModal.row.branchCode,
        fiscalYear,
        month,
        targetAmount: Number(editModal.targetValue) || 0,
      });

      toast.success(`Target updated for ${editModal.row.partyName}`);
      setEditModal({ open: false });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update target');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleSaveBulkTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processedRows.length === 0) {
      toast.error('No dealers in current filtered view');
      return;
    }

    setBulkSaving(true);
    try {
      const partyCodes = processedRows.map((r) => r.partyCode);
      await api.post('/reports/target-vs-achievement/bulk-target', {
        fiscalYear,
        month,
        flatTargetAmount: Number(bulkFlatAmount) || 0,
        partyCodes,
      });

      toast.success(`Bulk targets applied to ${partyCodes.length} dealers`);
      setBulkModal(false);
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to apply bulk targets');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading('Generating Target vs Achievement Excel export...');
    try {
      const res = await api.get(`/reports/export/excel?type=target_vs_achievement&${queryParams}`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.setAttribute('download', `target_vs_achievement_${month}_${fiscalYear}.xlsx`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Excel report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to download Excel report', { id: toastId });
    }
  };

  return (
    <AppShell title="Party Wise Performance" breadcrumb="Corporate Intelligence">
      {/* 1. Target Engine Studio Drawer */}
      <TargetEngineStudioDrawer
        isOpen={engineDrawer}
        onClose={() => setEngineDrawer(false)}
        lyWeight={lyWeight}
        setLyWeight={setLyWeight}
        lmWeight={lmWeight}
        setLmWeight={setLmWeight}
        lqWeight={lqWeight}
        setLqWeight={setLqWeight}
        lfyWeight={lfyWeight}
        setLfyWeight={setLfyWeight}
        growthPercent={growthPercent}
        setGrowthPercent={setGrowthPercent}
        floorMultiplier={floorMultiplier}
        setFloorMultiplier={setFloorMultiplier}
        guardrail={guardrail}
        isRecalculating={isRecalculating}
        onRunEngine={handleRunWeightedEngine}
        currentPeriodLabel={currentPeriodLabel}
        prevPeriodLabel={prevPeriodLabel}
        lyPeriodLabel={lyPeriodLabel}
        formatLakhs={formatLakhs}
      />

      {/* 2. Edit Target Modal */}
      <EditTargetModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false })}
        row={editModal.row}
        targetValue={editModal.targetValue || ''}
        setTargetValue={(val) => setEditModal((prev) => ({ ...prev, targetValue: val }))}
        onSave={handleSaveSingleTarget}
        savingTarget={savingTarget}
        currentPeriodLabel={currentPeriodLabel}
      />

      {/* 3. Bulk Target Modal */}
      <BulkTargetModal
        isOpen={bulkModal}
        onClose={() => setBulkModal(false)}
        bulkFlatAmount={bulkFlatAmount}
        setBulkFlatAmount={setBulkFlatAmount}
        onSave={handleSaveBulkTarget}
        bulkSaving={bulkSaving}
        currentPeriodLabel={currentPeriodLabel}
        dealerCount={processedRows.length}
      />

      {/* 4. Dealer 360 Drawer */}
      <Dealer360Drawer
        dealer={selectedDealer}
        onClose={() => setSelectedDealer(null)}
        onEditTarget={(dealer) => {
          setEditModal({
            open: true,
            row: dealer,
            targetValue: dealer.adminDefinedTarget || Math.round(dealer.finalTarget),
          });
          setSelectedDealer(null);
        }}
        currentPeriodLabel={currentPeriodLabel}
        prevPeriodLabel={prevPeriodLabel}
        lyPeriodLabel={lyPeriodLabel}
      />

      <div className="space-y-4 max-w-full">
        {/* Top Control Toolbar */}
        <div className="bg-white text-slate-800 rounded-2xl p-3 shadow-sm relative z-30 border border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <Calendar size={14} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-600 uppercase">Period:</span>
                  <select
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      setPage(1);
                    }}
                    className="bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="text-xs font-bold text-slate-600 uppercase">FY:</span>
                  <select
                    value={fiscalYear}
                    onChange={(e) => {
                      setFiscalYear(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value={2026}>FY 2026</option>
                    <option value={2025}>FY 2025</option>
                    <option value={2024}>FY 2024</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Building2 size={14} className="text-blue-600 shrink-0" />
              {isSuperAdmin ? (
                <select
                  value={branchCode}
                  onChange={(e) => {
                    setBranchCode(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All 35 Branches</option>
                  {branchesList.map((b: any) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-bold text-slate-900 font-mono flex items-center gap-1">
                  <Lock size={12} className="text-slate-700" /> {userBranch || user?.branchCode || 'BSE'}
                </span>
              )}
            </div>

            {/* Party Types Dropdown Trigger */}
            <div className="relative">
              <button
                ref={partyTypeBtnRef}
                type="button"
                onClick={togglePartyDropdown}
                className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-100 transition cursor-pointer"
              >
                <Users size={14} className="text-blue-600" />
                <span>
                  Types: <strong>{selectedPartyTypes.length === ALL_POSSIBLE_PARTY_TYPES.length ? 'All' : `${selectedPartyTypes.length} Selected`}</strong>
                </span>
                <ChevronDown size={13} className="text-slate-500" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search dealer, code..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEngineDrawer(true)}
                  icon={<Sliders size={14} className="text-purple-600" />}
                >
                  Target Engine
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkModal(true)}
                  icon={<Edit3 size={14} className="text-blue-600" />}
                >
                  Bulk Target
                </Button>
                <Button
                  variant={isLocked ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={handleToggleLock}
                  icon={isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                >
                  {isLocked ? 'Locked' : 'Draft Mode'}
                </Button>
              </>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              icon={<Download size={14} className="text-slate-600" />}
            >
              Export
            </Button>
          </div>
        </div>

        {/* Party Types Portal Dropdown */}
        {showPartyTypeDropdown && (
          <ClientPortal>
            <div
              id="party-type-dropdown-portal"
              style={{ top: `${partyDropdownPos.top}px`, left: `${partyDropdownPos.left}px` }}
              className="fixed z-[9999] w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase">Party Types Filter</span>
                <button onClick={() => setShowPartyTypeDropdown(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {ALL_POSSIBLE_PARTY_TYPES.map((pt) => (
                  <label key={pt} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedPartyTypes.includes(pt)}
                      onChange={() => togglePartyType(pt)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>{pt}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs font-bold">
                <button onClick={selectAllPartyTypes} className="text-blue-600 hover:underline">Select All</button>
                <button onClick={resetPartyTypesToDefault} className="text-slate-600 hover:underline">Reset Defaults</button>
              </div>
            </div>
          </ClientPortal>
        )}

        {/* 6 High-Impact Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <StatCard
            title="Total Sales"
            value={`₹${((summary.totalCurrentSales || 0) / 100000).toFixed(2)}L`}
            subtitle={`${currentPeriodLabel} Total Achieved`}
            icon={<DollarSign size={16} />}
          />
          <StatCard
            title="Final Target"
            value={`₹${((summary.totalFinalTarget || 0) / 100000).toFixed(2)}L`}
            subtitle={`${currentPeriodLabel} Budgeted Target`}
            icon={<Target size={16} />}
          />
          <StatCard
            title="Achievement %"
            value={`${summary.overallAchievementPercent || 0}%`}
            subtitle="Overall Fulfillment"
            icon={<TrendingUp size={16} />}
            trend={{ value: `${summary.overallAchievementPercent || 0}%`, isPositive: (summary.overallAchievementPercent || 0) >= 100 }}
          />
          <StatCard
            title="Achieved (>=100%)"
            value={statusCounts.achieved}
            subtitle="Dealers on Target"
            icon={<CheckCircle2 size={16} />}
          />
          <StatCard
            title="On Track (70-99%)"
            value={statusCounts.onTrack}
            subtitle="Approaching Target"
            icon={<AlertTriangle size={16} />}
          />
          <StatCard
            title="Under (<70%)"
            value={statusCounts.under}
            subtitle="Requires Intervention"
            icon={<XCircle size={16} />}
          />
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 relative overflow-hidden">
          <div className="w-full max-h-[72vh] overflow-y-auto pb-20">
            <table className="w-full text-xs text-center align-middle border-collapse">
              <thead className="sticky top-0 z-20 bg-[#003366] text-white select-none shadow-sm border-b-[2.5px] border-[#ED1C24]">
                <tr className="border-b border-slate-800">
                  <th onClick={() => handleSort('branchCode')} className="px-3 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition">
                    <div className="flex items-center justify-center gap-1">
                      <span>LOC</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('partyName')} className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>PARTY CODE</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('partyName')} className="px-4 py-3 border-r border-slate-700/80 text-left cursor-pointer hover:bg-white/10 transition min-w-[180px]">
                    <div className="flex items-center gap-1">
                      <span>PARTY NAME</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 border-r border-slate-700/80 text-center">TYPE</th>
                  <th className="px-3 py-3 border-r border-slate-700/80 text-center">CAT</th>

                  {showTargetCols && (
                    <th onClick={() => handleSort('finalTarget')} className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>{currentPeriodLabel} TARGET</span>
                        <ArrowUpDown size={11} className="opacity-60" />
                      </div>
                    </th>
                  )}

                  <th onClick={() => handleSort('currentSales')} className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center text-emerald-300">
                    <div className="flex items-center justify-center gap-1">
                      <span>{currentPeriodLabel} SALES</span>
                      <ArrowUpDown size={11} className="opacity-60 text-emerald-200" />
                    </div>
                  </th>

                  <th onClick={() => handleSort('achievementPercent')} className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>ACH %</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  <th className="px-3.5 py-3 border-r border-slate-700/80 text-center">{prevPeriodLabel} SALES</th>
                  <th onClick={() => handleSort('ytdSales')} className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{ytdLabel}</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  <th onClick={() => handleSort('yoyGrowthPercent')} className="px-3.5 py-3 text-center cursor-pointer hover:bg-white/10 transition">
                    <div className="flex items-center justify-center gap-1">
                      <span>YOY %</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white font-medium text-slate-800 align-middle text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400 border-b border-slate-200">
                      <RefreshCw size={26} className="animate-spin text-blue-600 mx-auto mb-2" />
                      <span className="font-bold">Loading party-wise target & sales matrix...</span>
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400 border-b border-slate-200">
                      <Info size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">No records found for the selected criteria.</p>
                      <button
                        onClick={() => {
                          setStatusFilter('ALL');
                          setSearch('');
                          resetPartyTypesToDefault();
                        }}
                        className="mt-3 px-4 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-500 transition"
                      >
                        Reset All Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r, idx) => {
                    const ach = r.achievementPercent;

                    return (
                      <tr key={r.id ? `${r.id}_${idx}` : `${r.partyCode}_${r.branchCode}_${idx}`} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <td className="px-3 py-2.5 text-center border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {r.branchCode}
                        </td>

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-xs border border-blue-200">
                            {r.partyCode}
                          </span>
                        </td>

                        <td
                          onClick={() => setSelectedDealer(r)}
                          className="px-4 py-2.5 text-left border-r border-slate-200 font-semibold text-slate-900 text-xs uppercase hover:text-blue-600 cursor-pointer transition"
                          title="Click to view Dealer 360 Profile"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{r.partyName}</span>
                            <ChevronRight size={13} className="text-blue-500 shrink-0" />
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200 text-slate-800 font-semibold whitespace-nowrap text-xs uppercase">
                          {r.partyType}
                        </td>

                        <td className="px-3 py-2.5 text-center border-r border-slate-200 font-mono font-bold text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs">
                            {r.partCategoryCode || 'ALL'}
                          </span>
                        </td>

                        {showTargetCols && (
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-200 font-mono font-bold text-slate-900 bg-blue-50/40">
                            {r.finalTarget > 0 ? (Math.round(r.finalTarget / 1000) * 1000).toLocaleString('en-IN') : '—'}
                          </td>
                        )}

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200 font-mono font-bold text-emerald-800 bg-emerald-50/40">
                          {r.currentSales > 0 ? Math.round(r.currentSales).toLocaleString('en-IN') : '—'}
                        </td>

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              variant={ach >= 100 ? 'success' : ach >= 70 ? 'warning' : 'danger'}
                              size="sm"
                              className="font-mono"
                            >
                              {ach}%
                            </Badge>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${ach >= 100 ? 'bg-emerald-500' : ach >= 70 ? 'bg-amber-500' : 'bg-rose-500'} rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(ach, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200 font-mono text-slate-700 font-semibold">
                          {r.lastMonthSales > 0 ? Math.round(r.lastMonthSales).toLocaleString('en-IN') : '—'}
                        </td>

                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200 font-mono font-bold text-slate-900">
                          {r.ytdSales > 0 ? Math.round(r.ytdSales).toLocaleString('en-IN') : '—'}
                        </td>

                        <td className="px-3.5 py-2.5 text-center">
                          {r.yoyGrowthPercent !== undefined && (
                            <Badge
                              variant={r.yoyGrowthPercent >= 0 ? 'success' : 'danger'}
                              size="sm"
                              className="font-mono"
                            >
                              {r.yoyGrowthPercent >= 0 ? '+' : ''}{r.yoyGrowthPercent}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Unified Pagination */}
          <Pagination
            currentPage={page}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[50, 100, 250, 500]}
            itemName="dealers"
          />
        </div>
      </div>
    </AppShell>
  );
}
