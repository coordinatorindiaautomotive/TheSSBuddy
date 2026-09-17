import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export interface Customer360PDFData {
  partyCode: string;
  fiscalYear: number;
  month: string;
  targetGrowthPercent: number;
  profile: any;
  health: any;
  periodComparison: any;
  fourYearTrend: any;
  branchContribution: any;
  decliningParts: any[];
  basketStats: any;
  matrix: any;
  categories: any[];
  topParts: any[];
  recommendedActions: any[];
  growthExplanation: any;
  nextGrowthRoadmap: any[];
  riskAndSignals: any;
}

export function generateCustomer360PDF(data: Customer360PDFData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = margin;

  const profile = data.profile || {};
  const partyName = profile.partyName || data.partyCode;
  const health = data.health || { score: 75, status: 'STABLE' };
  const period = data.periodComparison || {};
  const basket = data.basketStats || {};
  const branch = data.branchContribution || {};

  // Color constants
  const NAVY = [0, 32, 96] as [number, number, number];
  const BLUE = [37, 99, 235] as [number, number, number];
  const SLATE = [100, 116, 139] as [number, number, number];
  const DARK_SLATE = [15, 23, 42] as [number, number, number];
  const GREEN = [22, 163, 74] as [number, number, number];
  const RED = [220, 38, 38] as [number, number, number];
  const AMBER = [217, 119, 6] as [number, number, number];
  const LIGHT_BG = [248, 250, 252] as [number, number, number];

  // ─── 1. TOP HEADER BANNER ───
  doc.setFillColor(0, 32, 96);
  doc.rect(margin, currentY, pageWidth - margin * 2, 2.5, 'F');
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(37, 99, 235);
  doc.text('TheSSBuddy • POWERED BY THESSSYSTEMS', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  const genDate = `As of: ${data.month} FY${data.fiscalYear} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
  doc.text(genDate, pageWidth - margin - doc.getTextWidth(genDate), currentY);
  currentY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK_SLATE);
  doc.text('CUSTOMER 360 — PARTY ONE-PAGER DOSSIER', margin, currentY);
  currentY += 6;

  // ─── 2. CUSTOMER IDENTITY & HEALTH BOX ───
  const boxHeight = 26;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 2, 2, 'FD');

  // Party Name & Codes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...DARK_SLATE);
  doc.text(partyName, margin + 4, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(`Code: ${profile.partyCode || data.partyCode}`, margin + 4, currentY + 11);

  if (profile.originalCode && profile.originalCode !== (profile.partyCode || data.partyCode)) {
    doc.setTextColor(...SLATE);
    doc.text(` | Orig: ${profile.originalCode}`, margin + 28, currentY + 11);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_SLATE);
  doc.text(` | Type: ${profile.partyType || 'RETAILER'}`, margin + 55, currentY + 11);

  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Branch: ${profile.branchName || profile.branchCode || 'HO'}  •  Customer Since: ${basket.firstPurchase || 'N/A'}  •  Last Purchase: ${basket.lastPurchase || 'N/A'}`,
    margin + 4,
    currentY + 16
  );

  doc.text(
    `Lifetime Sales: ${formatLakhs(basket.lifetimeSales)}  •  Active Months: ${basket.activeMonths || 0}  •  Unique Parts: ${basket.totalUniqueParts || 0}  •  Invoices: ${basket.totalInvoices || 0}`,
    margin + 4,
    currentY + 21
  );

  // Health Score & Branch Rank (Right aligned inside box)
  const rightColX = pageWidth - margin - 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('HEALTH INDEX', rightColX, currentY + 6);
  doc.text('BRANCH POSITION', rightColX + 26, currentY + 6);

  doc.setFontSize(13);
  doc.setTextColor(health.status === 'GROWING' ? 22 : health.status === 'STABLE' ? 37 : 217, health.status === 'GROWING' ? 163 : health.status === 'STABLE' ? 99 : 119, health.status === 'GROWING' ? 74 : health.status === 'STABLE' ? 235 : 6);
  doc.text(`${health.score || 75}/100`, rightColX, currentY + 12);

  doc.setFontSize(11);
  doc.setTextColor(...DARK_SLATE);
  doc.text(`Rank #${branch.branchRank || 1}`, rightColX + 26, currentY + 12);

  doc.setFontSize(7.5);
  doc.text(`● ${health.status || 'STABLE'}`, rightColX, currentY + 17);
  doc.text(`${branch.branchSharePercent || 0}% of Branch`, rightColX + 26, currentY + 17);

  currentY += boxHeight + 4;

  // Normalized KPIs
  const curYtd = period.ytd?.current ?? period.ytd?.curSales ?? data.matrix?.curYtdSales ?? 0;
  const lyYtd = period.ytd?.lySamePeriod ?? period.ytd?.lySales ?? data.matrix?.lyYtdSales ?? 0;
  const curQtd = period.qtd?.current ?? period.qtd?.curSales ?? 0;
  const curMqtd = period.mqtd?.current ?? period.mqtd?.curSales ?? 0;
  const curHtd = period.htd?.current ?? period.htd?.curSales ?? 0;
  const ytdGrowth = period.ytd?.growthPercent ?? 0;
  const dynamicTarget = Math.round(lyYtd * (1 + data.targetGrowthPercent / 100));
  const dynamicGap = dynamicTarget - curYtd;
  const dynamicAch = dynamicTarget > 0 ? (curYtd / dynamicTarget) * 100 : (curYtd > 0 ? 100 : 0);

  // ─── 3. PRIMARY 7 KEY KPI TILES TABLE ───
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [[
      'YTD SALES',
      'QTD SALES',
      'MQTD SALES',
      'HTD SALES',
      'YOY GROWTH',
      `TARGET ACH (@+${data.targetGrowthPercent}%)`,
      dynamicGap > 0 ? 'TARGET GAP' : 'TARGET SURPLUS',
    ]],
    body: [[
      `${formatLakhs(curYtd)}\n(${formatCurrency(curYtd)})`,
      `${formatLakhs(curQtd)}\n(${formatCurrency(curQtd)})`,
      `${formatLakhs(curMqtd)}\n(${formatCurrency(curMqtd)})`,
      `${formatLakhs(curHtd)}\n(${formatCurrency(curHtd)})`,
      `${formatGrowth(ytdGrowth)}\nvs LY Same Period`,
      `${dynamicAch.toFixed(1)}%\n(Tgt: ${formatLakhs(dynamicTarget)})`,
      `${formatLakhs(Math.abs(dynamicGap))}\n(${formatCurrency(Math.abs(dynamicGap))})`,
    ]],
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      textColor: DARK_SLATE,
      cellPadding: 2.5,
    },
    columnStyles: {
      4: { textColor: ytdGrowth >= 0 ? GREEN : RED },
      5: { textColor: BLUE },
      6: { textColor: dynamicGap > 0 ? AMBER : GREEN },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─── 4. EXACT PERIOD PERFORMANCE VS LAST YEAR TABLE ───
  const periodRows = [
    { label: `MTD (${data.month})`, key: 'mtd' },
    { label: 'MQTD (Aug-Sep)', key: 'mqtd' },
    { label: 'QTD (Jul-Sep)', key: 'qtd' },
    { label: 'HTD (Apr-Sep)', key: 'htd' },
    { label: 'YTD (Apr-Sep)', key: 'ytd', bold: true },
  ].map((r) => {
    const d = period[r.key] || {};
    const c = d.current ?? d.curSales ?? 0;
    const l = d.lySamePeriod ?? d.lySales ?? 0;
    const g = d.growthPercent ?? 0;
    const diff = d.diffAmount ?? (c - l);
    const tgt = Math.round(l * (1 + data.targetGrowthPercent / 100));
    const ach = tgt > 0 ? (c / tgt) * 100 : (c > 0 ? 100 : 0);
    return [
      r.label,
      formatCurrency(c),
      formatCurrency(l),
      formatGrowth(g),
      `${diff >= 0 ? '+' : ''}${formatCurrency(diff)}`,
      formatCurrency(tgt),
      `${ach.toFixed(1)}%`,
    ];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('PERIOD PERFORMANCE VS LAST YEAR (EXACT SAME-PERIOD COMPARISON)', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [[
      'Period',
      `FY${data.fiscalYear} (Current)`,
      `FY${data.fiscalYear - 1} (LY Same Period)`,
      'YoY Growth %',
      'Net Variance (₹)',
      `Target (@+${data.targetGrowthPercent}%)`,
      'Target Ach %',
    ]],
    body: periodRows,
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: DARK_SLATE,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: SLATE },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        if (hookData.row.index === 4) {
          hookData.cell.styles.fillColor = [239, 246, 255];
        }
        if (hookData.column.index === 3) {
          const val = hookData.cell.raw as string;
          hookData.cell.styles.textColor = val.startsWith('-') ? RED : GREEN;
        }
        if (hookData.column.index === 4) {
          const val = hookData.cell.raw as string;
          hookData.cell.styles.textColor = val.startsWith('-') ? RED : GREEN;
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─── 5. 4-YEAR TREND & CATEGORY BREAKDOWN (SIDE BY SIDE / COMPACT) ───
  const trendYears = (data.fourYearTrend?.years && Array.isArray(data.fourYearTrend.years) && data.fourYearTrend.years.length > 0)
    ? data.fourYearTrend.years
    : [
        { year: 'FY 2023', sales: data.fourYearTrend?.fy23 || 0, yoyGrowth: null },
        { year: 'FY 2024', sales: data.fourYearTrend?.fy24 || 0, yoyGrowth: data.fourYearTrend?.yoy24 },
        { year: 'FY 2025', sales: data.fourYearTrend?.fy25 || 0, yoyGrowth: data.fourYearTrend?.yoy25 },
        { year: 'FY 2026', sales: data.fourYearTrend?.fy26 || 0, yoyGrowth: data.fourYearTrend?.yoy26 },
      ];
  const cagr = data.fourYearTrend?.cagr4Year ?? data.fourYearTrend?.cagr ?? 0;

  const trendRows = trendYears.map((yr: any) => [
    yr.year,
    formatLakhs(yr.sales),
    formatCurrency(yr.sales),
    yr.yoyGrowth !== null && yr.yoyGrowth !== undefined ? formatGrowth(yr.yoyGrowth) : 'Base Year',
  ]);

  const catRows = (data.categories || []).map((c: any) => [
    `Category ${c.cat}`,
    formatCurrency(c.curMonthSales),
    formatCurrency(c.ytdSales || c.curYtdSales),
    formatLakhs(c.lifetimeSales),
    `${c.sharePercent || 0}%`,
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(`4-YEAR SALES HISTORY (4Y CAGR: ${cagr}%) & CATEGORY BREAKDOWN`, margin, currentY);
  currentY += 2;

  // 4-Year Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: pageWidth / 2 + 2 },
    theme: 'grid',
    head: [['Fiscal Year', 'Sales (Lakhs)', 'Turnover (₹)', 'YoY Growth %']],
    body: trendRows,
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: SLATE },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // Category Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: pageWidth / 2 + 2, right: margin },
    theme: 'grid',
    head: [['Category', 'Month (₹)', 'YTD Sales (₹)', 'Lifetime (L)', 'Share %']],
    body: catRows.length > 0 ? catRows : [['No categories', '-', '-', '-', '-']],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right', textColor: SLATE },
      4: { halign: 'right', fontStyle: 'bold', textColor: BLUE },
    },
  });

  currentY = Math.max((doc as any).lastAutoTable.finalY, currentY + 24) + 4;

  // ─── 6. 5-PILLAR TARGET GAP DECOMPOSITION TABLE ───
  const gapAmount = Math.max(0, dynamicGap);
  const lostPartVol = Math.min(gapAmount * 0.35, data.decliningParts.reduce((s: number, p: any) => s + (p.opportunityValue || 0), 0)) || Math.round(gapAmount * 0.30);
  const catExpansion = Math.round(gapAmount * 0.25);
  const fastMovers = Math.round(gapAmount * 0.20);
  const crossSell = Math.round(gapAmount * 0.15);
  const dormantRecovery = Math.max(0, gapAmount - (lostPartVol + catExpansion + fastMovers + crossSell));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(`TARGET ACHIEVEMENT ENGINE — 5-PILLAR GAP DECOMPOSITION (100% OF ${formatLakhs(gapAmount)} GAP)`, margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Strategic Pillar', 'Allocation %', 'Target Revenue (₹)', 'Turnover Lakhs', 'Field Action Strategy']],
    body: [
      ['1. Lost Part Volume Recovery', '30%', formatCurrency(lostPartVol), formatLakhs(lostPartVol), 'Pitch reorders for parts where units dropped vs previous year baseline'],
      ['2. Category Expansion', '25%', formatCurrency(catExpansion), formatLakhs(catExpansion), 'Introduce lagging categories representing <15% of customer basket'],
      ['3. Branch Fast-Movers Adoption', '20%', formatCurrency(fastMovers), formatLakhs(fastMovers), 'Sell hot branch top-sellers that customer has never ordered'],
      ['4. Cross-Sell Root Part Families', '15%', formatCurrency(crossSell), formatLakhs(crossSell), 'Pair complementary root part items with active product orders'],
      ['5. Dormant Part Reactivation', '10%', formatCurrency(dormantRecovery), formatLakhs(dormantRecovery), 'Reactivate core items bought in FY23-FY24 but silent this fiscal year'],
    ],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', fontStyle: 'bold', textColor: BLUE },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold', textColor: BLUE },
      4: { textColor: SLATE },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─── 7. PRODUCT DECLINE & LOST VOLUME PITCH TARGETS ───
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = margin;
  }

  const decliningRows = (data.decliningParts || []).slice(0, 10).map((p: any) => [
    p.partNum,
    p.rootPartNum || p.partNum,
    p.cat || 'M',
    p.lyQty,
    p.curQty,
    p.qtyGap,
    formatCurrency(p.lySales),
    formatCurrency(p.curSales),
    formatCurrency(p.opportunityValue),
    `Reorder ${Math.abs(p.qtyGap)} pcs`,
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('PRODUCT DECLINE & LOST VOLUME ANALYSIS (IMMEDIATE FIELD PITCH TARGETS)', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Part Number', 'Root Family', 'Cat', 'LY Qty', 'Cur Qty', 'Qty Gap', 'LY Sales (₹)', 'Cur Sales (₹)', 'Opportunity (₹)', 'Pitch Action']],
    body: decliningRows.length > 0 ? decliningRows : [['No significant declining parts detected.', '', '', '', '', '', '', '', '', '']],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: DARK_SLATE },
      1: { textColor: SLATE },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold', textColor: RED },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right', fontStyle: 'bold', textColor: AMBER },
      9: { fontStyle: 'bold', textColor: BLUE },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─── 8. TOP 5 RECOMMENDED ACTIONS ───
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = margin;
  }

  const actionRows = (data.recommendedActions || []).slice(0, 5).map((a: any, idx: number) => [
    `#${a.rank || idx + 1}`,
    a.title,
    a.reason,
    formatCurrency(a.potentialValue),
    a.priority || 'MEDIUM',
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('TOP 5 RECOMMENDED NEXT BEST ACTIONS (FIELD REP SALES PLAYBOOK)', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Rank', 'Playbook Action', 'Data-Backed Rationale', 'Opportunity (₹)', 'Priority']],
    body: actionRows.length > 0 ? actionRows : [['#1', 'Maintain regular catalog ordering rhythm', 'Account is performing on baseline', '₹0', 'LOW']],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { fontStyle: 'bold', textColor: DARK_SLATE },
      2: { textColor: SLATE },
      3: { halign: 'right', fontStyle: 'bold', textColor: GREEN },
      4: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const val = hookData.cell.raw as string;
        hookData.cell.styles.textColor = val === 'HIGH' ? RED : val === 'MEDIUM' ? AMBER : BLUE;
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─── 9. TOP PARTLINE CONTRIBUTORS ───
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = margin;
  }

  const cleanTopParts = (data.topParts || []).slice(0, 10).map((p: any, idx: number) => [
    idx + 1,
    p.partNum,
    p.rootPartNum || p.partNum,
    p.cat || 'M',
    Number(p.curQty ?? p.qty ?? p.totalQty ?? 0).toLocaleString('en-IN'),
    formatCurrency(p.curSales ?? p.sales ?? p.totalSales ?? 0),
    `${p.sharePercent ?? p.revenueShare ?? 0}%`,
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('TOP PARTLINE REVENUE CONTRIBUTORS (CATALOG VOLUME)', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['#', 'Part Number', 'Root Family', 'Cat', 'Qty', 'Turnover (₹)', 'Share %']],
    body: cleanTopParts.length > 0 ? cleanTopParts : [['-', 'No parts recorded', '', '', '', '', '']],
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { halign: 'center', textColor: SLATE },
      1: { fontStyle: 'bold', textColor: DARK_SLATE },
      2: { textColor: SLATE },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right', fontStyle: 'bold', textColor: BLUE },
    },
  });

  // ─── FOOTER ON ALL PAGES ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
    doc.text(
      'TheSSBuddy Enterprise Customer 360 Intelligence System • Powered by Thesssystems',
      margin,
      pageHeight - 5
    );
    doc.text(
      `Confidential • Page ${i} of ${pageCount}`,
      pageWidth - margin - 35,
      pageHeight - 5
    );
  }

  // Direct Download Trigger
  const cleanCode = (data.partyCode || 'DEALER').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Customer_360_${cleanCode}_${data.month}_FY${data.fiscalYear}.pdf`;
  doc.save(filename);
}
