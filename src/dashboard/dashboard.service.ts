// src/dashboard/dashboard.service.ts
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly cacheService: CacheService,
  ) {}

  private getSecureBranchFilter(branchCode?: string) {
    const where: any = {};
    this.branchIsolation.mergeBranchFilter(where, 'branchCode', branchCode);
    return where;
  }

  async getSummaryKPIs(year: number, month: number, branchCode?: string) {
    const cacheKey = `dashboard:kpis:${branchCode || 'ALL'}:${year}:${month}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const whereBranch = this.getSecureBranchFilter(branchCode);

    const [totalIncentive, totalSales, totalOutstanding, totalCashIn, pendingApprovals] = await Promise.all([
      this.prisma.incentiveRecord.aggregate({
        where: { ...whereBranch, year, month },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.dealerMonthlyPerformance.aggregate({
        where: { ...whereBranch, year, month },
        _sum: { salesAmount: true },
      }),
      this.prisma.dealerMonthlyPerformance.aggregate({
        where: { ...whereBranch, year, month },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: { ...whereBranch, transactionType: 'CASH_IN' },
        _sum: { amount: true },
      }),
      this.prisma.workflowInstance.count({
        where: { status: 'IN_PROGRESS' },
      }),
    ]);

    const result = {
      year,
      month,
      branchCode: branchCode || 'ALL',
      totalIncentiveAmount: Number(totalIncentive._sum.netAmount || 0),
      totalIncentiveRecords: totalIncentive._count,
      totalSalesAmount: Number(totalSales._sum.salesAmount || 0),
      totalOutstandingAmount: Number(totalOutstanding._sum.outstandingAmount || 0),
      totalCashInAmount: Number(totalCashIn._sum.amount || 0),
      pendingApprovalCount: pendingApprovals,
    };

    const tags = CacheService.buildBranchPeriodTags(branchCode || null, year, month);
    await this.cacheService.set(cacheKey, result, 300, tags);

    return result;
  }

  async getTrendCharts(year: number, branchCode?: string) {
    const whereBranch = this.getSecureBranchFilter(branchCode);

    const monthlyTrends = await this.prisma.dealerMonthlyPerformance.groupBy({
      by: ['month'],
      where: { ...whereBranch, year },
      _sum: { salesAmount: true, netAmount: true, outstandingAmount: true },
      orderBy: { month: 'asc' },
    });

    return monthlyTrends.map((t) => ({
      month: t.month,
      salesAmount: Number(t._sum.salesAmount || 0),
      netAmount: Number(t._sum.netAmount || 0),
      outstandingAmount: Number(t._sum.outstandingAmount || 0),
    }));
  }

  async getCategorySalesMix(year: number, month: number, branchCode?: string) {
    const whereBranch = this.getSecureBranchFilter(branchCode);

    const mix = await this.prisma.dealerMonthlyPerformance.groupBy({
      by: ['partCategoryCode'],
      where: { ...whereBranch, year, month },
      _sum: { salesAmount: true },
    });

    return mix.map((m) => ({
      partCategoryCode: m.partCategoryCode || 'UNSPECIFIED',
      salesAmount: Number(m._sum.salesAmount || 0),
    }));
  }

  async getAlerts(branchCode?: string) {
    const whereBranch = this.getSecureBranchFilter(branchCode);

    const overdueParties = await this.prisma.dealerMonthlyPerformance.findMany({
      where: { ...whereBranch, outstandingAmount: { gt: 100000 } },
      include: { party: { select: { code: true, name: true } } },
      take: 10,
      orderBy: { outstandingAmount: 'desc' },
    });

    const dormantParties = await this.prisma.party.findMany({
      where: { subType: 'DORMANT' },
      take: 10,
    });

    return {
      overdueOutstandingAlerts: overdueParties.map((p) => ({
        partyCode: p.party.code,
        partyName: p.party.name,
        outstandingAmount: Number(p.outstandingAmount),
      })),
      dormantPartyAlerts: dormantParties.map((dp) => ({
        partyCode: dp.code,
        partyName: dp.name,
      })),
    };
  }

  async precomputeAggregates() {
    this.logger.log('Starting background pre-computation of dashboard aggregates...');
    return { ok: true };
  }

  /**
   * Analytics pulled directly from raw_sales — fast SQL aggregates.
   * Powers the new rich dashboard view.
   */
  async getRawSalesAnalytics(config: {
    fiscalYear?: number;
    month?: string;
    loc?: string;
    partyType?: string;
    partCategory?: string;
    consignee?: string;
    dealerSubType?: string;
  }) {
    const { fiscalYear, month, loc, partyType, partCategory, consignee, dealerSubType } = config;
    const selectedYear = fiscalYear || 2026;
    const selectedMonth = month || 'Jul';

    const fiscalMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthIndex = fiscalMonths.indexOf(selectedMonth);
    const ytdMonths = monthIndex >= 0 ? fiscalMonths.slice(0, monthIndex + 1) : ['Apr', 'May', 'Jun', 'Jul'];
    const ytdMonthsList = ytdMonths.map(m => `'${m}'`).join(', ');

    // Get max date dynamically for the selected year to compute correct boundary
    const maxDateResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT MAX(
        CASE 
          WHEN r.month_year ~ '^[0-9]{4}-[0-9]{2}$' THEN TO_DATE(r.month_year || '-' || LPAD(r.day::text, 2, '0'), 'YYYY-MM-DD')
          WHEN r.month_year ~ '^[A-Za-z]{3} [0-9]{4}$' THEN TO_DATE(LPAD(r.day::text, 2, '0') || ' ' || r.month_year, 'DD Mon YYYY')
          ELSE NULL
        END
      ) AS max_date
      FROM raw_sales r
      WHERE r.fiscal_year = ${selectedYear}
        AND r.day ~ '^[0-9]+$'
    `).catch(() => []);
    const maxDateVal = maxDateResult[0]?.max_date ? new Date(maxDateResult[0].max_date) : null;
    
    let maxMonth = 'Mar';
    let maxDay = 31;
    if (maxDateVal) {
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      maxMonth = monthsShort[maxDateVal.getMonth()];
      maxDay = maxDateVal.getDate();
    }

    const ytdConditions = ytdMonths.map(m => {
      if (m === maxMonth) {
        return `(r.month = '${m}' AND r.day <= ${maxDay})`;
      }
      return `r.month = '${m}'`;
    });
    const ytdSqlCondition = `(${ytdConditions.join(' OR ')})`;

    const getQtdMonths = (m: string): string[] => {
      const q1 = ['Apr', 'May', 'Jun'];
      const q2 = ['Jul', 'Aug', 'Sep'];
      const q3 = ['Oct', 'Nov', 'Dec'];
      const q4 = ['Jan', 'Feb', 'Mar'];
      if (q1.includes(m)) return q1.slice(0, q1.indexOf(m) + 1);
      if (q2.includes(m)) return q2.slice(0, q2.indexOf(m) + 1);
      if (q3.includes(m)) return q3.slice(0, q3.indexOf(m) + 1);
      if (q4.includes(m)) return q4.slice(0, q4.indexOf(m) + 1);
      return [];
    };
    const qtdMonths = getQtdMonths(selectedMonth);
    const qtdMonthsList = qtdMonths.map(m => `'${m}'`).join(', ');
    const qtdConditions = qtdMonths.map(m => {
      if (m === maxMonth) {
        return `(r.month = '${m}' AND r.day <= ${maxDay})`;
      }
      return `r.month = '${m}'`;
    });
    const qtdSqlCondition = qtdConditions.length > 0 ? `(${qtdConditions.join(' OR ')})` : '1=1';

    const yearFilter = fiscalYear ? `AND r.fiscal_year = ${fiscalYear}` : '';
    
    // Dynamic WHERE builders (supporting comma-separated multi-select values)
    const filters: string[] = [];

    // Enforce branch isolation for raw_sales analytics
    const locFilter = this.branchIsolation.getBranchFilter('loc');
    if (locFilter && (locFilter as any).loc) {
      const allowed = (locFilter as any).loc.in as string[];
      if (loc && loc.trim()) {
        const requested = loc.split(',').map(x => x.trim());
        const valid = requested.filter(x => allowed.includes(x));
        if (valid.length === 0) {
          const list = allowed.map(x => `'${x.replace(/'/g, "''")}'`).join(', ');
          filters.push(`r.loc IN (${list})`);
        } else {
          const list = valid.map(x => `'${x.replace(/'/g, "''")}'`).join(', ');
          filters.push(`r.loc IN (${list})`);
        }
      } else {
        const list = allowed.map(x => `'${x.replace(/'/g, "''")}'`).join(', ');
        filters.push(`r.loc IN (${list})`);
      }
    } else {
      if (loc && loc.trim()) {
        const list = loc.split(',').map(x => `'${x.trim().replace(/'/g, "''")}'`).join(', ');
        filters.push(`r.loc IN (${list})`);
      }
    }
    if (partyType && partyType.trim()) {
      const list = partyType.split(',').map(x => `'${x.trim().replace(/'/g, "''")}'`).join(', ');
      filters.push(`r.party_type IN (${list})`);
    }
    if (partCategory && partCategory.trim()) {
      const list = partCategory.split(',').map(x => `'${x.trim().replace(/'/g, "''")}'`).join(', ');
      filters.push(`r.part_category_code IN (${list})`);
    }
    if (consignee && consignee.trim()) {
      const list = consignee.split(',').map(x => `'${x.trim().replace(/'/g, "''")}'`).join(', ');
      filters.push(`r.consignee IN (${list})`);
    }
    if (dealerSubType && dealerSubType.trim()) {
      const list = dealerSubType.split(',').map(x => `'${x.trim().replace(/'/g, "''")}'::"PartySubType"`).join(', ');
      filters.push(`p.sub_type IN (${list})`);
    }
    const whereClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

    const [
      kpiRows,
      monthlyRows,
      branchRows,
      partyTypeRows,
      consigneeRows,
      quarterRows,
      distinctPartyTypes,
      distinctPartCategories,
      distinctConsignees,
      distinctLocations,
      partCategoryRows,
    ] = await Promise.all([
      // KPI totals (YTD, MTD, QTD, Parties, Parts with LYTD comparison)
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS lytd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS lymtd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month IN (${qtdMonthsList}) THEN r.net_retail_selling ELSE 0 END) AS qtd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month IN (${qtdMonthsList}) THEN r.net_retail_selling ELSE 0 END) AS lyqtd_sales,
          COUNT(DISTINCT CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.cons_party_code ELSE NULL END) AS ytd_parties,
          COUNT(DISTINCT CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.cons_party_code ELSE NULL END) AS lytd_parties,
          COUNT(DISTINCT CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.part_num ELSE NULL END) AS ytd_parts,
          COUNT(DISTINCT CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.part_num ELSE NULL END) AS lytd_parts
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 ${whereClause}
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          r.month,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} THEN r.net_retail_selling ELSE 0 END) AS current_year_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} THEN r.net_retail_selling ELSE 0 END) AS last_year_sales
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 AND r.fiscal_year IN (${selectedYear}, ${selectedYear - 1}) ${whereClause}
        GROUP BY r.month
        ORDER BY 
          CASE r.month
            WHEN 'Apr' THEN 1 WHEN 'May' THEN 2 WHEN 'Jun' THEN 3 WHEN 'Jul' THEN 4
            WHEN 'Aug' THEN 5 WHEN 'Sep' THEN 6 WHEN 'Oct' THEN 7 WHEN 'Nov' THEN 8
            WHEN 'Dec' THEN 9 WHEN 'Jan' THEN 10 WHEN 'Feb' THEN 11 WHEN 'Mar' THEN 12
            ELSE 13
          END
      `),
      // Branch / location performance
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          r.loc,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS lmtd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS lytd_sales
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 ${whereClause}
        GROUP BY r.loc
        ORDER BY ytd_sales DESC
      `),
      // Party type contribution (comparison across YTD, MTD, QTD)
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          r.party_type,
          -- YTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_last,
          -- MTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_last,
          -- QTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_last
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 AND r.fiscal_year IN (${selectedYear}, ${selectedYear - 1}) ${whereClause}
        GROUP BY r.party_type
        ORDER BY ytd_current DESC
      `),
      // Consignee contribution (top 8 comparison across YTD, MTD, QTD)
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          r.consignee,
          -- YTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_last,
          -- MTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_last,
          -- QTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_last
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 AND r.fiscal_year IN (${selectedYear}, ${selectedYear - 1}) ${whereClause}
        GROUP BY r.consignee
        ORDER BY ytd_current DESC
        LIMIT 8
      `),
      // Quarterly summary (CY, LY comparison)
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          CASE
            WHEN r.month IN ('Apr','May','Jun') THEN 'Q1'
            WHEN r.month IN ('Jul','Aug','Sep') THEN 'Q2'
            WHEN r.month IN ('Oct','Nov','Dec') THEN 'Q3'
            ELSE 'Q4'
          END AS quarter,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} THEN r.net_retail_selling ELSE 0 END) AS current_year_sales,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} THEN r.net_retail_selling ELSE 0 END) AS last_year_sales
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 AND r.fiscal_year IN (${selectedYear}, ${selectedYear - 1}) ${whereClause}
        GROUP BY quarter
        ORDER BY quarter
      `),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT party_type FROM raw_sales WHERE party_type IS NOT NULL AND party_type != '' ORDER BY party_type`),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT part_category_code FROM raw_sales WHERE part_category_code IS NOT NULL AND part_category_code != '' ORDER BY part_category_code`),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT consignee FROM raw_sales WHERE consignee IS NOT NULL AND consignee != '' ORDER BY consignee`),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT loc FROM raw_sales WHERE loc IS NOT NULL AND loc != '' ORDER BY loc`),
      // Part Category Mix comparison across YTD, MTD, QTD
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          r.part_category_code,
          -- YTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${ytdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS ytd_last,
          -- MTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND r.month = '${selectedMonth}' THEN r.net_retail_selling ELSE 0 END) AS mtd_last,
          -- QTD
          SUM(CASE WHEN r.fiscal_year = ${selectedYear} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_current,
          SUM(CASE WHEN r.fiscal_year = ${selectedYear - 1} AND ${qtdSqlCondition} THEN r.net_retail_selling ELSE 0 END) AS qtd_last
        FROM raw_sales r
        LEFT JOIN parties p ON r.consignee = p.code
        WHERE 1=1 AND r.fiscal_year IN (${selectedYear}, ${selectedYear - 1}) ${whereClause}
        GROUP BY r.part_category_code
        ORDER BY ytd_current DESC
      `),
    ]);

    const kpi = kpiRows[0] || {};
    return {
      kpis: {
        ytdSales:       Number(kpi.ytd_sales || 0),
        lytdSales:      Number(kpi.lytd_sales || 0),
        ytdGrowth:      Number(kpi.lytd_sales || 0) > 0 ? ((Number(kpi.ytd_sales || 0) - Number(kpi.lytd_sales || 0)) / Number(kpi.lytd_sales || 0)) * 100 : (Number(kpi.ytd_sales || 0) > 0 ? 100 : 0),
        
        mtdSales:       Number(kpi.mtd_sales || 0),
        lymtdSales:     Number(kpi.lymtd_sales || 0),
        mtdGrowth:      Number(kpi.lymtd_sales || 0) > 0 ? ((Number(kpi.mtd_sales || 0) - Number(kpi.lymtd_sales || 0)) / Number(kpi.lymtd_sales || 0)) * 100 : (Number(kpi.mtd_sales || 0) > 0 ? 100 : 0),
        
        qtdSales:       Number(kpi.qtd_sales || 0),
        lyqtdSales:     Number(kpi.lyqtd_sales || 0),
        qtdGrowth:      Number(kpi.lyqtd_sales || 0) > 0 ? ((Number(kpi.qtd_sales || 0) - Number(kpi.lyqtd_sales || 0)) / Number(kpi.lyqtd_sales || 0)) * 100 : (Number(kpi.qtd_sales || 0) > 0 ? 100 : 0),
        
        ytdParties:     Number(kpi.ytd_parties || 0),
        lytdParties:    Number(kpi.lytd_parties || 0),
        partiesGrowth:  Number(kpi.lytd_parties || 0) > 0 ? ((Number(kpi.ytd_parties || 0) - Number(kpi.lytd_parties || 0)) / Number(kpi.lytd_parties || 0)) * 100 : (Number(kpi.ytd_parties || 0) > 0 ? 100 : 0),
        
        ytdParts:       Number(kpi.ytd_parts || 0),
        lytdParts:      Number(kpi.lytd_parts || 0),
        partsGrowth:    Number(kpi.lytd_parts || 0) > 0 ? ((Number(kpi.ytd_parts || 0) - Number(kpi.lytd_parts || 0)) / Number(kpi.lytd_parts || 0)) * 100 : (Number(kpi.ytd_parts || 0) > 0 ? 100 : 0),
      },
      monthlyTrend: monthlyRows.map(r => {
        const currentYearSales = Number(r.current_year_sales || 0);
        const lastYearSales = Number(r.last_year_sales || 0);
        const growth = lastYearSales > 0 ? ((currentYearSales - lastYearSales) / lastYearSales) * 100 : (currentYearSales > 0 ? 100 : 0);
        return {
          month: r.month,
          currentYearSales,
          lastYearSales,
          growth,
        };
      }),
      branchPerformance: branchRows.map(r => {
        const mtdSales = Number(r.mtd_sales || 0);
        const lmtdSales = Number(r.lmtd_sales || 0);
        const ytdSales = Number(r.ytd_sales || 0);
        const lytdSales = Number(r.lytd_sales || 0);

        const mtdGrowth = lmtdSales > 0 ? ((mtdSales - lmtdSales) / lmtdSales) * 100 : (mtdSales > 0 ? 100 : 0);
        const ytdGrowth = lytdSales > 0 ? ((ytdSales - lytdSales) / lytdSales) * 100 : (ytdSales > 0 ? 100 : 0);

        return {
          loc: r.loc,
          mtdSales,
          lmtdSales,
          mtdGrowth,
          ytdSales,
          lytdSales,
          ytdGrowth,
        };
      }),
      partyTypeMix: partyTypeRows.map(r => {
        const ytdCurrent = Number(r.ytd_current || 0);
        const ytdLast = Number(r.ytd_last || 0);
        const ytdGrowth = ytdLast > 0 ? ((ytdCurrent - ytdLast) / ytdLast) * 100 : (ytdCurrent > 0 ? 100 : 0);

        const mtdCurrent = Number(r.mtd_current || 0);
        const mtdLast = Number(r.mtd_last || 0);
        const mtdGrowth = mtdLast > 0 ? ((mtdCurrent - mtdLast) / mtdLast) * 100 : (mtdCurrent > 0 ? 100 : 0);

        const qtdCurrent = Number(r.qtd_current || 0);
        const qtdLast = Number(r.qtd_last || 0);
        const qtdGrowth = qtdLast > 0 ? ((qtdCurrent - qtdLast) / qtdLast) * 100 : (qtdCurrent > 0 ? 100 : 0);

        return {
          partyType: r.party_type || 'Unknown',
          ytdCurrent,
          ytdLast,
          ytdGrowth,
          mtdCurrent,
          mtdLast,
          mtdGrowth,
          qtdCurrent,
          qtdLast,
          qtdGrowth,
        };
      }),
      consigneeMix: consigneeRows.map(r => {
        const ytdCurrent = Number(r.ytd_current || 0);
        const ytdLast = Number(r.ytd_last || 0);
        const ytdGrowth = ytdLast > 0 ? ((ytdCurrent - ytdLast) / ytdLast) * 100 : (ytdCurrent > 0 ? 100 : 0);

        const mtdCurrent = Number(r.mtd_current || 0);
        const mtdLast = Number(r.mtd_last || 0);
        const mtdGrowth = mtdLast > 0 ? ((mtdCurrent - mtdLast) / mtdLast) * 100 : (mtdCurrent > 0 ? 100 : 0);

        const qtdCurrent = Number(r.qtd_current || 0);
        const qtdLast = Number(r.qtd_last || 0);
        const qtdGrowth = qtdLast > 0 ? ((qtdCurrent - qtdLast) / qtdLast) * 100 : (qtdCurrent > 0 ? 100 : 0);

        return {
          consignee: r.consignee || 'Unknown',
          ytdCurrent,
          ytdLast,
          ytdGrowth,
          mtdCurrent,
          mtdLast,
          mtdGrowth,
          qtdCurrent,
          qtdLast,
          qtdGrowth,
        };
      }),
      partCategoryMix: partCategoryRows.map(r => {
        const ytdCurrent = Number(r.ytd_current || 0);
        const ytdLast = Number(r.ytd_last || 0);
        const ytdGrowth = ytdLast > 0 ? ((ytdCurrent - ytdLast) / ytdLast) * 100 : (ytdCurrent > 0 ? 100 : 0);

        const mtdCurrent = Number(r.mtd_current || 0);
        const mtdLast = Number(r.mtd_last || 0);
        const mtdGrowth = mtdLast > 0 ? ((mtdCurrent - mtdLast) / mtdLast) * 100 : (mtdCurrent > 0 ? 100 : 0);

        const qtdCurrent = Number(r.qtd_current || 0);
        const qtdLast = Number(r.qtd_last || 0);
        const qtdGrowth = qtdLast > 0 ? ((qtdCurrent - qtdLast) / qtdLast) * 100 : (qtdCurrent > 0 ? 100 : 0);

        return {
          partCategory: r.part_category_code || 'Unknown',
          ytdCurrent,
          ytdLast,
          ytdGrowth,
          mtdCurrent,
          mtdLast,
          mtdGrowth,
          qtdCurrent,
          qtdLast,
          qtdGrowth,
        };
      }),
      quarterlySummary: quarterRows.map(r => {
        const currentYearSales = Number(r.current_year_sales || 0);
        const lastYearSales = Number(r.last_year_sales || 0);
        const growth = lastYearSales > 0 ? ((currentYearSales - lastYearSales) / lastYearSales) * 100 : (currentYearSales > 0 ? 100 : 0);
        return {
          quarter: r.quarter,
          currentYearSales,
          lastYearSales,
          growth,
        };
      }),
      filterOptions: {
        partyTypes: distinctPartyTypes.map(x => x.party_type),
        partCategories: distinctPartCategories.map(x => x.part_category_code),
        consignees: distinctConsignees.map(x => x.consignee),
        locations: distinctLocations.map(x => x.loc),
        dealerSubTypes: ['RO', 'MW', 'AW'],
      },
    };
  }

  async getDormantParties(dormantDays = 30) {
    const threshold = Math.max(1, dormantDays);
    const today = new Date();

    const parties = await this.prisma.party.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, primaryBranchCode: true, primaryBranch: { select: { name: true } } },
    });

    if (parties.length === 0) {
      return { totalCount: 0, items: [], thresholdDays: threshold };
    }

    const partyCodes = parties.map(p => p.code);

    const latestSales = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        consignee as "partyCode",
        MAX(fiscal_year * 10000 + CASE 
          WHEN month = 'Jan' THEN 100
          WHEN month = 'Feb' THEN 200
          WHEN month = 'Mar' THEN 300
          WHEN month = 'Apr' THEN 400
          WHEN month = 'May' THEN 500
          WHEN month = 'Jun' THEN 600
          WHEN month = 'Jul' THEN 700
          WHEN month = 'Aug' THEN 800
          WHEN month = 'Sep' THEN 900
          WHEN month = 'Oct' THEN 1000
          WHEN month = 'Nov' THEN 1100
          ELSE 1200
        END + day) as "maxDateKey"
      FROM raw_sales
      WHERE consignee IN (${partyCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})
      GROUP BY consignee
    `);

    const latestByParty = new Map<string, number>();
    latestSales.forEach(s => {
      latestByParty.set(s.partyCode.toLowerCase(), Number(s.maxDateKey));
    });

    const dormantList = parties.map(p => {
      let lastDate: Date | null = null;
      let daysSince = 99999;
      const key = latestByParty.get(p.code.toLowerCase());

      if (key && key > 0) {
        const y = Math.floor(key / 10000);
        const mKey = Math.floor((key % 10000) / 100);
        const d = key % 100;
        try {
          lastDate = new Date(y, mKey - 1, d);
          daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        } catch (e) {
          // ignore
        }
      }

      return {
        partyCode: p.code,
        partyName: p.name,
        branchCode: p.primaryBranchCode || '',
        branchName: p.primaryBranch?.name || '',
        lastPurchaseDate: lastDate ? lastDate.toISOString().slice(0, 10) : 'Never',
        daysSinceLastPurchase: daysSince,
      };
    })
    .filter(x => x.daysSinceLastPurchase >= threshold)
    .sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);

    return {
      totalCount: dormantList.length,
      items: dormantList.slice(0, 50),
      thresholdDays: threshold,
    };
  }

  async getTargetShortfalls() {
    const latestTarget = await this.prisma.dealerTarget.findFirst({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { year: true, month: true },
    });

    if (!latestTarget) {
      return { totalCount: 0, items: [], thresholdPct: 70, elapsedDays: 0, daysInMonth: 0 };
    }

    const { year, month } = latestTarget;
    const monthsName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthStr = monthsName[month - 1];

    const maxDayRes = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT MAX(day) as "maxDay"
      FROM raw_sales
      WHERE fiscal_year = ${year} AND month = '${monthStr}'
    `);
    const maxDay = maxDayRes[0]?.maxDay ? Number(maxDayRes[0].maxDay) : new Date().getDate();

    const daysInMonth = new Date(year, month, 0).getDate();
    const elapsedRatio = daysInMonth > 0 ? maxDay / daysInMonth : 1.0;

    const targets = await this.prisma.dealerTarget.findMany({
      where: { year, month, targetAmount: { gt: 0 } },
      select: { partyId: true, targetAmount: true, party: { select: { code: true, name: true, primaryBranchCode: true, primaryBranch: { select: { name: true } } } } },
    });

    if (targets.length === 0) {
      return { totalCount: 0, items: [], thresholdPct: 70, elapsedDays: maxDay, daysInMonth };
    }

    const achieved = await this.prisma.incentiveRecord.findMany({
      where: { year, month },
      select: { partyId: true, baseAmount: true },
    });

    const achievedMap = new Map<string, number>();
    achieved.forEach(a => {
      achievedMap.set(a.partyId, Number(a.baseAmount || 0));
    });

    const shortfalls = targets.map(t => {
      const sale = achievedMap.get(t.partyId) || 0;
      const targetVal = Number(t.targetAmount);
      const achievedRatio = targetVal > 0 ? sale / targetVal : 0;
      const runRateRatio = elapsedRatio > 0 ? achievedRatio / elapsedRatio : 0;
      const expectedByNow = Math.round(targetVal * elapsedRatio);
      const shortfallPct = Math.round((elapsedRatio - achievedRatio) * 100 * 10) / 10;

      return {
        partyCode: t.party.code,
        partyName: t.party.name,
        branchCode: t.party.primaryBranchCode || '',
        branchName: t.party.primaryBranch?.name || '',
        target: targetVal,
        achieved: sale,
        expectedByNow,
        shortfallPct,
        runRatePct: Math.round(runRateRatio * 100 * 10) / 10,
        isBehind: runRateRatio < 0.70,
      };
    })
    .filter(x => x.isBehind)
    .sort((a, b) => a.runRatePct - b.runRatePct);

    return {
      totalCount: shortfalls.length,
      items: shortfalls.slice(0, 50),
      thresholdPct: 70,
      elapsedDays: maxDay,
      daysInMonth,
    };
  }

  async getOverdueOutstanding() {
    return {
      totalCount: 0,
      items: [],
      thresholdDays: 80,
    };
  }

  async getPendingMappingReviews() {
    const pendingReviewParties = await this.prisma.party.findMany({
      where: {
        isActive: true,
        mappings: { none: {} },
      },
      select: { code: true, name: true },
      take: 5,
    });

    const totalCount = await this.prisma.party.count({
      where: {
        isActive: true,
        mappings: { none: {} },
      },
    });

    return {
      count: totalCount,
      preview: pendingReviewParties.map(p => ({
        partyCode: p.code,
        partyName: p.name,
        confidenceScore: 0.0,
        baseLocationConfidenceTier: 'PENDING',
      })),
    };
  }

  // ─── POWER BI / DAX COMPLIANT EXECUTIVE KPIS (FTD, MTD, QTD, YTD) ───────────
  async getExecutiveKPIs(params: {
    fiscalYear?: number;
    month?: string;
    day?: number;
    branchCode?: string;
    partyType?: string;
    partCategory?: string;
  }) {
    const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const MONTH_INDEX_MAP: Record<string, number> = {
      Apr: 0, May: 1, Jun: 2, Jul: 3, Aug: 4, Sep: 5, Oct: 6, Nov: 7, Dec: 8, Jan: 9, Feb: 10, Mar: 11
    };

    // 1. Resolve Target FiscalYear, Month, and Day dynamically using SQL integer casting
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayDay = yesterday.getDate();

    let targetFY: number = params.fiscalYear || 2026;
    let targetMonth: string = params.month || 'Aug';
    let targetDay: number = params.day || yesterdayDay;

    if (!params.fiscalYear || !params.month || !params.day) {
      const maxDateRes = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          r.fiscal_year AS "fiscalYear",
          r.month AS "month",
          MAX(CAST(CASE WHEN r.day ~ '^[0-9]+$' THEN r.day ELSE '1' END AS INTEGER)) AS "maxDay"
        FROM retail_sales_records r
        WHERE 1=1 ${params.fiscalYear ? `AND r.fiscal_year = ${params.fiscalYear}` : `AND r.fiscal_year = (SELECT MAX(fiscal_year) FROM retail_sales_records)`}
          ${params.month ? `AND r.month = '${params.month.replace(/'/g, "''")}'` : ''}
        GROUP BY r.fiscal_year, r.month
        ORDER BY r.fiscal_year DESC, 
          CASE 
            WHEN r.month = 'Apr' THEN 1
            WHEN r.month = 'May' THEN 2
            WHEN r.month = 'Jun' THEN 3
            WHEN r.month = 'Jul' THEN 4
            WHEN r.month = 'Aug' THEN 5
            WHEN r.month = 'Sep' THEN 6
            WHEN r.month = 'Oct' THEN 7
            WHEN r.month = 'Nov' THEN 8
            WHEN r.month = 'Dec' THEN 9
            WHEN r.month = 'Jan' THEN 10
            WHEN r.month = 'Feb' THEN 11
            WHEN r.month = 'Mar' THEN 12
            ELSE 0
          END DESC
        LIMIT 1
      `).catch(() => []);

      if (maxDateRes && maxDateRes.length > 0) {
        targetFY = params.fiscalYear || Number(maxDateRes[0].fiscalYear) || 2026;
        targetMonth = params.month || maxDateRes[0].month || 'Aug';
        targetDay = params.day || Number(maxDateRes[0].maxDay) || yesterdayDay;
      }
    }

    const currentMonthIdx = MONTH_INDEX_MAP[targetMonth] ?? 4; // default Aug
    const prevMonthName = currentMonthIdx === 0 ? 'Mar' : MONTH_ORDER[currentMonthIdx - 1];
    const prevMonthFY = currentMonthIdx === 0 ? targetFY - 1 : targetFY;

    // Determine Quarter
    // Q1: Apr, May, Jun (0,1,2)
    // Q2: Jul, Aug, Sep (3,4,5)
    // Q3: Oct, Nov, Dec (6,7,8)
    // Q4: Jan, Feb, Mar (9,10,11)
    const quarterNum = Math.floor(currentMonthIdx / 3) + 1;
    const quarterName = `Q${quarterNum}`;
    const quarterStartMonthIdx = (quarterNum - 1) * 3;
    const quarterMonths = MONTH_ORDER.slice(quarterStartMonthIdx, quarterStartMonthIdx + 3);

    // Quarter elapsed months and current partial month
    const qMonthsPrior = MONTH_ORDER.slice(quarterStartMonthIdx, currentMonthIdx);

    // Previous Quarter Months
    const prevQuarterNum = quarterNum === 1 ? 4 : quarterNum - 1;
    const prevQuarterStartMonthIdx = (prevQuarterNum - 1) * 3;
    const prevQuarterFY = quarterNum === 1 ? targetFY - 1 : targetFY;
    const prevQuarterMonths = MONTH_ORDER.slice(prevQuarterStartMonthIdx, prevQuarterStartMonthIdx + 3);

    const effectiveBranch = params.branchCode || 'ALL';
    const effectivePartyType = params.partyType || 'ALL';
    const effectivePartCategory = params.partCategory !== undefined ? params.partCategory : 'M';
    const cacheKey = `dashboard:exec-kpis:${targetFY}:${targetMonth}:${targetDay}:${effectiveBranch}:${effectivePartyType}:${effectivePartCategory}`;

    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Formatter helper
    const formatINR = (val: number): string => {
      if (!val || isNaN(val)) return '₹0';
      const abs = Math.abs(val);
      if (abs >= 10000000) {
        return `${val < 0 ? '-' : ''}₹${(abs / 10000000).toFixed(2)} Cr`;
      }
      if (abs >= 100000) {
        return `${val < 0 ? '-' : ''}₹${(abs / 100000).toFixed(2)} L`;
      }
      if (abs >= 1000) {
        return `${val < 0 ? '-' : ''}₹${(abs / 1000).toFixed(1)} K`;
      }
      return `${val < 0 ? '-' : ''}₹${Math.round(abs).toLocaleString('en-IN')}`;
    };

    // Distinct available options for filters (using fast lookups)
    const [branches, partyTypes] = await Promise.all([
      this.prisma.branch.findMany({ select: { code: true, name: true } }),
      this.prisma.partyMaster.groupBy({
        by: ['partyType'],
        _count: { id: true },
      }),
    ]);

    const branchMap = new Map<string, string>();
    branches.forEach(b => branchMap.set(b.code, b.name));

    // Build dynamic SQL filters for location grid
    const locFilters: string[] = [];
    if (params.branchCode && params.branchCode !== 'ALL') {
      locFilters.push(`r.loc = '${params.branchCode.replace(/'/g, "''")}'`);
    }
    if (params.partyType && params.partyType !== 'ALL') {
      const types = params.partyType.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).filter(Boolean);
      if (types.length > 0) {
        locFilters.push(`r.party_type IN (${types.join(', ')})`);
      }
    }
    if (effectivePartCategory && effectivePartCategory !== 'ALL') {
      const cats = effectivePartCategory.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).filter(Boolean);
      if (cats.length > 0) {
        locFilters.push(`r.part_category_code IN (${cats.join(', ')})`);
      }
    }
    const locWhereClause = locFilters.length > 0 ? 'AND ' + locFilters.join(' AND ') : '';
    const dayCastSql = `CAST(CASE WHEN r.day ~ '^[0-9]+$' THEN r.day ELSE '0' END AS INTEGER)`;
    const qtdPriorCond = qMonthsPrior.length > 0 ? `r.month IN (${qMonthsPrior.map(m => `'${m}'`).join(', ')})` : '1=0';
    const priorQMonthsEquivalent = prevQuarterMonths.slice(0, currentMonthIdx - quarterStartMonthIdx);
    const equivalentPrevQMonthName = prevQuarterMonths[currentMonthIdx - quarterStartMonthIdx];
    const lqPriorCond = priorQMonthsEquivalent.length > 0 ? `r.month IN (${priorQMonthsEquivalent.map(m => `'${m}'`).join(', ')})` : '1=0';
    const ytdPriorCond = currentMonthIdx > 0 ? `r.month IN (${MONTH_ORDER.slice(0, currentMonthIdx).map(m => `'${m}'`).join(', ')})` : '1=0';

    let locationRows: any[] = [];
    try {
      locationRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          r.loc AS "loc",
          -- FTD
          SUM(CASE WHEN r.fiscal_year = ${targetFY} AND r.month = '${targetMonth}' AND ${dayCastSql} = ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "ftdSales",
          SUM(CASE WHEN r.fiscal_year = ${prevMonthFY} AND r.month = '${prevMonthName}' AND ${dayCastSql} = ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "ftdLmSales",
          SUM(CASE WHEN r.fiscal_year = ${targetFY - 1} AND r.month = '${targetMonth}' AND ${dayCastSql} = ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "ftdLySales",
          
          -- MTD
          SUM(CASE WHEN r.fiscal_year = ${targetFY} AND r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "mtdSales",
          SUM(CASE WHEN r.fiscal_year = ${prevMonthFY} AND r.month = '${prevMonthName}' AND ${dayCastSql} <= ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "mtdLmSales",
          SUM(CASE WHEN r.fiscal_year = ${targetFY - 1} AND r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay} THEN r.net_retail_selling ELSE 0 END) AS "mtdLySales",
          
          -- QTD
          SUM(CASE WHEN r.fiscal_year = ${targetFY} AND (${qtdPriorCond} OR (r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay})) THEN r.net_retail_selling ELSE 0 END) AS "qtdSales",
          SUM(CASE WHEN r.fiscal_year = ${prevQuarterFY} AND (${lqPriorCond} OR (r.month = '${equivalentPrevQMonthName}' AND ${dayCastSql} <= ${targetDay})) THEN r.net_retail_selling ELSE 0 END) AS "qtdLqSales",
          SUM(CASE WHEN r.fiscal_year = ${targetFY - 1} AND (${qtdPriorCond} OR (r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay})) THEN r.net_retail_selling ELSE 0 END) AS "qtdLySales",
          
          -- YTD
          SUM(CASE WHEN r.fiscal_year = ${targetFY} AND (${ytdPriorCond} OR (r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay})) THEN r.net_retail_selling ELSE 0 END) AS "ytdSales",
          SUM(CASE WHEN r.fiscal_year = ${targetFY - 1} AND (${ytdPriorCond} OR (r.month = '${targetMonth}' AND ${dayCastSql} <= ${targetDay})) THEN r.net_retail_selling ELSE 0 END) AS "ytdLySales"
        FROM retail_sales_records r
        WHERE r.fiscal_year IN (${targetFY}, ${targetFY - 1}, ${prevQuarterFY}) ${locWhereClause}
        GROUP BY r.loc
        ORDER BY "ytdSales" DESC
      `);
    } catch (err: any) {
      this.logger.error(`Location rows query failed: ${err.message}`);
      locationRows = [];
    }

    // ─── SINGLE-PASS CONSOLIDATED TOTALS (Exact sum of all location rows) ─────────
    const ftdCurrent: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.ftdSales || 0), 0);
    const ftdLM: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.ftdLmSales || 0), 0);
    const ftdLY: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.ftdLySales || 0), 0);
    const ftdGrowthLM = ftdLM > 0 ? ((ftdCurrent - ftdLM) / ftdLM) * 100 : (ftdCurrent > 0 ? 100 : 0);
    const ftdGrowthLY = ftdLY > 0 ? ((ftdCurrent - ftdLY) / ftdLY) * 100 : (ftdCurrent > 0 ? 100 : 0);

    const mtdCurrent: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.mtdSales || 0), 0);
    const mtdLM: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.mtdLmSales || 0), 0);
    const mtdLY: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.mtdLySales || 0), 0);
    const mtdGrowthLM = mtdLM > 0 ? ((mtdCurrent - mtdLM) / mtdLM) * 100 : (mtdCurrent > 0 ? 100 : 0);
    const mtdGrowthLY = mtdLY > 0 ? ((mtdCurrent - mtdLY) / mtdLY) * 100 : (mtdCurrent > 0 ? 100 : 0);

    const qtdCurrent: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.qtdSales || 0), 0);
    const qtdLQ: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.qtdLqSales || 0), 0);
    const qtdLY: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.qtdLySales || 0), 0);
    const qtdGrowthLQ = qtdLQ > 0 ? ((qtdCurrent - qtdLQ) / qtdLQ) * 100 : (qtdCurrent > 0 ? 100 : 0);
    const qtdGrowthLY = qtdLY > 0 ? ((qtdCurrent - qtdLY) / qtdLY) * 100 : (qtdCurrent > 0 ? 100 : 0);

    const ytdCurrent: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.ytdSales || 0), 0);
    const ytdLY: number = locationRows.reduce((sum: number, r: any) => sum + Number(r.ytdLySales || 0), 0);
    const ytdGrowthLY = ytdLY > 0 ? ((ytdCurrent - ytdLY) / ytdLY) * 100 : (ytdCurrent > 0 ? 100 : 0);

    const locationGrid = locationRows.map((r: any) => {
      const ftdCur = Number(r.ftdSales || 0);
      const ftdLm = Number(r.ftdLmSales || 0);
      const ftdLy = Number(r.ftdLySales || 0);
      const ftdGLM = ftdLm > 0 ? ((ftdCur - ftdLm) / ftdLm) * 100 : (ftdCur > 0 ? 100 : 0);
      const ftdGLY = ftdLy > 0 ? ((ftdCur - ftdLy) / ftdLy) * 100 : (ftdCur > 0 ? 100 : 0);

      const mtdCur = Number(r.mtdSales || 0);
      const mtdLm = Number(r.mtdLmSales || 0);
      const mtdLy = Number(r.mtdLySales || 0);
      const mtdGLM = mtdLm > 0 ? ((mtdCur - mtdLm) / mtdLm) * 100 : (mtdCur > 0 ? 100 : 0);
      const mtdGLY = mtdLy > 0 ? ((mtdCur - mtdLy) / mtdLy) * 100 : (mtdCur > 0 ? 100 : 0);

      const qtdCur = Number(r.qtdSales || 0);
      const qtdLq = Number(r.qtdLqSales || 0);
      const qtdLy = Number(r.qtdLySales || 0);
      const qtdGLQ = qtdLq > 0 ? ((qtdCur - qtdLq) / qtdLq) * 100 : (qtdCur > 0 ? 100 : 0);
      const qtdGLY = qtdLy > 0 ? ((qtdCur - qtdLy) / qtdLy) * 100 : (qtdCur > 0 ? 100 : 0);

      const ytdCur = Number(r.ytdSales || 0);
      const ytdLy = Number(r.ytdLySales || 0);
      const ytdGLY = ytdLy > 0 ? ((ytdCur - ytdLy) / ytdLy) * 100 : (ytdCur > 0 ? 100 : 0);

      return {
        loc: r.loc || 'UNSPECIFIED',
        branchName: branchMap.get(r.loc) || r.loc || 'UNSPECIFIED',
        ftd: { current: ftdCur, formatted: formatINR(ftdCur), lm: ftdLm, formattedLm: formatINR(ftdLm), ly: ftdLy, formattedLy: formatINR(ftdLy), growthLM: Number(ftdGLM.toFixed(1)), growthLY: Number(ftdGLY.toFixed(1)) },
        mtd: { current: mtdCur, formatted: formatINR(mtdCur), lm: mtdLm, formattedLm: formatINR(mtdLm), ly: mtdLy, formattedLy: formatINR(mtdLy), growthLM: Number(mtdGLM.toFixed(1)), growthLY: Number(mtdGLY.toFixed(1)) },
        qtd: { current: qtdCur, formatted: formatINR(qtdCur), lq: qtdLq, formattedLq: formatINR(qtdLq), ly: qtdLy, formattedLy: formatINR(qtdLy), growthLQ: Number(qtdGLQ.toFixed(1)), growthLY: Number(qtdGLY.toFixed(1)) },
        ytd: { current: ytdCur, formatted: formatINR(ytdCur), ly: ytdLy, formattedLy: formatINR(ytdLy), growthLY: Number(ytdGLY.toFixed(1)) },
      };
    });

    const response = {
      asOf: {
        day: targetDay,
        month: targetMonth,
        fiscalYear: targetFY,
        dateFormatted: `${targetDay}-${targetMonth}-${targetFY}`,
        quarter: quarterName,
        previousMonth: prevMonthName,
      },
      kpis: {
        ftd: {
          key: 'FTD',
          name: `FTD (${targetDay}-${targetMonth}-${targetFY})`,
          periodLabel: `${targetDay}-${targetMonth}-${targetFY}`,
          current: ftdCurrent,
          currentFormatted: formatINR(ftdCurrent),
          lm: ftdLM,
          lmFormatted: formatINR(ftdLM),
          lmLabel: `Same Day LM (${targetDay}-${prevMonthName})`,
          ly: ftdLY,
          lyFormatted: formatINR(ftdLY),
          lyLabel: `Same Day LY (${targetDay}-${targetMonth}-${targetFY - 1})`,
          growthVsLM: Number(ftdGrowthLM.toFixed(1)),
          growthVsLY: Number(ftdGrowthLY.toFixed(1)),
          trendLM: ftdGrowthLM >= 0 ? 'UP' : 'DOWN',
          trendLY: ftdGrowthLY >= 0 ? 'UP' : 'DOWN',
          dax: 'FTD = CALCULATE([Total Sales], Sales[SalesDate] = MAX(Sales[SalesDate]))',
        },
        mtd: {
          key: 'MTD',
          name: 'MTD — Month To Date',
          periodLabel: `1–${targetDay} ${targetMonth} ${targetFY}`,
          current: mtdCurrent,
          currentFormatted: formatINR(mtdCurrent),
          lm: mtdLM,
          lmFormatted: formatINR(mtdLM),
          lmLabel: `1–${targetDay} ${prevMonthName} (LM MTD)`,
          ly: mtdLY,
          lyFormatted: formatINR(mtdLY),
          lyLabel: `1–${targetDay} ${targetMonth} ${targetFY - 1} (LY MTD)`,
          growthVsLM: Number(mtdGrowthLM.toFixed(1)),
          growthVsLY: Number(mtdGrowthLY.toFixed(1)),
          trendLM: mtdGrowthLM >= 0 ? 'UP' : 'DOWN',
          trendLY: mtdGrowthLY >= 0 ? 'UP' : 'DOWN',
          dax: 'Sales MTD = TOTALMTD([Total Sales], \'Date\'[Date])',
        },
        qtd: {
          key: 'QTD',
          name: 'QTD — Quarter To Date',
          periodLabel: `${quarterName} FY${targetFY} To Date`,
          current: qtdCurrent,
          currentFormatted: formatINR(qtdCurrent),
          lq: qtdLQ,
          lqFormatted: formatINR(qtdLQ),
          lqLabel: `Prev Qtr Equivalent (${prevQuarterNum === 4 ? `Q4 FY${targetFY - 1}` : `Q${prevQuarterNum} FY${targetFY}`})`,
          ly: qtdLY,
          lyFormatted: formatINR(qtdLY),
          lyLabel: `Same Qtr LY (${quarterName} FY${targetFY - 1})`,
          growthVsLQ: Number(qtdGrowthLQ.toFixed(1)),
          growthVsLY: Number(qtdGrowthLY.toFixed(1)),
          trendLQ: qtdGrowthLQ >= 0 ? 'UP' : 'DOWN',
          trendLY: qtdGrowthLY >= 0 ? 'UP' : 'DOWN',
          dax: 'Sales QTD = TOTALQTD([Total Sales], \'Date\'[Date])',
        },
        ytd: {
          key: 'YTD',
          name: 'YTD — Year To Date',
          periodLabel: `FY${targetFY} (1-Apr → ${targetDay}-${targetMonth})`,
          current: ytdCurrent,
          currentFormatted: formatINR(ytdCurrent),
          ly: ytdLY,
          lyFormatted: formatINR(ytdLY),
          lyLabel: `FY${targetFY - 1} LY YTD (1-Apr → ${targetDay}-${targetMonth})`,
          growthVsLY: Number(ytdGrowthLY.toFixed(1)),
          trendLY: ytdGrowthLY >= 0 ? 'UP' : 'DOWN',
          dax: 'Sales YTD = TOTALYTD([Total Sales], \'Date\'[Date], "03-31")',
        },
      },
      locationGrid,
      filters: {
        periods: [
          { fiscalYear: 2026, month: 'Aug', monthYear: 'Aug-2026' },
          { fiscalYear: 2026, month: 'Jul', monthYear: 'Jul-2026' },
          { fiscalYear: 2026, month: 'Jun', monthYear: 'Jun-2026' },
          { fiscalYear: 2026, month: 'May', monthYear: 'May-2026' },
          { fiscalYear: 2026, month: 'Apr', monthYear: 'Apr-2026' },
        ],
        branches: branches.map(b => ({ code: b.code, name: b.name })),
        categories: ['M', 'A', 'C', 'O', 'S', 'G', 'P'],
        partyTypes: partyTypes.map(pt => pt.partyType).filter(Boolean),
      },
    };

    // Cache the consolidated response for 300s (5 mins)
    await this.cacheService.set(cacheKey, response, 300);

    return response;
  }
}

