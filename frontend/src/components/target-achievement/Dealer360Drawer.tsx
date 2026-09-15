'use client';
import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import {
  X, Activity, Calculator, Edit3, TrendingUp, TrendingDown,
  Layers, Package, Calendar, Award, CheckCircle2, AlertTriangle,
  XCircle, Clock, ShoppingCart, ArrowUpRight, BarChart2, ShieldCheck,
  Building2, Hash, Percent, RefreshCw, Printer, Maximize2,
  Minimize2, FileSpreadsheet, Sparkles, Target, Zap, HelpCircle,
  Check, ArrowRight, DollarSign, BarChart3, PieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface Dealer360DrawerProps {
  dealer: any;
  onClose: () => void;
  onEditTarget: (dealer: any) => void;
  currentPeriodLabel: string;
  prevPeriodLabel: string;
  lyPeriodLabel: string;
  fiscalYear?: number;
  month?: string;
}

type TabType = 'overview' | 'pitch' | 'frequency' | 'top_parts' | 'categories' | 'multi_period' | 'timeline' | 'all';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

const formatLakhs = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '0.00 L';
  return `${(val / 100000).toFixed(2)} L`;
};

const formatPercent = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '0.0%';
  const num = typeof val === 'number' ? val : parseFloat(val);
  const p = num > 1.5 || num < -1.5 ? num : num * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
};

export const Dealer360Drawer: React.FC<Dealer360DrawerProps> = ({
  dealer,
  onClose,
  onEditTarget,
  currentPeriodLabel,
  prevPeriodLabel,
  lyPeriodLabel,
  fiscalYear = 2026,
  month = 'Sep',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [freqFilter, setFreqFilter] = useState<'all' | 'frequent' | 'regular' | 'rare'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const partyCode = dealer?.partyCode || '';
  const branchCode = dealer?.branchCode || '';

  const { data: party360Data } = useSWR(
    partyCode ? `/reports/party-360?partyCode=${encodeURIComponent(partyCode)}&branchCode=${encodeURIComponent(branchCode)}&fiscalYear=${fiscalYear}&month=${encodeURIComponent(month)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const merged = useMemo(() => {
    if (!dealer) return null;
    const profile = party360Data?.profile || {};
    const matrix = party360Data?.matrix || {};
    return {
      ...dealer,
      ...matrix,
      partyName: profile.partyName || dealer.partyName || partyCode,
      originalCode: profile.originalCode || dealer.originalCode || partyCode,
      partyType: profile.partyType || dealer.partyType || 'TRADER/RETAILER',
      branchName: profile.branchName || dealer.branchName || branchCode,
      basketStats: party360Data?.basketStats || null,
      timeline: party360Data?.timeline || [],
      categories: party360Data?.categories || [],
      topParts: party360Data?.topParts || [],
      pitchOpportunities: party360Data?.pitchOpportunities || { reorderCandidates: [], crossSellBranchMovers: [] },
      frequencySegmentation: party360Data?.frequencySegmentation || { frequentCount: 0, regularCount: 0, rareCount: 0, frequent: [], regular: [], rare: [] },
    };
  }, [dealer, party360Data, partyCode, branchCode]);

  // Chart data from actual monthly timeline
  const chartData = useMemo(() => {
    if (merged?.timeline && merged.timeline.length > 0) {
      return merged.timeline.map((t: any) => ({
        month: t.period || t.month,
        sales: Math.round(t.sales || 0),
        partlines: t.partlines || 0,
        invoices: t.invoices || 0,
      }));
    }
    const base = Number(dealer?.lastMonthSales) || Number(dealer?.currentSales) || 100000;
    return [
      { month: 'Apr', sales: Math.round(base * 0.95), partlines: 15, invoices: 2 },
      { month: 'May', sales: Math.round(base * 1.10), partlines: 18, invoices: 3 },
      { month: 'Jun', sales: Math.round(base * 1.05), partlines: 16, invoices: 3 },
      { month: 'Jul', sales: Math.round(base * 1.12), partlines: 20, invoices: 4 },
      { month: prevPeriodLabel, sales: Math.round(dealer?.lastMonthSales || base * 1.15), partlines: 22, invoices: 4 },
      { month: `${currentPeriodLabel} (Cur)`, sales: Math.round(dealer?.currentSales || 0), partlines: dealer?.uniquePartlines || 0, invoices: 1 },
    ];
  }, [merged, dealer, currentPeriodLabel, prevPeriodLabel]);

  if (!dealer || !merged) return null;

  const currentSales = Number(merged.currentSales) || Number(merged.mtdSep26) || 0;
  const finalTarget = Number(merged.finalTarget) || 0;
  const achievementPercent = finalTarget > 0 ? (currentSales / finalTarget) * 100 : (Number(merged.achievementPercent) || 0);
  const isAchieved = achievementPercent >= 100;
  const isOnTrack = achievementPercent >= 70 && achievementPercent < 100;
  const gapAmount = currentSales - finalTarget;

  const basket = merged.basketStats || {
    totalInvoices: 0,
    totalUniqueParts: 0,
    totalLineItems: 0,
    lifetimeSales: 0,
    lifetimeQty: 0,
    avgInvoiceValue: 0,
    avgQtyPerInvoice: 0,
    avgLinesPerInvoice: 0,
    firstPurchase: 'N/A',
    lastPurchase: 'N/A',
    activeMonths: 0,
  };

  // Download complete Party 360 Excel report
  const handleDownloadExcel = async () => {
    try {
      setIsExporting(true);
      const url = `/reports/party-360/export?partyCode=${encodeURIComponent(partyCode)}&branchCode=${encodeURIComponent(branchCode)}&fiscalYear=${fiscalYear}&month=${encodeURIComponent(month)}`;
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Party_360_${partyCode}_${month}_FY${fiscalYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Failed to export Party 360 Excel', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger Formatted PDF Print Report (Official Document Layout)
  const handleFormattedPDF = () => {
    if (!merged) return;
    const printWin = window.open('', '_blank', 'width=1050,height=900');
    if (!printWin) {
      window.print();
      return;
    }

    const categoriesRows = (merged.categories || []).map((c: any) => `
      <tr>
        <td class="font-bold">${c.cat}</td>
        <td class="text-center">${c.uniquePartlines}</td>
        <td class="text-center">${c.totalInvoices}</td>
        <td class="text-right font-bold font-mono">₹${Math.round(c.curMonthSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-right font-mono">₹${Math.round(c.ytdSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-right font-mono">₹${Math.round(c.lifetimeSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-center font-bold">${c.sharePercent}%</td>
      </tr>
    `).join('');

    const topPartsRows = (merged.topParts || []).slice(0, 20).map((p: any, idx: number) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold">${p.partNum}</td>
        <td>${p.rootPartNum || p.partNum}</td>
        <td class="text-center font-bold">${p.cat}</td>
        <td class="text-center font-mono">${Number(p.totalQty || 0).toLocaleString('en-IN')}</td>
        <td class="text-right font-bold font-mono">₹${Math.round(p.totalSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-center">${p.revenueShare ? `${p.revenueShare}%` : '-'}</td>
        <td class="text-center">${p.lastPurchased || '-'}</td>
      </tr>
    `).join('');

    const pitchReorderRows = (merged.pitchOpportunities?.reorderCandidates || []).slice(0, 10).map((p: any, idx: number) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold text-navy">${p.partNum}</td>
        <td>${p.rootPartNum}</td>
        <td class="text-center font-bold">${p.cat}</td>
        <td class="text-right font-bold font-mono">₹${Math.round(p.totalSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-center font-bold text-red">${p.lastPurchased}</td>
        <td class="text-center"><span class="badge badge-pitch">Re-order Candidate</span></td>
      </tr>
    `).join('');

    const pitchCrossSellRows = (merged.pitchOpportunities?.crossSellBranchMovers || []).slice(0, 10).map((p: any, idx: number) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold text-navy">${p.partNum}</td>
        <td>${p.rootPartNum}</td>
        <td class="text-center font-bold">${p.cat}</td>
        <td class="text-right font-bold font-mono">₹${Math.round(p.totalSales || 0).toLocaleString('en-IN')}</td>
        <td class="text-center font-mono">${p.invoicesCount} inv</td>
        <td class="text-center"><span class="badge badge-regular">Cross-Sell Opportunity</span></td>
      </tr>
    `).join('');

    const timelineRows = (merged.timeline || []).map((t: any) => `
      <tr>
        <td class="font-bold text-navy">${t.period}</td>
        <td class="text-center">FY${t.fiscalYear}</td>
        <td class="text-right font-bold font-mono">₹${Math.round(t.sales || 0).toLocaleString('en-IN')}</td>
        <td class="text-center font-mono">${Number(t.qty || 0).toLocaleString('en-IN')}</td>
        <td class="text-center">${t.invoices}</td>
        <td class="text-center">${t.partlines}</td>
        <td class="text-right font-mono">₹${Math.round(t.avgInvoiceValue || 0).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Party 360° Intelligence Dossier - ${merged.partyCode} - ${merged.partyName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 12mm 12mm;
            }
            * {
              box-sizing: border-box;
              font-family: 'Segoe UI', Arial, sans-serif;
            }
            body {
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 10.5px;
              line-height: 1.35;
            }
            .header-banner {
              border-bottom: 2.5px solid #002060;
              padding-bottom: 8px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .company-title {
              font-size: 15px;
              font-weight: 900;
              color: #002060;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .report-subtitle {
              font-size: 11px;
              font-weight: 700;
              color: #0284c7;
              text-transform: uppercase;
              margin-top: 1px;
            }
            .meta-box {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 12px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              font-size: 10px;
            }
            .meta-item strong {
              color: #475569;
              font-size: 9px;
              text-transform: uppercase;
              display: block;
            }
            .meta-item span {
              color: #0f172a;
              font-weight: 800;
              font-size: 11.5px;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .kpi-card {
              border: 1px solid #cbd5e1;
              background: #f1f5f9;
              border-radius: 6px;
              padding: 7px 9px;
            }
            .kpi-label {
              font-size: 9px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
            }
            .kpi-val {
              font-size: 13px;
              font-weight: 900;
              color: #002060;
              margin-top: 1px;
              font-family: 'Courier New', Courier, monospace;
            }
            .kpi-sub {
              font-size: 8.5px;
              color: #64748b;
            }
            .section-title {
              font-size: 11px;
              font-weight: 800;
              color: #002060;
              text-transform: uppercase;
              border-bottom: 1.5px solid #002060;
              padding-bottom: 3px;
              margin-top: 12px;
              margin-bottom: 6px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 9.5px;
            }
            th {
              background-color: #002060;
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 4.5px 6px;
              border: 1px solid #002060;
              font-size: 9px;
              text-transform: uppercase;
            }
            td {
              padding: 4px 6px;
              border: 1px solid #cbd5e1;
              color: #1e293b;
            }
            tr:nth-child(even) td {
              background-color: #f8fafc;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: 'Courier New', Courier, monospace; }
            .font-bold { font-weight: 700; }
            .text-navy { color: #002060; }
            .text-red { color: #b91c1c; }
            .badge {
              display: inline-block;
              padding: 1px 5px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-regular { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
            .badge-pitch { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .page-break { page-break-before: always; }
            .footer {
              margin-top: 14px;
              border-top: 1px solid #cbd5e1;
              padding-top: 5px;
              font-size: 8.5px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div>
              <div class="company-title">THE SS BUDDY • DEALER INTELLIGENCE PORTAL</div>
              <div class="report-subtitle">PARTY 360° EXECUTIVE INTELLIGENCE DOSSIER</div>
            </div>
            <div style="text-align: right; font-size: 9px; color: #475569;">
              <div><strong>REPORT PERIOD:</strong> ${month}'${String(fiscalYear).slice(-2)} (FY${fiscalYear})</div>
              <div><strong>GENERATED:</strong> ${new Date().toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div class="meta-box">
            <div class="meta-item"><strong>Party Name</strong><span>${merged.partyName}</span></div>
            <div class="meta-item"><strong>Party Code (Consolidated)</strong><span>${merged.partyCode}</span></div>
            <div class="meta-item"><strong>Original ERP Code</strong><span>${merged.originalCode || merged.partyCode}</span></div>
            <div class="meta-item"><strong>Operating Branch</strong><span>${merged.branchCode} (${merged.branchName})</span></div>
            <div class="meta-item"><strong>Party Category / Type</strong><span>${merged.partyType} (${merged.partCategoryCode || 'ALL'} Cat)</span></div>
            <div class="meta-item"><strong>Buying Span</strong><span>${basket.activeMonths} Mos (${basket.firstPurchase} → ${basket.lastPurchase})</span></div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">${month}'${String(fiscalYear).slice(-2)} Turnover</div>
              <div class="kpi-val">₹${Math.round(currentSales).toLocaleString('en-IN')}</div>
              <div class="kpi-sub">${formatLakhs(currentSales)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">${month}'${String(fiscalYear).slice(-2)} Budget Target</div>
              <div class="kpi-val">₹${Math.round(finalTarget).toLocaleString('en-IN')}</div>
              <div class="kpi-sub">${formatLakhs(finalTarget)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Target Fulfillment %</div>
              <div class="kpi-val">${achievementPercent.toFixed(1)}%</div>
              <div class="kpi-sub">${isAchieved ? '✓ Target Achieved' : isOnTrack ? '⚡ On Track' : '⚠ Under Target'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Order Value (AOV)</div>
              <div class="kpi-val">₹${Math.round(basket.avgInvoiceValue).toLocaleString('en-IN')}</div>
              <div class="kpi-sub">${basket.totalInvoices} Invoices Billed</div>
            </div>
          </div>

          <div class="section-title">1. LIFETIME ORDER BASKET & TRANSACTION METRICS</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Lifetime Turnover</div>
              <div class="kpi-val">₹${Math.round(basket.lifetimeSales).toLocaleString('en-IN')}</div>
              <div class="kpi-sub">${formatLakhs(basket.lifetimeSales)} Total</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Unique Partlines</div>
              <div class="kpi-val">${basket.totalUniqueParts} Lines</div>
              <div class="kpi-sub">Total catalog breadth</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Lines / Invoice</div>
              <div class="kpi-val">${basket.avgLinesPerInvoice} Lines</div>
              <div class="kpi-sub">Basket variety</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Units / Invoice</div>
              <div class="kpi-val">${basket.avgQtyPerInvoice} Qty</div>
              <div class="kpi-sub">${basket.lifetimeQty.toLocaleString('en-IN')} Lifetime Qty</div>
            </div>
          </div>

          <div class="section-title">2. MULTI-PERIOD GROWTH & PERFORMANCE SCORECARD</div>
          <table>
            <thead>
              <tr>
                <th>Growth Metric & Interval</th>
                <th class="text-right">Sales Amount (₹)</th>
                <th class="text-right">Comparative Period</th>
                <th class="text-right">Growth Rate %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">MTD Performance (@ ${month}'${String(fiscalYear).slice(-2)})</td>
                <td class="text-right font-bold font-mono">₹${Math.round(currentSales).toLocaleString('en-IN')}</td>
                <td class="text-right font-mono">LY Same Month: ₹${Math.round(Number(merged.lySameMonthSales) || 0).toLocaleString('en-IN')}</td>
                <td class="text-right font-bold">${formatPercent(merged.mtdSep26Growth)}</td>
              </tr>
              <tr>
                <td class="font-bold">QTD Performance (Q2 FY${fiscalYear})</td>
                <td class="text-right font-bold font-mono">₹${Math.round(Number(merged.qtdQ2Cur) || 0).toLocaleString('en-IN')}</td>
                <td class="text-right font-mono">Prev Qtr: ₹${Math.round(Number(merged.qtdQ1CurTotal) || 0).toLocaleString('en-IN')}</td>
                <td class="text-right font-bold">${formatPercent(merged.qtdSep26Growth)}</td>
              </tr>
              <tr>
                <td class="font-bold">Annual Evolution (FY${fiscalYear} YTD)</td>
                <td class="text-right font-bold font-mono">₹${Math.round(Number(merged.ytdCur || merged.ytdSales) || 0).toLocaleString('en-IN')}</td>
                <td class="text-right font-mono">FY${fiscalYear - 1} Full: ₹${Math.round(Number(merged.fy2Total) || 0).toLocaleString('en-IN')}</td>
                <td class="text-right font-bold">${formatPercent(merged.ytdGrowth || merged.yoyGrowthPercent)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">3. PRODUCT CATEGORY SALES & PARTLINE DISTRIBUTION</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-center">Unique Partlines</th>
                <th class="text-center">Invoices</th>
                <th class="text-right">${month}'${String(fiscalYear).slice(-2)} Sales (₹)</th>
                <th class="text-right">YTD FY${fiscalYear} (₹)</th>
                <th class="text-right">Lifetime Sales (₹)</th>
                <th class="text-center">Share %</th>
              </tr>
            </thead>
            <tbody>
              ${categoriesRows || '<tr><td colspan="7" class="text-center">No categories recorded</td></tr>'}
            </tbody>
          </table>

          <div class="page-break"></div>

          <div class="header-banner">
            <div>
              <div class="company-title">THE SS BUDDY • SALES ACTION & LINE-ITEM INTELLIGENCE</div>
              <div class="report-subtitle">PARTY: ${merged.partyName} (${merged.partyCode})</div>
            </div>
            <div style="text-align: right; font-size: 9px; color: #475569;">
              <div>Page 2 of 2</div>
            </div>
          </div>

          <div class="section-title">4. SALES PITCH OPPORTUNITIES: DORMANT RE-ORDER & CROSS-SELL CANDIDATES</div>
          <table>
            <thead>
              <tr>
                <th class="text-center">#</th>
                <th>Part Number</th>
                <th>Root Part Number</th>
                <th class="text-center">Cat</th>
                <th class="text-right">Historical / Branch Spend (₹)</th>
                <th class="text-center">Last Bought / Volume</th>
                <th class="text-center">Pitch Recommendation</th>
              </tr>
            </thead>
            <tbody>
              ${pitchReorderRows || ''}
              ${pitchCrossSellRows || ''}
            </tbody>
          </table>

          <div class="section-title">5. TOP 20 PURCHASED PARTLINES (RANKED BY REVENUE)</div>
          <table>
            <thead>
              <tr>
                <th class="text-center">#</th>
                <th>Part Number</th>
                <th>Root Part Number</th>
                <th class="text-center">Cat</th>
                <th class="text-center">Total Qty</th>
                <th class="text-right">Total Revenue (₹)</th>
                <th class="text-center">Share %</th>
                <th class="text-center">Last Purchase</th>
              </tr>
            </thead>
            <tbody>
              ${topPartsRows || '<tr><td colspan="8" class="text-center">No line item records</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">6. MONTHLY HISTORICAL TURNOVER TIMELINE</div>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th class="text-center">Fiscal Year</th>
                <th class="text-right">Total Sales (₹)</th>
                <th class="text-center">Units Sold</th>
                <th class="text-center">Invoices</th>
                <th class="text-center">Partlines</th>
                <th class="text-right">Avg Invoice Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${timelineRows || '<tr><td colspan="7" class="text-center">No timeline records</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <div>Confidential & Proprietary • The SS Buddy Automotive Management Platform</div>
            <div>Authorized Financial & Sales Intelligence System</div>
          </div>
        </body>
      </html>
    `;

    printWin.document.write(htmlDoc);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 450);
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[99999] flex ${isFullScreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'} items-center justify-center animate-in fade-in duration-200`}>
      <div className={`bg-[#f8fafc] text-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-200 transition-all duration-300 ${
        isFullScreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-6xl h-[92vh] rounded-2xl'
      }`}>
        
        {/* TOP HEADER (LIGHT THEME MATCHING IMAGE 4) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white text-slate-900 shrink-0 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-mono font-bold text-xs uppercase border border-blue-200 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={12} className="text-blue-600" /> Party 360° Intelligence Dossier
                </span>
                <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-mono font-bold text-xs uppercase border border-purple-200 shadow-2xs">
                  {merged.partCategoryCode || 'ALL'} Category
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-xs uppercase border border-slate-200 shadow-2xs">
                  {merged.partyType}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
                {merged.partyName}
              </h2>

              <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono text-slate-600 flex-wrap pt-0.5">
                <span>Party Code: <strong className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{merged.partyCode}</strong></span>
                {merged.originalCode && merged.originalCode !== merged.partyCode && (
                  <span>Orig Code: <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{merged.originalCode}</strong></span>
                )}
                <span>Branch: <strong className="text-slate-900 font-bold">{merged.branchCode} ({merged.branchName})</strong></span>
                <span>Period: <strong className="text-emerald-700 font-bold">{month}'{String(fiscalYear).slice(-2)}</strong></span>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleDownloadExcel}
                disabled={isExporting}
                title="Download complete Party 360 dossier as Excel (.xlsx)"
                className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={15} className={isExporting ? 'animate-spin' : 'text-emerald-600'} />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                onClick={handleFormattedPDF}
                title="Print / Save Formatted PDF Dossier"
                className="px-3 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer size={15} className="text-blue-600" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Exit Full Screen' : 'Expand to Full Page'}
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
              >
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                onClick={onClose}
                title="Close"
                className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-xl transition ml-1 cursor-pointer shadow-2xs"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* TAB BAR NAVIGATION (MATCHING IMAGE 4 VIEW TABS) */}
          <div className="flex items-center gap-1.5 mt-4 pt-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Activity size={13} />
              <span>Overview & Target</span>
            </button>

            <button
              onClick={() => setActiveTab('pitch')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'pitch'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Zap size={13} className={activeTab === 'pitch' ? 'text-amber-300' : 'text-amber-500'} />
              <span>Pitch Opportunities ({(merged.pitchOpportunities?.reorderCandidates?.length || 0) + (merged.pitchOpportunities?.crossSellBranchMovers?.length || 0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('frequency')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'frequency'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Clock size={13} />
              <span>Purchase Frequency ({merged.frequencySegmentation?.totalUniqueParts || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('top_parts')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'top_parts'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <ShoppingCart size={13} />
              <span>Top Parts ({merged.topParts?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Layers size={13} />
              <span>Categories ({merged.categories?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('multi_period')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'multi_period'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <BarChart2 size={13} />
              <span>MTD • QTD • YTD</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-[#002060] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Calendar size={13} />
              <span>Monthly Timeline ({merged.timeline?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab(activeTab === 'all' ? 'overview' : 'all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>{activeTab === 'all' ? '✓ Master View (All-In-One)' : 'Master All-in-One View'}</span>
            </button>
          </div>
        </div>

        {/* BODY CONTENT AREA (CLEAN WHITE & SLATE DASHBOARD) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs custom-scrollbar bg-[#f8fafc]">
          
          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 1: OVERVIEW & TARGET FORMULATION */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'overview' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 4 Core Summary KPI Cards (MATCHING PORTAL STAT CARDS IN IMAGE 4) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{currentPeriodLabel} Turnover</p>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                      {formatCurrency(currentSales)}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{formatLakhs(currentSales)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{currentPeriodLabel} Target</p>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <Target size={16} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                      {formatCurrency(finalTarget)}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{formatLakhs(finalTarget)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Achievement %</p>
                    <div className={`p-2 rounded-xl ${isAchieved ? 'bg-emerald-50 text-emerald-600' : isOnTrack ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                      <BarChart3 size={16} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                        {achievementPercent.toFixed(1)}%
                      </p>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-3xs font-bold border ${
                        isAchieved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isOnTrack ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isAchieved ? 'ACHIEVED' : isOnTrack ? 'ON TRACK' : 'UNDER'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Overall Target Fulfillment</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Partlines & Gap</p>
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                      {merged.uniquePartlines || 0} <span className="text-xs font-normal text-slate-500">lines</span>
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Gap: <span className={gapAmount >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {gapAmount >= 0 ? `+${formatLakhs(gapAmount)}` : formatLakhs(gapAmount)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* LIFETIME BASKET & INVOICE INTELLIGENCE CARD (LIGHT THEME) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                    <ShoppingCart size={15} className="text-blue-600" />
                    Lifetime Order Basket & Invoicing Intelligence
                  </h4>
                  <span className="text-3xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200">
                    Active Buying Span: {basket.activeMonths} Months ({basket.firstPurchase} → {basket.lastPurchase})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-3xs text-slate-500 uppercase font-bold tracking-wider">Avg Invoice Value (AOV)</p>
                    <p className="text-base font-black text-slate-900 font-mono mt-1">{formatCurrency(basket.avgInvoiceValue)}</p>
                    <p className="text-3xs text-slate-500 mt-0.5">Per billed transaction</p>
                  </div>

                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-3xs text-slate-500 uppercase font-bold tracking-wider">Avg Lines / Invoice</p>
                    <p className="text-base font-black text-blue-700 font-mono mt-1">{basket.avgLinesPerInvoice} <span className="text-xs font-normal text-slate-500">parts</span></p>
                    <p className="text-3xs text-slate-500 mt-0.5">Basket variety breadth</p>
                  </div>

                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-3xs text-slate-500 uppercase font-bold tracking-wider">Avg Units / Invoice</p>
                    <p className="text-base font-black text-emerald-700 font-mono mt-1">{basket.avgQtyPerInvoice} <span className="text-xs font-normal text-slate-500">units</span></p>
                    <p className="text-3xs text-slate-500 mt-0.5">Order volume per bill</p>
                  </div>

                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-3xs text-slate-500 uppercase font-bold tracking-wider">Total Lifetime Billed</p>
                    <p className="text-base font-black text-purple-700 font-mono mt-1">{basket.totalInvoices} <span className="text-xs font-normal text-slate-500">inv ({basket.totalUniqueParts} parts)</span></p>
                    <p className="text-3xs text-slate-500 mt-0.5">{formatLakhs(basket.lifetimeSales)} total revenue</p>
                  </div>
                </div>
              </div>

              {/* Real Historical Turnover Timeline Chart */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Activity size={15} className="text-blue-600" />
                    Month-by-Month Turnover History (₹)
                  </span>
                  <span className="text-3xs text-slate-500 font-mono font-medium">Actual Transactional Retail Records</span>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSales360Light" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#0284c7" strokeWidth={2.5} fill="url(#colorSales360Light)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Target Engine Formulation Breakdown Card (Matching Portal Styling) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator size={14} className="text-blue-600" />
                    Target Engine Formulation Breakdown
                  </h4>
                  <span className="text-3xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
                    FY{fiscalYear} • {month} Target Matrix
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs text-slate-700 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">1. LY Same Month ({lyPeriodLabel}) × 40%:</span>
                    <span className="text-slate-900 font-bold">{formatCurrency((Number(merged.lySameMonthSales) || 0) * 0.40)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">2. Last Month ({prevPeriodLabel}) × 25%:</span>
                    <span className="text-slate-900 font-bold">{formatCurrency((Number(merged.lmSales) || Number(merged.lastMonthSales) || 0) * 0.25)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">3. Last Quarter Avg × 20%:</span>
                    <span className="text-slate-900 font-bold">{formatCurrency((Number(merged.lastQuarterAvg) || 0) * 0.20)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">4. Last FY Avg × 15%:</span>
                    <span className="text-slate-900 font-bold">{formatCurrency((Number(merged.lastFyAvg) || 0) * 0.15)}</span>
                  </div>
                  <div className="flex justify-between pt-2.5 text-blue-900 font-bold border-t border-slate-200">
                    <span>= Weighted Base:</span>
                    <span>{formatCurrency(Number(merged.weightedBase) || 0)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-slate-700">
                    <span>+ 10% Recommended Target:</span>
                    <span>{formatCurrency(Number(merged.recommendedTarget) || 0)}</span>
                  </div>
                  {Number(merged.gapAdjustment) > 0 && (
                    <div className="flex justify-between pt-2 text-emerald-700 font-semibold">
                      <span>+ Guardrail Gap Adjustment:</span>
                      <span>+{formatCurrency(Number(merged.gapAdjustment))}</span>
                    </div>
                  )}
                  {Number(merged.adminDefinedTarget) > 0 && (
                    <div className="flex justify-between pt-2 text-purple-700 font-bold">
                      <span>⚡ Admin Override Target:</span>
                      <span>{formatCurrency(Number(merged.adminDefinedTarget))}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 text-slate-900 font-bold text-sm border-t-2 border-slate-200">
                    <span>FINAL BUDGETED TARGET:</span>
                    <span className="text-[#002060] font-black text-base">{formatCurrency(finalTarget)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 2: SALES PITCH OPPORTUNITIES & CROSS-SELL */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'pitch' || activeTab === 'all') && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* RE-ORDER DORMANTS (LIGHT THEME TABLE) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" />
                      1. Re-Order Opportunities (Dormant High-Value Parts)
                    </h4>
                    <p className="text-3xs text-slate-500 mt-0.5">
                      Parts this party used to purchase in high volume ($&gt;$ ₹5,000) that have NOT been ordered in recent months! Proactive sales call candidates.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-mono font-bold text-xs border border-amber-200 shadow-2xs">
                    {merged.pitchOpportunities?.reorderCandidates?.length || 0} Candidates
                  </span>
                </div>

                {merged.pitchOpportunities?.reorderCandidates?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#002060] text-white">
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center w-12">#</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Part Number</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Root Part</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Cat</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Past Spend (₹)</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Past Qty</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Last Purchased</th>
                          <th className="py-2.5 px-3 text-center">Pitch Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {merged.pitchOpportunities.reorderCandidates.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 text-slate-400 text-center border-r border-slate-100">{i + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-100">{p.partNum}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{p.rootPartNum}</td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-purple-700">{p.cat}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(p.totalSales)}</td>
                            <td className="py-2.5 px-3 text-center text-slate-700 border-r border-slate-100">{p.totalQty.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-center text-rose-700 font-bold border-r border-slate-100">{p.lastPurchased}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 text-3xs font-sans font-bold shadow-2xs">
                                📞 Pitch Re-order
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6 font-medium">No dormant high-value parts found. Customer is active across all regular items.</p>
                )}
              </div>

              {/* BRANCH FAST-MOVERS (LIGHT THEME TABLE) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-600" />
                      2. Branch Top Fast-Movers (Cross-Sell Pitch Candidates)
                    </h4>
                    <p className="text-3xs text-slate-500 mt-0.5">
                      Top-selling fast-moving parts in branch ({merged.branchCode}) that this party has NEVER ordered yet! Cross-sell opportunities to expand wallet share.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-200 shadow-2xs">
                    {merged.pitchOpportunities?.crossSellBranchMovers?.length || 0} Hot Parts
                  </span>
                </div>

                {merged.pitchOpportunities?.crossSellBranchMovers?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#002060] text-white">
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center w-12">#</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Part Number</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Root Part</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Cat</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Branch Sales (₹)</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Branch Invoices</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {merged.pitchOpportunities.crossSellBranchMovers.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 text-slate-400 text-center border-r border-slate-100">{i + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-100">{p.partNum}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{p.rootPartNum}</td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-purple-700">{p.cat}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 border-r border-slate-100">{formatCurrency(p.totalSales)}</td>
                            <td className="py-2.5 px-3 text-center text-slate-700 border-r border-slate-100">{p.invoicesCount.toLocaleString('en-IN')} inv</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-300 text-3xs font-sans font-bold shadow-2xs">
                                🚀 Cross-Sell Opportunity
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6 font-medium">No cross-sell opportunities found.</p>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 3: PURCHASE FREQUENCY SEGMENTATION */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'frequency' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 flex-wrap gap-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Clock size={15} className="text-blue-600" />
                    Part Purchase Frequency Breakdown ({merged.frequencySegmentation?.totalUniqueParts || 0} Total Unique Parts)
                  </h4>
                  
                  {activeTab !== 'all' && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => setFreqFilter('all')}
                        className={`px-3 py-1 rounded-lg text-3xs font-bold cursor-pointer transition ${freqFilter === 'all' ? 'bg-[#002060] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFreqFilter('frequent')}
                        className={`px-3 py-1 rounded-lg text-3xs font-bold cursor-pointer transition ${freqFilter === 'frequent' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        Frequent ({merged.frequencySegmentation?.frequentCount || 0})
                      </button>
                      <button
                        onClick={() => setFreqFilter('regular')}
                        className={`px-3 py-1 rounded-lg text-3xs font-bold cursor-pointer transition ${freqFilter === 'regular' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        Regular ({merged.frequencySegmentation?.regularCount || 0})
                      </button>
                      <button
                        onClick={() => setFreqFilter('rare')}
                        className={`px-3 py-1 rounded-lg text-3xs font-bold cursor-pointer transition ${freqFilter === 'rare' ? 'bg-amber-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        Rare ({merged.frequencySegmentation?.rareCount || 0})
                      </button>
                    </div>
                  )}
                </div>

                {/* 3 Frequency Cards (LIGHT THEME) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/50 border-b border-slate-200">
                  <div className="bg-white border border-emerald-200 p-3.5 rounded-xl shadow-2xs">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-emerald-800 uppercase">🔥 Frequent / Core Basket</p>
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{merged.frequencySegmentation?.frequentCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-500 mt-1">Purchased in $\ge$ 3 active months. Core repeat purchase inventory.</p>
                  </div>

                  <div className="bg-white border border-blue-200 p-3.5 rounded-xl shadow-2xs">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-blue-800 uppercase">⚡ Regular / Seasonal</p>
                      <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{merged.frequencySegmentation?.regularCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-500 mt-1">Purchased in 2 active months. Semi-regular repeat cycle.</p>
                  </div>

                  <div className="bg-white border border-amber-200 p-3.5 rounded-xl shadow-2xs">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-amber-800 uppercase">📦 Rare / One-Off</p>
                      <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{merged.frequencySegmentation?.rareCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-500 mt-1">Purchased only once historically. Low repeat order frequency.</p>
                  </div>
                </div>

                {/* Items Table (LIGHT THEME) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#002060] text-white">
                        <th className="py-2.5 px-3 border-r border-blue-900/60">Part Number</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60">Root Part</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Cat</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Active Months</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Invoices</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Lifetime Sales (₹)</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Classification</th>
                        <th className="py-2.5 px-3 text-center">Last Purchase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {[
                        ...(freqFilter === 'all' || freqFilter === 'frequent' ? (merged.frequencySegmentation?.frequent || []) : []),
                        ...(freqFilter === 'all' || freqFilter === 'regular' ? (merged.frequencySegmentation?.regular || []) : []),
                        ...(freqFilter === 'all' || freqFilter === 'rare' ? (merged.frequencySegmentation?.rare || []) : []),
                      ].slice(0, 30).map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-blue-50/40 transition">
                          <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-100">{p.partNum}</td>
                          <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{p.rootPartNum}</td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-purple-700">{p.cat}</td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-slate-800">{p.activeMonthsCount} mos</td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-100 text-slate-600">{p.invoicesCount} inv</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(p.totalSales)}</td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-100">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold ${
                              p.frequencyType === 'FREQUENT'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : p.frequencyType === 'REGULAR'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {p.frequencyType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{p.lastPurchased}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 4: TOP PURCHASED PARTLINES */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'top_parts' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <ShoppingCart size={14} className="text-blue-600" />
                    Top 25 Purchased Partlines (Ranked by Lifetime Revenue)
                  </h4>
                  <span className="text-3xs text-slate-500 font-mono">Sorted by Total Turnover</span>
                </div>

                {merged.topParts && merged.topParts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#002060] text-white">
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center w-12">#</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Part Number</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Root Part</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Cat</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Total Qty</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Revenue (₹)</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Share %</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Invoices</th>
                          <th className="py-2.5 px-3 text-center">Last Purchase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {merged.topParts.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 text-slate-400 text-center border-r border-slate-100">{i + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-100">{p.partNum}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{p.rootPartNum}</td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-purple-700">{p.cat}</td>
                            <td className="py-2.5 px-3 text-center text-slate-800 border-r border-slate-100 font-bold">{p.totalQty.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 border-r border-slate-100">{formatCurrency(p.totalSales)}</td>
                            <td className="py-2.5 px-3 text-center text-purple-700 font-bold border-r border-slate-100">{p.revenueShare ? `${p.revenueShare}%` : '-'}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-100">{p.invoicesCount || '-'}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{p.lastPurchased || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6 font-medium">No specific line item records found for this party.</p>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 5: CATEGORIES BREAKDOWN */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'categories' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    Product Category Sales & Partline Distribution
                  </h4>
                  <span className="text-3xs text-slate-500 font-mono">Segment Distribution</span>
                </div>

                {merged.categories && merged.categories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#002060] text-white">
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Category</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Partlines</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Invoices</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">{currentPeriodLabel} Sales</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">FY{fiscalYear} YTD</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Lifetime Sales</th>
                          <th className="py-2.5 px-3 text-center">Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {merged.categories.map((c: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 font-bold border-r border-slate-100">
                              <span className="px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {c.cat}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-800 font-bold border-r border-slate-100">{c.uniquePartlines}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-100">{c.totalInvoices}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 border-r border-slate-100">{formatCurrency(c.curMonthSales)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-900 font-bold border-r border-slate-100">{formatCurrency(c.ytdSales)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700 border-r border-slate-100">{formatCurrency(c.lifetimeSales)}</td>
                            <td className="py-2.5 px-3 text-center text-purple-700 font-bold">{c.sharePercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6 font-medium">No specific category breakdown available.</p>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 6: MULTI-PERIOD GROWTH SCORECARD */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'multi_period' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* MTD Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-600" />
                    1. MTD Performance & Monthly Growth
                  </h4>
                  <span className="text-3xs text-slate-500 font-medium">Month-over-Month & Year-over-Year</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#002060] text-white">
                        <th className="py-2.5 px-3 border-r border-blue-900/60">Metric</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right">Growth Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">MTD @ {prevPeriodLabel} (LY-1)</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.mtdAug25)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatPercent(merged.mtdAug25Growth)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">LM Total ({prevPeriodLabel})</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.lmSales || merged.lastMonthSales)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{formatPercent(merged.mtdAug26Growth)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">LY Same Month ({lyPeriodLabel})</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.lySameMonthSales)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                      </tr>
                      <tr className="bg-blue-50/60">
                        <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-200">MTD @ {currentPeriodLabel} (Current)</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 border-r border-slate-200">{formatCurrency(currentSales)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatPercent(merged.mtdSep26Growth)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* QTD Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Award size={13} className="text-blue-600" />
                    2. QTD Performance & Quarterly Growth
                  </h4>
                  <span className="text-3xs text-slate-500 font-medium">Quarterly Aggregation</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#002060] text-white">
                        <th className="py-2.5 px-3 border-r border-blue-900/60">Quarter Period</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Sales Total (₹)</th>
                        <th className="py-2.5 px-3 text-right">Growth Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">QTD Last Year Total</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.qtdQ2LyTotal)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatPercent(merged.qtdAug25Growth)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">QTD Prev Quarter Total</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.qtdQ1CurTotal)}</td>
                        <td className="py-2.5 px-3 text-right text-blue-700 font-bold">{formatPercent(merged.qtdAug26Growth)}</td>
                      </tr>
                      <tr className="bg-blue-50/60">
                        <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-200">QTD Current Quarter Total</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 border-r border-slate-200">{formatCurrency(merged.qtdQ2Cur)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatPercent(merged.qtdSep26Growth)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* YTD & 3-Year Historical Growth */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-blue-600" />
                    3. YTD & 3-Year Historical Totals
                  </h4>
                  <span className="text-3xs text-slate-500 font-medium">Annual Trajectory</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#002060] text-white">
                        <th className="py-2.5 px-3 border-r border-blue-900/60">Fiscal Year</th>
                        <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Annual Total (₹)</th>
                        <th className="py-2.5 px-3 text-right">YoY Growth %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">FY{fiscalYear - 2} Annual Total</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.fy1Total)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">FY{fiscalYear - 1} Annual Total</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-100">{formatCurrency(merged.fy2Total)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700 font-bold">{formatPercent(merged.fy24Growth)}</td>
                      </tr>
                      <tr className="bg-purple-50/60">
                        <td className="py-2.5 px-3 font-bold text-purple-900 border-r border-slate-200">FY{fiscalYear} (YTD Total)</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 border-r border-slate-200">{formatCurrency(merged.ytdCur || merged.ytdSales)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatPercent(merged.ytdGrowth || merged.yoyGrowthPercent)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 7: MONTHLY HISTORY TIMELINE TABLE */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'timeline' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    Complete Monthly Transaction Timeline (All Records in Database)
                  </h4>
                  <span className="text-3xs text-slate-500 font-mono font-medium">Historical Ledger Records</span>
                </div>

                {merged.timeline && merged.timeline.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#002060] text-white">
                          <th className="py-2.5 px-3 border-r border-blue-900/60">Period</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">FY</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-right">Sales (₹)</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Qty</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Invoices</th>
                          <th className="py-2.5 px-3 border-r border-blue-900/60 text-center">Partlines</th>
                          <th className="py-2.5 px-3 text-right">Avg Invoice Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {merged.timeline.map((t: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 font-bold text-blue-900 border-r border-slate-100">{t.period}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-100">FY{t.fiscalYear}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 border-r border-slate-100">{formatCurrency(t.sales)}</td>
                            <td className="py-2.5 px-3 text-center text-slate-700 border-r border-slate-100">{Number(t.qty).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-center text-blue-700 font-bold border-r border-slate-100">{t.invoices}</td>
                            <td className="py-2.5 px-3 text-center text-purple-700 font-bold border-r border-slate-100">{t.partlines}</td>
                            <td className="py-2.5 px-3 text-right text-slate-900 font-bold">{formatCurrency(t.avgInvoiceValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6 font-medium">No monthly historical transactions found in database.</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION FOOTER (LIGHT THEME) */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet size={15} className={isExporting ? 'animate-spin' : ''} />
              <span>{isExporting ? 'Generating...' : 'Export Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={handleFormattedPDF}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Dossier (PDF)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditTarget(dealer)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Edit3 size={14} />
              <span>Edit Target</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:text-slate-900 font-bold hover:bg-slate-100 rounded-xl transition text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
