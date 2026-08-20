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
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── POWER BI / DAX MEASURES SPECIFICATION ────────────────────────────────────
const DAX_MEASURES = [
  {
    name: '1. FTD (Full Trading Day)',
    tag: 'FTD',
    color: 'from-blue-600 to-cyan-500',
    dax: `// FTD — Full Trading Day (Last completed business day)
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

  const ftdTotalGrowth = totals.ftdLm > 0 ? ((totals.ftd - totals.ftdLm) / totals.ftdLm) * 100 : 0;
  const mtdTotalGrowth = totals.mtdLm > 0 ? ((totals.mtd - totals.mtdLm) / totals.mtdLm) * 100 : 0;
  const qtdTotalGrowth = totals.qtdLq > 0 ? ((totals.qtd - totals.qtdLq) / totals.qtdLq) * 100 : 0;
  const ytdTotalGrowth = totals.ytdLy > 0 ? ((totals.ytd - totals.ytdLy) / totals.ytdLy) * 100 : 0;

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
      'FTD', 'LM FTD', 'LY FTD', 'FTD Growth (%)',
      'MTD', 'LM MTD', 'LY MTD', 'MTD Growth (%)',
      'QTD', 'LQ QTD', 'LY QTD', 'QTD Growth (%)',
      'YTD', 'LY YTD', 'YTD YoY Growth (%)'
    ];
    const rows = filteredData.map(r => [
      r.loc,
      `"${r.branchName}"`,
      r.ftd?.current || 0, r.ftd?.lm || 0, r.ftd?.ly || 0, r.ftd?.growthLM || 0,
      r.mtd?.current || 0, r.mtd?.lm || 0, r.mtd?.ly || 0, r.mtd?.growthLM || 0,
      r.qtd?.current || 0, r.qtd?.lq || 0, r.qtd?.ly || 0, r.qtd?.growthLQ || 0,
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
            <Building2 size={20} className="text-blue-600" />
            Location-Wise Executive Performance DataGrid
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {filteredData.length} Locations
            </span>
          </h3>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Distinct separate columns for FTD, LM FTD, LY FTD, MTD, QTD, YTD, and Growth % (As of {asOf?.day ? `Day ${asOf.day} ${asOf.month} ${asOf.fiscalYear}` : 'Latest DB Date'})
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
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 text-slate-900 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
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
              <th colSpan={4} className="py-2.5 px-3 border-b-2 border-[#053D3A] border-r border-[#074B47] text-center align-middle bg-[#053D3A]">
                FTD (Full Trading Day)
              </th>
              <th colSpan={4} className="py-2.5 px-3 border-b-2 border-[#2A716A] border-r border-[#1B5751] text-center align-middle bg-[#2A716A]">
                MTD (Month To Date)
              </th>
              <th colSpan={4} className="py-2.5 px-3 border-b-2 border-[#3B3B6D] border-r border-[#2C2C57] text-center align-middle bg-[#3B3B6D]">
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
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">Growth %</th>

              {/* MTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">MTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LM MTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY MTD</th>
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">Growth %</th>

              {/* QTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">QTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LQ QTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY QTD</th>
              <th className="py-2.5 px-3 text-center align-middle border-r border-[#074B47]">Growth %</th>

              {/* YTD */}
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">YTD</th>
              <th className="py-2.5 px-3 border-r border-[#074B47]/60 text-center align-middle">LY YTD</th>
              <th className="py-2.5 px-3 text-center align-middle">YoY %</th>
            </tr>
          </thead>
          <tbody className="bg-white font-normal text-slate-800 align-middle">
            {filteredData.length > 0 ? (
              filteredData.map((row: any, idx: number) => (
                <tr key={row.loc} className={`hover:bg-blue-50/60 transition border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  {/* Location Info */}
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900 border-r border-slate-200 text-center align-middle">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-medium text-[11px]">
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

                  {/* YTD */}
                  <td className="py-2.5 px-3 text-center align-middle font-mono font-medium text-blue-700 text-xs border-r border-slate-200">{formatVal(row.ytd?.current)}</td>
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
                <td colSpan={17} className="py-8 text-center align-middle text-slate-400 font-medium border-b border-slate-200">
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
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{ftdTotalGrowth.toFixed(1)}%</td>

              {/* MTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-white text-xs">{formatVal(totals.mtd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.mtdLm)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.mtdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{mtdTotalGrowth.toFixed(1)}%</td>

              {/* QTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-white text-xs">{formatVal(totals.qtd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.qtdLq)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.qtdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs border-r border-slate-700">{qtdTotalGrowth.toFixed(1)}%</td>

              {/* YTD Totals */}
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{formatVal(totals.ytd)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-slate-300 text-[11px]">{formatVal(totals.ytdLy)}</td>
              <td className="py-3 px-3 text-center align-middle font-mono text-amber-400 text-xs">{ytdTotalGrowth.toFixed(1)}%</td>
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

// ─── MAIN EXECUTIVE DASHBOARD PAGE ────────────────────────────────────────────
export default function DashboardPage() {
  const { isBranchUser, userBranch, isSuperAdmin, user } = useAuth();
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [month, setMonth] = useState<string>('Aug');
  const [day, setDay] = useState<number>(18);
  const [branchCode, setBranchCode] = useState<string>('ALL');
  
  // Default party type multi-selection: MASS, INDEPENDENT WORKSHOP, TRADER/RETAILER, WALK-IN CUSTOMER
  const [selectedPartyTypes, setSelectedPartyTypes] = useState<string[]>(DEFAULT_PARTY_TYPES);
  const [partCategory, setPartCategory] = useState<string>('ALL');
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
    fetcher
  );

  const kpis = kpiData?.kpis;
  const asOf = kpiData?.asOf;
  const filters = kpiData?.filters;

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

  // Monthly performance trajectory
  const trajectoryData = [
    { month: 'Apr', FY24: 10.93, FY25: 12.74, FY26: 14.19 },
    { month: 'May', FY24: 12.16, FY25: 13.40, FY26: 14.64 },
    { month: 'Jun', FY24: 10.48, FY25: 12.39, FY26: 13.71 },
    { month: 'Jul', FY24: 12.06, FY25: 13.85, FY26: 14.34 },
    { month: 'Aug', FY24: 11.82, FY25: 13.59, FY26: 5.75 }, // partial month
    { month: 'Sep', FY24: 11.87, FY25: 14.04, FY26: null },
    { month: 'Oct', FY24: 12.00, FY25: 14.55, FY26: null },
    { month: 'Nov', FY24: 12.34, FY25: 15.33, FY26: null },
    { month: 'Dec', FY24: 12.98, FY25: 15.66, FY26: null },
    { month: 'Jan', FY24: 14.11, FY25: 14.40, FY26: null },
    { month: 'Feb', FY24: 12.09, FY25: 13.93, FY26: null },
    { month: 'Mar', FY24: 11.04, FY25: 12.79, FY26: null },
  ];

  const categoryMixData = [
    { name: 'M (Maruti Genuine Parts)', value: 82.4, color: '#2563eb' },
    { name: 'A (Accessories)', value: 9.8, color: '#10b981' },
    { name: 'O (Oils & Lubricants)', value: 5.2, color: '#f59e0b' },
    { name: 'C (Consumables)', value: 2.6, color: '#8b5cf6' },
  ];

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
                    if (selectedM === 'Aug') setDay(18);
                    else if (selectedM === 'Jul' || selectedM === 'May') setDay(31);
                    else setDay(30);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Aug" className="text-slate-900 bg-white">Aug 2026 (Latest As-Of 18 Aug)</option>
                  <option value="Jul" className="text-slate-900 bg-white">Jul 2026 (Full Month)</option>
                  <option value="Jun" className="text-slate-900 bg-white">Jun 2026 (Full Month)</option>
                  <option value="May" className="text-slate-900 bg-white">May 2026 (Full Month)</option>
                  <option value="Apr" className="text-slate-900 bg-white">Apr 2026 (Full Month)</option>
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
                  <option value="ALL" className="text-slate-900 bg-white">All Categories</option>
                  {(filters?.categories || []).map((c: string) => (
                    <option key={c} value={c} className="text-slate-900 bg-white">
                      Category: {c}
                    </option>
                  ))}
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
                onClick={() => mutate()}
                className="p-2 rounded-xl bg-[#053D3A] hover:bg-[#074B47] text-white font-bold text-xs flex items-center justify-center transition shadow-2xs cursor-pointer"
                title="Refresh KPIs"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Active Filter Chips Banner */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ACTIVE CATEGORIES:</span>
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
          {/* Left Chart: Trajectory */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#053D3A]" />
                  Multi-Year Sales Trajectory (FY24 vs FY25 vs FY26)
                </h3>
                <p className="text-xs text-slate-400">Net Retail Turnover in ₹ Crores across financial years</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-[#053D3A] font-extrabold">
                  <span className="w-3 h-3 rounded-full bg-[#053D3A] shadow-xs"></span> FY26
                </span>
                <span className="flex items-center gap-1.5 text-teal-700 font-bold">
                  <span className="w-3 h-3 rounded-full bg-[#2A716A] shadow-xs"></span> FY25
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span className="w-3 h-3 rounded-full bg-slate-300"></span> FY24
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFY26" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#053D3A" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#053D3A" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorFY25" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2A716A" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2A716A" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} unit="Cr" />
                  <Tooltip
                    formatter={(val: any) => [`₹${val} Cr`, '']}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12, fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="FY26" stroke="#053D3A" strokeWidth={3.5} fillOpacity={1} fill="url(#colorFY26)" name="FY 2026" />
                  <Area type="monotone" dataKey="FY25" stroke="#2A716A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFY25)" name="FY 2025" />
                  <Area type="monotone" dataKey="FY24" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" fill="none" name="FY 2024" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Chart: Category Mix Break-up */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 mb-1">
                <PieChartIcon size={18} className="text-[#053D3A]" />
                Part Category Mix
              </h3>
              <p className="text-xs text-slate-400 mb-4">Volume & Value share distribution</p>
            </div>

            <div className="h-48 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${val}%`, 'Share']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center pointer-events-none">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">DOMINANT</p>
                <p className="text-base font-black text-[#053D3A]">M (82.4%)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
              {categoryMixData.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }}></span>
                  <span className="text-slate-700 font-semibold truncate text-[11px]">{c.name}</span>
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
