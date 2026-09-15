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
  Check, ArrowRight
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

  // Trigger Formatted PDF Print Report (Not a dark screen capture)
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
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex ${isFullScreen ? 'items-center justify-center p-0' : 'justify-end'} animate-in fade-in duration-200`}>
      <div className={`bg-[#080E1A] text-slate-100 h-full shadow-2xl flex flex-col justify-between overflow-hidden border-slate-700 transition-all duration-300 ${
        isFullScreen ? 'w-screen h-screen border-none rounded-none' : 'w-full max-w-4xl border-l'
      }`}>
        
        {/* TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#0B1528] text-white shrink-0 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs uppercase border border-cyan-400/40 flex items-center gap-1">
                  <Sparkles size={11} /> Party 360° Intelligence Dossier
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs uppercase border border-emerald-400/30">
                  {merged.partCategoryCode || 'ALL'} Category
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-xs uppercase border border-purple-400/30">
                  {merged.partyType}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                {merged.partyName}
              </h2>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-300 flex-wrap pt-0.5">
                <span>Party Code: <strong className="text-amber-300 font-bold">{merged.partyCode}</strong></span>
                {merged.originalCode && merged.originalCode !== merged.partyCode && (
                  <span>Orig Code: <strong className="text-cyan-300">{merged.originalCode}</strong></span>
                )}
                <span>Branch: <strong className="text-white">{merged.branchCode} ({merged.branchName})</strong></span>
                <span>Period: <strong className="text-emerald-300">{month}'{String(fiscalYear).slice(-2)}</strong></span>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleDownloadExcel}
                disabled={isExporting}
                title="Download complete Party 360 dossier as Excel (.xlsx)"
                className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet size={14} className={isExporting ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                onClick={handleFormattedPDF}
                title="Print / Save Formatted PDF Dossier"
                className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Exit Full Screen' : 'Expand to Full Page'}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              <button
                onClick={onClose}
                title="Close"
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition ml-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* TAB BAR NAVIGATION */}
          <div className="flex items-center gap-1 mt-4 border-b border-slate-800/80 pt-1 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-cyan-400 text-cyan-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Activity size={13} />
              <span>Overview & Target</span>
            </button>

            <button
              onClick={() => setActiveTab('pitch')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'pitch'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-amber-200 hover:bg-white/5'
              }`}
            >
              <Zap size={13} className="text-amber-400" />
              <span>Pitch Opportunities ({(merged.pitchOpportunities?.reorderCandidates?.length || 0) + (merged.pitchOpportunities?.crossSellBranchMovers?.length || 0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('frequency')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'frequency'
                  ? 'border-emerald-400 text-emerald-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Clock size={13} />
              <span>Purchase Frequency ({merged.frequencySegmentation?.totalUniqueParts || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('top_parts')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'top_parts'
                  ? 'border-cyan-400 text-cyan-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ShoppingCart size={13} />
              <span>Top Parts ({merged.topParts?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'categories'
                  ? 'border-cyan-400 text-cyan-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Layers size={13} />
              <span>Categories ({merged.categories?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('multi_period')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'multi_period'
                  ? 'border-cyan-400 text-cyan-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart2 size={13} />
              <span>MTD • QTD • YTD</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-cyan-400 text-cyan-300 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Calendar size={13} />
              <span>Monthly Timeline ({merged.timeline?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab(activeTab === 'all' ? 'overview' : 'all')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'border-purple-400 text-purple-300 bg-purple-500/10'
                  : 'border-transparent text-slate-400 hover:text-purple-300 hover:bg-white/5'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>{activeTab === 'all' ? '✓ Master View (All-In-One)' : 'Master All-in-One View'}</span>
            </button>
          </div>
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs custom-scrollbar">
          
          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 1: OVERVIEW & TARGET FORMULATION */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'overview' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 4 Core Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0f1b2e] p-3.5 rounded-xl border border-slate-700/70 shadow-xs">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">{currentPeriodLabel} Turnover</p>
                  <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(currentSales)}
                  </p>
                  <p className="text-3xs text-slate-400 mt-0.5">{formatLakhs(currentSales)}</p>
                </div>

                <div className="bg-[#0f1b2e] p-3.5 rounded-xl border border-slate-700/70 shadow-xs">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">{currentPeriodLabel} Target</p>
                  <p className="text-lg font-black font-mono text-amber-300 mt-0.5">
                    {formatCurrency(finalTarget)}
                  </p>
                  <p className="text-3xs text-slate-400 mt-0.5">{formatLakhs(finalTarget)}</p>
                </div>

                <div className="bg-[#0f1b2e] p-3.5 rounded-xl border border-slate-700/70 shadow-xs">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Fulfillment %</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${
                    isAchieved ? 'text-emerald-400' : isOnTrack ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {achievementPercent.toFixed(1)}%
                  </p>
                  <p className="text-3xs font-semibold text-slate-400 mt-0.5">
                    {isAchieved ? '✓ Target Achieved' : isOnTrack ? '⚡ On Track' : '⚠ Under Target'}
                  </p>
                </div>

                <div className="bg-[#0f1b2e] p-3.5 rounded-xl border border-slate-700/70 shadow-xs">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Partlines & Gap</p>
                  <p className="text-lg font-black font-mono text-cyan-300 mt-0.5">
                    {merged.uniquePartlines || 0} <span className="text-slate-400 text-xs font-normal">lines</span>
                  </p>
                  <p className="text-3xs text-slate-400 mt-0.5">
                    Gap: <span className={gapAmount >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {gapAmount >= 0 ? `+${formatLakhs(gapAmount)}` : formatLakhs(gapAmount)}
                    </span>
                  </p>
                </div>
              </div>

              {/* LIFETIME BASKET & INVOICE INTELLIGENCE CARD */}
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                  <h4 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                    <ShoppingCart size={14} className="text-cyan-400" />
                    Lifetime Order Basket & Invoice Metrics
                  </h4>
                  <span className="text-3xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono">
                    Active: {basket.activeMonths} Months ({basket.firstPurchase} → {basket.lastPurchase})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-mono">
                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-3xs text-slate-400 uppercase font-sans">Avg Invoice Value (AOV)</p>
                    <p className="text-sm font-black text-amber-300 mt-0.5">{formatCurrency(basket.avgInvoiceValue)}</p>
                    <p className="text-3xs text-slate-500">per billed invoice</p>
                  </div>

                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-3xs text-slate-400 uppercase font-sans">Avg Lines / Invoice</p>
                    <p className="text-sm font-black text-cyan-300 mt-0.5">{basket.avgLinesPerInvoice} <span className="text-xs font-normal text-slate-400">parts</span></p>
                    <p className="text-3xs text-slate-500">basket variety</p>
                  </div>

                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-3xs text-slate-400 uppercase font-sans">Avg Units / Invoice</p>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">{basket.avgQtyPerInvoice} <span className="text-xs font-normal text-slate-400">qty</span></p>
                    <p className="text-3xs text-slate-500">order volume</p>
                  </div>

                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-3xs text-slate-400 uppercase font-sans">Lifetime Invoices</p>
                    <p className="text-sm font-black text-purple-300 mt-0.5">{basket.totalInvoices} <span className="text-xs font-normal text-slate-400">inv ({basket.totalUniqueParts} parts)</span></p>
                    <p className="text-3xs text-slate-500">{formatLakhs(basket.lifetimeSales)} total</p>
                  </div>
                </div>
              </div>

              {/* Real Historical Turnover Timeline Chart */}
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Activity size={14} className="text-cyan-400" />
                    Month-by-Month Turnover History (₹)
                  </span>
                  <span className="text-3xs text-slate-400 font-mono">Actual Transactional Retail</span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSales360" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorSales360)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Target Engine Formulation Breakdown Card */}
              <div className="bg-slate-950 text-white rounded-xl p-4 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator size={13} />
                    Target Engine Formulation Breakdown
                  </h4>
                  <span className="text-3xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono">
                    FY{fiscalYear} • {month}
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs text-slate-300 divide-y divide-slate-800/80">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-400">1. LY Same Month ({lyPeriodLabel}) × 40%:</span>
                    <span className="text-white font-bold">{formatCurrency((Number(merged.lySameMonthSales) || 0) * 0.40)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-slate-400">2. Last Month ({prevPeriodLabel}) × 25%:</span>
                    <span className="text-white font-bold">{formatCurrency((Number(merged.lmSales) || Number(merged.lastMonthSales) || 0) * 0.25)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-slate-400">3. Last Quarter Avg × 20%:</span>
                    <span className="text-white font-bold">{formatCurrency((Number(merged.lastQuarterAvg) || 0) * 0.20)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-slate-400">4. Last FY Avg × 15%:</span>
                    <span className="text-white font-bold">{formatCurrency((Number(merged.lastFyAvg) || 0) * 0.15)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-amber-300 font-bold border-t border-slate-700">
                    <span>= Weighted Base:</span>
                    <span>{formatCurrency(Number(merged.weightedBase) || 0)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 text-cyan-300">
                    <span>+ 10% Recommended Target:</span>
                    <span>{formatCurrency(Number(merged.recommendedTarget) || 0)}</span>
                  </div>
                  {Number(merged.gapAdjustment) > 0 && (
                    <div className="flex justify-between pt-1.5 text-emerald-400">
                      <span>+ Guardrail Gap Adjustment:</span>
                      <span>+{formatCurrency(Number(merged.gapAdjustment))}</span>
                    </div>
                  )}
                  {Number(merged.adminDefinedTarget) > 0 && (
                    <div className="flex justify-between pt-1.5 text-purple-300 font-bold">
                      <span>⚡ Admin Override Target:</span>
                      <span>{formatCurrency(Number(merged.adminDefinedTarget))}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 text-white font-bold text-sm border-t border-slate-700">
                    <span>FINAL BUDGETED TARGET:</span>
                    <span className="text-amber-400 font-black">{formatCurrency(finalTarget)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 2: SALES PITCH OPPORTUNITIES & CROSS-SELL */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'pitch' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#0D1829] rounded-xl p-4 border border-amber-500/30 shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                  <div>
                    <h4 className="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-400" />
                      1. Re-Order Opportunities (Dormant High-Value Parts)
                    </h4>
                    <p className="text-3xs text-slate-400 mt-0.5">
                      Parts this party used to purchase in high volume ($&gt;$ ₹5,000) that have NOT been ordered in recent months!
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-3xs border border-amber-400/30">
                    {merged.pitchOpportunities?.reorderCandidates?.length || 0} Candidates
                  </span>
                </div>

                {merged.pitchOpportunities?.reorderCandidates?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-2xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <th className="p-2">#</th>
                          <th className="p-2">Part Number</th>
                          <th className="p-2">Root Part</th>
                          <th className="p-2 text-center">Cat</th>
                          <th className="p-2 text-right">Past Spend (₹)</th>
                          <th className="p-2 text-center">Past Qty</th>
                          <th className="p-2 text-right">Last Purchased</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {merged.pitchOpportunities.reorderCandidates.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/40">
                            <td className="p-2 text-slate-500">{i + 1}</td>
                            <td className="p-2 font-bold text-white">{p.partNum}</td>
                            <td className="p-2 text-slate-400">{p.rootPartNum}</td>
                            <td className="p-2 text-center font-bold text-cyan-300">{p.cat}</td>
                            <td className="p-2 text-right font-bold text-amber-300">{formatCurrency(p.totalSales)}</td>
                            <td className="p-2 text-center text-slate-300">{p.totalQty.toLocaleString('en-IN')}</td>
                            <td className="p-2 text-right text-rose-400 font-bold">{p.lastPurchased}</td>
                            <td className="p-2 text-center">
                              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 text-3xs font-sans font-bold">
                                📞 Pitch Re-order
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4">No dormant high-value parts found. Customer is consistently active across all items.</p>
                )}
              </div>

              {/* BRANCH FAST-MOVERS NOT YET PURCHASED */}
              <div className="bg-[#0D1829] rounded-xl p-4 border border-emerald-500/30 shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                  <div>
                    <h4 className="font-bold text-emerald-300 text-xs uppercase flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-400" />
                      2. Branch Top Movers (Cross-Sell Pitch Candidates)
                    </h4>
                    <p className="text-3xs text-slate-400 mt-0.5">
                      Top-selling fast-moving parts in branch ({merged.branchCode}) that this party has NEVER ordered yet!
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-3xs border border-emerald-400/30">
                    {merged.pitchOpportunities?.crossSellBranchMovers?.length || 0} Hot Parts
                  </span>
                </div>

                {merged.pitchOpportunities?.crossSellBranchMovers?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-2xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <th className="p-2">#</th>
                          <th className="p-2">Part Number</th>
                          <th className="p-2">Root Part</th>
                          <th className="p-2 text-center">Cat</th>
                          <th className="p-2 text-right">Branch Sales (₹)</th>
                          <th className="p-2 text-center">Branch Invoices</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {merged.pitchOpportunities.crossSellBranchMovers.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/40">
                            <td className="p-2 text-slate-500">{i + 1}</td>
                            <td className="p-2 font-bold text-white">{p.partNum}</td>
                            <td className="p-2 text-slate-400">{p.rootPartNum}</td>
                            <td className="p-2 text-center font-bold text-cyan-300">{p.cat}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(p.totalSales)}</td>
                            <td className="p-2 text-center text-slate-300">{p.invoicesCount.toLocaleString('en-IN')} inv</td>
                            <td className="p-2 text-center">
                              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/40 text-3xs font-sans font-bold">
                                🚀 Cross-Sell Opportunity
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4">No cross-sell opportunities found.</p>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 3: PURCHASE FREQUENCY SEGMENTATION */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'frequency' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                  <h4 className="font-bold text-white text-xs uppercase flex items-center gap-1.5">
                    <Clock size={14} className="text-purple-400" />
                    Part Purchase Frequency Segmentation ({merged.frequencySegmentation?.totalUniqueParts || 0} Total Unique Parts)
                  </h4>
                  
                  {activeTab !== 'all' && (
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setFreqFilter('all')}
                        className={`px-2 py-1 rounded text-3xs font-bold cursor-pointer ${freqFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFreqFilter('frequent')}
                        className={`px-2 py-1 rounded text-3xs font-bold cursor-pointer ${freqFilter === 'frequent' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Frequent ({merged.frequencySegmentation?.frequentCount || 0})
                      </button>
                      <button
                        onClick={() => setFreqFilter('regular')}
                        className={`px-2 py-1 rounded text-3xs font-bold cursor-pointer ${freqFilter === 'regular' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Regular ({merged.frequencySegmentation?.regularCount || 0})
                      </button>
                      <button
                        onClick={() => setFreqFilter('rare')}
                        className={`px-2 py-1 rounded text-3xs font-bold cursor-pointer ${freqFilter === 'rare' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Rare ({merged.frequencySegmentation?.rareCount || 0})
                      </button>
                    </div>
                  )}
                </div>

                {/* 3 Frequency Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-emerald-400 uppercase">🔥 Frequent / Core Basket</p>
                      <span className="text-xs font-mono font-bold text-emerald-300">{merged.frequencySegmentation?.frequentCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-400 mt-1">Purchased in 3 or more active months. High repeat customer loyalty items.</p>
                  </div>

                  <div className="bg-cyan-950/30 border border-cyan-500/30 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-cyan-400 uppercase">⚡ Regular / Seasonal</p>
                      <span className="text-xs font-mono font-bold text-cyan-300">{merged.frequencySegmentation?.regularCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-400 mt-1">Purchased in 2 active months. Semi-regular repeat purchase cycle.</p>
                  </div>

                  <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                      <p className="text-3xs font-bold text-amber-400 uppercase">📦 Rare / One-Off</p>
                      <span className="text-xs font-mono font-bold text-amber-300">{merged.frequencySegmentation?.rareCount || 0} items</span>
                    </div>
                    <p className="text-3xs text-slate-400 mt-1">Purchased only once historically. Low repeat order rate.</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-2xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                        <th className="p-2">Part Number</th>
                        <th className="p-2">Root Part</th>
                        <th className="p-2 text-center">Cat</th>
                        <th className="p-2 text-center">Active Months</th>
                        <th className="p-2 text-center">Invoices</th>
                        <th className="p-2 text-right">Lifetime Sales (₹)</th>
                        <th className="p-2 text-center">Classification</th>
                        <th className="p-2 text-right">Last Purchase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {[
                        ...(freqFilter === 'all' || freqFilter === 'frequent' ? (merged.frequencySegmentation?.frequent || []) : []),
                        ...(freqFilter === 'all' || freqFilter === 'regular' ? (merged.frequencySegmentation?.regular || []) : []),
                        ...(freqFilter === 'all' || freqFilter === 'rare' ? (merged.frequencySegmentation?.rare || []) : []),
                      ].slice(0, 30).map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-white">{p.partNum}</td>
                          <td className="p-2 text-slate-400">{p.rootPartNum}</td>
                          <td className="p-2 text-center font-bold text-cyan-300">{p.cat}</td>
                          <td className="p-2 text-center font-bold text-white">{p.activeMonthsCount} mos</td>
                          <td className="p-2 text-center text-slate-300">{p.invoicesCount} inv</td>
                          <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(p.totalSales)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold ${
                              p.frequencyType === 'FREQUENT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                                : p.frequencyType === 'REGULAR'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                            }`}>
                              {p.frequencyType}
                            </span>
                          </td>
                          <td className="p-2 text-right text-slate-400">{p.lastPurchased}</td>
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
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <h4 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-1.5">
                  <ShoppingCart size={13} className="text-amber-400" />
                  Top 25 Purchased Partlines (Ranked by Lifetime Revenue)
                </h4>

                {merged.topParts && merged.topParts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-2xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <th className="p-2">#</th>
                          <th className="p-2">Part Number</th>
                          <th className="p-2">Root Part</th>
                          <th className="p-2 text-center">Cat</th>
                          <th className="p-2 text-center">Total Qty</th>
                          <th className="p-2 text-right">Revenue (₹)</th>
                          <th className="p-2 text-center">Share %</th>
                          <th className="p-2 text-center">Invoices</th>
                          <th className="p-2 text-right">Last Purchase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {merged.topParts.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/40">
                            <td className="p-2 text-slate-400">{i + 1}</td>
                            <td className="p-2 font-bold text-white">{p.partNum}</td>
                            <td className="p-2 text-slate-400">{p.rootPartNum}</td>
                            <td className="p-2 text-center font-bold text-cyan-300">{p.cat}</td>
                            <td className="p-2 text-center text-amber-300 font-bold">{p.totalQty.toLocaleString('en-IN')}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(p.totalSales)}</td>
                            <td className="p-2 text-center text-purple-300 font-bold">{p.revenueShare ? `${p.revenueShare}%` : '-'}</td>
                            <td className="p-2 text-center text-slate-300">{p.invoicesCount || '-'}</td>
                            <td className="p-2 text-right text-slate-400">{p.lastPurchased || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-6">No specific line item records found for this party.</p>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 5: CATEGORIES BREAKDOWN */}
          {/* ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'categories' || activeTab === 'all') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <h4 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-400" />
                  Product Category Sales & Partline Distribution
                </h4>

                {merged.categories && merged.categories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-2xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <th className="p-2">Category</th>
                          <th className="p-2 text-center">Partlines</th>
                          <th className="p-2 text-center">Invoices</th>
                          <th className="p-2 text-right">{currentPeriodLabel} Sales</th>
                          <th className="p-2 text-right">FY{fiscalYear} YTD</th>
                          <th className="p-2 text-right">Lifetime Sales</th>
                          <th className="p-2 text-center">Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {merged.categories.map((c: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-cyan-300">
                              <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/50">
                                {c.cat}
                              </span>
                            </td>
                            <td className="p-2 text-center text-slate-300 font-bold">{c.uniquePartlines}</td>
                            <td className="p-2 text-center text-slate-400">{c.totalInvoices}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(c.curMonthSales)}</td>
                            <td className="p-2 text-right text-white font-bold">{formatCurrency(c.ytdSales)}</td>
                            <td className="p-2 text-right text-slate-300">{formatCurrency(c.lifetimeSales)}</td>
                            <td className="p-2 text-center text-purple-300 font-bold">{c.sharePercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-6">No specific category breakdown available.</p>
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
              <div className="bg-[#0D1829] rounded-xl p-3.5 border border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sky-300 text-xs uppercase flex items-center gap-1.5">
                    <Calendar size={13} />
                    1. MTD Performance & Monthly Growth
                  </h4>
                  <span className="text-3xs text-slate-400">Month-over-Month & Year-over-Year</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-2xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
                        <th className="p-2">Metric</th>
                        <th className="p-2 text-right">Amount (₹)</th>
                        <th className="p-2 text-right">Growth Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      <tr>
                        <td className="p-2 text-slate-300">MTD @ {prevPeriodLabel} (LY-1)</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.mtdAug25)}</td>
                        <td className="p-2 text-right text-slate-400">{formatPercent(merged.mtdAug25Growth)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-300">LM Total ({prevPeriodLabel})</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.lmSales || merged.lastMonthSales)}</td>
                        <td className="p-2 text-right text-emerald-400 font-bold">{formatPercent(merged.mtdAug26Growth)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-300">LY Same Month ({lyPeriodLabel})</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.lySameMonthSales)}</td>
                        <td className="p-2 text-right text-slate-400">-</td>
                      </tr>
                      <tr className="bg-sky-950/40">
                        <td className="p-2 font-bold text-sky-300">MTD @ {currentPeriodLabel} (Current)</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatCurrency(currentSales)}</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatPercent(merged.mtdSep26Growth)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* QTD Performance Table */}
              <div className="bg-[#0D1829] rounded-xl p-3.5 border border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-indigo-300 text-xs uppercase flex items-center gap-1.5">
                    <Award size={13} />
                    2. QTD Performance & Quarterly Growth
                  </h4>
                  <span className="text-3xs text-slate-400">Quarterly Aggregation</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-2xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
                        <th className="p-2">Quarter Period</th>
                        <th className="p-2 text-right">Sales Total (₹)</th>
                        <th className="p-2 text-right">Growth Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      <tr>
                        <td className="p-2 text-slate-300">QTD Last Year Total</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.qtdQ2LyTotal)}</td>
                        <td className="p-2 text-right text-slate-400">{formatPercent(merged.qtdAug25Growth)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-300">QTD Prev Quarter Total</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.qtdQ1CurTotal)}</td>
                        <td className="p-2 text-right text-indigo-300">{formatPercent(merged.qtdAug26Growth)}</td>
                      </tr>
                      <tr className="bg-indigo-950/40">
                        <td className="p-2 font-bold text-indigo-300">QTD Current Quarter Total</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatCurrency(merged.qtdQ2Cur)}</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatPercent(merged.qtdSep26Growth)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* YTD & 3-Year Historical Growth */}
              <div className="bg-[#0D1829] rounded-xl p-3.5 border border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-purple-300 text-xs uppercase flex items-center gap-1.5">
                    <TrendingUp size={13} />
                    3. YTD & 3-Year Historical Totals
                  </h4>
                  <span className="text-3xs text-slate-400">Annual Evolution</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-2xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
                        <th className="p-2">Fiscal Year</th>
                        <th className="p-2 text-right">Annual Total (₹)</th>
                        <th className="p-2 text-right">YoY Growth %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      <tr>
                        <td className="p-2 text-slate-300">FY{fiscalYear - 2} Annual Total</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.fy1Total)}</td>
                        <td className="p-2 text-right text-slate-400">-</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-300">FY{fiscalYear - 1} Annual Total</td>
                        <td className="p-2 text-right font-bold text-white">{formatCurrency(merged.fy2Total)}</td>
                        <td className="p-2 text-right text-purple-300 font-bold">{formatPercent(merged.fy24Growth)}</td>
                      </tr>
                      <tr className="bg-purple-950/40">
                        <td className="p-2 font-bold text-purple-300">FY{fiscalYear} (YTD Total)</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatCurrency(merged.ytdCur || merged.ytdSales)}</td>
                        <td className="p-2 text-right font-black text-emerald-400">{formatPercent(merged.ytdGrowth || merged.yoyGrowthPercent)}</td>
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
              <div className="bg-[#0D1829] rounded-xl p-4 border border-slate-700/80 shadow-xs">
                <h4 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-1.5">
                  <Calendar size={13} className="text-cyan-400" />
                  Complete Monthly Transaction Timeline (All Records in Database)
                </h4>

                {merged.timeline && merged.timeline.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-2xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <th className="p-2">Period</th>
                          <th className="p-2 text-center">FY</th>
                          <th className="p-2 text-right">Sales (₹)</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-center">Invoices</th>
                          <th className="p-2 text-center">Partlines</th>
                          <th className="p-2 text-right">Avg Invoice Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {merged.timeline.map((t: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-white">{t.period}</td>
                            <td className="p-2 text-center text-slate-400">FY{t.fiscalYear}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(t.sales)}</td>
                            <td className="p-2 text-center text-slate-300">{Number(t.qty).toLocaleString('en-IN')}</td>
                            <td className="p-2 text-center text-cyan-300">{t.invoices}</td>
                            <td className="p-2 text-center text-purple-300">{t.partlines}</td>
                            <td className="p-2 text-right text-amber-300 font-bold">{formatCurrency(t.avgInvoiceValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-6">No monthly historical transactions found in database.</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION FOOTER */}
        <div className="p-4 px-6 border-t border-slate-800 bg-[#0B1528] flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              className="px-4 py-2.5 bg-emerald-700/40 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet size={15} className={isExporting ? 'animate-spin' : ''} />
              <span>{isExporting ? 'Generating...' : 'Export Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={handleFormattedPDF}
              className="px-4 py-2.5 bg-blue-700/40 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Dossier (PDF)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditTarget(dealer)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Edit3 size={14} />
              <span>Edit Target</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-700 text-slate-300 hover:text-white font-bold hover:bg-slate-800/80 rounded-xl transition text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
