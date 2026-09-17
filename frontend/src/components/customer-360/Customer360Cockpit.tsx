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
  AreaChart,
  Area
} from 'recharts';
import toast from 'react-hot-toast';
import { generateCustomer360PDF } from './generateCustomer360PDF';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categoryViewMode, setCategoryViewMode] = useState<'cards' | 'table'>('cards');
  const [partySearch, setPartySearch] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
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

  // Active Category Metrics for Dynamic Period & KPI Cards
  const activeCategoryMetrics = useMemo(() => {
    if (selectedCategory === 'ALL' || !party360?.categoryMultiPeriod?.[selectedCategory]) {
      return {
        name: 'All Categories Combined',
        code: 'ALL',
        mtd: periodComparison.mtd || {},
        mqtd: periodComparison.mqtd || {},
        qtd: periodComparison.qtd || {},
        htd: periodComparison.htd || {},
        ytd: periodComparison.ytd || {},
      };
    }
    const catObj = party360.categoryMultiPeriod[selectedCategory] || {};
    return {
      name: `Category ${selectedCategory}`,
      code: selectedCategory,
      mtd: catObj.mtd || {},
      mqtd: catObj.mqtd || {},
      qtd: catObj.qtd || {},
      htd: catObj.htd || {},
      ytd: catObj.ytd || {},
    };
  }, [selectedCategory, party360, periodComparison]);

  // Normalized Metric Calculations
  const curYtd = activeCategoryMetrics.ytd?.current ?? periodComparison.ytd?.current ?? 0;
  const lyYtd = activeCategoryMetrics.ytd?.lySamePeriod ?? periodComparison.ytd?.lySamePeriod ?? 0;
  const curQtd = activeCategoryMetrics.qtd?.current ?? periodComparison.qtd?.current ?? 0;
  const curMqtd = activeCategoryMetrics.mqtd?.current ?? periodComparison.mqtd?.current ?? 0;
  const curHtd = activeCategoryMetrics.htd?.current ?? periodComparison.htd?.current ?? 0;
  const curMtd = activeCategoryMetrics.mtd?.current ?? periodComparison.mtd?.current ?? 0;
  const ytdGrowth = activeCategoryMetrics.ytd?.growthPercent ?? periodComparison.ytd?.growthPercent ?? 0;

  // 4-Year Trend normalized items
  const trendYears: any[] = (fourYearTrend.years && Array.isArray(fourYearTrend.years) && fourYearTrend.years.length > 0)
    ? fourYearTrend.years
    : [
        { year: 'FY 2023', sales: fourYearTrend.fy23 || 0, yoyGrowth: null },
        { year: 'FY 2024', sales: fourYearTrend.fy24 || 0, yoyGrowth: fourYearTrend.yoy24 },
        { year: 'FY 2025', sales: fourYearTrend.fy25 || 0, yoyGrowth: fourYearTrend.yoy25 },
        { year: 'FY 2026', sales: fourYearTrend.fy26 || 0, yoyGrowth: fourYearTrend.yoy26 },
      ];
  const cagrValue = fourYearTrend.cagr4Year ?? fourYearTrend.cagr ?? 0;

  // Normalized Basket Stats
  const lifetimeSales = basketStats.lifetimeSales || 0;
  const activeMonths = basketStats.activeMonths || 0;
  const totalInvoices = basketStats.totalInvoices || 0;
  const avgMonthlyBuying = activeMonths > 0 ? Math.round(lifetimeSales / activeMonths) : (basketStats.avgMonthlySales || 0);
  const avgOrderValue = totalInvoices > 0 ? Math.round(lifetimeSales / totalInvoices) : (basketStats.avgSalesPerInvoice || 0);

  // Dynamic Target Calculation based on Target Growth % input
  const dynamicCalculations = useMemo(() => {
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
  }, [curYtd, lyYtd, targetGrowthPercent, decliningParts]);

  // Clean Top Parts
  const cleanTopParts = useMemo(() => {
    return topParts.map((p: any, idx: number) => ({
      rank: p.rank || idx + 1,
      partNum: p.partNum,
      rootPartNum: p.rootPartNum || p.partNum,
      cat: p.cat || 'M',
      qty: p.curQty ?? p.qty ?? p.totalQty ?? 0,
      sales: p.curSales ?? p.sales ?? p.totalSales ?? 0,
      sharePercent: p.sharePercent ?? p.revenueShare ?? 0,
    }));
  }, [topParts]);

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

  // Direct Vector PDF Download Handler
  const handleDownloadPDF = () => {
    if (!partyCode || !party360) {
      toast.error('No customer intelligence data available to export');
      return;
    }
    try {
      setIsExportingPDF(true);
      toast.loading('Generating Customer 360 PDF Dossier...', { id: 'export-pdf' });
      generateCustomer360PDF({
        partyCode,
        fiscalYear,
        month,
        targetGrowthPercent,
        profile,
        health,
        periodComparison,
        fourYearTrend,
        branchContribution,
        decliningParts,
        basketStats,
        matrix,
        categories,
        topParts: cleanTopParts,
        recommendedActions,
        growthExplanation,
        nextGrowthRoadmap,
        riskAndSignals,
      });
      toast.success('Customer 360 PDF Downloaded Successfully!', { id: 'export-pdf' });
    } catch (e) {
      console.error('Failed to generate PDF', e);
      toast.error('Failed to generate PDF document', { id: 'export-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
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
          html, body, #__next, main {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            position: static !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10.5px !important;
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
        }
      `}</style>

      {/* ─── TOP CONTROL BAR (CLEAN & INTEGRATED) ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs print-hidden transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          
          {/* Quick Party Search Autocomplete */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchOpen ? partySearch : (currentPartyName ? `${currentPartyName} (${partyCode})` : partyCode)}
                onFocus={() => { setSearchOpen(true); setPartySearch(''); }}
                onChange={(e) => { setPartySearch(e.target.value); setSearchOpen(true); }}
                placeholder="Search party by name, code, city or branch..."
                className="w-full pl-9 pr-16 py-2 text-xs font-semibold bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-hidden focus:ring-3 focus:ring-blue-500/15 transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchOpen && partySearch && (
                  <button
                    onClick={() => setPartySearch('')}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setSearchOpen(!searchOpen); setPartySearch(''); }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 px-2 py-1 rounded-md transition-colors"
                >
                  {searchOpen ? 'Done' : 'Change'}
                </button>
              </div>
            </div>

            {/* Autocomplete dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2.5 bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                  <span>{filteredParties.length} parties found</span>
                  <span className="text-[10px] text-slate-400">Click to load</span>
                </div>
                {filteredParties.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 text-center">
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
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50/60 transition-colors flex items-center justify-between group cursor-pointer ${
                          isSelected ? 'bg-blue-50/80 font-semibold' : ''
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                              {pName}
                            </span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200/80">
                              {pType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-mono font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">
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
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Fiscal Year */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/80 transition-colors">
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
            <div className="flex items-center gap-1.5 bg-slate-100/80 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/80 transition-colors">
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
            <div className="flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200/80 transition-colors">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-blue-900">Target:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={targetGrowthPercent}
                onChange={(e) => setTargetGrowthPercent(Math.max(0, Number(e.target.value)))}
                className="w-10 bg-white text-center text-xs font-bold text-blue-700 border border-blue-300/80 rounded-lg py-0.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
              <span className="text-xs font-bold text-blue-700">%</span>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || !partyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-xs hover:shadow-sm disabled:opacity-50 active:scale-95"
              title="Download comprehensive Excel dossier with all sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            {/* Complete Formatted PDF Download */}
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF || !partyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-xs hover:shadow-sm disabled:opacity-50 active:scale-95"
              title="Download complete formatted multi-page PDF Dossier with all 23 sections"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPDF ? 'Preparing...' : 'PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT WRAPPER ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-4 print:mt-0 print:px-0">
        
        {/* Loading State */}
        {isLoading && !party360 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">Loading Customer Intelligence 360...</div>
            <div className="text-xs text-slate-500 mt-1">Aggregating multi-period transactions, catalog depth, and gap metrics...</div>
          </div>
        )}

        {/* ─── SECTION 1: CUSTOMER PROFILE & STATUS BANNER (POLISHED) ─── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card print-break-inside-avoid">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
            
            {/* Left: Identity */}
            <div className="flex items-start gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md ring-4 ring-blue-50 flex-shrink-0">
                {(profile.partyName || partyCode || 'P').charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {profile.partyName || partyCode}
                  </h2>
                  <span className="font-mono text-xs font-bold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-lg border border-blue-200/70">
                    Code: {profile.partyCode || partyCode}
                  </span>
                  {profile.originalCode && profile.originalCode !== (profile.partyCode || partyCode) && (
                    <span className="font-mono text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/70">
                      Orig: {profile.originalCode}
                    </span>
                  )}
                  <span className="text-xs font-bold tracking-wide uppercase bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200/70">
                    {profile.partyType || 'DEALER'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="text-rose-500">📍</span> Branch: <strong className="text-slate-800">{profile.branchName || profile.branchCode || 'Head Office'}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Since: <strong className="text-slate-800">{basketStats.firstPurchase || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Order: <strong className="text-slate-800">{basketStats.lastPurchase || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" /> Unique Parts: <strong className="text-slate-800">{basketStats.totalUniqueParts || 0}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" /> Invoices: <strong className="text-slate-800">{basketStats.totalInvoices || 0}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Health Score Gauge & Status */}
            <div className="flex items-center gap-3.5 flex-wrap sm:flex-nowrap">
              {/* Branch Contribution */}
              <div className="bg-slate-50/80 px-3.5 py-2.5 rounded-xl border border-slate-200/70 text-right min-w-[140px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Branch Rank & Share</div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-sm font-black text-slate-900">
                    Rank #{branchContribution.branchRank || 1}
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    {branchContribution.branchSharePercent || 0}%
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="bg-slate-50/80 px-3.5 py-2.5 rounded-xl border border-slate-200/70 text-center min-w-[120px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide uppercase border ${
                  health.status === 'GROWING' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                  health.status === 'STABLE' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  health.status === 'DECLINING' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                  'bg-rose-50 text-rose-700 border-rose-300'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {health.status}
                </span>
              </div>

              {/* Health Score */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white px-4 py-2.5 rounded-xl shadow-xs">
                <div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Health Index</div>
                  <div className="text-xl font-black tracking-tight">{health.score}<span className="text-xs font-medium text-slate-400">/100</span></div>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar (Clean Modern Pills) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lifetime Sales</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{formatLakhs(lifetimeSales)}</div>
            </div>
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Monthly Buying</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{formatLakhs(avgMonthlyBuying)}</div>
            </div>
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Order Value</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(avgOrderValue)}</div>
            </div>
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active History</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{activeMonths} Months</div>
            </div>
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Qty / Invoice</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{basketStats.avgQtyPerInvoice || 0} Units</div>
            </div>
            <div className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 transition-colors">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lines / Invoice</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{basketStats.avgLinesPerInvoice || 0} Items</div>
            </div>
          </div>
        </section>


        {/* ─── CATEGORY SELECTOR & FILTER TOOLBAR ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Category Focus:
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700'
              }`}
            >
              All Categories Combined
            </button>
            {categories.map((c: any) => (
              <button
                key={c.cat}
                onClick={() => setSelectedCategory(c.cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedCategory === c.cat
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700'
                }`}
              >
                <span className={`w-4 h-4 rounded-md text-[10px] font-mono flex items-center justify-center font-black ${
                  selectedCategory === c.cat ? 'bg-white text-blue-700' : 'bg-blue-100/80 text-blue-800'
                }`}>
                  {c.cat}
                </span>
                <span>Category {c.cat}</span>
                <span className="text-[10px] opacity-75 font-normal">({c.sharePercent}%)</span>
              </button>
            ))}
          </div>
          {selectedCategory !== 'ALL' && (
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>

        {/* ─── SECTION 2: PRIMARY 7 KPI METRIC TILES (SLEEK EXECUTIVE FINISH) ─── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          
          {/* Tile 1: YTD Sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card hover:border-blue-400/80 transition-all hover:shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  YTD Sales {selectedCategory !== 'ALL' ? `(${selectedCategory})` : '(Apr-Sep)'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                  FY{fiscalYear}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1 tracking-tight">
                {formatLakhs(curYtd)}
              </div>
              <div className="text-xs font-mono font-semibold text-slate-400 mt-0.5">
                {formatCurrency(curYtd)}
              </div>
            </div>

            {/* In Same Card: LY YTD & Growth */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">LY Same Period:</span>
                <span className="font-mono font-bold text-slate-700">{formatLakhs(lyYtd)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400 font-medium">YoY Growth:</span>
                <span className={`font-bold inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono ${
                  ytdGrowth >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                }`}>
                  {ytdGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatGrowth(ytdGrowth)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-200/40">
                <span>Qty Units:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {(activeCategoryMetrics.ytd.curQty || 0).toLocaleString('en-IN')} <span className="text-slate-400">vs</span> {(activeCategoryMetrics.ytd.lyQty || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Invoices:</span>
                <span className="font-mono">{activeCategoryMetrics.ytd.curInvoices || 0} vs {activeCategoryMetrics.ytd.lyInvoices || 0}</span>
              </div>
            </div>
          </div>

          {/* Tile 2: QTD Sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card hover:border-indigo-400/80 transition-all hover:shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  QTD Sales {selectedCategory !== 'ALL' ? `(${selectedCategory})` : '(Jul-Sep)'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                  Q2
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1 tracking-tight">
                {formatLakhs(curQtd)}
              </div>
              <div className="text-xs font-mono font-semibold text-slate-400 mt-0.5">
                {formatCurrency(curQtd)}
              </div>
            </div>

            {/* In Same Card: LY QTD & Growth */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">LY Same Period:</span>
                <span className="font-mono font-bold text-slate-700">{formatLakhs(activeCategoryMetrics.qtd.lySamePeriod)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400 font-medium">YoY Growth:</span>
                <span className={`font-bold inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono ${
                  (activeCategoryMetrics.qtd.growthPercent || 0) >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                }`}>
                  {(activeCategoryMetrics.qtd.growthPercent || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatGrowth(activeCategoryMetrics.qtd.growthPercent)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-200/40">
                <span>Qty Units:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {(activeCategoryMetrics.qtd.curQty || 0).toLocaleString('en-IN')} <span className="text-slate-400">vs</span> {(activeCategoryMetrics.qtd.lyQty || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Invoices:</span>
                <span className="font-mono">{activeCategoryMetrics.qtd.curInvoices || 0} vs {activeCategoryMetrics.qtd.lyInvoices || 0}</span>
              </div>
            </div>
          </div>

          {/* Tile 3: MTD Sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card hover:border-emerald-400/80 transition-all hover:shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  MTD Sales {selectedCategory !== 'ALL' ? `(${selectedCategory})` : `(${month})`}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono">
                  {month}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1 tracking-tight">
                {formatLakhs(curMtd)}
              </div>
              <div className="text-xs font-mono font-semibold text-slate-400 mt-0.5">
                {formatCurrency(curMtd)}
              </div>
            </div>

            {/* In Same Card: LY MTD & Growth */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">LY Same Period:</span>
                <span className="font-mono font-bold text-slate-700">{formatLakhs(activeCategoryMetrics.mtd.lySamePeriod)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400 font-medium">YoY Growth:</span>
                <span className={`font-bold inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono ${
                  (activeCategoryMetrics.mtd.growthPercent || 0) >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                }`}>
                  {(activeCategoryMetrics.mtd.growthPercent || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatGrowth(activeCategoryMetrics.mtd.growthPercent)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-200/40">
                <span>Qty Units:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {(activeCategoryMetrics.mtd.curQty || 0).toLocaleString('en-IN')} <span className="text-slate-400">vs</span> {(activeCategoryMetrics.mtd.lyQty || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Invoices:</span>
                <span className="font-mono">{activeCategoryMetrics.mtd.curInvoices || 0} vs {activeCategoryMetrics.mtd.lyInvoices || 0}</span>
              </div>
            </div>
          </div>

          {/* Tile 4: MQTD Sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card hover:border-slate-300 transition-all hover:shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MQTD Sales</div>
              <div className="text-lg font-black text-slate-900 mt-1 tracking-tight">
                {formatLakhs(curMqtd)}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {formatCurrency(curMqtd)}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">LY MQTD:</span>
                <span className="font-mono font-bold text-slate-700">{formatLakhs(activeCategoryMetrics.mqtd.lySamePeriod)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400 font-medium">YoY %:</span>
                <span className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                  (activeCategoryMetrics.mqtd.growthPercent || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {formatGrowth(activeCategoryMetrics.mqtd.growthPercent)}
                </span>
              </div>
            </div>
          </div>

          {/* Tile 5: HTD Sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card hover:border-slate-300 transition-all hover:shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HTD Sales (H1)</div>
              <div className="text-lg font-black text-slate-900 mt-1 tracking-tight">
                {formatLakhs(curHtd)}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {formatCurrency(curHtd)}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">LY HTD:</span>
                <span className="font-mono font-bold text-slate-700">{formatLakhs(activeCategoryMetrics.htd.lySamePeriod)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400 font-medium">YoY %:</span>
                <span className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                  (activeCategoryMetrics.htd.growthPercent || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {formatGrowth(activeCategoryMetrics.htd.growthPercent)}
                </span>
              </div>
            </div>
          </div>

          {/* Tile 6: Target Achievement % */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-2xl border border-blue-200/80 p-3.5 shadow-xs flex flex-col justify-between print-card">
            <div>
              <div className="text-[10px] font-bold text-blue-900/80 uppercase tracking-wider">Target Achieved</div>
              <div className="text-2xl font-black text-blue-700 mt-1 font-mono tracking-tight">
                {dynamicCalculations.dynamicAchievementPercent.toFixed(1)}%
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-blue-100/80 bg-blue-50/50 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-blue-800/80 font-medium">Target:</span>
                <span className="font-mono font-bold text-blue-950">{formatLakhs(dynamicCalculations.dynamicTarget)}</span>
              </div>
              <div className="text-[10px] font-mono text-blue-600 text-right mt-0.5">
                {formatCurrency(dynamicCalculations.dynamicTarget)}
              </div>
            </div>
          </div>

          {/* Tile 7: Target Gap / Surplus */}
          <div className={`rounded-2xl border p-3.5 shadow-xs flex flex-col justify-between print-card ${
            dynamicCalculations.dynamicGap > 0
              ? 'bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white border-amber-200/80'
              : 'bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white border-emerald-200/80'
          }`}>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {dynamicCalculations.dynamicGap > 0 ? 'Target Gap' : 'Target Surplus'}
              </div>
              <div className={`text-2xl font-black mt-1 font-mono tracking-tight ${
                dynamicCalculations.dynamicGap > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {formatLakhs(Math.abs(dynamicCalculations.dynamicGap))}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {formatCurrency(Math.abs(dynamicCalculations.dynamicGap))}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200/50 bg-white/60 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Objective:</span>
                <span className="font-bold text-slate-800">+{targetGrowthPercent}% YoY</span>
              </div>
            </div>
          </div>

        </section>


        {/* ─── SECTION 3: PERFORMANCE VS LAST YEAR TABLE (SAME PERIOD COMPARISON) ─── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print-card print-break-inside-avoid">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Period Performance vs Last Year (Exact Same-Period Comparison)
                </h3>
                <div className="text-[11px] text-slate-400">
                  Like-for-like timeframe comparison across Sales turnover, Unit quantities, and Targets
                </div>
              </div>
              {selectedCategory !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-md bg-blue-100/80 text-blue-800 text-[10px] font-bold">
                  Category {selectedCategory}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              *Real-time computed data
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/40 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-3 text-right">FY{fiscalYear} (Current ₹)</th>
                  <th className="py-3 px-3 text-right">FY{fiscalYear - 1} (LY Same Period ₹)</th>
                  <th className="py-3 px-3 text-right">YoY Sales %</th>
                  <th className="py-3 px-3 text-right">Net Variance (₹)</th>
                  <th className="py-3 px-3 text-right">Current Qty</th>
                  <th className="py-3 px-3 text-right">LY Qty</th>
                  <th className="py-3 px-3 text-right">Qty %</th>
                  <th className="py-3 px-3 text-right">Target (+{targetGrowthPercent}%)</th>
                  <th className="py-3 px-4 text-right">Target Ach %</th>
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
                  const pData = (activeCategoryMetrics as any)[row.key] || {};
                  const cur = pData.current ?? pData.curSales ?? 0;
                  const ly = pData.lySamePeriod ?? pData.lySales ?? 0;
                  const growth = pData.growthPercent ?? 0;
                  const diff = pData.diffAmount ?? (cur - ly);
                  const curQ = pData.curQty ?? 0;
                  const lyQ = pData.lyQty ?? 0;
                  const qGrowth = pData.qtyGrowthPercent ?? (lyQ > 0 ? (curQ - lyQ) / lyQ : 0);
                  const tgt = Math.round(ly * (1 + targetGrowthPercent / 100));
                  const ach = tgt > 0 ? (cur / tgt) * 100 : (cur > 0 ? 100 : 0);
                  const isPositive = growth >= 0;

                  return (
                    <tr
                      key={row.key}
                      className={`hover:bg-slate-50/90 transition-colors ${row.isPrimary ? 'bg-blue-50/40 font-bold' : ''}`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        {row.isPrimary && <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />}
                        <span className={row.isPrimary ? 'text-blue-900 font-bold' : ''}>{row.label}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900">
                        <div className="font-bold">{formatCurrency(cur)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatLakhs(cur)}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        <div>{formatCurrency(ly)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatLakhs(ly)}</div>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {formatGrowth(growth)}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-semibold ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900">
                        {curQ.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {lyQ.toLocaleString('en-IN')}
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${qGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatGrowth(qGrowth)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(tgt)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] inline-block ${
                          ach >= 100 ? 'bg-emerald-100/80 text-emerald-800' :
                          ach >= 80 ? 'bg-blue-100/80 text-blue-800' :
                          'bg-amber-100/80 text-amber-800'
                        }`}>
                          {ach.toFixed(1)}%
                        </span>
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  4-Year Sales History & CAGR
                </h3>
              </div>
              <div className="text-xs font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200/70">
                4Y CAGR: {cagrValue}%
              </div>
            </div>

            {/* 4 Year Bars Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {trendYears.map((yr: any, idx: number) => (
                <div
                  key={yr.year || idx}
                  className={`p-2.5 rounded-xl border text-center transition-colors ${
                    idx === trendYears.length - 1
                      ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                      : 'bg-slate-50/70 border-slate-200/70'
                  }`}
                >
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{yr.year}</div>
                  <div className="text-xs font-black text-slate-900 mt-1 font-mono">
                    {formatLakhs(yr.sales)}
                  </div>
                  {yr.yoyGrowth !== undefined && yr.yoyGrowth !== null ? (
                    <div className={`text-[10px] font-bold mt-0.5 ${yr.yoyGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatGrowth(yr.yoyGrowth)}
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
                  data={trendYears.map((y: any) => ({
                    year: y.year,
                    sales: Number(((y.sales || 0) / 100000).toFixed(2)),
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="L" />
                  <Tooltip
                    formatter={(val: any) => [`₹${val} Lakhs`, 'Turnover']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="sales" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Seasonality Progression */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Monthly Run-Rate (FY{fiscalYear} vs FY{fiscalYear - 1})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Apr - Mar Invoicing</span>
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
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="k" />
                  <Tooltip
                    formatter={(val: any) => [`₹${(Number(val) * 1000).toLocaleString('en-IN')}`, 'Sales']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cur"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCurSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-slate-400 text-center mt-2">
              Monthly invoicing volume (in thousands ₹)
            </div>
          </div>
        </section>

        {/* ─── SECTION 5: CATEGORY-WISE INTELLIGENCE & SAME-PERIOD PERFORMANCE ─── */}
        <section className="space-y-4 print-break-inside-avoid">
          
          {/* Header Bar with Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Category-Wise Performance & Same-Period Comparative Matrix
                </h3>
                <p className="text-[11px] text-slate-400">
                  MTD, QTD, and YTD analysis vs Last Year Same Period with Sales, Qty, and growth %
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60">
              <button
                onClick={() => setCategoryViewMode('cards')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  categoryViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Comparative Cards
              </button>
              <button
                onClick={() => setCategoryViewMode('table')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  categoryViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Detailed Matrix Table
              </button>
            </div>
          </div>


          {/* Mode 1: Comparative Category Cards Grid */}
          {categoryViewMode === 'cards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {categories.map((c: any) => {
                const cMtd = c.mtd || {};
                const cQtd = c.qtd || {};
                const cYtd = c.ytd || {};
                const isSelected = selectedCategory === c.cat;

                return (
                  <div
                    key={c.cat}
                    onClick={() => setSelectedCategory(isSelected ? 'ALL' : c.cat)}
                    className={`bg-white rounded-xl border p-4 shadow-xs cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-400/20 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold font-mono shadow-xs">
                          {c.cat}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Category {c.cat}
                          </h4>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Unique Parts: <strong className="text-slate-700">{c.uniquePartlines || 0}</strong></span>
                            <span>•</span>
                            <span>Invoices: <strong className="text-slate-700">{c.totalInvoices || 0}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Share</span>
                        <div className="text-sm font-extrabold text-blue-700 font-mono">
                          {c.sharePercent}%
                        </div>
                      </div>
                    </div>

                    {/* 3-Column Comparative Grid: MTD | QTD | YTD */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
                      
                      {/* Pillar 1: MTD */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>MTD ({month})</span>
                          <span className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                            (cMtd.growthPercent || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {formatGrowth(cMtd.growthPercent)}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 mt-1 font-mono">
                          {formatLakhs(cMtd.current)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatCurrency(cMtd.current)}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                          <div>LY: <strong className="font-mono text-slate-700">{formatLakhs(cMtd.lySamePeriod)}</strong></div>
                          <div className="mt-0.5 text-[9px]">Qty: {(cMtd.curQty || 0).toLocaleString('en-IN')} vs {(cMtd.lyQty || 0).toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      {/* Pillar 2: QTD */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>QTD (Q2)</span>
                          <span className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                            (cQtd.growthPercent || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {formatGrowth(cQtd.growthPercent)}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 mt-1 font-mono">
                          {formatLakhs(cQtd.current)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatCurrency(cQtd.current)}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                          <div>LY: <strong className="font-mono text-slate-700">{formatLakhs(cQtd.lySamePeriod)}</strong></div>
                          <div className="mt-0.5 text-[9px]">Qty: {(cQtd.curQty || 0).toLocaleString('en-IN')} vs {(cQtd.lyQty || 0).toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      {/* Pillar 3: YTD */}
                      <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between text-[10px] font-bold text-blue-900 uppercase">
                          <span>YTD (H1)</span>
                          <span className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                            (cYtd.growthPercent || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {formatGrowth(cYtd.growthPercent)}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 mt-1 font-mono">
                          {formatLakhs(cYtd.current)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatCurrency(cYtd.current)}
                        </div>
                        <div className="mt-2 pt-1 border-t border-blue-200/60 text-[10px] text-slate-600">
                          <div>LY: <strong className="font-mono text-slate-800">{formatLakhs(cYtd.lySamePeriod)}</strong></div>
                          <div className="mt-0.5 text-[9px]">Qty: {(cYtd.curQty || 0).toLocaleString('en-IN')} vs {(cYtd.lyQty || 0).toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mode 2: Detailed Matrix Table */}
          {categoryViewMode === 'table' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">MTD Cur (₹)</th>
                      <th className="py-2.5 px-3 text-right">MTD LY (₹)</th>
                      <th className="py-2.5 px-3 text-right">MTD %</th>
                      <th className="py-2.5 px-3 text-right">MTD Qty</th>
                      <th className="py-2.5 px-3 text-right">QTD Cur (₹)</th>
                      <th className="py-2.5 px-3 text-right">QTD LY (₹)</th>
                      <th className="py-2.5 px-3 text-right">QTD %</th>
                      <th className="py-2.5 px-3 text-right">YTD Cur (₹)</th>
                      <th className="py-2.5 px-3 text-right">YTD LY (₹)</th>
                      <th className="py-2.5 px-3 text-right">YTD %</th>
                      <th className="py-2.5 px-3 text-right">YTD Qty</th>
                      <th className="py-2.5 px-3 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                    {categories.map((c: any) => {
                      const cM = c.mtd || {};
                      const cQ = c.qtd || {};
                      const cY = c.ytd || {};
                      return (
                        <tr key={c.cat} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-mono">
                              {c.cat}
                            </span>
                            <span>Category {c.cat}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(cM.current)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{formatCurrency(cM.lySamePeriod)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${(cM.growthPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatGrowth(cM.growthPercent)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{(cM.curQty || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(cQ.current)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{formatCurrency(cQ.lySamePeriod)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${(cQ.growthPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatGrowth(cQ.growthPercent)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(cY.current)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{formatCurrency(cY.lySamePeriod)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${(cY.growthPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatGrowth(cY.growthPercent)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{(cY.curQty || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">{c.sharePercent}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 5 Parts YTD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print-card">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Top 5 Partline Revenue Contributors (YTD)
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Ranked by Value</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/40 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Part #</th>
                    <th className="py-2.5 px-3">Cat</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">YTD Sales</th>
                    <th className="py-2.5 px-4 text-right">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {cleanTopParts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-slate-400 text-xs">No part items recorded</td>
                    </tr>
                  ) : (
                    cleanTopParts.slice(0, 5).map((p: any) => (
                      <tr key={p.partNum} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{p.partNum}</div>
                          {p.rootPartNum && (
                            <div className="text-[10px] text-slate-400">Root: {p.rootPartNum}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                            {p.cat || 'M'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {Number(p.qty).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(p.sales)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-blue-700 font-bold">
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
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print-card print-break-inside-avoid">
          <div className="px-5 py-3.5 bg-amber-50/50 border-b border-amber-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100/80 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Product Decline & Lost Volume Analysis (Immediate Pitch Targets)
                </h3>
                <div className="text-[11px] text-amber-800/80">
                  Parts where purchasing has slowed down or dropped significantly compared to last year's pace
                </div>
              </div>
            </div>
            <div className="text-xs font-extrabold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300/80">
              {decliningParts.length} Parts with Gaps
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/40 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Part Num</th>
                  <th className="py-3 px-2">Cat</th>
                  <th className="py-3 px-2 text-right">LY Qty</th>
                  <th className="py-3 px-2 text-right">Cur Qty</th>
                  <th className="py-3 px-2 text-right">Qty Gap</th>
                  <th className="py-3 px-3 text-right">LY Sales</th>
                  <th className="py-3 px-3 text-right">Cur Sales</th>
                  <th className="py-3 px-2 text-right">4Y Max</th>
                  <th className="py-3 px-3 text-right">Opportunity</th>
                  <th className="py-3 px-4">Pitch Action</th>
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
                    <tr key={p.partNum} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{p.partNum}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Root: {p.rootPartNum || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                          {p.cat || 'M'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-500">
                        {p.lyQty}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                        {p.curQty}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-extrabold text-rose-600">
                        {p.qtyGap}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {formatCurrency(p.lySales)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900 font-semibold">
                        {formatCurrency(p.curSales)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-400">
                        {p.maxHistoricalQty || p.avg4yQty || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-700">
                        {formatCurrency(p.opportunityValue)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200/70">
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
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card print-break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Target Achievement Engine — 5-Pillar Gap Decomposition (100% Coverage)
                </h3>
                <div className="text-[11px] text-slate-400">
                  Actionable bridge showing exactly where to extract the {formatLakhs(dynamicCalculations.dynamicGap)} required to hit the +{targetGrowthPercent}% growth target
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <span className="text-slate-400">Target Gap:</span>
              <span className="text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/70">
                {formatLakhs(dynamicCalculations.dynamicGap)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-4">
            {/* Pillar 1: Lost Volume Recovery */}
            <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>1. Lost Part Volume</span>
                  <span className="text-blue-600 font-mono">30%</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  {formatLakhs(dynamicCalculations.pillars.lostPartVol)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Recover {decliningParts.length} dropped parts back to previous year buying rates.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Action: Reorder Campaign
              </div>
            </div>

            {/* Pillar 2: Category Expansion */}
            <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>2. Category Expansion</span>
                  <span className="text-blue-600 font-mono">25%</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  {formatLakhs(dynamicCalculations.pillars.catExpansion)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Introduce low-share categories currently &lt;15% of customer's basket.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Action: Basket Diversification
              </div>
            </div>

            {/* Pillar 3: Fast Moving Branch Movers */}
            <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>3. Branch Fast Movers</span>
                  <span className="text-blue-600 font-mono">20%</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  {formatLakhs(dynamicCalculations.pillars.fastMovers)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Sell top branch fast-sellers that this customer has never ordered.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Action: Cross-Benchmarking
              </div>
            </div>

            {/* Pillar 4: Cross Sell Root Parts */}
            <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>4. Cross-Sell Root Parts</span>
                  <span className="text-blue-600 font-mono">15%</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  {formatLakhs(dynamicCalculations.pillars.crossSell)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Pitch complementary parts tied to active root part families.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Action: Family Bundles
              </div>
            </div>

            {/* Pillar 5: Dormant Reactivation */}
            <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>5. Dormant Recovery</span>
                  <span className="text-blue-600 font-mono">10%</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  {formatLakhs(dynamicCalculations.pillars.dormantRecovery)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Reactivate core catalog items ordered in FY23-FY24 but silent this year.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Action: Historical Winback
              </div>
            </div>
          </div>
        </section>


        {/* ─── SECTION 8: TOP 5 RECOMMENDED NEXT BEST ACTIONS (DATA-DRIVEN PLAYBOOK) ─── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card print-break-inside-avoid">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Top 5 Recommended Next Best Actions (Field Rep Sales Playbook)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/70">
              Targeted Revenue Boost
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 mt-4">
            {recommendedActions.length === 0 ? (
              <div className="col-span-5 p-6 text-center text-xs text-slate-400">
                No immediate action playbooks required. Account purchasing is on-track.
              </div>
            ) : (
              recommendedActions.map((act: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        #{act.rank || idx + 1}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        act.priority === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-200/80' :
                        act.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200/80' :
                        'bg-blue-50 text-blue-700 border border-blue-200/80'
                      }`}>
                        {act.priority}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-2">
                      {act.title}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {act.reason}
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">Value:</span>
                    <span className="text-xs font-black text-emerald-700 font-mono">
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  YTD Growth Drivers & Attribution
                </h3>
              </div>
              <span className={`text-xs font-black font-mono ${growthExplanation.totalGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {growthExplanation.totalGrowth >= 0 ? '+' : ''}{formatLakhs(growthExplanation.totalGrowth)}
              </span>
            </div>

            <div className="space-y-3">
              {growthExplanation.components.map((comp: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <span className="text-slate-700 font-medium">{comp.label}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(comp.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              *Growth drivers isolate category volume expansion, root part depth, and price mix adjustments.
            </div>
          </div>

          {/* Next Growth Roadmap */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs print-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Where Can We Get the Next {targetGrowthPercent}%?
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/70">
                Confidence-Rated
              </span>
            </div>

            <div className="space-y-2.5">
              {nextGrowthRoadmap.map((road: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-900 truncate">{road.opportunity}</div>
                    <div className="text-[10px] text-slate-400">{road.confidence}</div>
                  </div>
                  <div className="font-mono font-black text-emerald-700 flex-shrink-0">
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
          <div className="bg-rose-50/40 rounded-2xl border border-rose-200/70 p-5 shadow-xs print-card">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-7 h-7 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                Attention Required (Risk Factors & Volume Drops)
              </h3>
            </div>
            {riskAndSignals.attentionRequired.length === 0 ? (
              <div className="text-xs text-rose-700">No critical risk signals flagged for this account.</div>
            ) : (
              <ul className="space-y-2.5">
                {riskAndSignals.attentionRequired.map((risk: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-rose-900">
                    <span className="text-rose-500 font-bold mt-0.5">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Positive Signals (Growth Catalysts) */}
          <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200/70 p-5 shadow-xs print-card">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                Positive Signals (Growth Catalysts & Strengths)
              </h3>
            </div>
            {riskAndSignals.positiveSignals.length === 0 ? (
              <div className="text-xs text-emerald-700">Maintaining standard historical turnover baseline.</div>
            ) : (
              <ul className="space-y-2.5">
                {riskAndSignals.positiveSignals.map((pos: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-emerald-900">
                    <span className="text-emerald-500 font-bold mt-0.5">✓</span>
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
