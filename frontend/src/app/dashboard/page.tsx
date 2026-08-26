'use client';
import React, { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import {
  TrendingUp, TrendingDown, Calendar, Building2, Filter, RefreshCw,
  Layers, Code2, Copy, Check, Info, Sparkles, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, BarChart3, ChevronDown, ChevronUp, ShieldCheck,
  CheckSquare, Square, Zap, Clock, Compass, Activity, Users, ArrowRight, Lock,
  Search, Download
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LabelList
} from 'recharts';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── POWER BI / DAX MEASURES SPECIFICATION ────────────────────────────────────
const DAX_MEASURES = [
  {
    name: '1. FTD (Trading Date)',
    tag: 'FTD',
    color: 'from-blue-600 to-cyan-500',
    dax: `// FTD — Trading Date (Last completed business day)
Sales FTD = 
VAR MaxDate = MAX('Sales'[SalesDate])
RETURN
CALCULATE([Total Sales], 'Sales'[SalesDate] = MaxDate)

Sales LM FTD = 
VAR MaxDate = MAX('Sales'[SalesDate])
VAR LMDate = EDATE(MaxDate, -1)
RETURN
CALCULATE([Total Sales], 'Sales'[SalesDate] = LMDate)

Sales LY FTD = 
VAR MaxDate = MAX('Sales'[SalesDate])
VAR LYDate = SAMEPERIODLASTYEAR('Sales'[SalesDate])
RETURN
CALCULATE([Total Sales], 'Sales'[SalesDate] = LYDate)

FTD Growth % vs LM = 
DIVIDE([Sales FTD] - [Sales LM FTD], [Sales LM FTD], 0) * 100`,
  },
  {
    name: '2. MTD (Month To Date)',
    tag: 'MTD',
    color: 'from-emerald-600 to-teal-500',
    dax: `// MTD — Month To Date (1st of month to current elapsed day)
Sales MTD = 
TOTALMTD([Total Sales], 'Date'[Date])

Sales LM MTD = 
VAR CurrentDay = DAY(MAX('Date'[Date]))
RETURN
CALCULATE(
    [Total Sales],
    DATEADD('Date'[Date], -1, MONTH),
    DAY('Date'[Date]) <= CurrentDay
)

Sales LY MTD = 
VAR CurrentDay = DAY(MAX('Date'[Date]))
RETURN
CALCULATE(
    [Total Sales],
    SAMEPERIODLASTYEAR('Date'[Date]),
    DAY('Date'[Date]) <= CurrentDay
)

MTD Growth % vs LM = 
DIVIDE([Sales MTD] - [Sales LM MTD], [Sales LM MTD], 0) * 100`,
  },
  {
    name: '3. QTD (Quarter To Date - Fair Elapsed Days)',
    tag: 'QTD',
    color: 'from-purple-600 to-indigo-500',
    dax: `// QTD — Quarter To Date (Fair elapsed days comparison)
Sales QTD = 
TOTALQTD([Total Sales], 'Date'[Date])

Sales LQ QTD = 
VAR QtrStart = STARTOFQUARTER('Date'[Date])
VAR CurrentDate = MAX('Date'[Date])
VAR ElapsedDays = DATEDIFF(QtrStart, CurrentDate, DAY)
VAR PrevQtrStart = EDATE(QtrStart, -3)
RETURN
CALCULATE(
    [Total Sales],
    DATESBETWEEN('Date'[Date], PrevQtrStart, PrevQtrStart + ElapsedDays)
)

Sales LY QTD = 
CALCULATE([Sales QTD], SAMEPERIODLASTYEAR('Date'[Date]))

QTD Growth % vs LQ = 
DIVIDE([Sales QTD] - [Sales LQ QTD], [Sales LQ QTD], 0) * 100`,
  },
  {
    name: '4. YTD (Year To Date - April to March Financial Year)',
    tag: 'YTD',
    color: 'from-amber-500 to-orange-500',
    dax: `// YTD — Year To Date (1-Apr to current date)
Sales YTD = 
TOTALYTD([Total Sales], 'Date'[Date], "03-31")

Sales LY YTD = 
CALCULATE(
    [Sales YTD],
    SAMEPERIODLASTYEAR('Date'[Date])
)

YTD Growth % vs LY = 
DIVIDE([Sales YTD] - [Sales LY YTD], [Sales LY YTD], 0) * 100`,
  },
];

// ─── PREMIUM EXECUTIVE KPI CARD COMPONENT ────────────────────────────────────
function PremiumKPICard({
  tag,
  periodLabel,
  primaryValue,
  lmValue,
  lmLabel,
  lmGrowth,
  lyValue,
  lyLabel,
  lyGrowth,
  theme,
  icon: Icon,
}: {
  tag: string;
  periodLabel: string;
  primaryValue: string;
  lmValue?: string;
  lmLabel?: string;
  lmGrowth?: number;
  lyValue?: string;
  lyLabel?: string;
  lyGrowth?: number;
  theme: 'ftd' | 'mtd' | 'qtd' | 'ytd';
  icon: any;
}) {
  const styles = {
    ftd: {
      bg: 'bg-white border-slate-200/90',
      iconBg: 'bg-[#053D3A] text-white',
      accentText: 'text-slate-900',
    },
    mtd: {
      bg: 'bg-white border-slate-200/90',
      iconBg: 'bg-[#053D3A] text-white',
      accentText: 'text-slate-900',
    },
    qtd: {
      bg: 'bg-white border-slate-200/90',
      iconBg: 'bg-[#1F1F45] text-white',
      accentText: 'text-slate-900',
    },
    ytd: {
      bg: 'bg-[#FFF8EC] border-[#FFE2B8]',
      iconBg: 'bg-[#9A6500] text-white',
      accentText: 'text-amber-950',
    },
  }[theme];

  const primaryGrowth = lmGrowth !== undefined ? lmGrowth : lyGrowth;

  return (
    <div
      className={`rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 ${styles.bg} border flex flex-col justify-between min-h-[155px]`}
    >
      <div>
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}>
              <Icon size={17} />
            </div>
            <div>
              <span className="font-black text-xs text-slate-900 tracking-tight uppercase block leading-none">
                {tag}
              </span>
              <span className="text-[10px] font-bold text-slate-500 block leading-tight mt-0.5">
                {periodLabel}
              </span>
            </div>
          </div>

          {primaryGrowth !== undefined && (
            <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-0.5 border ${
              primaryGrowth >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {primaryGrowth >= 0 ? <ArrowUpRight size={11} className="text-emerald-600" /> : <ArrowDownRight size={11} className="text-rose-600" />}
              <span>
                {primaryGrowth >= 0 ? '' : ''}{primaryGrowth}%
              </span>
            </div>
          )}
        </div>

        {/* Primary Metric Value */}
        <div className="mt-1">
          <p className={`text-2xl font-black ${styles.accentText} tracking-tight font-sans`}>
            {primaryValue}
          </p>
        </div>
      </div>

      {/* Comparison Structured Sub-Panel */}
      <div className="mt-3 pt-2 border-t border-slate-200/60 space-y-1.5 text-[10px] font-sans">
        {lmValue && (
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-semibold truncate max-w-[155px]" title={lmLabel}>
              {lmLabel}:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 font-mono text-[11px]">{lmValue}</span>
              {lmGrowth !== undefined && (
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                  lmGrowth >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {lmGrowth >= 0 ? '↗' : '↘'} {lmGrowth}%
                </span>
              )}
            </div>
          </div>
        )}

        {lyValue && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-600 font-semibold truncate max-w-[155px]" title={lyLabel}>
              {lyLabel}:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 font-mono text-[11px]">{lyValue}</span>
              {lyGrowth !== undefined && (
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                  lyGrowth >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {lyGrowth >= 0 ? '↑' : '↓'} {lyGrowth}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOCATION-WISE EXECUTIVE DATAGRID MATRIX COMPONENT ─────────────────────
function LocationGridTable({ locationGrid, asOf }: { locationGrid: any[]; asOf?: any }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return locationGrid;
    const term = searchTerm.toLowerCase().trim();
    return locationGrid.filter(
      (item) =>
        (item.loc && item.loc.toLowerCase().includes(term)) ||
        (item.branchName && item.branchName.toLowerCase().includes(term))
    );
  }, [locationGrid, searchTerm]);

  // Compute totals across all visible locations
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        acc.ftd += item.ftd?.current || 0;
        acc.ftdLm += item.ftd?.lm || 0;
        acc.ftdLy += item.ftd?.ly || 0;

        acc.mtd += item.mtd?.current || 0;
        acc.mtdLm += item.mtd?.lm || 0;
        acc.mtdLy += item.mtd?.ly || 0;

        acc.qtd += item.qtd?.current || 0;
        acc.qtdLq += item.qtd?.lq || 0;
        acc.qtdLy += item.qtd?.ly || 0;

        acc.ytd += item.ytd?.current || 0;
        acc.ytdLy += item.ytd?.ly || 0;
        return acc;
      },
      { ftd: 0, ftdLm: 0, ftdLy: 0, mtd: 0, mtdLm: 0, mtdLy: 0, qtd: 0, qtdLq: 0, qtdLy: 0, ytd: 0, ytdLy: 0 }
    );
  }, [filteredData]);

  const ftdTotalGrowthLM = totals.ftdLm > 0 ? ((totals.ftd - totals.ftdLm) / totals.ftdLm) * 100 : 0;
  const ftdTotalGrowthLY = totals.ftdLy > 0 ? ((totals.ftd - totals.ftdLy) / totals.ftdLy) * 100 : 0;
  const mtdTotalGrowthLM = totals.mtdLm > 0 ? ((totals.mtd - totals.mtdLm) / totals.mtdLm) * 100 : 0;
  const mtdTotalGrowthLY = totals.mtdLy > 0 ? ((totals.mtd - totals.mtdLy) / totals.mtdLy) * 100 : 0;
  const qtdTotalGrowthLQ = totals.qtdLq > 0 ? ((totals.qtd - totals.qtdLq) / totals.qtdLq) * 100 : 0;
  const qtdTotalGrowthLY = totals.qtdLy > 0 ? ((totals.qtd - totals.qtdLy) / totals.qtdLy) * 100 : 0;
  const ytdTotalGrowthLY = totals.ytdLy > 0 ? ((totals.ytd - totals.ytdLy) / totals.ytdLy) * 100 : 0;

  const formatVal = (val: number): string => {
    if (!val || isNaN(val)) return '0';
    const abs = Math.abs(val);
    if (abs >= 10000000) return `${val < 0 ? '-' : ''}${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `${val < 0 ? '-' : ''}${(abs / 100000).toFixed(2)} L`;
    if (abs >= 1000) return `${val < 0 ? '-' : ''}${(abs / 1000).toFixed(1)} K`;
    return `${val < 0 ? '-' : ''}${Math.round(abs).toLocaleString('en-IN')}`;
  };

  const handleExportCSV = () => {
    if (!filteredData || filteredData.length === 0) return;
    const headers = [
      'Loc Code', 'Branch Name',
      'FTD', 'LM FTD', 'LY FTD', 'FTD Growth vs LM (%)', 'FTD Growth vs LY (%)',
      'MTD', 'LM MTD', 'LY MTD', 'MTD Growth vs LM (%)', 'MTD Growth vs LY (%)',
      'QTD', 'LQ QTD', 'LY QTD', 'QTD Growth vs LQ (%)', 'QTD Growth vs LY (%)',
      'YTD', 'LY YTD', 'YTD YoY Growth (%)'
    ];
    const rows = filteredData.map(r => [
      r.loc,
      `"${r.branchName}"`,
      r.ftd?.current || 0, r.ftd?.lm || 0, r.ftd?.ly || 0, r.ftd?.growthLM || 0, r.ftd?.growthLY || 0,
      r.mtd?.current || 0, r.mtd?.lm || 0, r.mtd?.ly || 0, r.mtd?.growthLM || 0, r.mtd?.growthLY || 0,
      r.qtd?.current || 0, r.qtd?.lq || 0, r.qtd?.ly || 0, r.qtd?.growthLQ || 0, r.qtd?.growthLY || 0,
      r.ytd?.current || 0, r.ytd?.ly || 0, r.ytd?.growthLY || 0,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Location_Wise_Executive_Matrix_${asOf?.dateFormatted || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
      {/* Table Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <Building2 size={20} className="text-[#053D3A]" />
            Location-Wise Executive Performance DataGrid
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-900 border border-slate-200">
              {filteredData.length} Locations
            </span>
          </h3>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Distinct separate columns for FTD, LM FTD, LY FTD, MTD, QTD, YTD, and Dual Growth % (As of {asOf?.day ? `Day ${asOf.day} ${asOf.month} ${asOf.fiscalYear}` : 'Latest DB Date'})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search location code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 text-slate-900 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A] transition"
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition shrink-0"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Data Table with Multi-Header Columns */}
      <div className="overflow-x-auto rounded-2xl border border-slate-300 max-h-[480px] overflow-y-auto shadow-inner">
        <table className="w-full text-center align-middle text-xs font-sans border-collapse">
          <thead className="sticky top-0 z-20 shadow-md">
            {/* Top Group Header */}
            <tr className="text-white font-extrabold text-[11px] uppercase tracking-wider">
              <th colSpan={2} className="py-2.5 px-3 border-b-2 border-[#053D3A] border-r border-[#074B47] text-center align-middle bg-[#053D3A]">
                Location Info
              </th>
              <th colSpan={5} className="py-2.5 px-3 border-b-2 border-[#053D3A] border-r border-[#074B47] text-center align-middle bg-[#053D3A]">
                FTD ({asOf?.day ? `${asOf.day}-${asOf.month}-${asOf.fiscalYear}` : 'Trading Date'})
              </th>
              <th colSpan={5} className="py-2.5 px-3 border-b-2 border-[#2A716A] border-r border-[#1B5751] text-center align-middle bg-[#2A716A]">
                MTD (Month To Date)
              </th>
              <th colSpan={5} className="py-2.5 px-3 border-b-2 border-[#3B3B6D] border-r border-[#2C2C57] text-center align-middle bg-[#3B3B6D]">
                QTD (Quarter To Date)
              </th>
              <th colSpan={3} className="py-2.5 px-3 border-b-2 border-[#9A6500] text-center align-middle bg-[#9A6500]">
                YTD (Year To Date)
              </th>
            </tr>

            {/* Column Headers */}
            <tr className="bg-[#032F2D] text-slate-100 font-bold text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3 border-r border-[#074B47] text-center align-middle">Loc Code</th>
              <th className="py-2.5 px-3 border-r border-[#074B47] min-w-[130px] text-center align-middle">Branch Name</th>

              {/* FTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">FTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LM FTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY FTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LM %</th>
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">LY %</th>

              {/* MTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">MTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LM MTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY MTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LM %</th>
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">LY %</th>

              {/* QTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">QTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LQ QTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY QTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LQ %</th>
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">LY %</th>

              {/* YTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">YTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY YTD</th>
              <th className="py-2.5 px-3 text-center align-middle">YoY %</th>
            </tr>
          </thead>
          <tbody className="bg-white font-normal text-slate-800 align-middle">
            {filteredData.length > 0 ? (
              filteredData.map((row: any, idx: number) => (
                <tr key={row.loc} className={`hover:bg-slate-100/80 transition border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  {/* Location Info */}
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900 border-r border-slate-200 text-center align-middle">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-900 rounded-md border border-slate-200 font-bold text-[11px]">
                      {row.loc}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 border-r border-slate-200 text-center align-middle truncate max-w-[150px]" title={row.branchName}>
                    {row.branchName}
                  </td>

                  {/* FTD */}
                  <td className="py-2.5 px-3 text-center align-middle font-mono font-medium text-slate-900 border-r border-slate-200">{formatVal(row.ftd?.current)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.ftd?.lm)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.ftd?.ly)}</td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.ftd?.growthLM !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.ftd.growthLM >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.ftd.growthLM >= 0 ? '+' : ''}{row.ftd.growthLM}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.ftd?.growthLY !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.ftd.growthLY >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.ftd.growthLY >= 0 ? '+' : ''}{row.ftd.growthLY}%
                      </span>
                    )}
                  </td>

                  {/* MTD */}
                  <td className="py-2.5 px-3 text-center align-middle font-mono font-medium text-slate-900 border-r border-slate-200">{formatVal(row.mtd?.current)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.mtd?.lm)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.mtd?.ly)}</td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.mtd?.growthLM !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.mtd.growthLM >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.mtd.growthLM >= 0 ? '+' : ''}{row.mtd.growthLM}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.mtd?.growthLY !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.mtd.growthLY >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.mtd.growthLY >= 0 ? '+' : ''}{row.mtd.growthLY}%
                      </span>
                    )}
                  </td>

                  {/* QTD */}
                  <td className="py-2.5 px-3 text-center align-middle font-mono font-medium text-slate-900 border-r border-slate-200">{formatVal(row.qtd?.current)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.qtd?.lq)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.qtd?.ly)}</td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.qtd?.growthLQ !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.qtd.growthLQ >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.qtd.growthLQ >= 0 ? '+' : ''}{row.qtd.growthLQ}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.qtd?.growthLY !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.qtd.growthLY >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.qtd.growthLY >= 0 ? '+' : ''}{row.qtd.growthLY}%
                      </span>
                    )}
                  </td>

                  {/* YTD */}
                  <td className="py-2.5 px-3 text-center align-middle font-mono font-bold text-slate-900 text-xs border-r border-slate-200">{formatVal(row.ytd?.current)}</td>
                  <td className="py-2.5 px-3 text-center align-middle font-mono text-slate-700 font-normal text-[11px] border-r border-slate-200">{formatVal(row.ytd?.ly)}</td>
                  <td className="py-2.5 px-3 text-center align-middle border-r border-slate-200">
                    {row.ytd?.growthLY !== undefined && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${row.ytd.growthLY >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {row.ytd.growthLY >= 0 ? '+' : ''}{row.ytd.growthLY}%
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={20} className="py-8 text-center align-middle text-slate-400 font-medium border-b border-slate-200">
                  No matching locations found.
                </td>
              </tr>
            )}
          </tbody>
          {/* Sticky Total Footer Row */}
          <tfoot className="sticky bottom-0 z-10 bg-[#032F2D] text-white font-bold text-xs border-t-2 border-[#FFE2B8]/40 align-middle">
            <tr>
              <td className="py-3 px-3 uppercase tracking-wider text-[#FFE2B8] border-r border-[#074B47] text-center align-middle font-extrabold">TOTAL</td>
              <td className="py-3 px-3 font-extrabold text-[#DCEDEA] border-r border-[#074B47] text-center align-middle">Consolidated</td>

              {/* FTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-white text-xs">{formatVal(totals.ftd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.ftdLm)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.ftdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{ftdTotalGrowthLM.toFixed(1)}%</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{ftdTotalGrowthLY.toFixed(1)}%</td>

              {/* MTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-white text-xs">{formatVal(totals.mtd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.mtdLm)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.mtdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{mtdTotalGrowthLM.toFixed(1)}%</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{mtdTotalGrowthLY.toFixed(1)}%</td>

              {/* QTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-white text-xs">{formatVal(totals.qtd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.qtdLq)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.qtdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{qtdTotalGrowthLQ.toFixed(1)}%</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{qtdTotalGrowthLY.toFixed(1)}%</td>

              {/* YTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{formatVal(totals.ytd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.ytdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{ytdTotalGrowthLY.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── DEFAULT PARTY TYPES ──────────────────────────────────────────────────────
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

const getYesterdayDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    day: d.getDate(),
    month: months[d.getMonth()],
    year: 2026,
  };
};

// ─── MAIN EXECUTIVE DASHBOARD PAGE ────────────────────────────────────────────
export default function DashboardPage() {
  const { isBranchUser, userBranch, isSuperAdmin, user } = useAuth();
  const yesterday = useMemo(() => getYesterdayDate(), []);
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [month, setMonth] = useState<string>('Aug');
  const [day, setDay] = useState<number>(25);
  const [branchCode, setBranchCode] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Default party type multi-selection: MASS, INDEPENDENT WORKSHOP, TRADER/RETAILER, WALK-IN CUSTOMER
  const [selectedPartyTypes, setSelectedPartyTypes] = useState<string[]>(DEFAULT_PARTY_TYPES);
  const [partCategory, setPartCategory] = useState<string>('M');
  const [showPartyTypeDropdown, setShowPartyTypeDropdown] = useState<boolean>(false);
  const [showDaxPanel, setShowDaxPanel] = useState<boolean>(false);
  const [copiedDax, setCopiedDax] = useState<string | null>(null);

  const effectiveBranch = isBranchUser && userBranch ? userBranch : branchCode;

  // Build query string
  const queryPartyTypes = useMemo(() => {
    if (selectedPartyTypes.length === 0 || selectedPartyTypes.length === ALL_POSSIBLE_PARTY_TYPES.length) {
      return 'ALL';
    }
    return selectedPartyTypes.join(',');
  }, [selectedPartyTypes]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      fiscalYear: String(fiscalYear),
      month: month,
      day: String(day),
      branchCode: effectiveBranch,
      partyType: queryPartyTypes,
      partCategory,
    });
    return params.toString();
  }, [fiscalYear, month, day, effectiveBranch, queryPartyTypes, partCategory]);

  const { data: kpiData, mutate, isLoading } = useSWR(
    `/dashboard/executive-kpis?${queryParams}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const kpis = kpiData?.kpis;
  const asOf = kpiData?.asOf;
  const filters = kpiData?.filters;

  // Live Refresh handler (forces backend cache bypass and fresh DB recalculation)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await api.get(`/dashboard/executive-kpis?${queryParams}&refresh=true`).then(r => r.data);
      await mutate(fresh, { revalidate: false });
      toast.success('Dashboard refreshed with latest live data!', { icon: '⚡' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle single party type
  const togglePartyType = (pt: string) => {
    setSelectedPartyTypes((prev) =>
      prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]
    );
  };

  // Reset to default 4
  const resetPartyTypesToDefault = () => {
    setSelectedPartyTypes(DEFAULT_PARTY_TYPES);
    toast.success('Reset to default 4 party types');
  };

  // Select all party types
  const selectAllPartyTypes = () => {
    setSelectedPartyTypes(ALL_POSSIBLE_PARTY_TYPES);
    toast.success('Selected all party types');
  };

  const handleCopyDax = (dax: string, name: string) => {
    navigator.clipboard.writeText(dax);
    setCopiedDax(name);
    toast.success(`Copied DAX measure: ${name}`);
    setTimeout(() => setCopiedDax(null), 2500);
  };

  // Dynamic live monthly performance trajectory with YoY Growth % & formatting
  const trajectoryData = useMemo(() => {
    const raw = (kpiData?.trajectoryData && kpiData.trajectoryData.length > 0)
      ? kpiData.trajectoryData
      : [
          { month: 'Apr', FY24: 10.93, FY25: 12.83, FY26: 14.27 },
          { month: 'May', FY24: 12.10, FY25: 13.41, FY26: 14.65 },
          { month: 'Jun', FY24: 10.46, FY25: 12.37, FY26: 13.72 },
          { month: 'Jul', FY24: 12.03, FY25: 13.86, FY26: 14.34 },
          { month: 'Aug', FY24: 11.78, FY25: 13.59, FY26: 11.30 },
          { month: 'Sep', FY24: 11.85, FY25: 14.03, FY26: null },
          { month: 'Oct', FY24: 11.96, FY25: 14.55, FY26: null },
          { month: 'Nov', FY24: 12.30, FY25: 15.32, FY26: null },
          { month: 'Dec', FY24: 12.93, FY25: 15.65, FY26: null },
          { month: 'Jan', FY24: 14.08, FY25: 14.37, FY26: null },
          { month: 'Feb', FY24: 12.07, FY25: 13.91, FY26: null },
          { month: 'Mar', FY24: 11.00, FY25: 12.79, FY26: null },
        ];

    return raw.map((d: any) => {
      const fy26 = d.FY26 !== null && d.FY26 !== undefined ? Number(d.FY26) : null;
      const fy25 = d.FY25 !== null && d.FY25 !== undefined ? Number(d.FY25) : null;
      const fy24 = d.FY24 !== null && d.FY24 !== undefined ? Number(d.FY24) : null;
      
      let growthYoY: number | null = null;
      if (fy26 !== null && fy25 !== null && fy25 > 0) {
        growthYoY = Number((((fy26 - fy25) / fy25) * 100).toFixed(1));
      }

      return {
        ...d,
        FY26: fy26,
        FY25: fy25,
        FY24: fy24,
        growthYoY,
        growthFormatted: growthYoY !== null ? `${growthYoY >= 0 ? '+' : ''}${growthYoY}%` : null,
        isPositive: growthYoY !== null ? growthYoY >= 0 : true,
      };
    });
  }, [kpiData?.trajectoryData]);

  // Dynamic live party type mix
  const partyTypeMixData = useMemo(() => {
    if (kpiData?.partyTypeMixData && kpiData.partyTypeMixData.length > 0) {
      return kpiData.partyTypeMixData;
    }
    return [
      {
        name: 'Independent Workshop',
        shortName: 'Workshop (IW)',
        value: 37.1,
        salesCr: 21.69,
        lySalesCr: 21.45,
        growth: '+1.1%',
        isPositive: true,
        color: '#2563eb',
        lines: '2.23L Lines',
        parts: '12,307 SKUs',
      },
      {
        name: 'Trader / Retailer',
        shortName: 'Trader / Retailer',
        value: 30.2,
        salesCr: 17.64,
        lySalesCr: 14.74,
        growth: '+19.6%',
        isPositive: true,
        color: '#10b981',
        lines: '1.50L Lines',
        parts: '14,002 SKUs',
      },
      {
        name: 'Walk-in Customer',
        shortName: 'Walk-in Cust.',
        value: 16.4,
        salesCr: 9.61,
        lySalesCr: 8.44,
        growth: '+13.8%',
        isPositive: true,
        color: '#f59e0b',
        lines: '1.49L Lines',
        parts: '9,151 SKUs',
      },
      {
        name: 'MASS (Authorized)',
        shortName: 'MASS (Auth.)',
        value: 16.3,
        salesCr: 9.52,
        lySalesCr: 8.80,
        growth: '+8.2%',
        isPositive: true,
        color: '#8b5cf6',
        lines: '0.59L Lines',
        parts: '9,728 SKUs',
      },
    ];
  }, [kpiData?.partyTypeMixData]);

  return (
    <AppShell title="Dashboard" breadcrumb="Overview">
      <div className="space-y-6 max-w-full">
        {/* 1. TOP EXECUTIVE CONTROL COCKPIT (MARUTI SUZUKI IDENTITY) */}
        {/* 1. EXECUTIVE FILTER & CONTROL TOOLBAR */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 text-slate-800 relative z-30"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
            {/* Left: Filters */}
            <div className="flex items-center gap-3 flex-wrap">

              {/* Branch Network Dropdown */}
              {isSuperAdmin ? (
                <div className="flex items-center gap-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
                  <Building2 size={15} className="text-[#053D3A] shrink-0" />
                  <select
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="text-slate-900 bg-white">All 35 Branches</option>
                    {(filters?.branches || []).map((b: any) => (
                      <option key={b.code} value={b.code} className="text-slate-900 bg-white">
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 rounded-xl px-3.5 py-2 text-xs font-bold shadow-2xs">
                  <Lock size={13} className="text-slate-950" />
                  <span>Branch: {userBranch || user?.branchCode || 'BSE'}</span>
                </div>
              )}
              {/* As-Of Period / Month Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                <Calendar size={15} className="text-[#053D3A] shrink-0" />
                <select
                  value={month}
                  onChange={(e) => {
                    const selectedM = e.target.value;
                    setMonth(selectedM);
                    if (selectedM === yesterday.month) {
                      setDay(yesterday.day);
                    } else if (['Jul', 'May', 'Mar', 'Jan', 'Aug', 'Oct', 'Dec'].includes(selectedM)) {
                      setDay(31);
                    } else {
                      setDay(30);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Aug" className="text-slate-900 bg-white">Aug 2026 (Latest As-Of {day} Aug)</option>
                  <option value="Jul" className="text-slate-900 bg-white">Jul 2026 (Full Month)</option>
                  <option value="Jun" className="text-slate-900 bg-white">Jun 2026 (Full Month)</option>
                  <option value="May" className="text-slate-900 bg-white">May 2026 (Full Month)</option>
                  <option value="Apr" className="text-slate-900 bg-white">Apr 2026 (Full Month)</option>
                  <option value="Mar" className="text-slate-900 bg-white">Mar 2026 (Full Month)</option>
                  <option value="Feb" className="text-slate-900 bg-white">Feb 2026 (Full Month)</option>
                  <option value="Jan" className="text-slate-900 bg-white">Jan 2026 (Full Month)</option>
                  <option value="Dec" className="text-slate-900 bg-white">Dec 2025 (Full Month)</option>
                  <option value="Nov" className="text-slate-900 bg-white">Nov 2025 (Full Month)</option>
                  <option value="Oct" className="text-slate-900 bg-white">Oct 2025 (Full Month)</option>
                  <option value="Sep" className="text-slate-900 bg-white">Sep 2025 (Full Month)</option>
                </select>
              </div>

              {/* Day Input */}
              <div className="flex items-center gap-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-2 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Day:</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-8 bg-transparent text-xs font-bold font-mono text-[#053D3A] focus:outline-none text-center"
                />
              </div>

              {/* Multi-Select Party Types Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPartyTypeDropdown(!showPartyTypeDropdown)}
                  className="flex items-center gap-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                >
                  <Users size={15} className="text-[#053D3A]" />
                  <span>
                    Party Types: <strong className="text-[#087443] font-mono">({selectedPartyTypes.length} Active)</strong>
                  </span>
                  <ChevronDown size={14} className="text-slate-600" />
                </button>

                {/* Dropdown Menu */}
                {showPartyTypeDropdown && (
                  <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-300 rounded-2xl shadow-2xl z-50 p-3.5 space-y-2 text-xs text-slate-800">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-extrabold text-slate-900">Select Party Types</span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          onClick={resetPartyTypesToDefault}
                          className="text-[#053D3A] hover:underline font-bold"
                        >
                          Default 4
                        </button>
                        <span className="text-slate-400">|</span>
                        <button
                          onClick={selectAllPartyTypes}
                          className="text-emerald-700 hover:underline font-bold"
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
                              isSelected ? 'bg-teal-50 text-[#053D3A] font-extrabold' : 'hover:bg-slate-100 text-slate-700 font-semibold'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePartyType(pt)}
                              className="rounded text-[#053D3A] focus:ring-0 cursor-pointer"
                            />
                            <span className="truncate flex-1">{pt}</span>
                            {isDefault && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded-full font-bold">
                                Default
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setShowPartyTypeDropdown(false)}
                      className="w-full py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl text-center text-xs transition mt-2 shadow-xs cursor-pointer"
                    >
                      Apply Filter
                    </button>
                  </div>
                )}
              </div>

              {/* Part Category Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
                <Layers size={15} className="text-[#053D3A] shrink-0" />
                <select
                  value={partCategory}
                  onChange={(e) => setPartCategory(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Categories (MGP + MGA + MGO + Tyres)</option>
                  <option value="M" className="text-slate-900 bg-white">M — Maruti Genuine Parts (MGP)</option>
                  <option value="AA" className="text-slate-900 bg-white">AA — Maruti Genuine Accessories (MGA)</option>
                  <option value="AG" className="text-slate-900 bg-white">AG — Maruti Genuine Oil & Lubes (MGO)</option>
                  <option value="T" className="text-slate-900 bg-white">T — Tyres, Battery & Tools</option>
                </select>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button
                  onClick={() => setShowDaxPanel(!showDaxPanel)}
                  className="px-4 py-2 rounded-xl bg-[#FFE2B8] hover:bg-[#FFD49A] text-[#053D3A] font-extrabold text-xs flex items-center gap-2 transition shadow-2xs cursor-pointer border border-[#FFD49A]"
                >
                  <Code2 size={15} className="text-[#053D3A]" />
                  <span>Power BI / DAX Studio</span>
                  {showDaxPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}

              <button
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-60"
                title="Refresh Live KPIs from Database"
              >
                <RefreshCw size={14} className={isLoading || isRefreshing ? 'animate-spin text-[#FFE2B8]' : 'text-[#FFE2B8]'} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Active Filter Chips Banner */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ACTIVE PARTY TYPES:</span>
            {selectedPartyTypes.map((pt) => (
              <span
                key={pt}
                className="inline-flex items-center gap-1 px-3 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-md text-[10px] font-bold uppercase shadow-2xs"
              >
                {pt}
              </span>
            ))}
            {selectedPartyTypes.length === 0 && (
              <span className="text-[10px] text-amber-700 font-bold">All Party Types Unfiltered</span>
            )}
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PART CATEGORY:</span>
            <span className="inline-flex items-center gap-1 px-3 py-0.5 bg-teal-50 text-[#053D3A] border border-teal-200 rounded-md text-[10px] font-extrabold uppercase shadow-2xs">
              {partCategory === 'M'
                ? 'MGP Parts (M)'
                : partCategory === 'AA'
                ? 'MGA Accessories (AA)'
                : partCategory === 'AG'
                ? 'MGO Oil & Lubes (AG)'
                : partCategory === 'T'
                ? 'Tyres & Tools (T)'
                : 'All Categories'}
            </span>
          </div>
        </div>

        {/* 2. POWER BI / DAX STUDIO SPECIFICATION DRAWER */}
        {isSuperAdmin && showDaxPanel && (
          <div className="bg-[#0b1329] text-slate-200 rounded-3xl p-6 border border-blue-900/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles size={20} className="text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Power BI & DAX Reusable Calculations Specification
                  </h3>
                  <p className="text-xs text-slate-400">
                    Production-tested DAX measures aligned with FTD, MTD, QTD, and YTD financial models
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-mono font-bold">
                DAX Standard Specification
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DAX_MEASURES.map((m) => (
                <div
                  key={m.name}
                  className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-xs text-cyan-300">{m.name}</span>
                    <button
                      onClick={() => handleCopyDax(m.dax, m.name)}
                      className="flex items-center gap-1 text-[11px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition font-bold"
                    >
                      {copiedDax === m.name ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedDax === m.name ? 'Copied!' : 'Copy DAX'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-400/95 bg-black/60 p-3 rounded-xl overflow-x-auto max-h-40 leading-relaxed border border-slate-950">
                    {m.dax}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CORE 4 EXECUTIVE KPI CARDS (FTD, MTD, QTD, YTD) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Card 1: FTD */}
          <PremiumKPICard
            tag="FTD"
            periodLabel={kpis?.ftd?.periodLabel || `Day ${day} ${month}`}
            primaryValue={kpis?.ftd?.currentFormatted || '₹0'}
            lmValue={kpis?.ftd?.lmFormatted}
            lmLabel={kpis?.ftd?.lmLabel || 'Same Day LM'}
            lmGrowth={kpis?.ftd?.growthVsLM}
            lyValue={kpis?.ftd?.lyFormatted}
            lyLabel={kpis?.ftd?.lyLabel || 'Same Day LY'}
            lyGrowth={kpis?.ftd?.growthVsLY}
            theme="ftd"
            icon={Calendar}
          />

          {/* Card 2: MTD */}
          <PremiumKPICard
            tag="MTD"
            periodLabel={kpis?.mtd?.periodLabel || `1–${day} ${month}`}
            primaryValue={kpis?.mtd?.currentFormatted || '₹0'}
            lmValue={kpis?.mtd?.lmFormatted}
            lmLabel={kpis?.mtd?.lmLabel || 'LM MTD'}
            lmGrowth={kpis?.mtd?.growthVsLM}
            lyValue={kpis?.mtd?.lyFormatted}
            lyLabel={kpis?.mtd?.lyLabel || 'LY MTD'}
            lyGrowth={kpis?.mtd?.growthVsLY}
            theme="mtd"
            icon={BarChart3}
          />

          {/* Card 3: QTD */}
          <PremiumKPICard
            tag="QTD"
            periodLabel={kpis?.qtd?.periodLabel || `${asOf?.quarter || 'Q2'} FY${fiscalYear}`}
            primaryValue={kpis?.qtd?.currentFormatted || '₹0'}
            lmValue={kpis?.qtd?.lqFormatted}
            lmLabel={kpis?.qtd?.lqLabel || 'Prev Qtr Equiv.'}
            lmGrowth={kpis?.qtd?.growthVsLQ}
            lyValue={kpis?.qtd?.lyFormatted}
            lyLabel={kpis?.qtd?.lyLabel || 'Same Qtr LY'}
            lyGrowth={kpis?.qtd?.growthVsLY}
            theme="qtd"
            icon={PieChartIcon}
          />

          {/* Card 4: YTD */}
          <PremiumKPICard
            tag="YTD"
            periodLabel={kpis?.ytd?.periodLabel || `FY${fiscalYear} YTD`}
            primaryValue={kpis?.ytd?.currentFormatted || '₹0'}
            lyValue={kpis?.ytd?.lyFormatted}
            lyLabel={kpis?.ytd?.lyLabel || 'FY Previous LY'}
            lyGrowth={kpis?.ytd?.growthVsLY}
            theme="ytd"
            icon={TrendingUp}
          />
        </div>

        {/* 4. PERFORMANCE CHARTS & TRAJECTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Chart: Trajectory Column Chart */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#053D3A]" />
                  Multi-Year Sales Trajectory (FY24 vs FY25 vs FY26)
                </h3>
                <p className="text-xs text-slate-400">Net Retail Turnover in ₹ Crores with Monthly YoY Growth % Conditional Formatting</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-[#053D3A] font-extrabold">
                  <span className="w-3 h-3 rounded-md bg-[#053D3A] shadow-xs"></span> FY26
                </span>
                <span className="flex items-center gap-1.5 text-[#2A716A] font-bold">
                  <span className="w-3 h-3 rounded-md bg-[#2A716A] shadow-xs"></span> FY25
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span className="w-3 h-3 rounded-md bg-slate-300"></span> FY24
                </span>
              </div>
            </div>

            {/* Column Chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trajectoryData} margin={{ top: 22, right: 10, left: -15, bottom: 5 }} barGap={2} barCategoryGap="16%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} unit="Cr" tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const fy26 = data.FY26;
                        const fy25 = data.FY25;
                        const fy24 = data.FY24;
                        const growth = data.growthYoY;
                        return (
                          <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl border border-slate-700 text-xs space-y-2 min-w-[190px]">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 font-bold">
                              <span className="text-amber-400">{label} Performance</span>
                              {growth !== null && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${growth >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                                  {data.growthFormatted} YoY
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between items-center text-emerald-300 font-bold">
                                <span>FY26 (Current):</span>
                                <span>{fy26 !== null ? `₹${fy26.toFixed(2)} Cr` : 'In Progress / Upcoming'}</span>
                              </div>
                              <div className="flex justify-between items-center text-teal-300 font-semibold">
                                <span>FY25 (LY):</span>
                                <span>₹{fy25?.toFixed(2) || '0'} Cr</span>
                              </div>
                              <div className="flex justify-between items-center text-slate-400">
                                <span>FY24:</span>
                                <span>₹{fy24?.toFixed(2) || '0'} Cr</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="FY24" fill="#cbd5e1" name="FY 2024" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="FY25" fill="#2A716A" name="FY 2025" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="FY26" fill="#053D3A" name="FY 2026" radius={[4, 4, 0, 0]} maxBarSize={16}>
                    <LabelList
                      dataKey="FY26"
                      position="top"
                      content={(props: any) => {
                        const { x, y, width, value } = props;
                        if (value === null || value === undefined || isNaN(value) || value <= 0) return null;
                        return (
                          <text
                            x={x + width / 2}
                            y={y - 6}
                            fill="#053D3A"
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={800}
                          >
                            ₹{Number(value).toFixed(1)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Growth % Conditional Formatting Scorecard */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Monthly YoY Growth % (FY26 vs FY25):</span>
                <span className="text-[9px] font-semibold text-slate-400">Conditional: Green (+Growth) | Red (-Decline)</span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 text-center">
                {trajectoryData.map((d: any) => {
                  const hasGrowth = d.growthYoY !== null;
                  const isPos = d.growthYoY >= 0;
                  return (
                    <div
                      key={d.month}
                      className={`p-1.5 rounded-xl border flex flex-col items-center justify-center transition ${
                        !hasGrowth
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : isPos
                          ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800 shadow-2xs font-extrabold'
                          : 'bg-rose-50 border-rose-200/90 text-rose-800 shadow-2xs font-extrabold'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-600 uppercase">{d.month}</span>
                      <span className="text-[11px] leading-tight">
                        {hasGrowth ? d.growthFormatted : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Chart: Party Type Mix & YoY Growth Break-up */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 mb-1">
                  <PieChartIcon size={18} className="text-[#053D3A]" />
                  Party Type Mix & Growth
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  YTD vs LY YTD
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-2">Channel share distribution & YoY revenue growth</p>
            </div>

            <div className="h-44 w-full relative flex items-center justify-center my-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partyTypeMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {partyTypeMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700">
                            <p className="font-bold text-slate-200">{data.name}</p>
                            <p className="text-emerald-400 font-extrabold text-sm mt-0.5">
                              ₹{data.salesCr} Cr <span className="text-xs font-normal text-slate-300">({data.value}%)</span>
                            </p>
                            <p className="text-slate-400 text-[10px] mt-1">
                              YoY Growth: <span className="text-emerald-400 font-bold">{data.growth}</span> (vs ₹{data.lySalesCr} Cr)
                            </p>
                            <p className="text-slate-400 text-[10px]">
                              Range: <span className="text-amber-300 font-bold">{data.parts}</span> • {data.lines}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center pointer-events-none">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">TOP SHARE</p>
                <p className="text-sm font-black text-[#053D3A]">IW (37.1%)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
              {partyTypeMixData.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }}></span>
                    <span className="text-slate-700 font-bold truncate text-[11px]">{c.shortName}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-slate-900 font-black text-[11px]">{c.value}%</span>
                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded">
                      {c.growth}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. LOCATION-WISE EXECUTIVE PERFORMANCE DATAGRID MATRIX (BOOTSTRAP DATATABLE PATTERN) */}
        <LocationGridTable
          locationGrid={kpiData?.locationGrid || []}
          asOf={asOf}
        />
      </div>
    </AppShell>
  );
}
