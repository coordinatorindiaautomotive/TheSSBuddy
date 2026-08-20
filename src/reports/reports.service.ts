// src/reports/reports.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  async getIncentiveRegister(filter: any) {
    const where: any = {};
    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    if (filter.partCategoryCode) where.partCategoryCode = filter.partCategoryCode;
    if (filter.status) where.status = filter.status;
    if (filter.partyType) {
      where.party = { type: filter.partyType };
    }

    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.incentiveRecord.findMany({
        where,
        include: {
          party: { select: { code: true, name: true, type: true } },
          scheme: { select: { code: true, name: true } },
          branch: { select: { code: true, name: true } },
        },
        skip, take,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.incentiveRecord.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getOutstandingMaster(filter: any) {
    const where: any = {};
    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    if (filter.partCategoryCode) where.partCategoryCode = filter.partCategoryCode;
    if (filter.partyType) {
      where.party = { type: filter.partyType };
    }

    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.dealerMonthlyPerformance.findMany({
        where,
        include: {
          party: { select: { code: true, name: true, type: true, subType: true } },
          branch: { select: { code: true, name: true } },
        },
        skip, take,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { outstandingAmount: 'desc' }],
      }),
      this.prisma.dealerMonthlyPerformance.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getPerformanceReport(filter: any) {
    const where: any = {};
    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    if (filter.partCategoryCode) where.partCategoryCode = filter.partCategoryCode;

    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.dealerMonthlyPerformance.findMany({
        where,
        include: {
          party: { select: { code: true, name: true, type: true } },
          branch: { select: { code: true, name: true } },
        },
        skip, take,
        orderBy: [{ salesAmount: 'desc' }],
      }),
      this.prisma.dealerMonthlyPerformance.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  // ─── WEIGHTED PARTY TARGET ENGINE & GUARDRAIL GAP DISTRIBUTION ────────────────
  async refreshTargetVsAchievementCache(
    fiscalYear: number,
    month: string,
    config?: {
      lyWeight?: number;       // default 0.40 (40%)
      lmWeight?: number;       // default 0.25 (25%)
      lqWeight?: number;       // default 0.20 (20%)
      lfyWeight?: number;      // default 0.15 (15%)
      growthPercent?: number;  // default 10 (+10%)
      floorMultiplier?: number;// default 1.15 (15% floor)
      categoryMBudget?: number;// default 14 (₹14 Cr)
    },
  ) {
    const t0 = Date.now();
    const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const MONTH_NUMBER_MAP: Record<string, number> = {
      Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12, Jan: 1, Feb: 2, Mar: 3
    };

    const targetFY = Number(fiscalYear) || 2026;
    const targetMonth = month || 'Aug';
    const monthNumber = MONTH_NUMBER_MAP[targetMonth] || 8;

    const monthIdx = MONTH_ORDER.indexOf(targetMonth) >= 0 ? MONTH_ORDER.indexOf(targetMonth) : 4;
    const prevMonth = monthIdx === 0 ? 'Mar' : MONTH_ORDER[monthIdx - 1];
    const prevMonthFY = monthIdx === 0 ? targetFY - 1 : targetFY;

    const lySameMonth = targetMonth;
    const lySameMonthFY = targetFY - 1;

    // YTD months in current FY
    const ytdMonths = MONTH_ORDER.slice(0, monthIdx + 1);

    // Weights Configuration (defaults from User Specification)
    const wLY = config?.lyWeight !== undefined ? config.lyWeight : 0.40;
    const wLM = config?.lmWeight !== undefined ? config.lmWeight : 0.25;
    const wLQ = config?.lqWeight !== undefined ? config.lqWeight : 0.20;
    const wLFY = config?.lfyWeight !== undefined ? config.lfyWeight : 0.15;
    const growthMult = 1 + ((config?.growthPercent !== undefined ? config.growthPercent : 10) / 100);
    const floorMult = config?.floorMultiplier !== undefined ? config.floorMultiplier : 1.15;

    // Determine Last Quarter Months (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
    let lastQuarterMonths: string[] = ['Apr', 'May', 'Jun'];
    let lastQuarterFY = targetFY;
    if (monthIdx >= 3 && monthIdx <= 5) {
      // e.g. Jul, Aug, Sep -> previous quarter is Q1 (Apr, May, Jun)
      lastQuarterMonths = ['Apr', 'May', 'Jun'];
      lastQuarterFY = targetFY;
    } else if (monthIdx >= 6 && monthIdx <= 8) {
      // Oct, Nov, Dec -> previous is Q2 (Jul, Aug, Sep)
      lastQuarterMonths = ['Jul', 'Aug', 'Sep'];
      lastQuarterFY = targetFY;
    } else if (monthIdx >= 9 && monthIdx <= 11) {
      // Jan, Feb, Mar -> previous is Q3 (Oct, Nov, Dec)
      lastQuarterMonths = ['Oct', 'Nov', 'Dec'];
      lastQuarterFY = targetFY;
    } else {
      // Apr, May, Jun -> previous is Q4 of last FY (Jan, Feb, Mar)
      lastQuarterMonths = ['Jan', 'Feb', 'Mar'];
      lastQuarterFY = targetFY - 1;
    }

    const lastFY = targetFY - 1;

    // Branch names map
    const branches = await this.prisma.branch.findMany({
      select: { code: true, name: true },
    });
    const branchNameMap = new Map(branches.map((b) => [b.code, b.name]));

    this.logger.log(`Executing Weighted Party Target Engine for FY${targetFY} ${targetMonth}...`);

    // Complete SQL Multi-Period Pipeline over 5.3M records partitioned by Category
    const rowsRaw: any[] = await this.prisma.$queryRaw`
      WITH ly_same_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          MAX(COALESCE(cons_party_name, dealer_code)) AS party_name,
          COALESCE(party_type, 'TRADER/RETAILER') AS party_type,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ly_sm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${lySameMonthFY} AND month = ${lySameMonth}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M'), party_type
      ),
      last_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS lm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${prevMonthFY} AND month = ${prevMonth}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      last_qtr AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND((SUM(net_retail_selling) / 3)::numeric, 2) AS lq_avg
        FROM retail_sales_records
        WHERE fiscal_year = ${lastQuarterFY} AND month = ANY(${lastQuarterMonths})
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      last_fy AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND((SUM(net_retail_selling) / 12)::numeric, 2) AS lfy_avg
        FROM retail_sales_records
        WHERE fiscal_year = ${lastFY}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      prior_6m AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND((SUM(net_retail_selling) / 6)::numeric, 2) AS avg_6m_sales
        FROM retail_sales_records
        WHERE ((fiscal_year = ${targetFY} AND month IN ('Apr', 'May', 'Jun', 'Jul'))
           OR (fiscal_year = ${targetFY - 1} AND month IN ('Feb', 'Mar')))
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ytd_cur AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ytd_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month = ANY(${ytdMonths})
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ytd_ly AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ly_ytd_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND month = ANY(${ytdMonths})
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      current_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code,
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code,
          COALESCE(part_category_code, 'M') AS part_category_code,
          MAX(COALESCE(cons_party_name, dealer_code)) AS party_name,
          COALESCE(party_type, 'TRADER/RETAILER') AS party_type,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS cur_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month = ${targetMonth}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M'), party_type
      ),
      all_parties AS (
        SELECT branch_code, party_code, part_category_code FROM ly_same_month
        UNION
        SELECT branch_code, party_code, part_category_code FROM current_month
        UNION
        SELECT branch_code, party_code, part_category_code FROM last_month
      )
      SELECT 
        ap.branch_code AS "branchCode",
        ap.party_code AS "partyCode",
        ap.part_category_code AS "partCategoryCode",
        COALESCE(NULLIF(cm.party_name, '-'), NULLIF(ly.party_name, '-'), ap.party_code) AS "partyName",
        COALESCE(NULLIF(cm.party_type, '-'), NULLIF(ly.party_type, '-'), 'TRADER/RETAILER') AS "partyType",
        COALESCE(ly.ly_sm_sales, 0) AS "lySameMonthSales",
        COALESCE(lm.lm_sales, 0) AS "lastMonthSales",
        COALESCE(lq.lq_avg, 0) AS "lastQuarterAvg",
        COALESCE(lfy.lfy_avg, 0) AS "lastFyAvg",
        COALESCE(p6.avg_6m_sales, 0) AS "avgSaleLast6Month",
        COALESCE(cm.cur_sales, 0) AS "currentSales",
        COALESCE(yc.ytd_sales, 0) AS "ytdSales",
        COALESCE(yl.ly_ytd_sales, 0) AS "lastYearYTDSales",
        COALESCE(dt.admin_defined_target, 0) AS "adminDefinedTarget"
      FROM all_parties ap
      LEFT JOIN ly_same_month ly ON ap.branch_code = ly.branch_code AND ap.party_code = ly.party_code AND ap.part_category_code = ly.part_category_code
      LEFT JOIN current_month cm ON ap.branch_code = cm.branch_code AND ap.party_code = cm.party_code AND ap.part_category_code = cm.part_category_code
      LEFT JOIN last_month lm ON ap.branch_code = lm.branch_code AND ap.party_code = lm.party_code AND ap.part_category_code = lm.part_category_code
      LEFT JOIN last_qtr lq ON ap.branch_code = lq.branch_code AND ap.party_code = lq.party_code AND ap.part_category_code = lq.part_category_code
      LEFT JOIN last_fy lfy ON ap.branch_code = lfy.branch_code AND ap.party_code = lfy.party_code AND ap.part_category_code = lfy.part_category_code
      LEFT JOIN prior_6m p6 ON ap.branch_code = p6.branch_code AND ap.party_code = p6.party_code AND ap.part_category_code = p6.part_category_code
      LEFT JOIN ytd_cur yc ON ap.branch_code = yc.branch_code AND ap.party_code = yc.party_code AND ap.part_category_code = yc.part_category_code
      LEFT JOIN ytd_ly yl ON ap.branch_code = yl.branch_code AND ap.party_code = yl.party_code AND ap.part_category_code = yl.part_category_code
      LEFT JOIN dealer_targets dt ON ap.party_code = dt.party_code AND dt.year = ${targetFY} AND dt.month = ${monthNumber} AND dt.part_category_code = ap.part_category_code
      ORDER BY COALESCE(cm.cur_sales, lm.lm_sales, ly.ly_sm_sales, 0) DESC;
    `;

    // Category M Budget (Default: ₹14.00 Cr = ₹14,00,00,000)
    const catMBudgetAmount = config?.categoryMBudget !== undefined 
      ? Number(config.categoryMBudget) * 10000000 
      : 140000000; // 14 Cr

    // Calculate raw weighted bases
    let rawCatMBase = 0;
    const preRows = rowsRaw.map((r) => {
      const lySM = Number(r.lySameMonthSales) || 0;
      const lm = Number(r.lastMonthSales) || 0;
      const lq = Number(r.lastQuarterAvg) || 0;
      const lfy = Number(r.lastFyAvg) || 0;
      const cur = Number(r.currentSales) || 0;
      const p6 = Number(r.avgSaleLast6Month) || 0;

      // User's Exact Formula:
      // (LY Same Month * 40%) + (Last Month * 25%) + (Last Qtr Avg * 20%) + (Last FY Avg * 15%)
      let weightedBase = (lySM * wLY) + (lm * wLM) + (lq * wLQ) + (lfy * wLFY);

      if (weightedBase === 0) {
        weightedBase = lm > 0 ? lm : lq > 0 ? lq : p6 > 0 ? p6 : cur;
      }

      if ((r.partCategoryCode || 'M') === 'M') {
        rawCatMBase += weightedBase;
      }

      return {
        ...r,
        lySM,
        lm,
        lq,
        lfy,
        cur,
        p6,
        weightedBase: Math.round(weightedBase),
      };
    });

    const catMScaling = rawCatMBase > 0 ? catMBudgetAmount / rawCatMBase : growthMult;

    // Calculate Recommended Target with Category M 14 Cr calibration
    let totalLySameMonth = 0;
    let totalWeightedBase = 0;
    let totalRecommendedTarget = 0;

    const parsedRows = preRows.map((r) => {
      const isCatM = (r.partCategoryCode || 'M') === 'M';
      const scaling = isCatM ? catMScaling : growthMult;
      const recommendedTarget = Math.round(r.weightedBase * scaling);

      totalLySameMonth += r.lySM;
      totalWeightedBase += r.weightedBase;
      totalRecommendedTarget += recommendedTarget;

      return {
        ...r,
        recommendedTarget,
        adminDefinedTarget: Number(r.adminDefinedTarget) > 0 ? Number(r.adminDefinedTarget) : null,
      };
    });

    // ─── 2. OVERALL TARGET GUARDRAIL FLOOR AUDIT ────────────────────────────
    // Floor = LY Same Month * 1.15 (+15% minimum growth guardrail)
    const overallFloor = Math.round(totalLySameMonth * floorMult);
    const gap = overallFloor > totalRecommendedTarget ? overallFloor - totalRecommendedTarget : 0;
    const isFloorPassed = totalRecommendedTarget >= overallFloor;

    // ─── 3. GAP DISTRIBUTION ENGINE ──────────────────────────────────────────
    const finalSnapshotData = parsedRows.map((p) => {
      let gapAdjustment = 0;
      if (gap > 0) {
        // Distribute gap proportionally based on dealer recommended weight
        const weight = totalRecommendedTarget > 0 ? p.recommendedTarget / totalRecommendedTarget : 1 / parsedRows.length;
        gapAdjustment = Math.round(gap * weight);
      }

      const systemSuggestedTarget = Math.round((p.recommendedTarget + gapAdjustment) / 1000) * 1000;
      const rawFinalTarget = p.adminDefinedTarget && p.adminDefinedTarget > 0
        ? p.adminDefinedTarget
        : (p.recommendedTarget + gapAdjustment);
      const finalTarget = Math.round(rawFinalTarget / 1000) * 1000;

      const ytdSales = Number(p.ytdSales) || 0;
      const lastYearYTDSales = Number(p.lastYearYTDSales) || 0;
      const achievementPercent = finalTarget > 0 ? Math.round((p.cur / finalTarget) * 1000) / 10 : 0;
      const yoyGrowthPercent = lastYearYTDSales > 0 ? Math.round(((ytdSales - lastYearYTDSales) / lastYearYTDSales) * 1000) / 10 : 0;

      return {
        fiscalYear: targetFY,
        month: targetMonth,
        monthNum: monthNumber,
        branchCode: p.branchCode,
        branchName: branchNameMap.get(p.branchCode) || p.branchCode,
        partyCode: p.partyCode,
        partyName: p.partyName,
        partyType: p.partyType,
        partCategoryCode: p.partCategoryCode || 'M',
        salesExecutive: 'Branch Owned',
        
        // Detailed Weighted Components
        lySameMonthSales: p.lySM,
        lastMonthSales: p.lm,
        lastQuarterAvg: p.lq,
        lastFyAvg: p.lfy,
        avgSaleLast6Month: p.p6,

        // Engine Outputs
        weightedBase: p.weightedBase,
        recommendedTarget: p.recommendedTarget,
        gapAdjustment,
        systemSuggestedTarget,
        adminDefinedTarget: p.adminDefinedTarget,
        finalTarget,

        // Performance & Growth
        currentSales: p.cur,
        achievementPercent,
        ytdSales,
        lastYearYTDSales,
        yoyGrowthPercent,

        // Workflow Status
        targetStatus: 'DRAFT',
      };
    });

    // ─── 4. ATOMICALLY PERSIST TO SNAPSHOT CACHE ────────────────────────────
    await this.prisma.$transaction(async (tx) => {
      await tx.targetVsAchievementSnapshot.deleteMany({
        where: { fiscalYear: targetFY, month: targetMonth },
      });

      const batchSize = 500;
      for (let i = 0; i < finalSnapshotData.length; i += batchSize) {
        await tx.targetVsAchievementSnapshot.createMany({
          data: finalSnapshotData.slice(i, i + batchSize),
          skipDuplicates: true,
        });
      }
    });

    const elapsed = Date.now() - t0;
    this.logger.log(
      `Target Engine calculated ${finalSnapshotData.length} parties in ${elapsed}ms. Floor: ₹${overallFloor}, Rec: ₹${totalRecommendedTarget}, Gap: ₹${gap}`,
    );

    return {
      count: finalSnapshotData.length,
      elapsedMs: elapsed,
      guardrail: {
        totalLySameMonth,
        overallFloor,
        totalRecommendedTarget,
        gap,
        isFloorPassed,
        status: isFloorPassed ? 'ACCEPT' : 'GAP_DISTRIBUTED',
      },
    };
  }

  // ─── PARTY-WISE TARGET VS ACHIEVEMENT (HIGH-SPEED CACHE LOOKUP) ───────────────
  async getTargetVsAchievement(filter: {
    fiscalYear?: number;
    month?: string;
    branchCode?: string;
    partyType?: string;
    partCategoryCode?: string;
    search?: string;
    page?: number;
    pageSize?: number | string;
  }) {
    const targetFY = Number(filter.fiscalYear) || 2026;
    const targetMonth = filter.month || 'Aug';

    // Check if snapshot cache already exists
    const cachedCount = await this.prisma.targetVsAchievementSnapshot.count({
      where: { fiscalYear: targetFY, month: targetMonth },
    });

    // If cache is missing, compute once and store!
    if (cachedCount === 0) {
      await this.refreshTargetVsAchievementCache(targetFY, targetMonth);
    }

    const where: any = {
      fiscalYear: targetFY,
      month: targetMonth,
    };

    this.branchIsolation.mergeBranchFilter(where, 'branchCode', filter.branchCode);

    if (filter.partCategoryCode && filter.partCategoryCode !== 'ALL') {
      where.partCategoryCode = filter.partCategoryCode;
    }

    let partyTypesList: string[] = [];
    if (filter.partyType && filter.partyType !== 'ALL') {
      partyTypesList = filter.partyType.split(',').map((s) => s.trim()).filter(Boolean);
      where.partyType = { in: partyTypesList };
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { partyCode: { contains: q, mode: 'insensitive' } },
        { partyName: { contains: q, mode: 'insensitive' } },
        { branchCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const snapshots = await this.prisma.targetVsAchievementSnapshot.findMany({
      where,
      orderBy: { currentSales: 'desc' },
    });

    // When partCategoryCode is ALL (or not filtered), consolidate rows by (branchCode, partyCode)
    let processedSnapshots: any[] = [];

    if (!filter.partCategoryCode || filter.partCategoryCode === 'ALL') {
      const consolidatedMap = new Map<string, any>();
      for (const r of snapshots) {
        const key = `${r.branchCode}_${r.partyCode}`;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            id: key,
            branchCode: r.branchCode,
            branchName: r.branchName,
            partyCode: r.partyCode,
            partyName: r.partyName,
            partyType: r.partyType,
            salesExecutive: r.salesExecutive,
            partCategoryCode: 'ALL',
            lySameMonthSales: 0,
            lastMonthSales: 0,
            lastQuarterAvg: 0,
            lastFyAvg: 0,
            avgSaleLast6Month: 0,
            weightedBase: 0,
            recommendedTarget: 0,
            gapAdjustment: 0,
            systemSuggestedTarget: 0,
            adminDefinedTarget: 0,
            finalTarget: 0,
            currentSales: 0,
            ytdSales: 0,
            lastYearYTDSales: 0,
            targetStatus: r.targetStatus,
          });
        }
        const item = consolidatedMap.get(key);
        item.lySameMonthSales += Number(r.lySameMonthSales) || 0;
        item.lastMonthSales += Number(r.lastMonthSales) || 0;
        item.lastQuarterAvg += Number(r.lastQuarterAvg) || 0;
        item.lastFyAvg += Number(r.lastFyAvg) || 0;
        item.avgSaleLast6Month += Number(r.avgSaleLast6Month) || 0;
        item.weightedBase += Number(r.weightedBase) || 0;
        item.recommendedTarget += Number(r.recommendedTarget) || 0;
        item.gapAdjustment += Number(r.gapAdjustment) || 0;
        item.systemSuggestedTarget += Number(r.systemSuggestedTarget) || 0;
        if (Number(r.adminDefinedTarget) > 0) item.adminDefinedTarget += Number(r.adminDefinedTarget);
        item.finalTarget += Number(r.finalTarget) || 0;
        item.currentSales += Number(r.currentSales) || 0;
        item.ytdSales += Number(r.ytdSales) || 0;
        item.lastYearYTDSales += Number(r.lastYearYTDSales) || 0;
      }
      processedSnapshots = Array.from(consolidatedMap.values());
      processedSnapshots.sort((a, b) => b.currentSales - a.currentSales);
    } else {
      processedSnapshots = snapshots;
    }

    // Totals for Bento KPIs & Guardrail Audit
    let totalFinalTarget = 0;
    let totalCurrentSales = 0;
    let totalLastMonthSales = 0;
    let totalYTDSales = 0;
    let totalLastYearYTDSales = 0;
    let totalLySameMonth = 0;
    let totalWeightedBase = 0;
    let totalRecommendedTarget = 0;
    let totalGapAdjustment = 0;

    const formattedRows = processedSnapshots.map((r, index) => {
      const currentSales = Number(r.currentSales) || 0;
      const rawFinalTarget = Number(r.finalTarget) || 0;
      const finalTarget = Math.round(rawFinalTarget / 1000) * 1000;
      const weightedBase = Math.round(Number(r.weightedBase) || 0);
      const recommendedTarget = Math.round(Number(r.recommendedTarget) || 0);
      const gapAdjustment = Math.round(Number(r.gapAdjustment) || 0);
      const lySameMonthSales = Number(r.lySameMonthSales) || 0;
      const lastMonthSales = Number(r.lastMonthSales) || 0;
      const lastQuarterAvg = Number(r.lastQuarterAvg) || 0;
      const lastFyAvg = Number(r.lastFyAvg) || 0;
      const avgSaleLast6Month = Number(r.avgSaleLast6Month) || 0;
      const adminDefinedTarget = Number(r.adminDefinedTarget) || 0;
      const ytdSales = Number(r.ytdSales) || 0;
      const lastYearYTDSales = Number(r.lastYearYTDSales) || 0;

      totalFinalTarget += finalTarget;
      totalCurrentSales += currentSales;
      totalLastMonthSales += lastMonthSales;
      totalYTDSales += ytdSales;
      totalLastYearYTDSales += lastYearYTDSales;
      totalLySameMonth += lySameMonthSales;
      totalWeightedBase += weightedBase;
      totalRecommendedTarget += recommendedTarget;
      totalGapAdjustment += gapAdjustment;

      const achievementPercent = finalTarget > 0 ? Math.round((currentSales / finalTarget) * 1000) / 10 : 0;
      const yoyGrowthPercent = lastYearYTDSales > 0 ? Math.round(((ytdSales - lastYearYTDSales) / lastYearYTDSales) * 1000) / 10 : 0;

      return {
        id: r.id || `${r.partyCode}_${r.branchCode}_${index}`,
        rank: index + 1,
        branchCode: r.branchCode,
        branchName: r.branchName || r.branchCode,
        partyCode: r.partyCode,
        partyName: r.partyName,
        partyType: r.partyType,
        partCategoryCode: r.partCategoryCode || 'ALL',
        executiveName: r.salesExecutive || 'Branch Owned',

        // 4 Weighted Components
        lySameMonthSales,
        lastMonthSales,
        lastQuarterAvg,
        lastFyAvg,
        avgSaleLast6Month,

        // Engine Outputs
        weightedBase,
        recommendedTarget,
        gapAdjustment,
        systemSuggestedTarget: Number(r.systemSuggestedTarget) || recommendedTarget + gapAdjustment,
        adminDefinedTarget: adminDefinedTarget > 0 ? adminDefinedTarget : null,
        finalTarget,

        // Sales & Growth
        currentSales,
        achievementPercent,
        ytdSales,
        lastYearYTDSales,
        yoyGrowthPercent,
        targetStatus: r.targetStatus || 'DRAFT',
      };
    });

    const overallAchievementPercent =
      totalFinalTarget > 0 ? Math.round((totalCurrentSales / totalFinalTarget) * 1000) / 10 : 0;
    const overallYoYGrowthPercent =
      totalLastYearYTDSales > 0
        ? Math.round(((totalYTDSales - totalLastYearYTDSales) / totalLastYearYTDSales) * 1000) / 10
        : 0;

    const overallFloor = Math.round(totalLySameMonth * 1.15);
    const isFloorPassed = totalRecommendedTarget >= overallFloor;

    // Pagination
    const page = Number(filter.page) || 1;
    const pageSizeParam = filter.pageSize;
    const pageSizeNum =
      String(pageSizeParam).toUpperCase() === 'ALL' || Number(pageSizeParam) === -1 || Number(pageSizeParam) >= 10000
        ? formattedRows.length || 1
        : Number(pageSizeParam) || 100;

    const startIndex = (page - 1) * pageSizeNum;
    const paginatedItems =
      pageSizeNum >= formattedRows.length
        ? formattedRows
        : formattedRows.slice(startIndex, startIndex + pageSizeNum);

    return {
      summary: {
        totalTarget: totalFinalTarget,
        totalCurrentSales,
        overallAchievementPercent,
        overallYoYGrowthPercent,
        totalDealers: formattedRows.length,
        fiscalYear: targetFY,
        month: targetMonth,
        targetStatus: snapshots[0]?.targetStatus || 'DRAFT',
        guardrail: {
          totalLySameMonth,
          overallFloor,
          totalRecommendedTarget,
          totalGapAdjustment,
          isFloorPassed,
          status: isFloorPassed ? 'ACCEPT' : 'GAP_DISTRIBUTED',
        },
      },
      ...buildPaginatedResponse(paginatedItems, formattedRows.length, page, pageSizeNum),
    };
  }

  // ─── TARGET WORKFLOW: APPROVE & LOCK TARGETS ──────────────────────────────────
  async lockTargets(fiscalYear: number, month: string, lockedBy: string) {
    const updated = await this.prisma.targetVsAchievementSnapshot.updateMany({
      where: { fiscalYear, month },
      data: {
        targetStatus: 'LOCKED',
        lockedAt: new Date(),
        lockedBy,
      },
    });

    return {
      ok: true,
      message: `Targets for ${month} ${fiscalYear} have been APPROVED & LOCKED (${updated.count} dealers locked).`,
    };
  }

  async unlockTargets(fiscalYear: number, month: string) {
    const updated = await this.prisma.targetVsAchievementSnapshot.updateMany({
      where: { fiscalYear, month },
      data: {
        targetStatus: 'DRAFT',
        lockedAt: null,
        lockedBy: null,
      },
    });

    return {
      ok: true,
      message: `Targets for ${month} ${fiscalYear} unlocked to DRAFT mode.`,
    };
  }

  // Update single party admin target
  async updateDealerTarget(data: {
    partyCode: string;
    partyName?: string;
    branchCode: string;
    fiscalYear: number;
    month: string;
    targetAmount: number;
    updatedBy?: string;
  }) {
    const MONTH_NUMBER_MAP: Record<string, number> = {
      Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12, Jan: 1, Feb: 2, Mar: 3
    };
    const monthNum = MONTH_NUMBER_MAP[data.month] || 8;

    const party = await this.prisma.party.findFirst({
      where: { code: data.partyCode },
    });

    const existing = await this.prisma.dealerTarget.findFirst({
      where: {
        partyCode: data.partyCode,
        year: data.fiscalYear,
        month: monthNum,
      },
    });

    if (existing) {
      await this.prisma.dealerTarget.update({
        where: { id: existing.id },
        data: {
          adminDefinedTarget: data.targetAmount,
          finalTarget: data.targetAmount,
          targetAmount: data.targetAmount,
          updatedBy: data.updatedBy || 'SYSTEM',
        },
      });
    } else {
      await this.prisma.dealerTarget.create({
        data: {
          partyId: party ? party.id : '00000000-0000-0000-0000-000000000000',
          partyCode: data.partyCode,
          partyName: data.partyName || data.partyCode,
          branchCode: data.branchCode,
          year: data.fiscalYear,
          month: monthNum,
          systemSuggestedTarget: 0,
          adminDefinedTarget: data.targetAmount,
          finalTarget: data.targetAmount,
          targetAmount: data.targetAmount,
          createdBy: data.updatedBy || 'SYSTEM',
        },
      });
    }

    // Update in snapshot cache
    await this.prisma.targetVsAchievementSnapshot.updateMany({
      where: {
        partyCode: data.partyCode,
        fiscalYear: data.fiscalYear,
        month: data.month,
      },
      data: {
        adminDefinedTarget: data.targetAmount,
        finalTarget: data.targetAmount,
      },
    });

    return { ok: true, message: `Target updated for ${data.partyCode}` };
  }

  // Bulk Target Adjustment
  async bulkAdjustTargets(data: {
    fiscalYear: number;
    month: string;
    flatTargetAmount?: number;
    partyCodes: string[];
    updatedBy?: string;
  }) {
    let updatedCount = 0;
    for (const code of data.partyCodes) {
      if (data.flatTargetAmount && data.flatTargetAmount > 0) {
        await this.updateDealerTarget({
          partyCode: code,
          branchCode: 'ALL',
          fiscalYear: data.fiscalYear,
          month: data.month,
          targetAmount: data.flatTargetAmount,
          updatedBy: data.updatedBy,
        });
        updatedCount++;
      }
    }
    return { ok: true, message: `Updated targets for ${updatedCount} dealers` };
  }

  async exportReportToExcel(reportName: string, data: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportName);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.columns = headers.map((h) => ({ header: h, key: h, width: 22 }));
      data.forEach((row) => worksheet.addRow(row));

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B1C30' },
      };
    }

    return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  }
}
