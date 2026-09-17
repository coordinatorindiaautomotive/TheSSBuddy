'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import {
  Building2, Search, Calendar, Target, TrendingUp, TrendingDown,
  Download, Printer, AlertTriangle, CheckCircle2, ChevronRight,
  ShieldCheck, Award, Zap, Layers, BarChart3, Package, ArrowUpRight,
  ArrowDownRight, Sparkles, RefreshCw, Clock, ShoppingCart, Percent,
  FileSpreadsheet, ArrowRight, HelpCircle, Check, X, ShieldAlert,
  Flame, Compass, BarChart2, Hash, DollarSign, Activity, PieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';

const fetcher = (url: string) => api.get(url).then(r => r.data);

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

const formatLakhs = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0.00 L';
  const l = (val / 100000).toFixed(2);
  return `₹${l} L`;
};

const formatGrowth = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '0.0%';
  const num = typeof val === 'number' ? val : parseFloat(val);
  const p = Math.abs(num) > 1.5 ? num : num * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
};

interface Customer360CockpitProps {
  initialPartyCode?: string;
  initialFiscalYear?: number;
  initialMonth?: string;
  onPartyChange?: (partyCode: string) => void;
}

export const Customer360Cockpit: React.FC<Customer360CockpitProps> = ({
  initialPartyCode = '',
  initialFiscalYear = 2026,
  initialMonth = 'Sep',
  onPartyChange
}) => {
  const [partyCode, setPartyCode] = useState<string>(initialPartyCode);
  const [fiscalYear, setFiscalYear] = useState<number>(initialFiscalYear);
  const [month, setMonth] = useState<string>(initialMonth);
  const [targetGrowthPercent, setTargetGrowthPercent] = useState<number>(15);
  const [partySearch, setPartySearch] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (initialPartyCode && initialPartyCode !== partyCode) {
      setPartyCode(initialPartyCode);
    }
  }, [initialPartyCode]);

  // Fetch party master list for search autocomplete
  const { data: partiesList } = useSWR('/parties/ssot-registry', fetcher, { revalidateOnFocus: false });

  // Filter parties for search dropdown
  const filteredParties = useMemo(() => {
    if (!partiesList || !Array.isArray(partiesList)) return [];
    const q = partySearch.toLowerCase().trim();
    if (!q) return partiesList.slice(0, 40);
    return partiesList.filter((p: any) => {
      const code = (p.code || p.consPartyCode || p.dealerCode || '').toLowerCase();
      const name = (p.name || p.consPartyName || p.partyName || '').toLowerCase();
      const orig = (p.originalCode || '').toLowerCase();
      const loc = (p.baseLoc || p.primaryBranchCode || p.loc || p.branchCode || '').toLowerCase();
      const exec = (p.executiveName || p.assignedSalesExecutive || '').toLowerCase();
      const type = (p.partyType || '').toLowerCase();
      return (
        code.includes(q) ||
        name.includes(q) ||
        orig.includes(q) ||
        loc.includes(q) ||
        exec.includes(q) ||
        type.includes(q)
      );
    }).slice(0, 50);
  }, [partiesList, partySearch]);

  // Auto-select first party if none selected
  useEffect(() => {
    if (!partyCode && partiesList && Array.isArray(partiesList) && partiesList.length > 0) {
      const first = partiesList[0];
      const firstCode = first.code || first.consPartyCode || first.originalCode || first.dealerCode || '';
      if (firstCode) {
        setPartyCode(firstCode);
        if (onPartyChange) onPartyChange(firstCode);
      }
    }
  }, [partiesList, partyCode, onPartyChange]);

  // Click outside to close party search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch comprehensive 360 data
  const apiUrl = partyCode
    ? `/reports/party-360?partyCode=${encodeURIComponent(partyCode)}&fiscalYear=${fiscalYear}&month=${encodeURIComponent(month)}`
    : null;

  const { data: party360, error, isLoading } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  const profile = party360?.profile || {};
  const health = party360?.health || { score: 75, status: 'STABLE', breakdown: {} };
  const periodComparison = party360?.periodComparison || {};
  const fourYearTrend = party360?.fourYearTrend || {};
  const branchContribution = party360?.branchContribution || {};
  const decliningParts = party360?.decliningParts || [];
  const basketStats = party360?.basketStats || {};
  const matrix = party360?.matrix || {};
  const categories = party360?.categories || [];
  const topParts = party360?.topParts || [];
  const recommendedActions = party360?.recommendedActions || [];
  const growthExplanation = party360?.growthExplanation || { totalGrowth: 0, components: [] };
  const nextGrowthRoadmap = party360?.nextGrowthRoadmap || [];
  const riskAndSignals = party360?.riskAndSignals || { attentionRequired: [], positiveSignals: [] };
  const timeline = party360?.timeline || [];

  // Dynamic Target Calculation based on Target Growth % input
  const dynamicCalculations = useMemo(() => {
    const curYtd = periodComparison.ytd?.curSales || matrix.curYtdSales || 0;
    const lyYtd = periodComparison.ytd?.lySales || matrix.lyYtdSales || 0;
    const dynamicTarget = Math.round(lyYtd * (1 + targetGrowthPercent / 100));
    const dynamicGap = dynamicTarget - curYtd;
    const dynamicAchievementPercent = dynamicTarget > 0 ? (curYtd / dynamicTarget) * 100 : (curYtd > 0 ? 100 : 0);

    // 5-Pillar Decomposition adjusted to dynamic target gap
    const gapAmount = Math.max(0, dynamicGap);
    const lostPartVol = Math.min(gapAmount * 0.35, decliningParts.reduce((s: number, p: any) => s + (p.opportunityValue || 0), 0)) || Math.round(gapAmount * 0.30);
    const catExpansion = Math.round(gapAmount * 0.25);
    const fastMovers = Math.round(gapAmount * 0.20);
    const crossSell = Math.round(gapAmount * 0.15);
    const dormantRecovery = Math.max(0, gapAmount - (lostPartVol + catExpansion + fastMovers + crossSell));

    return {
      curYtd,
      lyYtd,
      dynamicTarget,
      dynamicGap,
      dynamicAchievementPercent,
      pillars: {
        lostPartVol,
        catExpansion,
        fastMovers,
        crossSell,
        dormantRecovery
      }
    };
  }, [periodComparison, matrix, targetGrowthPercent, decliningParts]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    if (!partyCode) return;
    try {
      setIsExportingExcel(true);
      toast.loading('Generating Party 360 Intelligence Dossier Excel...', { id: 'export-excel' });
      const response = await api.get(
        `/reports/party-360/export?partyCode=${encodeURIComponent(partyCode)}&branchCode=${encodeURIComponent(profile.branchCode || '')}&fiscalYear=${fiscalYear}&month=${encodeURIComponent(month)}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Party_360_${partyCode}_${month}_FY${fiscalYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel Dossier Downloaded Successfully!', { id: 'export-excel' });
    } catch (e: any) {
      toast.error('Failed to export Excel dossier', { id: 'export-excel' });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // PDF Print Handler
  const handlePrintPDF = () => {
    window.print();
  };

  const handleSelectParty = (p: any) => {
    const code = p.code || p.consPartyCode || p.originalCode || p.dealerCode;
    setPartyCode(code);
    setSearchOpen(false);
    setPartySearch('');
    if (onPartyChange) onPartyChange(code);
  };

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const years = [2027, 2026, 2025, 2024, 2023];

  const currentPartyName = profile.partyName || (partiesList && Array.isArray(partiesList) ? partiesList.find((p: any) => (p.code || p.consPartyCode) === partyCode)?.name : '') || partyCode;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-12 print:bg-white print:pb-0 print:text-black">
      {/* ─── PRINT CSS INJECTION ─── */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          .no-print, header, aside, nav, .print-hidden {
            display: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          .print-header {
            border-bottom: 2px solid #0f172a !important;
          }
        }
      `}</style>

      {/* ─── TOP CONTROL BAR ─── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs print-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  TheSSBuddy
                </span>
                <span className="text-xs text-slate-400 font-medium">Powered by Thesssystems</span>
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate">
                CUSTOMER 360 — PARTY ONE-PAGER
              </h1>
            </div>
          </div>

          {/* Quick Party Search Autocomplete */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchOpen ? partySearch : (currentPartyName ? `${currentPartyName} (${partyCode})` : partyCode)}
                onFocus={() => { setSearchOpen(true); setPartySearch(''); }}
                onChange={(e) => { setPartySearch(e.target.value); setSearchOpen(true); }}
                placeholder="Search party code, name, original code, city..."
                className="w-full pl-9 pr-14 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchOpen && partySearch && (
                  <button
                    onClick={() => setPartySearch('')}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setSearchOpen(!searchOpen); setPartySearch(''); }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 px-1 py-0.5"
                >
                  {searchOpen ? 'Close' : 'Change'}
                </button>
              </div>
            </div>

            {/* Autocomplete dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                  <span>Showing {filteredParties.length} matching parties</span>
                  <span>Select to load 360</span>
                </div>
                {filteredParties.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    No matching parties found for "{partySearch}"
                  </div>
                ) : (
                  filteredParties.map((p: any, idx: number) => {
                    const pCode = p.code || p.consPartyCode || p.dealerCode || '';
                    const pName = p.name || p.consPartyName || p.partyName || pCode;
                    const pOrig = p.originalCode && p.originalCode !== pCode ? p.originalCode : '';
                    const pLoc = p.baseLoc || p.primaryBranchCode || p.loc || p.branchCode || 'All';
                    const pType = p.partyType || 'RETAILER';
                    const isSelected = pCode === partyCode;

                    return (
                      <button
                        key={`${pCode}-${idx}`}
                        onClick={() => handleSelectParty(p)}
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between group cursor-pointer ${
                          isSelected ? 'bg-blue-50/80 font-semibold' : ''
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                              {pName}
                            </span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              {pType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-mono font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                              Code: {pCode}
                            </span>
                            {pOrig && (
                              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                Orig: {pOrig}
                              </span>
                            )}
                            <span className="text-slate-600">
                              📍 {pLoc}
                            </span>
                            {p.executiveName && p.executiveName !== 'Unassigned' && (
                              <span className="text-slate-500 text-[10px]">
                                👤 {p.executiveName}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 flex-shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Controls & Export Actions */}
          <div className="flex items-center gap-2">
            {/* Fiscal Year */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y}>FY {y-1}-{String(y).slice(2)}</option>
                ))}
              </select>
            </div>

            {/* As-Of Month */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500">Month:</span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Target Growth % Input */}
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-blue-900">Target:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={targetGrowthPercent}
                onChange={(e) => setTargetGrowthPercent(Math.max(0, Number(e.target.value)))}
                className="w-10 bg-white text-center text-xs font-bold text-blue-700 border border-blue-300 rounded py-0.5 focus:outline-hidden"
              />
              <span className="text-xs font-bold text-blue-700">%</span>
            </div>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || !partyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
              title="Download comprehensive Excel dossier with all sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            {/* Export PDF Print */}
            <button
              onClick={handlePrintPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs"
              title="Print or save one-pager PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT WRAPPER ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-4 print:mt-0 print:px-0">
        
        {/* Loading State */}
        {isLoading && !party360 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">Loading Customer Intelligence 360...</div>
            <div className="text-xs text-slate-500 mt-1">Aggregating 4-year transactions, catalog depth, and gap metrics...</div>
          </div>
        )}

        {/* ─── SECTION 1: CUSTOMER PROFILE & STATUS BANNER ─── */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card print-break-inside-avoid">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            
            {/* Left: Identity */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
                {(profile.partyName || partyCode || 'P').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">
                    {profile.partyName || partyCode}
                  </h2>
                  <span className="font-mono text-xs font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                    Code: {profile.partyCode || partyCode}
                  </span>
                  {profile.originalCode && profile.originalCode !== (profile.partyCode || partyCode) && (
                    <span className="font-mono text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      Orig: {profile.originalCode}
                    </span>
                  )}
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {profile.partyType || 'TRADER/RETAILER'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                  <span>📍 Branch: <strong className="text-slate-700">{profile.branchName || profile.branchCode || 'Head Office'}</strong></span>
                  <span>📅 Since: <strong className="text-slate-700">{basketStats.firstPurchase || 'N/A'}</strong></span>
                  <span>🕒 Last Order: <strong className="text-slate-700">{basketStats.lastPurchase || 'N/A'}</strong></span>
                  <span>📦 Unique Parts: <strong className="text-slate-700">{basketStats.totalUniqueParts || 0}</strong></span>
                  <span>🧾 Total Invoices: <strong className="text-slate-700">{basketStats.totalInvoices || 0}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: Health Score Gauge & Status */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Branch Contribution */}
              <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-right">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Branch Rank & Share</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-extrabold text-slate-900">
                    Rank #{branchContribution.branchRank || 1}
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    {branchContribution.branchSharePercent || 0}% of Branch
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Account Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase border ${
                  health.status === 'GROWING' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                  health.status === 'STABLE' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  health.status === 'DECLINING' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                  'bg-rose-50 text-rose-700 border-rose-300'
                }`}>
                  ● {health.status}
                </span>
              </div>

              {/* Health Score */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Health Index</div>
                  <div className="text-xl font-black tracking-tight">{health.score}<span className="text-xs font-medium text-slate-400">/100</span></div>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-emerald-400 flex items-center justify-center text-xs font-bold text-emerald-300">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-3 pt-1">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Lifetime Sales</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatLakhs(basketStats.lifetimeSales)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Avg Monthly Buying</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatLakhs(basketStats.avgMonthlySales)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Avg Order Value</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatCurrency(basketStats.avgSalesPerInvoice)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Active Months</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{basketStats.activeMonths || 0} Months</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Avg Qty / Invoice</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{basketStats.avgQtyPerInvoice || 0} Units</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Lines / Invoice</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{basketStats.avgLinesPerInvoice || 0} Items</div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: PRIMARY 7 KPI METRIC TILES ─── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Tile 1: YTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">YTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(periodComparison.ytd?.curSales || matrix.curYtdSales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(periodComparison.ytd?.curSales || matrix.curYtdSales)}
            </div>
          </div>

          {/* Tile 2: QTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">QTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(periodComparison.qtd?.curSales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(periodComparison.qtd?.curSales)}
            </div>
          </div>

          {/* Tile 3: MQTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">MQTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(periodComparison.mqtd?.curSales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(periodComparison.mqtd?.curSales)}
            </div>
          </div>

          {/* Tile 4: HTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">HTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(periodComparison.htd?.curSales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(periodComparison.htd?.curSales)}
            </div>
          </div>

          {/* Tile 5: YTD Growth % */}
          <div className={`rounded-xl border p-3 shadow-xs print-card ${
            (periodComparison.ytd?.growthPercent || 0) >= 0
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-rose-50/70 border-rose-200'
          }`}>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">YTD Growth YoY</div>
            <div className={`text-base font-extrabold mt-1 flex items-center gap-1 ${
              (periodComparison.ytd?.growthPercent || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {(periodComparison.ytd?.growthPercent || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {formatGrowth(periodComparison.ytd?.growthPercent)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              vs LY Same Period
            </div>
          </div>

          {/* Tile 6: Target Achievement % */}
          <div className="bg-blue-50/70 rounded-xl border border-blue-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Target Achieved</div>
            <div className="text-base font-black text-blue-700 mt-1">
              {dynamicCalculations.dynamicAchievementPercent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">
              Target: {formatLakhs(dynamicCalculations.dynamicTarget)}
            </div>
          </div>

          {/* Tile 7: Target Gap */}
          <div className={`rounded-xl border p-3 shadow-xs print-card ${
            dynamicCalculations.dynamicGap > 0
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              {dynamicCalculations.dynamicGap > 0 ? 'Target Gap' : 'Target Surplus'}
            </div>
            <div className={`text-base font-extrabold mt-1 ${
              dynamicCalculations.dynamicGap > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {formatLakhs(Math.abs(dynamicCalculations.dynamicGap))}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              @{targetGrowthPercent}% growth aim
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: PERFORMANCE VS LAST YEAR TABLE (SAME PERIOD COMPARISON) ─── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print-card print-break-inside-avoid">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Period Performance vs Last Year (Exact Same-Period Comparison)
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              *Prevents partial vs full period comparison distortions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-3 text-right">FY{fiscalYear} (Current)</th>
                  <th className="py-2.5 px-3 text-right">FY{fiscalYear - 1} (LY Same Period)</th>
                  <th className="py-2.5 px-3 text-right">YoY Growth %</th>
                  <th className="py-2.5 px-3 text-right">Net Variance (₹)</th>
                  <th className="py-2.5 px-3 text-right">Target (@+{targetGrowthPercent}%)</th>
                  <th className="py-2.5 px-3 text-right">Target Ach %</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {[
                  { label: `MTD (${month})`, key: 'mtd' },
                  { label: 'MQTD (Aug-Sep)', key: 'mqtd' },
                  { label: 'QTD (Jul-Sep)', key: 'qtd' },
                  { label: 'HTD (Apr-Sep)', key: 'htd' },
                  { label: 'YTD (Apr-Sep)', key: 'ytd', isPrimary: true },
                ].map((row) => {
                  const pData = periodComparison[row.key] || {};
                  const cur = pData.curSales || 0;
                  const ly = pData.lySales || 0;
                  const growth = pData.growthPercent || 0;
                  const diff = cur - ly;
                  const tgt = Math.round(ly * (1 + targetGrowthPercent / 100));
                  const ach = tgt > 0 ? (cur / tgt) * 100 : (cur > 0 ? 100 : 0);
                  const isPositive = growth >= 0;

                  return (
                    <tr
                      key={row.key}
                      className={`hover:bg-slate-50/80 transition-colors ${row.isPrimary ? 'bg-blue-50/30 font-bold' : ''}`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-1.5">
                        {row.isPrimary && <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                        {row.label}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {formatCurrency(cur)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatCurrency(ly)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatGrowth(growth)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(tgt)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          ach >= 100 ? 'bg-emerald-100 text-emerald-800' :
                          ach >= 80 ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {ach.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          ach >= 100 ? 'bg-emerald-500' :
                          ach >= 75 ? 'bg-blue-500' :
                          'bg-rose-500'
                        }`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── SECTION 4: 4-YEAR TREND & MONTHLY SEASONALITY ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
          
          {/* 4-Year Sales Trend Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  4-Year Sales History & CAGR
                </h3>
              </div>
              <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                4Y CAGR: {fourYearTrend.cagr || 0}%
              </div>
            </div>

            {/* 4 Year Bars Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { fy: 'FY 2022-23', sales: fourYearTrend.fy23 || 0, tag: 'FY23' },
                { fy: 'FY 2023-24', sales: fourYearTrend.fy24 || 0, tag: 'FY24', yoy: fourYearTrend.yoy24 },
                { fy: 'FY 2024-25', sales: fourYearTrend.fy25 || 0, tag: 'FY25', yoy: fourYearTrend.yoy25 },
                { fy: 'FY 2025-26', sales: fourYearTrend.fy26 || 0, tag: 'FY26', yoy: fourYearTrend.yoy26, active: true },
              ].map((yr) => (
                <div
                  key={yr.tag}
                  className={`p-2.5 rounded-lg border text-center ${
                    yr.active
                      ? 'bg-blue-50/60 border-blue-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">{yr.tag}</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">
                    {formatLakhs(yr.sales)}
                  </div>
                  {yr.yoy !== undefined ? (
                    <div className={`text-[10px] font-bold mt-0.5 ${yr.yoy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatGrowth(yr.yoy)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-0.5">Base Year</div>
                  )}
                </div>
              ))}
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { year: 'FY23', sales: Math.round((fourYearTrend.fy23 || 0) / 100000) },
                    { year: 'FY24', sales: Math.round((fourYearTrend.fy24 || 0) / 100000) },
                    { year: 'FY25', sales: Math.round((fourYearTrend.fy25 || 0) / 100000) },
                    { year: 'FY26 (YTD)', sales: Math.round((fourYearTrend.fy26 || 0) / 100000) },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="L" />
                  <Tooltip
                    formatter={(val: any) => [`₹${val} Lakhs`, 'Turnover']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="sales" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Seasonality Progression */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Monthly Run-Rate (FY{fiscalYear} vs FY{fiscalYear - 1})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Apr - Mar Pace</span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeline.slice(-12).map((t: any) => ({
                    month: t.monthYear || t.month,
                    cur: Math.round((t.sales || 0) / 1000),
                    qty: t.qty || 0,
                  }))}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCurSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="k" />
                  <Tooltip
                    formatter={(val: any) => [`₹${(Number(val) * 1000).toLocaleString('en-IN')}`, 'Sales']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cur"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCurSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-slate-500 text-center mt-1">
              Monthly invoicing volume (in thousands ₹)
            </div>
          </div>
        </section>

        {/* ─── SECTION 5: CATEGORY PERFORMANCE & TOP 5 PARTS YTD ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
          
          {/* Category Performance Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print-card">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Category Breakdown & Share
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">{categories.length} Categories</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-2 px-3">Cat</th>
                    <th className="py-2 px-3 text-right">Cur YTD</th>
                    <th className="py-2 px-3 text-right">LY Same Period</th>
                    <th className="py-2 px-3 text-right">YoY %</th>
                    <th className="py-2 px-3">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">No category records found</td>
                    </tr>
                  ) : (
                    categories.map((c: any) => {
                      const share = c.sharePercent || 0;
                      const growth = c.growthPercent || 0;
                      return (
                        <tr key={c.cat} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-mono">
                              {c.cat}
                            </span>
                            <span>Category {c.cat}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900">
                            {formatCurrency(c.curYtdSales || c.curMonthSales)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {formatCurrency(c.lyYtdSales || c.lyMonthSales)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatGrowth(growth)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, share)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono font-bold text-slate-600 w-8 text-right">
                                {share}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 Parts YTD */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print-card">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Top 5 Partline Revenue Contributors
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">YTD Volume</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-2 px-3">Part #</th>
                    <th className="py-2 px-2">Cat</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">YTD Sales</th>
                    <th className="py-2 px-3 text-right">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {topParts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">No part items recorded</td>
                    </tr>
                  ) : (
                    topParts.slice(0, 5).map((p: any) => (
                      <tr key={p.partNum} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-mono font-bold text-slate-900">{p.partNum}</div>
                          {p.rootPartNum && (
                            <div className="text-[10px] text-slate-500">Root: {p.rootPartNum}</div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                            {p.cat || 'M'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {p.curQty || p.qty || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(p.curSales || p.sales)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700 font-bold">
                          {p.sharePercent || 0}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6: PRODUCT DECLINE / GAP ANALYSIS (LOST VOLUME) ─── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print-card print-break-inside-avoid">
          <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Product Decline & Lost Volume Analysis (Immediate Pitch Targets)
                </h3>
                <div className="text-[11px] text-amber-700">
                  Parts where purchasing has slowed down or dropped significantly compared to last year's pace
                </div>
              </div>
            </div>
            <div className="text-xs font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              {decliningParts.length} Parts with Gaps
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Part Num</th>
                  <th className="py-2.5 px-2">Cat</th>
                  <th className="py-2.5 px-2 text-right">LY Qty</th>
                  <th className="py-2.5 px-2 text-right">Cur Qty</th>
                  <th className="py-2.5 px-2 text-right">Qty Gap</th>
                  <th className="py-2.5 px-3 text-right">LY Sales</th>
                  <th className="py-2.5 px-3 text-right">Cur Sales</th>
                  <th className="py-2.5 px-2 text-right">4Y Max Qty</th>
                  <th className="py-2.5 px-3 text-right">Opportunity (₹)</th>
                  <th className="py-2.5 px-3">Pitch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {decliningParts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                      No significant declining parts detected. Customer is maintaining or expanding volume across catalog.
                    </td>
                  </tr>
                ) : (
                  decliningParts.slice(0, 8).map((p: any) => (
                    <tr key={p.partNum} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900">{p.partNum}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Root: {p.rootPartNum || 'N/A'}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                          {p.cat || 'M'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                        {p.lyQty}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                        {p.curQty}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-extrabold text-rose-600">
                        {p.qtyGap}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatCurrency(p.lySales)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold">
                        {formatCurrency(p.curSales)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                        {p.maxHistoricalQty || p.avg4yQty || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-700">
                        {formatCurrency(p.opportunityValue)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Reorder {Math.abs(p.qtyGap)} pcs
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── SECTION 7: TARGET ACHIEVEMENT ENGINE & 5-PILLAR GAP DECOMPOSITION ─── */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card print-break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Target Achievement Engine — 5-Pillar Gap Decomposition (100% Coverage)
                </h3>
                <div className="text-[11px] text-slate-500">
                  Actionable bridge showing exactly where to extract the {formatLakhs(dynamicCalculations.dynamicGap)} required to hit the +{targetGrowthPercent}% growth target
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <span className="text-slate-500">Target Gap:</span>
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {formatLakhs(dynamicCalculations.dynamicGap)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            {/* Pillar 1: Lost Volume Recovery */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>1. Lost Part Volume</span>
                  <span className="text-blue-600">30%</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {formatLakhs(dynamicCalculations.pillars.lostPartVol)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Recover {decliningParts.length} dropped parts back to previous year buying rates.
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-semibold text-blue-700">
                Action: Reorder Campaign
              </div>
            </div>

            {/* Pillar 2: Category Expansion */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>2. Category Expansion</span>
                  <span className="text-blue-600">25%</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {formatLakhs(dynamicCalculations.pillars.catExpansion)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Introduce low-share categories currently &lt;15% of customer's basket.
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-semibold text-blue-700">
                Action: Basket Diversification
              </div>
            </div>

            {/* Pillar 3: Fast Moving Branch Movers */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>3. Branch Fast Movers</span>
                  <span className="text-blue-600">20%</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {formatLakhs(dynamicCalculations.pillars.fastMovers)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Sell top branch fast-sellers that this customer has never ordered.
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-semibold text-blue-700">
                Action: Cross-Dealer Benchmarking
              </div>
            </div>

            {/* Pillar 4: Cross Sell Root Parts */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>4. Cross-Sell Root Parts</span>
                  <span className="text-blue-600">15%</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {formatLakhs(dynamicCalculations.pillars.crossSell)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Pitch complementary parts tied to active root part families.
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-semibold text-blue-700">
                Action: Family Bundles
              </div>
            </div>

            {/* Pillar 5: Dormant Reactivation */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>5. Dormant Recovery</span>
                  <span className="text-blue-600">10%</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {formatLakhs(dynamicCalculations.pillars.dormantRecovery)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Reactivate core catalog items ordered in FY23-FY24 but silent this year.
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] font-semibold text-blue-700">
                Action: Historical Winback
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8: TOP 5 RECOMMENDED NEXT BEST ACTIONS (DATA-DRIVEN PLAYBOOK) ─── */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card print-break-inside-avoid">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Top 5 Recommended Next Best Actions (Field Rep Sales Playbook)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Targeted Revenue Boost
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
            {recommendedActions.length === 0 ? (
              <div className="col-span-5 p-4 text-center text-xs text-slate-500">
                No immediate action playbooks generated. Account is healthy.
              </div>
            ) : (
              recommendedActions.map((act: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                        #{act.rank || idx + 1}
                      </span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                        act.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                        act.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {act.priority}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-2">
                      {act.title}
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                      {act.reason}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Value:</span>
                    <span className="text-xs font-extrabold text-emerald-700 font-mono">
                      {formatCurrency(act.potentialValue)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ─── SECTION 9: GROWTH EXPLANATION & NEXT 15% ROADMAP ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
          
          {/* Growth Explanation */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  YTD Growth Drivers & Attribution
                </h3>
              </div>
              <span className={`text-xs font-bold ${growthExplanation.totalGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {growthExplanation.totalGrowth >= 0 ? '+' : ''}{formatLakhs(growthExplanation.totalGrowth)}
              </span>
            </div>

            <div className="space-y-2.5">
              {growthExplanation.components.map((comp: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{comp.label}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(comp.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              *Growth drivers isolate category volume expansion, root part depth, and price mix adjustments.
            </div>
          </div>

          {/* Next Growth Roadmap */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs print-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Where Can We Get the Next {targetGrowthPercent}%?
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Confidence-Rated
              </span>
            </div>

            <div className="space-y-2">
              {nextGrowthRoadmap.map((road: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate">{road.opportunity}</div>
                    <div className="text-[10px] text-slate-400">{road.confidence}</div>
                  </div>
                  <div className="font-mono font-bold text-emerald-700 flex-shrink-0">
                    {formatCurrency(road.potential)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 10: PURCHASE BEHAVIOR & RISK / POSITIVE ALERTS ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
          
          {/* Risk Alerts (Attention Required) */}
          <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-4 shadow-xs print-card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Attention Required (Risk Factors & Volume Drops)
              </h3>
            </div>
            {riskAndSignals.attentionRequired.length === 0 ? (
              <div className="text-xs text-rose-700">No critical risk signals flagged for this account.</div>
            ) : (
              <ul className="space-y-2">
                {riskAndSignals.attentionRequired.map((risk: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-rose-900">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Positive Signals (Growth Catalysts) */}
          <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-4 shadow-xs print-card">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Positive Signals (Growth Catalysts & Strengths)
              </h3>
            </div>
            {riskAndSignals.positiveSignals.length === 0 ? (
              <div className="text-xs text-emerald-700">Maintaining standard historical turnover baseline.</div>
            ) : (
              <ul className="space-y-2">
                {riskAndSignals.positiveSignals.map((pos: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-emerald-900">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{pos}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default Customer360Cockpit;
