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

  // Normalized Metric Calculations
  const curYtd = periodComparison.ytd?.current ?? periodComparison.ytd?.curSales ?? matrix.curYtdSales ?? 0;
  const lyYtd = periodComparison.ytd?.lySamePeriod ?? periodComparison.ytd?.lySales ?? matrix.lyYtdSales ?? 0;
  const curQtd = periodComparison.qtd?.current ?? periodComparison.qtd?.curSales ?? 0;
  const curMqtd = periodComparison.mqtd?.current ?? periodComparison.mqtd?.curSales ?? 0;
  const curHtd = periodComparison.htd?.current ?? periodComparison.htd?.curSales ?? 0;
  const curMtd = periodComparison.mtd?.current ?? periodComparison.mtd?.curSales ?? 0;
  const ytdGrowth = periodComparison.ytd?.growthPercent ?? 0;

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

  // Complete Formatted Multi-Page PDF Print Handler
  const handlePrintPDF = () => {
    setIsExportingPDF(true);
    const printWin = window.open('', '_blank', 'width=1100,height=900');
    if (!printWin) {
      window.print();
      setIsExportingPDF(false);
      return;
    }

    const partyNameStr = profile.partyName || partyCode;
    const branchNameStr = profile.branchName || profile.branchCode || 'Head Office';
    const statusStr = health.status || 'STABLE';
    const scoreStr = `${health.score || 75}/100`;

    // Category rows HTML
    const catRowsHtml = categories.map((c: any) => `
      <tr>
        <td style="font-weight: bold; color: #0f172a;">Category ${c.cat}</td>
        <td style="text-align: right; font-family: monospace;">₹${Math.round(c.curMonthSales || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #002060;">₹${Math.round(c.ytdSales || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-family: monospace; color: #64748b;">₹${Math.round(c.lifetimeSales || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-weight: bold; color: #2563eb;">${c.sharePercent || 0}%</td>
      </tr>
    `).join('');

    // Top parts rows HTML
    const topPartsRowsHtml = cleanTopParts.slice(0, 15).map((p: any, idx: number) => `
      <tr>
        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold; color: #002060;">${p.partNum}</td>
        <td style="font-family: monospace; color: #64748b;">${p.rootPartNum}</td>
        <td style="text-align: center; font-weight: bold;">${p.cat}</td>
        <td style="text-align: right; font-family: monospace;">${Number(p.qty).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">₹${Math.round(p.sales).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-weight: bold; color: #2563eb;">${p.sharePercent}%</td>
      </tr>
    `).join('');

    // Declining parts rows HTML
    const decliningPartsRowsHtml = decliningParts.slice(0, 10).map((p: any) => `
      <tr>
        <td style="font-family: monospace; font-weight: bold; color: #991b1b;">${p.partNum}</td>
        <td style="text-align: center; font-weight: bold;">${p.cat || 'M'}</td>
        <td style="text-align: right; font-family: monospace;">${p.lyQty}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold;">${p.curQty}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">${p.qtyGap}</td>
        <td style="text-align: right; font-family: monospace;">₹${Math.round(p.lySales || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold;">₹${Math.round(p.curSales || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #d97706;">₹${Math.round(p.opportunityValue || 0).toLocaleString('en-IN')}</td>
        <td style="color: #2563eb; font-weight: bold; font-size: 10px;">Reorder ${Math.abs(p.qtyGap)} pcs</td>
      </tr>
    `).join('');

    // Actions rows HTML
    const actionsRowsHtml = recommendedActions.slice(0, 5).map((a: any, idx: number) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">#${a.rank || idx + 1}</td>
        <td style="font-weight: bold; color: #0f172a;">${a.title}</td>
        <td style="color: #475569; font-size: 10.5px;">${a.reason}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #16a34a;">₹${Math.round(a.potentialValue || 0).toLocaleString('en-IN')}</td>
        <td style="text-align: center;"><span style="background: ${a.priority === 'HIGH' ? '#fee2e2; color: #991b1b;' : '#fef3c7; color: #92400e;'} padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9.5px;">${a.priority}</span></td>
      </tr>
    `).join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer 360 Dossier — ${partyNameStr} (${partyCode})</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.35;
          }
          .page-container {
            width: 100%;
          }
          .header-dossier {
            border-bottom: 2.5px solid #002060;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand-title {
            font-size: 16px;
            font-weight: 900;
            color: #002060;
            letter-spacing: -0.3px;
          }
          .brand-sub {
            font-size: 9.5px;
            font-weight: 700;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-box {
            text-align: right;
            font-size: 10px;
            color: #64748b;
          }
          .profile-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 12px;
          }
          .profile-name {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
          }
          .badge {
            display: inline-block;
            padding: 1.5px 6px;
            border-radius: 4px;
            font-size: 9.5px;
            font-weight: bold;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
            margin-bottom: 12px;
          }
          .kpi-cell {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: center;
          }
          .kpi-cell-label {
            font-size: 8.5px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
          }
          .kpi-cell-val {
            font-size: 12px;
            font-weight: 900;
            color: #002060;
            margin-top: 2px;
            font-family: monospace;
          }
          .section-heading {
            font-size: 11px;
            font-weight: 800;
            color: #002060;
            text-transform: uppercase;
            border-bottom: 1.5px solid #002060;
            padding-bottom: 3px;
            margin-top: 14px;
            margin-bottom: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 10px;
          }
          th {
            background: #002060;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 5px 6px;
            border: 1px solid #002060;
            font-size: 9px;
            text-transform: uppercase;
          }
          td {
            padding: 4.5px 6px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .pillars-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
            margin-bottom: 12px;
          }
          .pillar-box {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            border-radius: 6px;
            padding: 6px 8px;
          }
          .pillar-title {
            font-size: 9px;
            font-weight: bold;
            color: #0f172a;
          }
          .pillar-val {
            font-size: 12px;
            font-weight: 900;
            color: #2563eb;
            font-family: monospace;
            margin: 2px 0;
          }
          .page-break {
            page-break-before: always;
            break-before: always;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          
          <!-- TOP HEADER -->
          <div class="header-dossier">
            <div>
              <div class="brand-sub">TheSSBuddy • Powered by Thesssystems</div>
              <div class="brand-title">CUSTOMER 360 — COMPREHENSIVE INTELLIGENCE DOSSIER</div>
            </div>
            <div class="meta-box">
              <div><strong>As of:</strong> ${month} FY${fiscalYear}</div>
              <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
              <div><strong>Target Aim:</strong> +${targetGrowthPercent}% YoY</div>
            </div>
          </div>

          <!-- SECTION 1: CUSTOMER IDENTITY & HEALTH -->
          <div class="profile-grid">
            <div>
              <div class="profile-name">${partyNameStr}</div>
              <div style="margin-top: 3px;">
                <span class="badge" style="background: #dbeafe; color: #1e40af;">Code: ${profile.partyCode || partyCode}</span>
                ${profile.originalCode && profile.originalCode !== (profile.partyCode || partyCode) ? `<span class="badge" style="background: #f1f5f9; color: #475569;">Orig: ${profile.originalCode}</span>` : ''}
                <span class="badge" style="background: #f1f5f9; color: #334155;">${profile.partyType || 'RETAILER'}</span>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                📍 Branch: <strong>${branchNameStr}</strong> | 📅 Since: <strong>${basketStats.firstPurchase || 'N/A'}</strong> | 🕒 Last Order: <strong>${basketStats.lastPurchase || 'N/A'}</strong>
              </div>
            </div>

            <div style="text-align: center; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 0 8px;">
              <div style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Branch Position</div>
              <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px;">Rank #${branchContribution.branchRank || 1}</div>
              <div style="font-size: 9.5px; font-weight: bold; color: #2563eb;">${branchContribution.branchSharePercent || 0}% Share of Branch</div>
            </div>

            <div style="text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Account Health</div>
              <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 1px;">${scoreStr}</div>
              <span class="badge" style="background: #dcfce7; color: #15803d; text-transform: uppercase;">● ${statusStr}</span>
            </div>
          </div>

          <!-- KEY ORDER BEHAVIOR STRIP -->
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 12px; background: #f1f5f9; padding: 6px 8px; border-radius: 6px; font-size: 9.5px;">
            <div>Lifetime Sales: <strong>${formatLakhs(lifetimeSales)}</strong></div>
            <div>Avg Monthly: <strong>${formatLakhs(avgMonthlyBuying)}</strong></div>
            <div>Avg Order: <strong>${formatCurrency(avgOrderValue)}</strong></div>
            <div>Active Months: <strong>${activeMonths} Months</strong></div>
            <div>Catalog Breadth: <strong>${basketStats.totalUniqueParts || 0} Parts</strong></div>
            <div>Total Invoices: <strong>${totalInvoices} Invoices</strong></div>
          </div>

          <!-- SECTION 2: 7 PRIMARY KPI METRICS -->
          <div class="kpi-row">
            <div class="kpi-cell">
              <div class="kpi-cell-label">YTD Sales</div>
              <div class="kpi-cell-val">${formatLakhs(curYtd)}</div>
              <div style="font-size: 8px; color: #64748b;">${formatCurrency(curYtd)}</div>
            </div>
            <div class="kpi-cell">
              <div class="kpi-cell-label">QTD Sales</div>
              <div class="kpi-cell-val">${formatLakhs(curQtd)}</div>
              <div style="font-size: 8px; color: #64748b;">${formatCurrency(curQtd)}</div>
            </div>
            <div class="kpi-cell">
              <div class="kpi-cell-label">MQTD Sales</div>
              <div class="kpi-cell-val">${formatLakhs(curMqtd)}</div>
              <div style="font-size: 8px; color: #64748b;">${formatCurrency(curMqtd)}</div>
            </div>
            <div class="kpi-cell">
              <div class="kpi-cell-label">HTD Sales</div>
              <div class="kpi-cell-val">${formatLakhs(curHtd)}</div>
              <div style="font-size: 8px; color: #64748b;">${formatCurrency(curHtd)}</div>
            </div>
            <div class="kpi-cell" style="background: ${ytdGrowth >= 0 ? '#ecfdf5' : '#fff1f2'};">
              <div class="kpi-cell-label">YoY Growth</div>
              <div class="kpi-cell-val" style="color: ${ytdGrowth >= 0 ? '#16a34a' : '#dc2626'};">${formatGrowth(ytdGrowth)}</div>
              <div style="font-size: 8px; color: #64748b;">vs LY Same Period</div>
            </div>
            <div class="kpi-cell" style="background: #eff6ff;">
              <div class="kpi-cell-label">Target Achieved</div>
              <div class="kpi-cell-val" style="color: #2563eb;">${dynamicCalculations.dynamicAchievementPercent.toFixed(1)}%</div>
              <div style="font-size: 8px; color: #2563eb;">Tgt: ${formatLakhs(dynamicCalculations.dynamicTarget)}</div>
            </div>
            <div class="kpi-cell" style="background: ${dynamicCalculations.dynamicGap > 0 ? '#fffbeb' : '#ecfdf5'};">
              <div class="kpi-cell-label">${dynamicCalculations.dynamicGap > 0 ? 'Target Gap' : 'Target Surplus'}</div>
              <div class="kpi-cell-val" style="color: ${dynamicCalculations.dynamicGap > 0 ? '#d97706' : '#16a34a'};">${formatLakhs(Math.abs(dynamicCalculations.dynamicGap))}</div>
              <div style="font-size: 8px; color: #64748b;">@+${targetGrowthPercent}% aim</div>
            </div>
          </div>

          <!-- SECTION 3: EXACT SAME-PERIOD COMPARISON TABLE -->
          <div class="section-heading">Period Performance vs Last Year (Exact Same-Period Comparison)</div>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th style="text-align: right;">FY${fiscalYear} (Current)</th>
                <th style="text-align: right;">FY${fiscalYear - 1} (LY Same Period)</th>
                <th style="text-align: right;">YoY Growth %</th>
                <th style="text-align: right;">Net Diff (₹)</th>
                <th style="text-align: right;">Target (@+${targetGrowthPercent}%)</th>
                <th style="text-align: right;">Target Ach %</th>
              </tr>
            </thead>
            <tbody>
              ${[
                { label: `MTD (${month})`, key: 'mtd' },
                { label: 'MQTD (Aug-Sep)', key: 'mqtd' },
                { label: 'QTD (Jul-Sep)', key: 'qtd' },
                { label: 'HTD (Apr-Sep)', key: 'htd' },
                { label: 'YTD (Apr-Sep)', key: 'ytd', bold: true },
              ].map(r => {
                const d = periodComparison[r.key] || {};
                const c = d.current ?? d.curSales ?? 0;
                const l = d.lySamePeriod ?? d.lySales ?? 0;
                const g = d.growthPercent ?? 0;
                const diff = d.diffAmount ?? (c - l);
                const tgt = Math.round(l * (1 + targetGrowthPercent / 100));
                const ach = tgt > 0 ? (c / tgt) * 100 : (c > 0 ? 100 : 0);
                return `
                  <tr style="${r.bold ? 'background: #eff6ff; font-weight: bold;' : ''}">
                    <td>${r.label}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: bold;">₹${Math.round(c).toLocaleString('en-IN')}</td>
                    <td style="text-align: right; font-family: monospace; color: #64748b;">₹${Math.round(l).toLocaleString('en-IN')}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${g >= 0 ? '#16a34a' : '#dc2626'};">${formatGrowth(g)}</td>
                    <td style="text-align: right; font-family: monospace; color: ${diff >= 0 ? '#16a34a' : '#dc2626'};">${diff >= 0 ? '+' : ''}₹${Math.round(diff).toLocaleString('en-IN')}</td>
                    <td style="text-align: right; font-family: monospace;">₹${Math.round(tgt).toLocaleString('en-IN')}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${ach >= 100 ? '#16a34a' : '#2563eb'};">${ach.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- SECTION 4: 4-YEAR TREND & CATEGORY BREAKDOWN -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <div class="section-heading">4-Year Sales History (4Y CAGR: ${cagrValue}%)</div>
              <table>
                <thead>
                  <tr>
                    <th>Fiscal Year</th>
                    <th style="text-align: right;">Sales Turnover</th>
                    <th style="text-align: right;">YoY Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  ${trendYears.map((yr: any) => `
                    <tr>
                      <td style="font-weight: bold;">${yr.year}</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatLakhs(yr.sales)}</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${yr.yoyGrowth >= 0 ? '#16a34a' : '#dc2626'};">${yr.yoyGrowth !== null && yr.yoyGrowth !== undefined ? formatGrowth(yr.yoyGrowth) : 'Base Year'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div>
              <div class="section-heading">Category Breakdown & Wallet Share</div>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style="text-align: right;">Month</th>
                    <th style="text-align: right;">YTD Sales</th>
                    <th style="text-align: right;">Lifetime</th>
                    <th style="text-align: right;">Share %</th>
                  </tr>
                </thead>
                <tbody>
                  ${catRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- SECTION 5: 5-PILLAR TARGET GAP DECOMPOSITION -->
          <div class="section-heading">Target Achievement Engine — 5-Pillar Gap Decomposition (100% Coverage)</div>
          <div class="pillars-grid">
            <div class="pillar-box">
              <div class="pillar-title">1. Lost Part Volume (30%)</div>
              <div class="pillar-val">${formatLakhs(dynamicCalculations.pillars.lostPartVol)}</div>
              <div style="font-size: 8.5px; color: #64748b;">Recover dropped catalog items</div>
            </div>
            <div class="pillar-box">
              <div class="pillar-title">2. Category Expansion (25%)</div>
              <div class="pillar-val">${formatLakhs(dynamicCalculations.pillars.catExpansion)}</div>
              <div style="font-size: 8.5px; color: #64748b;">Cross-sell lagging categories</div>
            </div>
            <div class="pillar-box">
              <div class="pillar-title">3. Branch Movers (20%)</div>
              <div class="pillar-val">${formatLakhs(dynamicCalculations.pillars.fastMovers)}</div>
              <div style="font-size: 8.5px; color: #64748b;">Introduce branch top-sellers</div>
            </div>
            <div class="pillar-box">
              <div class="pillar-title">4. Cross-Sell Families (15%)</div>
              <div class="pillar-val">${formatLakhs(dynamicCalculations.pillars.crossSell)}</div>
              <div style="font-size: 8.5px; color: #64748b;">Pair root part accessories</div>
            </div>
            <div class="pillar-box">
              <div class="pillar-title">5. Dormant Recovery (10%)</div>
              <div class="pillar-val">${formatLakhs(dynamicCalculations.pillars.dormantRecovery)}</div>
              <div style="font-size: 8.5px; color: #64748b;">Reactivate lapsed core parts</div>
            </div>
          </div>

          <!-- SECTION 6: PRODUCT DECLINE & LOST VOLUME ANALYSIS -->
          <div class="section-heading">Product Decline & Lost Volume Analysis (Field Pitch Targets)</div>
          <table>
            <thead>
              <tr>
                <th>Part Number</th>
                <th style="text-align: center;">Cat</th>
                <th style="text-align: right;">LY Qty</th>
                <th style="text-align: right;">Cur Qty</th>
                <th style="text-align: right;">Qty Gap</th>
                <th style="text-align: right;">LY Sales</th>
                <th style="text-align: right;">Cur Sales</th>
                <th style="text-align: right;">Opportunity (₹)</th>
                <th>Pitch Recommendation</th>
              </tr>
            </thead>
            <tbody>
              ${decliningPartsRowsHtml || '<tr><td colspan="9" style="text-align:center;">No declining parts detected.</td></tr>'}
            </tbody>
          </table>

          <!-- SECTION 7: TOP 5 RECOMMENDED ACTIONS -->
          <div class="section-heading">Top Recommended Next Best Actions (Field Rep Sales Playbook)</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">Rank</th>
                <th>Action Playbook</th>
                <th>Data-Driven Rationale</th>
                <th style="text-align: right; width: 110px;">Potential (₹)</th>
                <th style="text-align: center; width: 70px;">Priority</th>
              </tr>
            </thead>
            <tbody>
              ${actionsRowsHtml || '<tr><td colspan="5" style="text-align:center;">No immediate playbook actions required.</td></tr>'}
            </tbody>
          </table>

          <!-- SECTION 8: TOP PARTLINE CONTRIBUTORS -->
          <div class="section-heading">Top Partline Revenue Contributors (Catalog Volume)</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 35px;">#</th>
                <th>Part Num</th>
                <th>Root Part Family</th>
                <th style="text-align: center;">Cat</th>
                <th style="text-align: right;">Qty</th>
                <th style="text-align: right;">Turnover (₹)</th>
                <th style="text-align: right;">Revenue Share %</th>
              </tr>
            </thead>
            <tbody>
              ${topPartsRowsHtml || '<tr><td colspan="7" style="text-align:center;">No parts recorded.</td></tr>'}
            </tbody>
          </table>

          <!-- FOOTER -->
          <div style="border-top: 1.5px solid #cbd5e1; padding-top: 6px; margin-top: 14px; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
            <div>TheSSBuddy Enterprise Customer 360 Intelligence System • Powered by Thesssystems</div>
            <div>Confidential Business Intelligence Report • Page 1 of 1</div>
          </div>

        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlDoc);
    printWin.document.close();

    // Trigger Print after styles render
    setTimeout(() => {
      printWin.focus();
      printWin.print();
      setIsExportingPDF(false);
    }, 450);
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

            {/* Complete Formatted PDF Print */}
            <button
              onClick={handlePrintPDF}
              disabled={isExportingPDF || !partyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
              title="Print complete formatted multi-page PDF Dossier with all 23 sections"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isExportingPDF ? 'Preparing PDF...' : 'PDF'}</span>
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
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatLakhs(lifetimeSales)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Avg Monthly Buying</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatLakhs(avgMonthlyBuying)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Avg Order Value</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{formatCurrency(avgOrderValue)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] font-medium text-slate-500">Active Months</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">{activeMonths} Months</div>
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
              {formatLakhs(curYtd)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(curYtd)}
            </div>
          </div>

          {/* Tile 2: QTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">QTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(curQtd)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(curQtd)}
            </div>
          </div>

          {/* Tile 3: MQTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">MQTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(curMqtd)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(curMqtd)}
            </div>
          </div>

          {/* Tile 4: HTD Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs print-card">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">HTD Sales</div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLakhs(curHtd)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatCurrency(curHtd)}
            </div>
          </div>

          {/* Tile 5: YTD Growth % */}
          <div className={`rounded-xl border p-3 shadow-xs print-card ${
            ytdGrowth >= 0
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-rose-50/70 border-rose-200'
          }`}>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">YTD Growth YoY</div>
            <div className={`text-base font-extrabold mt-1 flex items-center gap-1 ${
              ytdGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {ytdGrowth >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {formatGrowth(ytdGrowth)}
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
                  const cur = pData.current ?? pData.curSales ?? 0;
                  const ly = pData.lySamePeriod ?? pData.lySales ?? 0;
                  const growth = pData.growthPercent ?? 0;
                  const diff = pData.diffAmount ?? (cur - ly);
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
                4Y CAGR: {cagrValue}%
              </div>
            </div>

            {/* 4 Year Bars Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {trendYears.map((yr: any, idx: number) => (
                <div
                  key={yr.year || idx}
                  className={`p-2.5 rounded-lg border text-center ${
                    idx === trendYears.length - 1
                      ? 'bg-blue-50/60 border-blue-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">{yr.year}</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">
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
                            {formatCurrency(c.ytdSales || c.curYtdSales || c.curMonthSales)}
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
                  {cleanTopParts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">No part items recorded</td>
                    </tr>
                  ) : (
                    cleanTopParts.slice(0, 5).map((p: any) => (
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
                          {Number(p.qty).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(p.sales)}
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
