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
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

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
  
  // Default show 100 per page, with options up to ALL
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);

  // Quick Filter by Achievement Status
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Sorting
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

  // Recalculating state for manual cache refresh
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  // Build query
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

  const currentPeriodLabel = `${month}'${shortYear}`; // e.g. "Aug'26"
  const prevPeriodLabel = `${prevMonthName}'${prevMonthShortYear}`; // e.g. "Jul'26"
  const lyPeriodLabel = `${month}'${prevShortYear}`; // e.g. "Aug'25"
  const { isSuperAdmin, isBranchUser, userBranch, user } = useAuth();
  const effectiveBranchCode = isSuperAdmin ? branchCode : (userBranch || user?.branchCode || 'BSE');
  const effectiveFiscalYear = isSuperAdmin ? fiscalYear : 2026;

  const ytdLabel = `FY${shortYear} YTD`; // e.g. "FY26 YTD"
  const lyYtdLabel = `FY${prevShortYear} LY YTD`; // e.g. "FY25 LY YTD"

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

  // Fetch branches for filter dropdown
  const { data: dashboardData } = useSWR('/dashboard/executive-kpis', fetcher);
  const branchesList = dashboardData?.filters?.branches || [];

  const rawRows: any[] = useMemo(() => data?.items || data?.data || [], [data]);
  const summary = data?.summary || {};
  const guardrail = summary?.guardrail || {};
  const isLocked = summary?.targetStatus === 'LOCKED';

  // Status breakdown counts
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

  // Client-Side Search, Status Filter & Sorting
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
  const effectivePageSize = pageSize === -1 ? totalCount : pageSize;
  const totalPages = Math.ceil(totalCount / effectivePageSize) || 1;
  const paginatedRows = useMemo(() => {
    if (pageSize === -1 || pageSize >= totalCount) return processedRows;
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize, totalCount]);

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

  // Run Weighted Target Calculation
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

  // Lock / Approve Target Matrix
  const handleToggleLock = async () => {
    if (isLocked) {
      const confirmed = window.confirm(`Unlock target matrix for ${month} ${fiscalYear} back to DRAFT state?`);
      if (!confirmed) return;
      try {
        await api.post('/reports/target-engine/unlock', { fiscalYear, month });
        toast.success(`Target Matrix unlocked to DRAFT state`);
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

  // Save Single Target
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

  // Save Bulk Target
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

  // Export to Excel (Authenticated Blob Download)
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

  const dealerTrajectory = useMemo(() => {
    if (!selectedDealer) return [];
    const base = Number(selectedDealer.avgSaleLast6Month) || 100000;
    return [
      { month: 'Mar', sales: Math.round(base * 0.85) },
      { month: 'Apr', sales: Math.round(base * 0.95) },
      { month: 'May', sales: Math.round(base * 1.10) },
      { month: 'Jun', sales: Math.round(base * 1.05) },
      { month: prevPeriodLabel, sales: Math.round(selectedDealer.lastMonthSales || base * 1.15) },
      { month: `${currentPeriodLabel} (Current)`, sales: Math.round(selectedDealer.currentSales) },
    ];
  }, [selectedDealer, currentPeriodLabel, prevPeriodLabel]);

  return (
    <AppShell title="Party Wise Performance" breadcrumb="Corporate Intelligence">
      {/* ─── 1. TARGET ENGINE STUDIO CONFIGURATION DRAWER ─── */}
      {engineDrawer && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            <div>
              {/* Header */}
              <div className="p-6 text-white flex items-start justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div>
                  <div className="flex items-center gap-2">
                    <Calculator size={18} className="text-amber-400" />
                    <h3 className="text-lg font-black text-white">Party Target Engine Studio</h3>
                  </div>
                  <p className="text-xs text-blue-200/80 font-mono mt-1">
                    Period: <strong>{currentPeriodLabel} Target Formulation & Guardrails</strong>
                  </p>
                </div>
                <button
                  onClick={() => setEngineDrawer(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 text-xs">
                {/* 1. Mathematical Formula Card */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-blue-900 shadow-md font-mono">
                  <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                    Weighted Base Formula
                  </p>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Weighted Base = ({lyPeriodLabel} × {lyWeight}%) + ({prevPeriodLabel} × {lmWeight}%) + (Last Qtr Avg × {lqWeight}%) + (Last FY Avg × {lfyWeight}%)
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Recommended Target = Weighted Base × (1 + {growthPercent}%)</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${lyWeight + lmWeight + lqWeight + lfyWeight === 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      Sum: {lyWeight + lmWeight + lqWeight + lfyWeight}%
                    </span>
                  </div>
                </div>

                {/* 2. Weight Sliders */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-blue-600" />
                    Historical Component Weight Allocation
                  </h4>

                  {/* LY Same Month (40%) */}
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>LY Same Month ({lyPeriodLabel})</span>
                      <span className="font-mono text-blue-600">{lyWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={lyWeight}
                      onChange={(e) => setLyWeight(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Last Month (25%) */}
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Last Month ({prevPeriodLabel})</span>
                      <span className="font-mono text-blue-600">{lmWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={lmWeight}
                      onChange={(e) => setLmWeight(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Last Quarter Avg (20%) */}
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Last Quarter Monthly Average</span>
                      <span className="font-mono text-blue-600">{lqWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={lqWeight}
                      onChange={(e) => setLqWeight(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Last FY Avg (15%) */}
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Last Financial Year Monthly Average</span>
                      <span className="font-mono text-blue-600">{lfyWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={lfyWeight}
                      onChange={(e) => setLfyWeight(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* 3. Growth & Guardrail Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
                      Expected Growth %
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={growthPercent}
                        onChange={(e) => setGrowthPercent(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
                      Guardrail Floor Multiplier
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={0.05}
                        value={floorMultiplier}
                        onChange={(e) => setFloorMultiplier(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-500">x</span>
                    </div>
                  </div>
                </div>

                {/* 4. Live Guardrail Audit Preview */}
                <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 text-blue-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs flex items-center gap-1.5 text-blue-900">
                      <Scale size={14} className="text-blue-700" />
                      Overall Target Guardrail Floor Audit
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${guardrail?.isFloorPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {guardrail?.isFloorPassed ? 'Floor Passed (ACCEPT)' : 'Gap Distributed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                    <div>
                      <p className="text-blue-600/80 text-[10px]">LY Same Month</p>
                      <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.totalLySameMonth)}</p>
                    </div>
                    <div>
                      <p className="text-blue-600/80 text-[10px]">Guardrail Floor ({floorMultiplier}x)</p>
                      <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.overallFloor)}</p>
                    </div>
                    <div>
                      <p className="text-blue-600/80 text-[10px]">Recommended Total</p>
                      <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.totalRecommendedTarget)}</p>
                    </div>
                  </div>

                  {!guardrail?.isFloorPassed && guardrail?.totalGapAdjustment > 0 && (
                    <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2">
                      ⚠️ Shortfall of <strong>₹{(guardrail.totalGapAdjustment / 100000).toFixed(2)} Lakhs</strong> automatically distributed proportionally across all active parties.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEngineDrawer(false)}
                className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunWeightedEngine}
                disabled={isRecalculating}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
              >
                <Calculator size={14} />
                <span>{isRecalculating ? 'Executing Engine...' : 'Run Target Engine & Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. EDIT SINGLE TARGET MODAL ─── */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
              <div className="flex items-center gap-2.5">
                <Target size={20} className="text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">Define Custom Admin Target</h3>
              </div>
              <button
                onClick={() => setEditModal({ open: false })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSingleTarget} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <p className="font-black text-slate-900 text-sm">{editModal.row?.partyName}</p>
                <p className="font-mono text-slate-500 text-[11px]">
                  Code: <strong className="text-slate-800">{editModal.row?.partyCode}</strong> | Branch: <strong className="text-slate-800">{editModal.row?.branchCode}</strong>
                </p>
                <p className="text-slate-600 font-sans text-xs">
                  Engine Weighted Base: <strong className="font-mono text-blue-700">{Math.round(editModal.row?.weightedBase || 0).toLocaleString('en-IN')}</strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-[11px] tracking-tight">
                  Admin Target Amount for {currentPeriodLabel}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={editModal.targetValue}
                    onChange={(e) => setEditModal({ ...editModal, targetValue: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono text-lg font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 150000"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Overwrites the engine recommended target and updates qualification benchmarks.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false })}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTarget}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-60 text-xs"
                >
                  <Check size={14} />
                  <span>{savingTarget ? 'Saving...' : 'Save Target'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 3. BULK TARGET MODAL ─── */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
              <div className="flex items-center gap-2.5">
                <Sliders size={20} className="text-cyan-400" />
                <h3 className="font-extrabold text-sm text-white">Bulk Target Assignment</h3>
              </div>
              <button
                onClick={() => setBulkModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBulkTarget} className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50/90 p-4 rounded-2xl border border-blue-200 text-blue-900">
                <p className="font-extrabold text-sm">
                  Assigning target to {processedRows.length} filtered dealers
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Target Period: <strong className="font-mono">{currentPeriodLabel}</strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-[11px] tracking-tight">
                  Flat Target Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bulkFlatAmount}
                    onChange={(e) => setBulkFlatAmount(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono text-lg font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 100000"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-60 text-xs"
                >
                  <Check size={14} />
                  <span>{bulkSaving ? 'Applying...' : 'Apply Bulk Targets'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 4. DEALER 360 PERFORMANCE DRAWER ─── */}
      {selectedDealer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            <div>
              {/* Drawer Header */}
              <div className="p-6 text-white flex items-start justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono font-bold text-[10px] uppercase border border-white/20">
                    Dealer 360 Profile
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    {selectedDealer.partyName}
                  </h3>
                  <p className="text-xs text-blue-200/80 font-mono mt-0.5">
                    Party Code: <strong>{selectedDealer.partyCode}</strong> • Loc: <strong>{selectedDealer.branchCode}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDealer(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-5 text-xs">
                {/* Metric Quick Bento */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{currentPeriodLabel} Turnover</p>
                    <p className="text-xl font-black font-mono text-emerald-700 mt-1">
                      ₹{Math.round(selectedDealer.currentSales).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Target Fulfillment ({currentPeriodLabel})</p>
                    <p className="text-xl font-black font-mono text-blue-700 mt-1">
                      {selectedDealer.achievementPercent}%
                    </p>
                  </div>
                </div>

                {/* 6-Month Trajectory Area Chart */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <Activity size={14} className="text-blue-600" />
                      6-Month Sales Trend (₹)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Monthly Retail</span>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dealerTrajectory}>
                        <defs>
                          <linearGradient id="colorDealer" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']} />
                        <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorDealer)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Exact Weighted Base Breakdown */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-2.5">
                  <h4 className="font-black text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator size={13} />
                    Target Engine Formulation Breakdown
                  </h4>
                  <div className="space-y-1.5 font-mono text-[11px] text-slate-300 divide-y divide-slate-800">
                    <div className="flex justify-between pt-1">
                      <span>1. LY Same Month ({lyPeriodLabel}) × 40%:</span>
                      <span className="text-white font-bold">{Math.round((selectedDealer.lySameMonthSales || 0) * 0.40).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5">
                      <span>2. Last Month ({prevPeriodLabel}) × 25%:</span>
                      <span className="text-white font-bold">{Math.round((selectedDealer.lastMonthSales || 0) * 0.25).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5">
                      <span>3. Last Qtr Avg × 20%:</span>
                      <span className="text-white font-bold">{Math.round((selectedDealer.lastQuarterAvg || 0) * 0.20).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5">
                      <span>4. Last FY Avg × 15%:</span>
                      <span className="text-white font-bold">{Math.round((selectedDealer.lastFyAvg || 0) * 0.15).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-amber-300 font-bold border-t border-slate-700">
                      <span>= Weighted Base:</span>
                      <span>{Math.round(selectedDealer.weightedBase || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 text-cyan-300">
                      <span>+ 10% Recommended Target:</span>
                      <span>{Math.round(selectedDealer.recommendedTarget || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {selectedDealer.gapAdjustment > 0 && (
                      <div className="flex justify-between pt-1.5 text-emerald-400">
                        <span>+ Guardrail Gap Adjustment:</span>
                        <span>+{Math.round(selectedDealer.gapAdjustment).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 text-white font-black text-xs border-t border-slate-700">
                      <span>FINAL TARGET:</span>
                      <span className="text-amber-400">{Math.round(selectedDealer.finalTarget).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setEditModal({
                    open: true,
                    row: selectedDealer,
                    targetValue: selectedDealer.adminDefinedTarget || Math.round(selectedDealer.finalTarget),
                  });
                  setSelectedDealer(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Edit3 size={14} />
                <span>Edit Target</span>
              </button>
              <button
                onClick={() => setSelectedDealer(null)}
                className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold hover:bg-white rounded-xl transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3.5 max-w-full">
        {/* ─── 5. TOP EXECUTIVE CONTROL TOOLBAR ─── */}
        <div
          className="bg-white text-slate-800 rounded-2xl p-2 px-3.5 shadow-sm relative z-30 border border-slate-200/90 overflow-x-auto"
        >
          <div className="flex items-center justify-between gap-2.5 min-w-max">
            {/* Left: Filters + Search */}
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {/* Period & Year — SuperAdmin Only */}
              {isSuperAdmin && (
                <>
                  {/* Month */}
                  <div className="flex items-center gap-1 bg-white text-slate-900 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                    <Calendar size={13} className="text-blue-600 shrink-0" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Period:</span>
                    <select
                      value={month}
                      onChange={(e) => {
                        setMonth(e.target.value);
                        setPage(1);
                      }}
                      className="bg-slate-100 text-slate-900 font-bold text-xs focus:outline-none cursor-pointer rounded px-1 py-0.5 border border-slate-300"
                    >
                      {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => (
                        <option key={m} value={m} className="text-slate-900 bg-white">{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Year */}
                  <div className="flex items-center gap-1 bg-white text-slate-900 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">FY:</span>
                    <select
                      value={fiscalYear}
                      onChange={(e) => {
                        setFiscalYear(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-slate-100 text-slate-900 font-bold text-xs focus:outline-none cursor-pointer rounded px-1 py-0.5 border border-slate-300"
                    >
                      <option value={2026} className="text-slate-900 bg-white">FY 2026</option>
                      <option value={2025} className="text-slate-900 bg-white">FY 2025</option>
                      <option value={2024} className="text-slate-900 bg-white">FY 2024</option>
                    </select>
                  </div>
                </>
              )}

              {/* Branch */}
              <div className="flex items-center gap-1 bg-white text-slate-900 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                <Building2 size={13} className="text-blue-600 shrink-0" />
                {isSuperAdmin ? (
                  <select
                    value={branchCode}
                    onChange={(e) => {
                      setBranchCode(e.target.value);
                      setPage(1);
                    }}
                    className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer py-0.5"
                  >
                    <option value="ALL" className="text-slate-900 bg-white">All 35 Branches</option>
                    {branchesList.map((b: any) => (
                      <option key={b.code} value={b.code} className="text-slate-900 bg-white">
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-black text-slate-900 font-mono flex items-center gap-1">
                    <Lock size={11} className="text-slate-700" /> {userBranch || user?.branchCode || 'BSE'}
                  </span>
                )}
              </div>

              {/* Multi-Select Party Types */}
              <div className="relative">
                <button
                  ref={partyTypeBtnRef}
                  type="button"
                  onClick={togglePartyDropdown}
                  className="flex items-center gap-1 bg-white text-slate-900 border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold hover:bg-slate-50 transition shadow-sm"
                >
                  <Users size={13} className="text-emerald-600" />
                  <span>
                    Party Types: <strong className="text-emerald-700 font-mono">({selectedPartyTypes.length} Active)</strong>
                  </span>
                  <ChevronDown size={13} className="text-slate-600" />
                </button>

                {showPartyTypeDropdown && (
                  <ClientPortal>
                    <div
                      id="party-type-dropdown-portal"
                      style={{ top: `${partyDropdownPos.top}px`, left: `${partyDropdownPos.left}px` }}
                      className="fixed z-[99999] w-72 bg-white border border-slate-300 rounded-2xl shadow-2xl p-3 space-y-2 text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-extrabold text-slate-900">Select Party Types</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            onClick={resetPartyTypesToDefault}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Default 4
                          </button>
                          <span className="text-slate-400">|</span>
                          <button
                            onClick={selectAllPartyTypes}
                            className="text-emerald-600 hover:underline font-bold"
                          >
                            All
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {ALL_POSSIBLE_PARTY_TYPES.map((pt) => {
                          const isSelected = selectedPartyTypes.includes(pt);
                          const isDefault = DEFAULT_PARTY_TYPES.includes(pt);

                          return (
                            <label
                              key={pt}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                                isSelected ? 'bg-blue-50 text-blue-900 font-extrabold' : 'hover:bg-slate-100 text-slate-700 font-semibold'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePartyType(pt)}
                                className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              <span className="truncate flex-1">{pt}</span>
                              {isDefault && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">
                                  Default
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setShowPartyTypeDropdown(false)}
                        className="w-full py-1.5 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl text-center text-xs transition mt-2 shadow-2xs cursor-pointer"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </ClientPortal>
                )}
              </div>

              {/* Part Category */}
              <div className="flex items-center gap-1 bg-white text-slate-900 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                <Layers size={13} className="text-purple-600 shrink-0" />
                <select
                  value={partCategory}
                  onChange={(e) => {
                    setPartCategory(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer py-0.5"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Categories</option>
                  <option value="M" className="text-slate-900 bg-white">M - Maruti Genuine Parts</option>
                  <option value="AA" className="text-slate-900 bg-white">AA - Accessories</option>
                  <option value="AG" className="text-slate-900 bg-white">AG - Oil</option>
                  <option value="T" className="text-slate-900 bg-white">T - Tools</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Instant search dealer or code..."
                  className="pl-7 pr-2 py-1 bg-slate-900/90 border border-blue-400/30 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36 lg:w-44"
                />
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {/* Target Engine Studio Button (SuperAdmin Only) */}
              {isSuperAdmin && (
                <button
                  onClick={() => setEngineDrawer(true)}
                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1 transition shadow hover:brightness-110"
                >
                  <Calculator size={13} />
                  <span>Target Engine Studio</span>
                </button>
              )}

              {/* Lock / Unlock Targets (SuperAdmin Only) */}
              {isSuperAdmin && (
                <button
                  onClick={handleToggleLock}
                  className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition shadow-sm ${
                    isLocked
                      ? 'bg-emerald-700/80 hover:bg-emerald-700 text-white border border-emerald-500/50'
                      : 'bg-slate-800/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40'
                  }`}
                  title={isLocked ? 'Targets are locked and approved' : 'Click to approve & lock target matrix'}
                >
                  {isLocked ? <Lock size={12} className="text-emerald-300" /> : <Unlock size={12} className="text-amber-400" />}
                  <span>{isLocked ? 'Targets Locked' : 'Lock Targets'}</span>
                </button>
              )}

              <button
                onClick={() => setShowWeightedBreakdown(!showWeightedBreakdown)}
                className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition shadow-xs ${
                  showWeightedBreakdown
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-200'
                }`}
                title="Toggle Detailed 4-Part Weighted Base Columns"
              >
                <PieChart size={13} />
                <span>{showWeightedBreakdown ? 'Hide Weights' : 'Show Weights'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition shadow"
              >
                <Download size={13} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 6. ANALYTICS BENTO KPI CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Card 1: Total Target */}
          <div className="bg-white rounded-2xl p-3 px-4 shadow-xs border border-purple-200/80 hover:shadow-md transition relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-500"></div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                Total Target ({currentPeriodLabel})
              </span>
              <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Target size={14} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {formatLakhs(summary.totalTarget)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">
              Weighted Base + Guardrail Floor Gap Adjustment
            </p>
          </div>

          {/* Card 2: Current Month Sales */}
          <div className="bg-white rounded-2xl p-3 px-4 shadow-xs border border-emerald-200/80 hover:shadow-md transition relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-500"></div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                {currentPeriodLabel} Sales
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BarChart3 size={14} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {formatLakhs(summary.totalCurrentSales)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">
              Real-time net retail sales turnover for {currentPeriodLabel}
            </p>
          </div>

          {/* Card 3: Overall Achievement % */}
          <div className="bg-white rounded-2xl p-3 px-4 shadow-xs border border-blue-200/80 hover:shadow-md transition relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500"></div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                Achievement % ({currentPeriodLabel})
              </span>
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sparkles size={14} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                {summary.overallAchievementPercent || 0}%
              </p>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  (summary.overallAchievementPercent || 0) >= 100
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {(summary.overallAchievementPercent || 0) >= 100 ? 'Target Exceeded' : 'On Track'}
              </span>
            </div>
          </div>

          {/* Card 4: Guardrail Audit Floor */}
          <div className="bg-white rounded-2xl p-3 px-4 shadow-xs border border-amber-200/80 hover:shadow-md transition relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                Guardrail Floor ({floorMultiplier}x)
              </span>
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Scale size={14} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {formatLakhs(guardrail?.overallFloor)}
            </p>
            <p className="text-[10px] text-emerald-700 mt-1 font-bold flex items-center gap-1 truncate">
              <ShieldCheck size={12} /> Status: {guardrail?.isFloorPassed ? 'Floor Passed' : 'Gap Distributed Pro-rata'}
            </p>
          </div>
        </div>

        {/* ─── 7. INTERACTIVE STATUS FILTER PILLS & DISPLAY SELECTOR ─── */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 px-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mr-1">
              Filter Status:
            </span>

            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All Dealers</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
                {statusCounts.all}
              </span>
            </button>

            <button
              onClick={() => {
                setStatusFilter('ACHIEVED');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'ACHIEVED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Achieved (≥100%)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono font-bold">
                {statusCounts.achieved}
              </span>
            </button>

            <button
              onClick={() => {
                setStatusFilter('ON_TRACK');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'ON_TRACK'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={13} />
              <span>On Track (70%–99%)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono font-bold">
                {statusCounts.onTrack}
              </span>
            </button>

            <button
              onClick={() => {
                setStatusFilter('UNDER');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'UNDER'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <XCircle size={13} />
              <span>Underperforming (&lt;70%)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono font-bold">
                {statusCounts.under}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-[11px]">Display:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              {[50, 100, 250, 500, -1].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    pageSize === size
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size === -1 ? 'All' : size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 8. STICKY DATA TABLE WITH FULL WEIGHTED BREAKDOWN ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Target size={17} className="text-blue-600" />
              <span className="font-extrabold text-slate-800 text-sm">
                Party-Wise Target vs Achievement Matrix ({totalCount} Dealers Listed)
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Click column headers to sort • Click party name for <strong>Dealer 360</strong>.
            </span>
          </div>

          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-xs text-center align-middle border-collapse">
              {/* Sticky Header (High-Visibility Enterprise Theme) */}
              <thead className="sticky top-0 z-20 table-header-navy select-none shadow-md">
                <tr>
                  <th
                    onClick={() => handleSort('branchCode')}
                    className="px-3.5 py-3 border-r border-slate-700/80 cursor-pointer hover:bg-white/10 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Branch</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 border-r border-slate-700/80 text-center align-middle">Party Code</th>
                  <th
                    onClick={() => handleSort('partyName')}
                    className="px-3.5 py-3 border-r border-slate-700/80 min-w-[200px] cursor-pointer hover:bg-white/10 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Party Name</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 border-r border-slate-700/80 text-center align-middle">Party Type</th>
                  <th className="px-2.5 py-3 border-r border-slate-700/80 text-center align-middle">Cat</th>

                  {/* Weighted Base Breakdown Columns */}
                  {showWeightedBreakdown && (
                    <>
                      <th className="px-3 py-3 border-r border-slate-700/80 min-w-[110px] bg-slate-950 text-center align-middle">
                        {lyPeriodLabel} (40%)
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700/80 min-w-[110px] bg-slate-950 text-center align-middle">
                        {prevPeriodLabel} (25%)
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700/80 min-w-[110px] bg-slate-950 text-center align-middle">
                        Last Qtr (20%)
                      </th>
                      <th className="px-3 py-3 border-r border-slate-700/80 min-w-[110px] bg-slate-950 text-center align-middle">
                        Last FY (15%)
                      </th>
                      <th
                        onClick={() => handleSort('weightedBase')}
                        className="px-3.5 py-3 border-r border-slate-700/80 min-w-[115px] bg-amber-950 cursor-pointer hover:bg-amber-900 text-amber-200 text-center align-middle"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Weighted Base</span>
                          <ArrowUpDown size={11} className="opacity-60" />
                        </div>
                      </th>
                    </>
                  )}

                  {showTargetCols && (
                    <>
                      <th className="px-3.5 py-3 border-r border-slate-700/80 min-w-[110px] text-center align-middle">
                        Rec. Target
                      </th>
                      <th className="px-3.5 py-3 border-r border-slate-700/80 min-w-[110px] text-center align-middle">
                        Admin Target
                      </th>
                    </>
                  )}

                  <th
                    onClick={() => handleSort('finalTarget')}
                    className="px-3.5 py-3 bg-[#0E1E4C] border-r border-slate-700/80 min-w-[115px] cursor-pointer hover:brightness-110 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Final Target</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('currentSales')}
                    className="px-3.5 py-3 bg-[#092B28] border-r border-slate-700/80 min-w-[125px] cursor-pointer hover:brightness-110 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-emerald-200 font-extrabold">{currentPeriodLabel} Sales</span>
                      <ArrowUpDown size={11} className="opacity-60 text-emerald-200" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('achievementPercent')}
                    className="px-3.5 py-3 border-r border-slate-700/80 min-w-[140px] cursor-pointer hover:bg-white/10 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Achievement %</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  <th className="px-3.5 py-3 border-r border-slate-700/80 min-w-[120px] text-center align-middle">
                    {prevPeriodLabel} Sales
                  </th>

                  <th
                    onClick={() => handleSort('ytdSales')}
                    className="px-3.5 py-3 border-r border-slate-700/80 min-w-[120px] cursor-pointer hover:bg-white/10 transition text-center align-middle"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{ytdLabel} Sales</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('yoyGrowthPercent')}
                    className="px-3.5 py-3 text-center align-middle cursor-pointer hover:bg-white/10 transition"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>YoY Growth %</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {isLoading ? (
                  <tr>
                    <td colSpan={18} className="py-16 text-center align-middle text-slate-400 border-b border-slate-200">
                      <RefreshCw size={26} className="animate-spin text-blue-600 mx-auto mb-2" />
                      <span className="font-bold">Loading party-wise target & sales matrix...</span>
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="py-16 text-center align-middle text-slate-400 border-b border-slate-200">
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
                    const achBg =
                      ach >= 100
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : ach >= 70
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200';

                    return (
                      <tr key={r.id ? `${r.id}_${idx}` : `${r.partyCode}_${r.branchCode}_${idx}`} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        {/* Branch */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {r.branchCode}
                        </td>

                        {/* Party Code */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold text-[11px] border border-blue-200">
                            {r.partyCode}
                          </span>
                        </td>

                        {/* Party Name */}
                        <td
                          onClick={() => setSelectedDealer(r)}
                          className="px-3.5 py-2.5 text-left align-middle border-r border-slate-200 font-semibold text-slate-900 text-xs uppercase hover:text-blue-600 cursor-pointer transition"
                          title="Click to view Dealer 360 Profile & Formulation Breakdown"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{r.partyName}</span>
                            <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 text-blue-500 transition" />
                          </div>
                        </td>

                        {/* Party Type */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 font-semibold whitespace-nowrap text-[11px] uppercase">
                          {r.partyType}
                        </td>

                        {/* Category */}
                        <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-bold text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px]">
                            {r.partCategoryCode === 'M'
                              ? 'M - Parts'
                              : r.partCategoryCode === 'AA'
                              ? 'AA - Accessories'
                              : r.partCategoryCode === 'AG'
                              ? 'AG - Oil'
                              : r.partCategoryCode === 'T'
                              ? 'T - Tools'
                              : r.partCategoryCode || 'ALL'}
                          </span>
                        </td>

                        {/* Weighted Breakdown Columns */}
                        {showWeightedBreakdown && (
                          <>
                            <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                              {r.lySameMonthSales > 0 ? Math.round(r.lySameMonthSales).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                              {r.lastMonthSales > 0 ? Math.round(r.lastMonthSales).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                              {r.lastQuarterAvg > 0 ? Math.round(r.lastQuarterAvg).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                              {r.lastFyAvg > 0 ? Math.round(r.lastFyAvg).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-amber-800 bg-amber-50/40">
                              {r.weightedBase > 0 ? Math.round(r.weightedBase).toLocaleString('en-IN') : '—'}
                            </td>
                          </>
                        )}

                        {/* Recommended Target */}
                        {showTargetCols && (
                          <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                            {r.recommendedTarget > 0 ? (Math.round(r.recommendedTarget / 1000) * 1000).toLocaleString('en-IN') : '—'}
                          </td>
                        )}

                        {/* Admin Target */}
                        {showTargetCols && (
                          <td
                            onClick={() =>
                              setEditModal({
                                open: true,
                                row: r,
                                targetValue: r.adminDefinedTarget || (Math.round(r.finalTarget / 1000) * 1000),
                              })
                            }
                            className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer transition"
                            title="Click to edit admin target"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>
                                {r.adminDefinedTarget > 0 ? Math.round(r.adminDefinedTarget).toLocaleString('en-IN') : '—'}
                              </span>
                              <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-blue-500" />
                            </div>
                          </td>
                        )}

                        {/* Final Target */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900 bg-blue-50/40">
                          {r.finalTarget > 0 ? (Math.round(r.finalTarget / 1000) * 1000).toLocaleString('en-IN') : '—'}
                        </td>

                        {/* Current Sales */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-emerald-800 bg-emerald-50/40">
                          {r.currentSales > 0 ? Math.round(r.currentSales).toLocaleString('en-IN') : '—'}
                        </td>

                        {/* Achievement % */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border font-mono ${achBg}`}>
                              {ach}%
                            </span>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${ach >= 100 ? 'bg-emerald-500' : ach >= 70 ? 'bg-amber-500' : 'bg-rose-500'} rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(ach, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Last Month Sales */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-slate-700 font-semibold">
                          {r.lastMonthSales > 0 ? Math.round(r.lastMonthSales).toLocaleString('en-IN') : '—'}
                        </td>

                        {/* YTD Sales */}
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900">
                          {r.ytdSales > 0 ? Math.round(r.ytdSales).toLocaleString('en-IN') : '—'}
                        </td>

                        {/* YoY Growth % */}
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          {r.yoyGrowthPercent !== undefined && (
                            <span
                              className={`inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono ${
                                r.yoyGrowthPercent >= 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {r.yoyGrowthPercent >= 0 ? '+' : ''}{r.yoyGrowthPercent}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 text-xs bg-slate-50/50">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-slate-600 font-medium">
                {pageSize === -1 || pageSize >= totalCount
                  ? `Showing All ${totalCount} Dealers`
                  : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} Dealers`}
              </span>

              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-sm">
                <span className="text-slate-500 font-bold text-[11px]">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent font-black text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                  <option value={-1}>Show All ({totalCount})</option>
                </select>
              </div>
            </div>

            {pageSize !== -1 && pageSize < totalCount && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white disabled:opacity-40 transition shadow-sm"
                >
                  Previous
                </button>
                <span className="px-3.5 py-1.5 font-bold text-slate-800">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white disabled:opacity-40 transition shadow-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
