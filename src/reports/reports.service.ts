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

  // ─── COMPREHENSIVE MULTI-PERIOD & TARGET MATRIX ───────────────────────────
  async calculateMultiPeriodMatrix(
    targetFY: number,
    targetMonth: string,
    branchFilter?: string | null,
    catFilter?: string | null,
    metadata?: any,
  ): Promise<any[]> {
    const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthIdx = MONTH_ORDER.indexOf(targetMonth) >= 0 ? MONTH_ORDER.indexOf(targetMonth) : 5;
    const prevMonth = monthIdx === 0 ? 'Mar' : MONTH_ORDER[monthIdx - 1];
    const prevMonthFY = monthIdx === 0 ? targetFY - 1 : targetFY;

    const lyMonth = targetMonth;
    const lyFY = targetFY - 1;
    const lyPrevMonth = prevMonth;
    const lyPrevMonthFY = prevMonthFY - 1;

    const ly2Month = targetMonth;
    const ly2FY = targetFY - 2;
    const ly2PrevMonth = prevMonth;
    const ly2PrevMonthFY = prevMonthFY - 2;

    // Quarters setup
    let curQuarterMonths = ['Jul', 'Aug', 'Sep'];
    let curQuarterTillMonths = ['Jul', 'Aug', 'Sep'];
    let prevQuarterMonths = ['Apr', 'May', 'Jun'];
    let prevQuarterTillMonths = ['Apr', 'May', 'Jun'];
    let prevQuarterFY = targetFY;

    let q1CurTillMonths = ['Apr', 'May', 'Jun'];
    let q1LyTillMonths = ['Apr', 'May', 'Jun'];
    let q2CurTillMonths = ['Jul', 'Aug', 'Sep'];
    let q2LyTillMonths = ['Jul', 'Aug', 'Sep'];

    if (monthIdx <= 2) {
      curQuarterMonths = ['Apr', 'May', 'Jun'];
      curQuarterTillMonths = MONTH_ORDER.slice(0, monthIdx + 1);
      prevQuarterMonths = ['Jan', 'Feb', 'Mar'];
      prevQuarterTillMonths = ['Jan', 'Feb', 'Mar'];
      prevQuarterFY = targetFY - 1;

      q1CurTillMonths = MONTH_ORDER.slice(0, monthIdx + 1);
      q1LyTillMonths = MONTH_ORDER.slice(0, monthIdx + 1);
      q2CurTillMonths = [];
      q2LyTillMonths = [];
    } else if (monthIdx >= 3 && monthIdx <= 5) {
      curQuarterMonths = ['Jul', 'Aug', 'Sep'];
      curQuarterTillMonths = MONTH_ORDER.slice(3, monthIdx + 1);
      prevQuarterMonths = ['Apr', 'May', 'Jun'];
      prevQuarterTillMonths = ['Apr', 'May', 'Jun'];
      prevQuarterFY = targetFY;

      q1CurTillMonths = ['Apr', 'May', 'Jun'];
      q1LyTillMonths = ['Apr', 'May', 'Jun'];
      q2CurTillMonths = MONTH_ORDER.slice(3, monthIdx + 1);
      q2LyTillMonths = MONTH_ORDER.slice(3, monthIdx + 1);
    } else if (monthIdx >= 6 && monthIdx <= 8) {
      curQuarterMonths = ['Oct', 'Nov', 'Dec'];
      curQuarterTillMonths = MONTH_ORDER.slice(6, monthIdx + 1);
      prevQuarterMonths = ['Jul', 'Aug', 'Sep'];
      prevQuarterTillMonths = ['Jul', 'Aug', 'Sep'];
      prevQuarterFY = targetFY;

      q1CurTillMonths = ['Apr', 'May', 'Jun'];
      q1LyTillMonths = ['Apr', 'May', 'Jun'];
      q2CurTillMonths = ['Jul', 'Aug', 'Sep'];
      q2LyTillMonths = ['Jul', 'Aug', 'Sep'];
    } else {
      curQuarterMonths = ['Jan', 'Feb', 'Mar'];
      curQuarterTillMonths = MONTH_ORDER.slice(9, monthIdx + 1);
      prevQuarterMonths = ['Oct', 'Nov', 'Dec'];
      prevQuarterTillMonths = ['Oct', 'Nov', 'Dec'];
      prevQuarterFY = targetFY;

      q1CurTillMonths = ['Apr', 'May', 'Jun'];
      q1LyTillMonths = ['Apr', 'May', 'Jun'];
      q2CurTillMonths = ['Jul', 'Aug', 'Sep'];
      q2LyTillMonths = ['Jul', 'Aug', 'Sep'];
    }

    const ytdMonths = MONTH_ORDER.slice(0, monthIdx + 1);
    const fy0 = targetFY - 3;
    const fy1 = targetFY - 2;
    const fy2 = targetFY - 1;
    const fy3 = targetFY;

    let branchSqlClause = '';
    if (branchFilter && branchFilter !== 'ALL') {
      branchSqlClause = `AND loc = '${branchFilter.replace(/'/g, "''")}'`;
    }
    let catSqlClause = '';
    if (catFilter && catFilter !== 'ALL') {
      catSqlClause = `AND part_category_code = '${catFilter.replace(/'/g, "''")}'`;
    }

    const q1CurTillClause = q1CurTillMonths.length > 0 ? `month IN ('${q1CurTillMonths.join("','")}')` : `1=0`;
    const q1LyTillClause = q1LyTillMonths.length > 0 ? `month IN ('${q1LyTillMonths.join("','")}')` : `1=0`;
    const q2CurTillClause = q2CurTillMonths.length > 0 ? `month IN ('${q2CurTillMonths.join("','")}')` : `1=0`;
    const q2LyTillClause = q2LyTillMonths.length > 0 ? `month IN ('${q2LyTillMonths.join("','")}')` : `1=0`;

    const rawRows: any[] = await this.prisma.$queryRawUnsafe(`
      WITH 
      cur_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          MAX(COALESCE(cons_party_name, dealer_code)) AS party_name, 
          COALESCE(party_type, 'TRADER/RETAILER') AS party_type,
          COUNT(DISTINCT part_num) AS unique_partlines,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS cur_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month = '${targetMonth}'
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M'), party_type
      ),
      last_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS lm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${prevMonthFY} AND month = '${prevMonth}'
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ly_same_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          MAX(COALESCE(cons_party_name, dealer_code)) AS party_name, 
          COALESCE(party_type, 'TRADER/RETAILER') AS party_type,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ly_sm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${lyFY} AND month = '${lyMonth}'
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M'), party_type
      ),
      ly_prev_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ly_pm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${lyPrevMonthFY} AND month = '${lyPrevMonth}'
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ly2_prev_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ly2_pm_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${ly2PrevMonthFY} AND month = '${ly2PrevMonth}'
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q1_cur_total AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q1_cur_total_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month IN ('Apr', 'May', 'Jun')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q1_cur_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q1_cur_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND ${q1CurTillClause}
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q1_ly_total AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q1_ly_total_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND month IN ('Apr', 'May', 'Jun')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q1_ly_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q1_ly_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND ${q1LyTillClause}
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q2_cur_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q2_cur_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND ${q2CurTillClause}
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      q2_ly_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS q2_ly_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND ${q2LyTillClause}
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ytd_cur AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ytd_cur_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      ytd_ly AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS ytd_ly_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      fy_totals AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy0} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy0_total,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy1} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy1_total,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy2} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy2_total,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy3} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy3_total
        FROM retail_sales_records
        WHERE fiscal_year IN (${fy0}, ${fy1}, ${fy2}, ${fy3})
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      target_bases AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND((SUM(CASE WHEN fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterMonths.join("','")}') THEN net_retail_selling ELSE 0 END) / 3)::numeric, 2) AS lq_avg,
          ROUND((SUM(CASE WHEN fiscal_year = ${targetFY - 1} THEN net_retail_selling ELSE 0 END) / 12)::numeric, 2) AS lfy_avg
        FROM retail_sales_records
        WHERE (fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterMonths.join("','")}')) OR fiscal_year = ${targetFY - 1}
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      snapshots AS (
        SELECT 
          branch_code,
          party_code,
          COALESCE(part_category_code, 'M') AS cat,
          party_name,
          party_type
        FROM target_vs_achievement_snapshots
        WHERE fiscal_year = ${targetFY} AND month = '${targetMonth}'
          ${branchFilter && branchFilter !== 'ALL' ? `AND branch_code = '${branchFilter.replace(/'/g, "''")}'` : ''}
          ${catFilter && catFilter !== 'ALL' ? `AND part_category_code = '${catFilter.replace(/'/g, "''")}'` : ''}
      ),
      all_parties AS (
        SELECT branch_code, party_code, cat FROM cur_month
        UNION
        SELECT branch_code, party_code, cat FROM last_month
        UNION
        SELECT branch_code, party_code, cat FROM ly_same_month
        UNION
        SELECT branch_code, party_code, cat FROM snapshots
      )
      SELECT 
        ap.branch_code AS "branchCode",
        ap.party_code AS "partyCode",
        ap.cat AS "partCategoryCode",
        COALESCE(NULLIF(cm.party_name, '-'), NULLIF(ly.party_name, '-'), NULLIF(sn.party_name, '-'), ap.party_code) AS "partyName",
        COALESCE(NULLIF(cm.party_type, '-'), NULLIF(ly.party_type, '-'), NULLIF(sn.party_type, '-'), 'TRADER/RETAILER') AS "partyType",
        COALESCE(cm.cur_sales, 0) AS "curSales",
        COALESCE(cm.unique_partlines, 0) AS "uniquePartlines",
        COALESCE(lm.lm_sales, 0) AS "lmSales",
        COALESCE(ly.ly_sm_sales, 0) AS "lySameMonthSales",
        COALESCE(lp.ly_pm_sales, 0) AS "lyPrevMonthSales",
        COALESCE(l2p.ly2_pm_sales, 0) AS "ly2PrevMonthSales",
        COALESCE(q1c.q1_cur_total_sales, 0) AS "q1CurTotalSales",
        COALESCE(q1ct.q1_cur_till_sales, 0) AS "q1CurTillSales",
        COALESCE(q1l.q1_ly_total_sales, 0) AS "q1LyTotalSales",
        COALESCE(q1lt.q1_ly_till_sales, 0) AS "q1LyTillSales",
        COALESCE(q2c.q2_cur_till_sales, 0) AS "q2CurTillSales",
        COALESCE(q2l.q2_ly_till_sales, 0) AS "q2LyTillSales",
        COALESCE(yc.ytd_cur_sales, 0) AS "ytdCurSales",
        COALESCE(yl.ytd_ly_sales, 0) AS "ytdLySales",
        COALESCE(ft.fy0_total, 0) AS "fy0Total",
        COALESCE(ft.fy1_total, 0) AS "fy1Total",
        COALESCE(ft.fy2_total, 0) AS "fy2Total",
        COALESCE(ft.fy3_total, 0) AS "fy3Total",
        COALESCE(tb.lq_avg, 0) AS "lastQuarterAvg",
        COALESCE(tb.lfy_avg, 0) AS "lastFyAvg",
        COALESCE(dt.admin_defined_target, 0) AS "adminDefinedTarget"
      FROM all_parties ap
      LEFT JOIN cur_month cm ON ap.branch_code = cm.branch_code AND ap.party_code = cm.party_code AND ap.cat = cm.cat
      LEFT JOIN last_month lm ON ap.branch_code = lm.branch_code AND ap.party_code = lm.party_code AND ap.cat = lm.cat
      LEFT JOIN ly_same_month ly ON ap.branch_code = ly.branch_code AND ap.party_code = ly.party_code AND ap.cat = ly.cat
      LEFT JOIN snapshots sn ON ap.branch_code = sn.branch_code AND ap.party_code = sn.party_code AND ap.cat = sn.cat
      LEFT JOIN ly_prev_month lp ON ap.branch_code = lp.branch_code AND ap.party_code = lp.party_code AND ap.cat = lp.cat
      LEFT JOIN ly2_prev_month l2p ON ap.branch_code = l2p.branch_code AND ap.party_code = l2p.party_code AND ap.cat = l2p.cat
      LEFT JOIN q1_cur_total q1c ON ap.branch_code = q1c.branch_code AND ap.party_code = q1c.party_code AND ap.cat = q1c.cat
      LEFT JOIN q1_cur_till q1ct ON ap.branch_code = q1ct.branch_code AND ap.party_code = q1ct.party_code AND ap.cat = q1ct.cat
      LEFT JOIN q1_ly_total q1l ON ap.branch_code = q1l.branch_code AND ap.party_code = q1l.party_code AND ap.cat = q1l.cat
      LEFT JOIN q1_ly_till q1lt ON ap.branch_code = q1lt.branch_code AND ap.party_code = q1lt.party_code AND ap.cat = q1lt.cat
      LEFT JOIN q2_cur_till q2c ON ap.branch_code = q2c.branch_code AND ap.party_code = q2c.party_code AND ap.cat = q2c.cat
      LEFT JOIN q2_ly_till q2l ON ap.branch_code = q2l.branch_code AND ap.party_code = q2l.party_code AND ap.cat = q2l.cat
      LEFT JOIN ytd_cur yc ON ap.branch_code = yc.branch_code AND ap.party_code = yc.party_code AND ap.cat = yc.cat
      LEFT JOIN ytd_ly yl ON ap.branch_code = yl.branch_code AND ap.party_code = yl.party_code AND ap.cat = yl.cat
      LEFT JOIN fy_totals ft ON ap.branch_code = ft.branch_code AND ap.party_code = ft.party_code AND ap.cat = ft.cat
      LEFT JOIN target_bases tb ON ap.branch_code = tb.branch_code AND ap.party_code = tb.party_code AND ap.cat = tb.cat
      LEFT JOIN dealer_targets dt ON ap.party_code = dt.party_code AND dt.year = ${targetFY} AND dt.month = ${monthIdx + 1} AND dt.part_category_code = ap.cat
      ORDER BY COALESCE(cm.cur_sales, lm.lm_sales, ly.ly_sm_sales, 0) DESC;
    `);

    // Master maps
    const [parties, partyMasters, branches] = await Promise.all([
      this.prisma.party.findMany({ select: { code: true, name: true, type: true, primaryBranchCode: true } }),
      this.prisma.partyMaster.findMany({ select: { consPartyCode: true, originalCode: true, consPartyName: true, partyType: true, baseLoc: true } }),
      this.prisma.branch.findMany({ select: { code: true, name: true } }),
    ]);
    const partyMap = new Map<string, any>();
    parties.forEach((p) => partyMap.set(p.code.toUpperCase(), p));
    const partyMasterMap = new Map<string, any>();
    partyMasters.forEach((pm) => partyMasterMap.set(pm.consPartyCode.toUpperCase(), pm));
    const branchMap = new Map<string, string>();
    branches.forEach((b) => branchMap.set(b.code.toUpperCase(), b.name));

    // Consolidate rows:
    // When no branchFilter (or branchFilter === 'ALL'), roll up all multi-branch sales into the party's primary base branch.
    // When branchFilter is specific, group per that branch.
    const isAllBranches = !branchFilter || branchFilter === 'ALL';
    const isAllCats = !catFilter || catFilter === 'ALL';

    const consolidatedMap = new Map<string, any>();
    for (const r of rawRows) {
      const pCode = (r.partyCode || '-').toUpperCase();
      const pmRecord = partyMasterMap.get(pCode);
      const pMaster = partyMap.get(pCode);

      const primaryBranch = pmRecord?.baseLoc || pMaster?.primaryBranchCode || r.branchCode || 'VBZ';
      const primaryBranchName = branchMap.get(primaryBranch.toUpperCase()) || primaryBranch;
      const primaryPartyType = pmRecord?.partyType || r.partyType || pMaster?.type || 'INDEPENDENT WORKSHOP';
      const primaryPartyName = pmRecord?.consPartyName || pMaster?.name || r.partyName || r.partyCode;

      const key = isAllBranches
        ? (isAllCats ? pCode : `${pCode}_${r.partCategoryCode}`)
        : (isAllCats ? `${r.branchCode}_${pCode}` : `${r.branchCode}_${pCode}_${r.partCategoryCode}`);

      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, {
          branchCode: isAllBranches ? primaryBranch : r.branchCode,
          branchName: isAllBranches ? primaryBranchName : (branchMap.get(r.branchCode.toUpperCase()) || r.branchCode),
          partyCode: r.partyCode,
          partCategoryCode: isAllCats ? 'ALL' : r.partCategoryCode,
          partyName: primaryPartyName,
          partyType: primaryPartyType,
          curSales: 0,
          uniquePartlines: 0,
          lmSales: 0,
          lySameMonthSales: 0,
          lyPrevMonthSales: 0,
          ly2PrevMonthSales: 0,
          q1CurTotalSales: 0,
          q1CurTillSales: 0,
          q1LyTotalSales: 0,
          q1LyTillSales: 0,
          q2CurTillSales: 0,
          q2LyTillSales: 0,
          ytdCurSales: 0,
          ytdLySales: 0,
          fy0Total: 0,
          fy1Total: 0,
          fy2Total: 0,
          fy3Total: 0,
          lastQuarterAvg: 0,
          lastFyAvg: 0,
          adminDefinedTarget: 0,
        });
      }
      const item = consolidatedMap.get(key);
      item.curSales += Number(r.curSales) || 0;
      item.uniquePartlines = Math.max(item.uniquePartlines, Number(r.uniquePartlines) || 0);
      item.lmSales += Number(r.lmSales) || 0;
      item.lySameMonthSales += Number(r.lySameMonthSales) || 0;
      item.lyPrevMonthSales += Number(r.lyPrevMonthSales) || 0;
      item.ly2PrevMonthSales += Number(r.ly2PrevMonthSales) || 0;
      item.q1CurTotalSales += Number(r.q1CurTotalSales) || 0;
      item.q1CurTillSales += Number(r.q1CurTillSales) || 0;
      item.q1LyTotalSales += Number(r.q1LyTotalSales) || 0;
      item.q1LyTillSales += Number(r.q1LyTillSales) || 0;
      item.q2CurTillSales += Number(r.q2CurTillSales) || 0;
      item.q2LyTillSales += Number(r.q2LyTillSales) || 0;
      item.ytdCurSales += Number(r.ytdCurSales) || 0;
      item.ytdLySales += Number(r.ytdLySales) || 0;
      item.fy0Total += Number(r.fy0Total) || 0;
      item.fy1Total += Number(r.fy1Total) || 0;
      item.fy2Total += Number(r.fy2Total) || 0;
      item.fy3Total += Number(r.fy3Total) || 0;
      item.lastQuarterAvg += Number(r.lastQuarterAvg) || 0;
      item.lastFyAvg += Number(r.lastFyAvg) || 0;
      if (Number(r.adminDefinedTarget) > 0) item.adminDefinedTarget += Number(r.adminDefinedTarget);
    }
    let processedRows: any[] = Array.from(consolidatedMap.values());

    if (metadata?.partyType && metadata.partyType !== 'ALL') {
      const pTypes = metadata.partyType.split(',').map((t: string) => t.trim().toUpperCase());
      processedRows = processedRows.filter((r) => {
        const pmRecord = partyMasterMap.get(r.partyCode.toUpperCase());
        const pt = (pmRecord?.partyType || r.partyType || partyMap.get(r.partyCode.toUpperCase())?.type || '').toUpperCase();
        return pTypes.includes(pt) || (pt === 'DEALER' && pTypes.some((x: string) => x.includes('TRADER') || x.includes('DEALER')));
      });
    }

    if (metadata?.search && metadata.search.trim()) {
      const q = metadata.search.trim().toLowerCase();
      processedRows = processedRows.filter((r) => {
        const pMaster = partyMap.get(r.partyCode.toUpperCase());
        const pmRecord = partyMasterMap.get(r.partyCode.toUpperCase());
        const pName = (pmRecord?.consPartyName || pMaster?.name || r.partyName || '').toLowerCase();
        const pCode = (r.partyCode || '').toLowerCase();
        const origCode = (pmRecord?.originalCode || '').toLowerCase();
        const bCode = (r.branchCode || '').toLowerCase();
        const bName = (branchMap.get(r.branchCode.toUpperCase()) || '').toLowerCase();
        return pName.includes(q) || pCode.includes(q) || origCode.includes(q) || bCode.includes(q) || bName.includes(q);
      });
    }

    // Fetch snapshots
    const snapshotTargets = await this.prisma.targetVsAchievementSnapshot.findMany({
      where: { fiscalYear: targetFY, month: targetMonth },
      select: {
        branchCode: true,
        partyCode: true,
        partCategoryCode: true,
        weightedBase: true,
        recommendedTarget: true,
        gapAdjustment: true,
        adminDefinedTarget: true,
        finalTarget: true,
      },
    });
    const snapshotMap = new Map<string, any>();
    snapshotTargets.forEach((st) => {
      const pCode = st.partyCode.toUpperCase();
      const cat = (st.partCategoryCode || 'ALL').toUpperCase();
      const bCode = st.branchCode.toUpperCase();

      const k = isAllBranches
        ? (isAllCats ? pCode : `${pCode}_${cat}`)
        : (isAllCats ? `${bCode}_${pCode}` : `${bCode}_${pCode}_${cat}`);

      if (!snapshotMap.has(k)) {
        snapshotMap.set(k, {
          branchCode: st.branchCode,
          partyCode: st.partyCode,
          partCategoryCode: isAllCats ? 'ALL' : st.partCategoryCode,
          weightedBase: 0,
          recommendedTarget: 0,
          adminDefinedTarget: 0,
          finalTarget: 0,
        });
      }
      const allObj = snapshotMap.get(k);
      allObj.weightedBase += Number(st.weightedBase) || 0;
      allObj.recommendedTarget += Number(st.recommendedTarget) || 0;
      if (Number(st.adminDefinedTarget) > 0) allObj.adminDefinedTarget += Number(st.adminDefinedTarget);
      allObj.finalTarget += Number(st.finalTarget) || 0;
    });

    const calculatedRows = processedRows.map((r, idx) => {
      const pMaster = partyMap.get(r.partyCode.toUpperCase());
      const pmRecord = partyMasterMap.get(r.partyCode.toUpperCase());
      const originalCode = pmRecord?.originalCode || r.partyCode || '-';
      const partyName = pmRecord?.consPartyName || pMaster?.name || r.partyName || r.partyCode;
      const partyType = pmRecord?.partyType || r.partyType || pMaster?.type || 'INDEPENDENT WORKSHOP';
      const branchName = r.branchName || branchMap.get(r.branchCode.toUpperCase()) || r.branchCode;

      const curSales = Number(r.curSales) || 0;
      const uniquePartlines = Number(r.uniquePartlines) || 0;
      const lmSales = Number(r.lmSales) || 0;
      const lySameMonthSales = Number(r.lySameMonthSales) || 0;
      const lyPrevMonthSales = Number(r.lyPrevMonthSales) || 0;
      const ly2PrevMonthSales = Number(r.ly2PrevMonthSales) || 0;

      const q1CurTotalSales = Number(r.q1CurTotalSales) || 0;
      const q1CurTillSales = Number(r.q1CurTillSales) || 0;
      const q1LyTotalSales = Number(r.q1LyTotalSales) || 0;
      const q1LyTillSales = Number(r.q1LyTillSales) || 0;
      const q2CurTillSales = Number(r.q2CurTillSales) || 0;
      const q2LyTillSales = Number(r.q2LyTillSales) || 0;

      const ytdCurSales = Number(r.ytdCurSales) || 0;
      const ytdLySales = Number(r.ytdLySales) || 0;

      const fy0Total = Number(r.fy0Total) || 0;
      const fy1Total = Number(r.fy1Total) || 0;
      const fy2Total = Number(r.fy2Total) || 0;
      const fy3Total = Number(r.fy3Total) || 0;

      const lqAvg = Number(r.lastQuarterAvg) || 0;
      const lfyAvg = Number(r.lastFyAvg) || 0;

      const pCode = r.partyCode.toUpperCase();
      const cat = (r.partCategoryCode || 'ALL').toUpperCase();
      const bCode = r.branchCode.toUpperCase();
      const snapKey = isAllBranches
        ? (isAllCats ? pCode : `${pCode}_${cat}`)
        : (isAllCats ? `${bCode}_${pCode}` : `${bCode}_${pCode}_${cat}`);

      const snap = snapshotMap.get(snapKey);
      const snapFinalTarget = snap ? Number(snap.finalTarget) || 0 : 0;
      const snapRecTarget = snap ? Number(snap.recommendedTarget) || 0 : 0;
      const snapWeightedBase = snap ? Number(snap.weightedBase) || 0 : 0;
      const snapAdminTarget = snap ? Number(snap.adminDefinedTarget) || 0 : 0;

      let weightedBase = snapWeightedBase > 0 ? snapWeightedBase : (lySameMonthSales * 0.40) + (lmSales * 0.25) + (lqAvg * 0.20) + (lfyAvg * 0.15);
      if (weightedBase === 0) {
        weightedBase = lmSales > 0 ? lmSales : lqAvg > 0 ? lqAvg : curSales;
      }
      weightedBase = Math.round(weightedBase);

      const recommendedTarget = snapRecTarget > 0 ? snapRecTarget : Math.round(weightedBase * 1.10);
      const adminDefinedTarget = Number(r.adminDefinedTarget) > 0 ? Number(r.adminDefinedTarget) : snapAdminTarget;
      const finalTarget = adminDefinedTarget > 0 ? adminDefinedTarget : (snapFinalTarget > 0 ? snapFinalTarget : recommendedTarget);

      // Growth Calculations
      const mtdLyGrowth = lySameMonthSales > 0 ? ((curSales - lySameMonthSales) / lySameMonthSales) : 0;
      const mtdLmGrowth = lmSales > 0 ? ((curSales - lmSales) / lmSales) : 0;

      const q2Growth = q2LyTillSales > 0 ? ((q2CurTillSales - q2LyTillSales) / q2LyTillSales) : 0;
      const ytdGrowth = ytdLySales > 0 ? ((ytdCurSales - ytdLySales) / ytdLySales) : 0;
      const fyYoYGrowth = fy2Total > 0 ? ((fy3Total - fy2Total) / fy2Total) : 0;

      const achievementPercent = finalTarget > 0 ? (curSales / finalTarget) : 0;
      const status = achievementPercent >= 1.0 ? 'ACHIEVED' : achievementPercent >= 0.70 ? 'ON TRACK' : 'UNDER TARGET';

      return {
        rank: idx + 1,
        branchCode: r.branchCode,
        branchName,
        partyCode: r.partyCode,
        originalCode,
        partyName,
        partyType,
        partCategoryCode: r.partCategoryCode,
        uniquePartlines,

        // 4 Multi-Year Historical Totals
        fy0Total,
        fy1Total,
        fy2Total,
        fy3Total,
        fyYoYGrowth,

        // YTD
        ytdLy: ytdLySales,
        ytdCur: ytdCurSales,
        ytdGrowth,

        // Quarterly
        q1CurTotal: q1CurTotalSales,
        q1CurTill: q1CurTillSales,
        q1LyTotal: q1LyTotalSales,
        q1LyTill: q1LyTillSales,
        q2CurTill: q2CurTillSales,
        q2LyTill: q2LyTillSales,
        q2Growth,

        // Monthly
        mtdCur: curSales,
        lmTotal: lmSales,
        lmTill: lmSales,
        lySameMonthSales,
        mtdLyGrowth,
        mtdLmGrowth,

        // Target & Status
        weightedBase,
        recommendedTarget,
        finalTarget,
        currentSales: curSales,
        lastMonthSales: lmSales,
        ytdSales: ytdCurSales,
        lastYearYTDSales: ytdLySales,
        yoyGrowthPercent: ytdLySales > 0 ? Math.round(((ytdCurSales - ytdLySales) / ytdLySales) * 1000) / 10 : 0,
        achievementPercent: finalTarget > 0 ? Math.round((curSales / finalTarget) * 1000) / 10 : 0,
        status,
      };
    });

    calculatedRows.sort((a, b) => b.mtdCur - a.mtdCur || b.lmTotal - a.lmTotal);
    calculatedRows.forEach((r, i) => { r.rank = i + 1; });
    return calculatedRows;
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

    if ((filter as any).view === 'matrix' || (filter as any).includeMatrix === 'true' || (filter as any).includeMatrix === true) {
      const calculatedRows = await this.calculateMultiPeriodMatrix(
        targetFY,
        targetMonth,
        filter.branchCode && filter.branchCode !== 'ALL' ? filter.branchCode : null,
        filter.partCategoryCode && filter.partCategoryCode !== 'ALL' ? filter.partCategoryCode : null,
        { partyType: filter.partyType, search: filter.search }
      );

      const totalTarget = calculatedRows.reduce((s: number, x: any) => s + (Number(x.finalTarget) || 0), 0);
      const totalSales = calculatedRows.reduce((s: number, x: any) => s + (Number(x.mtdCur) || Number(x.currentSales) || 0), 0);
      const overallAch = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 1000) / 10 : 0;

      const page = Number(filter.page) || 1;
      const pageSizeParam = filter.pageSize;
      const pageSizeNum =
        String(pageSizeParam).toUpperCase() === 'ALL' || Number(pageSizeParam) === -1 || Number(pageSizeParam) >= 10000
          ? calculatedRows.length || 1
          : Number(pageSizeParam) || 100;

      const startIndex = (page - 1) * pageSizeNum;
      const paginatedItems =
        pageSizeNum >= calculatedRows.length
          ? calculatedRows
          : calculatedRows.slice(startIndex, startIndex + pageSizeNum);

      return {
        summary: {
          totalTarget,
          totalFinalTarget: totalTarget,
          totalCurrentSales: totalSales,
          overallAchievementPercent: overallAch,
          totalDealers: calculatedRows.length,
          fiscalYear: targetFY,
          month: targetMonth,
        },
        ...buildPaginatedResponse(paginatedItems, calculatedRows.length, page, pageSizeNum),
      };
    }

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

    // Consolidate snapshots
    const isAllBranchesFilter = !filter.branchCode || filter.branchCode === 'ALL';
    const isAllCatsFilter = !filter.partCategoryCode || filter.partCategoryCode === 'ALL';

    const [pmList, pList] = await Promise.all([
      this.prisma.partyMaster.findMany({ select: { consPartyCode: true, partyType: true, baseLoc: true, consPartyName: true } }),
      this.prisma.party.findMany({ select: { code: true, type: true, primaryBranchCode: true, name: true } }),
    ]);
    const pmLookup = new Map<string, any>();
    pmList.forEach((pm) => pmLookup.set(pm.consPartyCode.toUpperCase(), pm));
    const pLookup = new Map<string, any>();
    pList.forEach((p) => pLookup.set(p.code.toUpperCase(), p));

    let processedSnapshots: any[] = [];

    if (isAllBranchesFilter || isAllCatsFilter) {
      const consolidatedMap = new Map<string, any>();
      for (const r of snapshots) {
        const pCode = (r.partyCode || '-').toUpperCase();
        const pmRecord = pmLookup.get(pCode);
        const pMaster = pLookup.get(pCode);

        const primaryBranch = pmRecord?.baseLoc || pMaster?.primaryBranchCode || r.branchCode || 'VBZ';
        const primaryPartyType = pmRecord?.partyType || r.partyType || pMaster?.type || 'INDEPENDENT WORKSHOP';
        const primaryPartyName = pmRecord?.consPartyName || pMaster?.name || r.partyName || r.partyCode;

        const key = isAllBranchesFilter
          ? (isAllCatsFilter ? pCode : `${pCode}_${r.partCategoryCode}`)
          : (isAllCatsFilter ? `${r.branchCode}_${pCode}` : `${r.branchCode}_${pCode}_${r.partCategoryCode}`);

        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            id: key,
            branchCode: isAllBranchesFilter ? primaryBranch : r.branchCode,
            branchName: isAllBranchesFilter ? r.branchName : r.branchName,
            partyCode: r.partyCode,
            partyName: primaryPartyName,
            partyType: primaryPartyType,
            salesExecutive: r.salesExecutive,
            partCategoryCode: isAllCatsFilter ? 'ALL' : r.partCategoryCode,
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
      const pmRecord = pmLookup.get(r.partyCode.toUpperCase());
      const originalCode = pmRecord?.originalCode || r.partyCode || '-';
      const partyType = pmRecord?.partyType || r.partyType || 'INDEPENDENT WORKSHOP';

      return {
        id: r.id || `${r.partyCode}_${r.branchCode}_${index}`,
        rank: index + 1,
        branchCode: r.branchCode,
        branchName: r.branchName || r.branchCode,
        partyCode: r.partyCode,
        originalCode,
        partyName: r.partyName,
        partyType,
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
        totalFinalTarget,
        totalCurrentSales,
        totalLastMonthSales,
        totalYTDSales,
        totalLastYearYTDSales,
        totalLySameMonth,
        totalRecommendedTarget,
        totalWeightedBase,
        totalGapAdjustment,
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

  // ─── EXPORT REPORT TO EXCEL ───────────────────────────────────────────────
  async exportReportToExcel(reportName: string, data: any[], metadata: any = {}): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'The SS Buddy Intelligence Portal';
    workbook.lastModifiedBy = 'SS Buddy Corporate System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const isTargetVsAchievement =
      !reportName ||
      reportName.toLowerCase().includes('target') ||
      reportName.toLowerCase().includes('performance') ||
      reportName.toLowerCase().includes('partywise') ||
      reportName.toLowerCase().includes('growth');

    if (isTargetVsAchievement) {
      const targetMonth = metadata?.month || 'Sep';
      const targetFY = Number(metadata?.fiscalYear) || 2026;
      const branchFilter = metadata?.branchCode && metadata.branchCode !== 'ALL' ? metadata.branchCode : null;
      const catFilter = metadata?.partCategoryCode && metadata.partCategoryCode !== 'ALL' ? metadata.partCategoryCode : null;

      const calculatedRows = await this.calculateMultiPeriodMatrix(
        targetFY,
        targetMonth,
        branchFilter,
        catFilter,
        metadata,
      );

      const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      const monthIdx = MONTH_ORDER.indexOf(targetMonth) >= 0 ? MONTH_ORDER.indexOf(targetMonth) : 5;
      const prevMonth = monthIdx === 0 ? 'Mar' : MONTH_ORDER[monthIdx - 1];
      const prevMonthFY = monthIdx === 0 ? targetFY - 1 : targetFY;
      const lyMonth = targetMonth;

      const worksheet = workbook.addWorksheet('Sheet1', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
        pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 },
      });

      const NAVY_HEADER = 'FF003366';
      const PURPLE_HEADER = 'FF581C87';
      const PURPLE_COL = 'FF4C1D95';
      const INDIGO_HEADER = 'FF3730A3';
      const INDIGO_COL = 'FF312E81';
      const BLUE_HEADER = 'FF1D4ED8';
      const BLUE_COL = 'FF1E40AF';
      const TEAL_HEADER = 'FF0F766E';
      const EMERALD_TARGET = 'FF047857';
      const GREEN_STATUS = 'FF065F46';

      const GRAY_LIGHT = 'FFF8FAFC';
      const GRAY_BORDER = 'FFE2E8F0';
      const GREEN_FILL = 'FFDCFCE7';
      const GREEN_TEXT = 'FF166534';
      const AMBER_FILL = 'FFFEF3C7';
      const AMBER_TEXT = 'FF92400E';
      const RED_FILL = 'FFFEE2E2';
      const RED_TEXT = 'FF991B1B';

      const shortYear = String(targetFY).slice(-2);
      const prevShortYear = String(targetFY - 1).slice(-2);
      const prevMonthShortYear = String(prevMonthFY).slice(-2);

      // ─── ROW 1: SECTION GROUP BANDS (Exact 28 Columns matching reference file) ──────
      // Group 1: Cols 1-8 (A-H) - Dealer & Branch Identification
      worksheet.mergeCells(1, 1, 1, 8);
      const g1 = worksheet.getCell(1, 1);
      g1.value = '1. DEALER & BRANCH IDENTIFICATION';
      g1.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g1.alignment = { vertical: 'middle', horizontal: 'center' };
      g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };

      // Group 2: Cols 9-11 (I-K) - Multi-Year Sales & Growth
      worksheet.mergeCells(1, 9, 1, 11);
      const g2 = worksheet.getCell(1, 9);
      g2.value = `2. MULTI-YEAR SALES & GROWTH (FY${targetFY - 3} - FY${targetFY})`;
      g2.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE_HEADER } };

      // Group 3: Cols 12-14 (L-N) - YTD Performance & Growth
      worksheet.mergeCells(1, 12, 1, 14);
      const g3 = worksheet.getCell(1, 12);
      g3.value = `3. YTD PERFORMANCE & GROWTH (FY${prevShortYear}-${shortYear})`;
      g3.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g3.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_HEADER } };

      // Group 4: Cols 15-18 (O-R) - Quarterly Performance
      worksheet.mergeCells(1, 15, 1, 18);
      const g4 = worksheet.getCell(1, 15);
      g4.value = `4. QUARTERLY PERFORMANCE (Q1 & Q2 FY${prevShortYear}-${shortYear})`;
      g4.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g4.alignment = { vertical: 'middle', horizontal: 'center' };
      g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };

      // Group 5: Cols 19-24 (S-X) - MTD Performance & Growth
      worksheet.mergeCells(1, 19, 1, 24);
      const g5 = worksheet.getCell(1, 19);
      g5.value = `5. MTD PERFORMANCE & GROWTH (@ ${targetMonth}'${shortYear})`;
      g5.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g5.alignment = { vertical: 'middle', horizontal: 'center' };
      g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };

      // Group 6: Cols 25-28 (Y-AB) - Target & Fulfillment
      worksheet.mergeCells(1, 25, 1, 28);
      const g6 = worksheet.getCell(1, 25);
      g6.value = '6. TARGET & FULFILLMENT';
      g6.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      g6.alignment = { vertical: 'middle', horizontal: 'center' };
      g6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_TARGET } };

      worksheet.getRow(1).height = 22;

      // ─── ROW 2: DETAILED COLUMN HEADERS (Exact 28 Columns) ─────────────
      const headers = [
        // 1. Core Dimensions (1-8 / A-H)
        { key: 'branchCode', label: 'BRANCH CODE', width: 14, align: 'center', bg: NAVY_HEADER },
        { key: 'branchName', label: 'BRANCH NAME', width: 26, align: 'left', bg: NAVY_HEADER },
        { key: 'partyCode', label: 'PARTY CODE', width: 16, align: 'center', bg: NAVY_HEADER },
        { key: 'originalCode', label: 'ORIGINAL CODE', width: 16, align: 'center', bg: NAVY_HEADER },
        { key: 'partyName', label: 'PARTY / DEALER NAME', width: 34, align: 'left', bg: NAVY_HEADER },
        { key: 'partyType', label: 'PARTY TYPE', width: 22, align: 'center', bg: NAVY_HEADER },
        { key: 'partCategoryCode', label: 'CAT', width: 10, align: 'center', bg: NAVY_HEADER },
        { key: 'uniquePartlines', label: 'UNIQUE PARTLINE', width: 16, align: 'center', bg: NAVY_HEADER },

        // 2. Multi-Year Sales (9-11 / I-K)
        { key: 'fy0Total', label: `FY ${targetFY - 3} Total Sale`, width: 18, align: 'center', bg: PURPLE_COL },
        { key: 'fy1Total', label: `FY ${targetFY - 2} Total Sale`, width: 18, align: 'center', bg: PURPLE_COL },
        { key: 'fy2Total', label: `FY ${targetFY - 1} Total Sale`, width: 18, align: 'center', bg: PURPLE_COL },

        // 3. YTD Performance (12-14 / L-N)
        { key: 'ytdLy', label: `YTD @ ${targetFY - 1}`, width: 18, align: 'center', bg: INDIGO_COL },
        { key: 'ytdCur', label: `YTD @ ${targetFY}`, width: 18, align: 'center', bg: INDIGO_COL },
        { key: 'ytdGrowth', label: 'YTD Growth%', width: 15, align: 'center', bg: 'FF1E1B4B' },

        // 4. Quarterly Performance (15-18 / O-R)
        { key: 'q1CurTotal', label: `Q1 (FY${targetFY - 1}-${shortYear}) Total`, width: 18, align: 'center', bg: BLUE_COL },
        { key: 'q2LyTill', label: `Q2 (FY${targetFY - 2}-${prevShortYear}) Till date`, width: 18, align: 'center', bg: BLUE_COL },
        { key: 'q2CurTill', label: `Q2 (FY${targetFY - 1}-${shortYear}) Till date`, width: 18, align: 'center', bg: BLUE_COL },
        { key: 'q2Growth', label: 'QTD Growth% ', width: 15, align: 'center', bg: 'FF172554' },

        // 5. Monthly Performance (19-24 / S-X)
        { key: 'lmTotal', label: `${prevMonth}'${prevMonthShortYear} Total`, width: 18, align: 'center', bg: TEAL_HEADER },
        { key: 'lmTill', label: `MTD @ ${prevMonth}'${prevMonthShortYear}`, width: 18, align: 'center', bg: TEAL_HEADER },
        { key: 'lySameMonthSales', label: `MTD @ ${lyMonth}'${prevShortYear}`, width: 18, align: 'center', bg: TEAL_HEADER },
        { key: 'mtdCur', label: `MTD @ ${targetMonth}'${shortYear}`, width: 18, align: 'center', bg: TEAL_HEADER },
        { key: 'mtdLyGrowth', label: 'MTD Growth%', width: 15, align: 'center', bg: 'FF134E4A' },
        { key: 'mtdLmGrowth', label: 'MTD Growth% (LM)', width: 16, align: 'center', bg: 'FF134E4A' },

        // 6. Target & Fulfillment (25-28 / Y-AB)
        { key: 'finalTarget', label: `${targetMonth}'${shortYear} TARGET`, width: 18, align: 'center', bg: EMERALD_TARGET },
        { key: 'mtdCurTill', label: `${targetMonth}'${shortYear} Till Date`, width: 18, align: 'center', bg: EMERALD_TARGET },
        { key: 'achievementPercent', label: 'ACH %', width: 14, align: 'center', bg: GREEN_STATUS },
        { key: 'status', label: 'STATUS', width: 16, align: 'center', bg: GREEN_STATUS },
      ];

      const headerRow = worksheet.getRow(2);
      headerRow.height = 28;

      headers.forEach((h, idx) => {
        const colIdx = idx + 1;
        worksheet.getColumn(colIdx).width = h.width;
        const cell = headerRow.getCell(colIdx);
        cell.value = h.label;
        cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: h.align === 'left' ? 'left' : 'center', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: NAVY_HEADER } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      // ─── DATA ROWS (Row 3 onwards) ─────────────────────────────────────
      let currentRowIdx = 3;
      calculatedRows.forEach((item, idx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 20;
        const isEven = idx % 2 === 0;
        const defaultBg = isEven ? 'FFFFFFFF' : GRAY_LIGHT;

        const rowValues = [
          item.branchCode || '-',
          (item.branchName || item.branchCode || '-').toUpperCase(),
          item.partyCode || '-',
          item.originalCode || '-',
          (item.partyName || '-').toUpperCase(),
          (item.partyType || 'INDEPENDENT WORKSHOP').toUpperCase(),
          (item.partCategoryCode || 'ALL').toUpperCase(),
          item.uniquePartlines || 0,

          // Multi-Year (Cols 9-11 / I-K)
          item.fy0Total,
          item.fy1Total,
          item.fy2Total,

          // YTD (Cols 12-14 / L-N)
          item.ytdLy,
          item.ytdCur,
          { formula: `IFERROR(M${currentRowIdx}/L${currentRowIdx}-1,0)` },

          // Quarterly (Cols 15-18 / O-R)
          item.q1CurTotal,
          item.q2LyTill,
          item.q2CurTill,
          { formula: `IFERROR(Q${currentRowIdx}/P${currentRowIdx}-1,0)` },

          // Monthly (Cols 19-24 / S-X)
          item.lmTotal,
          item.lmTill,
          item.lySameMonthSales,
          item.mtdCur,
          { formula: `IFERROR(V${currentRowIdx}/U${currentRowIdx}-1,0)` },
          { formula: `IFERROR(V${currentRowIdx}/T${currentRowIdx}-1,0)` },

          // Target & Status (Cols 25-28 / Y-AB)
          item.finalTarget,
          { formula: `V${currentRowIdx}` },
          { formula: `IFERROR(Z${currentRowIdx}/Y${currentRowIdx},0)` },
          item.status,
        ];

        rowValues.forEach((val, cIdx) => {
          const colIdx = cIdx + 1;
          const cell = row.getCell(colIdx);
          cell.value = val;
          cell.font = { name: 'Abadi', size: 9 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: headers[cIdx].align === 'left' ? 'left' : 'center',
          };
          cell.border = {
            top: { style: 'thin', color: { argb: GRAY_BORDER } },
            bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
            left: { style: 'thin', color: { argb: GRAY_BORDER } },
            right: { style: 'thin', color: { argb: GRAY_BORDER } },
          };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };

          // Number Formatting matching user's exact format ###,##0;[Red]-###,##0;"—"
          const amountCols = [9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21, 22, 25, 26];
          const percentCols = [14, 18, 23, 24, 27];

          if (amountCols.includes(colIdx)) {
            cell.numFmt = '###,##0;[Red]-###,##0;"—"';
          } else if (colIdx === 8) {
            cell.numFmt = '#,##0';
            cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FF0F172A' } };
          } else if (percentCols.includes(colIdx)) {
            cell.numFmt = '0.0%';
            if (colIdx === 27) {
              const pVal = Number(item.achievementPercent) || 0;
              cell.font = { name: 'Abadi', size: 9, bold: true };
              if (pVal >= 1.0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_FILL } };
                cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: GREEN_TEXT } };
              } else if (pVal >= 0.70) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_FILL } };
                cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: AMBER_TEXT } };
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
                cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: RED_TEXT } };
              }
            }
          } else if (colIdx === 28) {
            cell.font = { name: 'Abadi', size: 8.5, bold: true };
            if (item.status === 'ACHIEVED') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_FILL } };
              cell.font = { name: 'Abadi', size: 8.5, bold: true, color: { argb: GREEN_TEXT } };
            } else if (item.status === 'ON TRACK') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_FILL } };
              cell.font = { name: 'Abadi', size: 8.5, bold: true, color: { argb: AMBER_TEXT } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
              cell.font = { name: 'Abadi', size: 8.5, bold: true, color: { argb: RED_TEXT } };
            }
          } else if (colIdx === 1 || colIdx === 3 || colIdx === 4) {
            cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FF003366' } };
          }
        });

        currentRowIdx++;
      });

      // ─── GRAND TOTAL SUMMARY ROW ───────────────────────────────────────
      if (calculatedRows.length > 0) {
        const totalRow = worksheet.getRow(currentRowIdx);
        totalRow.height = 24;
        const firstDataRow = 3;
        const lastDataRow = currentRowIdx - 1;

        worksheet.mergeCells(currentRowIdx, 1, currentRowIdx, 7);
        const grandLabelCell = totalRow.getCell(1);
        grandLabelCell.value = `GRAND TOTAL (${calculatedRows.length} DEALERS)`;
        grandLabelCell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        grandLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        grandLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

        // Unique partlines total (Col 8 / H)
        const partlineCell = totalRow.getCell(8);
        partlineCell.value = { formula: `SUM(H${firstDataRow}:H${lastDataRow})` };
        partlineCell.numFmt = '#,##0';
        partlineCell.alignment = { vertical: 'middle', horizontal: 'center' };
        partlineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        partlineCell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
        partlineCell.border = {
          top: { style: 'double', color: { argb: 'FF60A5FA' } },
          bottom: { style: 'medium', color: { argb: 'FF60A5FA' } },
        };

        const amountCols = [9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21, 22, 25, 26];

        for (let c = 9; c <= 28; c++) {
          const colLetter = worksheet.getColumn(c).letter;
          const cell = totalRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.border = {
            top: { style: 'double', color: { argb: 'FF60A5FA' } },
            bottom: { style: 'medium', color: { argb: 'FF60A5FA' } },
          };

          if (amountCols.includes(c)) {
            cell.value = { formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
            cell.numFmt = '###,##0;[Red]-###,##0;"—"';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (c === 25 || c === 22 || c === 26) {
              cell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
            }
          } else if (c === 14) {
            // YTD Growth% = (M - L) / L
            cell.value = { formula: `IFERROR(M${currentRowIdx}/L${currentRowIdx}-1,0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (c === 18) {
            // QTD Growth% = (Q - P) / P
            cell.value = { formula: `IFERROR(Q${currentRowIdx}/P${currentRowIdx}-1,0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (c === 23) {
            // MTD Growth% = (V - U) / U
            cell.value = { formula: `IFERROR(V${currentRowIdx}/U${currentRowIdx}-1,0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (c === 24) {
            // MTD Growth% (LM) = (V - T) / T
            cell.value = { formula: `IFERROR(V${currentRowIdx}/T${currentRowIdx}-1,0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (c === 27) {
            // ACH % = Till Date / Target (Z / Y)
            cell.value = { formula: `IFERROR(Z${currentRowIdx}/Y${currentRowIdx},0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
          } else if (c === 28) {
            cell.value = 'PORTFOLIO';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Abadi', size: 8.5, bold: true, color: { argb: 'FF94A3B8' } };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }
      }

      // ─── AUTOFILTER ────────────────────────────────────────────────────
      if (calculatedRows.length > 0) {
        worksheet.autoFilter = {
          from: { row: 2, column: 1 },
          to: { row: currentRowIdx - 1, column: 28 },
        };
      }
    } else {
      // General Rich Formatted Table Exporter
      const worksheet = workbook.addWorksheet(reportName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      });

      if (data.length > 0) {
        const rawKeys = Object.keys(data[0]);
        const formatHeader = (key: string) =>
          key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^\w/, (c) => c.toUpperCase())
            .toUpperCase();

        worksheet.columns = rawKeys.map((k) => ({
          header: formatHeader(k),
          key: k,
          width: Math.max(k.length + 6, 18),
        }));

        data.forEach((row, rIdx) => {
          const addedRow = worksheet.addRow(row);
          const isEven = rIdx % 2 === 0;
          addedRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
          };
          addedRow.eachCell((cell) => {
            cell.font = { name: 'Abadi', size: 9 };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
            if (typeof cell.value === 'number' && cell.value > 100) {
              cell.numFmt = '#,##,##0';
            }
          });
        });

        const headerRow = worksheet.getRow(1);
        headerRow.height = 26;
        headerRow.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF003366' },
        };

        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: data.length + 1, column: rawKeys.length },
        };
      }
    }

    return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  }

  // ─── COMPREHENSIVE PARTY 360° STATISTICS ──────────────────────────────────
  async getParty360Statistics(partyCode: string, branchCode?: string, fiscalYear = 2026, month = 'Sep') {
    if (!partyCode) {
      throw new BadRequestException('partyCode is required');
    }

    const cleanCode = partyCode.trim();
    const targetFY = Number(fiscalYear) || 2026;
    const targetMonth = month || 'Sep';

    // 1. Party master & mapping details
    const [partyMaster, party, branch] = await Promise.all([
      this.prisma.partyMaster.findFirst({
        where: {
          OR: [
            { consPartyCode: cleanCode },
            { originalCode: cleanCode },
          ],
        },
      }),
      this.prisma.party.findFirst({
        where: { code: cleanCode },
      }),
      branchCode && branchCode !== 'ALL' ? this.prisma.branch.findFirst({ where: { code: branchCode } }) : null,
    ]);

    const partyName = partyMaster?.consPartyName || party?.name || cleanCode;
    const originalCode = partyMaster?.originalCode || cleanCode;
    const consPartyCode = partyMaster?.consPartyCode || cleanCode;
    const partyType = party?.type || partyMaster?.partyType || 'TRADER/RETAILER';
    const resolvedBranchCode = branchCode && branchCode !== 'ALL' ? branchCode : (partyMaster?.baseLoc || branch?.code || 'HO');
    const branchName = branch?.name || resolvedBranchCode;

    const targetCodes = Array.from(new Set([cleanCode, consPartyCode, originalCode])).filter(Boolean);
    const partyMatchCondition = targetCodes
      .map((c) => `(cons_party_code = '${c.replace(/'/g, "''")}' OR dealer_code = '${c.replace(/'/g, "''")}')`)
      .join(' OR ');

    // 2. Lifetime Basket & Order Statistics
    const [basketStatsRaw]: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT document_num)::int as total_invoices,
        COUNT(DISTINCT part_num)::int as total_unique_parts,
        ROUND(SUM(net_retail_selling)::numeric, 2) as lifetime_sales,
        ROUND(SUM(net_retail_qty)::numeric, 2) as lifetime_qty,
        MIN(month_year) as first_purchase,
        MAX(month_year) as last_purchase,
        COUNT(DISTINCT CONCAT(fiscal_year, '-', month))::int as active_months,
        COUNT(*)::int as total_line_items
      FROM retail_sales_records
      WHERE (${partyMatchCondition})
    `);

    const totalInvoices = Number(basketStatsRaw?.total_invoices) || 0;
    const lifetimeSales = Number(basketStatsRaw?.lifetime_sales) || 0;
    const lifetimeQty = Number(basketStatsRaw?.lifetime_qty) || 0;
    const totalLineItems = Number(basketStatsRaw?.total_line_items) || 0;

    const basketStats = {
      totalInvoices,
      totalUniqueParts: Number(basketStatsRaw?.total_unique_parts) || 0,
      totalLineItems,
      lifetimeSales,
      lifetimeQty,
      avgInvoiceValue: totalInvoices > 0 ? Math.round(lifetimeSales / totalInvoices) : 0,
      avgQtyPerInvoice: totalInvoices > 0 ? Math.round((lifetimeQty / totalInvoices) * 10) / 10 : 0,
      avgLinesPerInvoice: totalInvoices > 0 ? Math.round((totalLineItems / totalInvoices) * 10) / 10 : 0,
      firstPurchase: basketStatsRaw?.first_purchase || 'N/A',
      lastPurchase: basketStatsRaw?.last_purchase || 'N/A',
      activeMonths: Number(basketStatsRaw?.active_months) || 0,
    };

    // 3. Real monthly historical trend across all available years
    const monthlyRecords: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        fiscal_year,
        month,
        COALESCE(part_category_code, 'M') as cat,
        COUNT(DISTINCT part_num)::int as partlines,
        COUNT(DISTINCT document_num)::int as invoices,
        ROUND(SUM(net_retail_selling)::numeric, 2) as sales,
        ROUND(SUM(net_retail_qty)::numeric, 2) as qty
      FROM retail_sales_records
      WHERE (${partyMatchCondition})
      GROUP BY fiscal_year, month, COALESCE(part_category_code, 'M')
      ORDER BY fiscal_year ASC, 
        CASE month 
          WHEN 'Apr' THEN 1 WHEN 'May' THEN 2 WHEN 'Jun' THEN 3
          WHEN 'Jul' THEN 4 WHEN 'Aug' THEN 5 WHEN 'Sep' THEN 6
          WHEN 'Oct' THEN 7 WHEN 'Nov' THEN 8 WHEN 'Dec' THEN 9
          WHEN 'Jan' THEN 10 WHEN 'Feb' THEN 11 WHEN 'Mar' THEN 12
          ELSE 13
        END ASC
    `);

    // Group monthly timeline
    const timelineMap = new Map<string, any>();
    const timelineByCategory = monthlyRecords.map((r) => {
      const periodKey = `${r.month}'${String(r.fiscal_year).slice(-2)}`;
      const invCount = Number(r.invoices) || 0;
      const salesVal = Number(r.sales) || 0;
      return {
        period: periodKey,
        month: r.month,
        fiscalYear: Number(r.fiscal_year),
        cat: r.cat || 'M',
        sales: salesVal,
        qty: Number(r.qty) || 0,
        partlines: Number(r.partlines) || 0,
        invoices: invCount,
        avgInvoiceValue: invCount > 0 ? Math.round(salesVal / invCount) : 0,
      };
    });

    for (const r of monthlyRecords) {
      const key = `${r.month}'${String(r.fiscal_year).slice(-2)}`;
      if (!timelineMap.has(key)) {
        timelineMap.set(key, {
          period: key,
          month: r.month,
          fiscalYear: Number(r.fiscal_year),
          sales: 0,
          qty: 0,
          partlines: 0,
          invoices: 0,
          avgInvoiceValue: 0,
        });
      }
      const item = timelineMap.get(key);
      item.sales += Number(r.sales) || 0;
      item.qty += Number(r.qty) || 0;
      item.partlines = Math.max(item.partlines, Number(r.partlines) || 0);
      item.invoices += Number(r.invoices) || 0;
      item.avgInvoiceValue = item.invoices > 0 ? Math.round(item.sales / item.invoices) : 0;
    }
    const timeline = Array.from(timelineMap.values());

    // Detailed Category Multi-Period Matrix Query
    const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthIdx = MONTH_ORDER.indexOf(targetMonth);
    const prevMonthIdx = monthIdx > 0 ? monthIdx - 1 : 11;
    const prevMonth = MONTH_ORDER[prevMonthIdx];
    const prevMonthFY = monthIdx === 0 ? targetFY - 1 : targetFY;

    const lyMonth = targetMonth;
    const lyFY = targetFY - 1;
    const lyPrevMonth = prevMonth;
    const lyPrevMonthFY = prevMonthFY - 1;
    const ly2PrevMonthFY = prevMonthFY - 2;

    let curQuarterMonths: string[] = [];
    let prevQuarterMonths: string[] = [];
    let curQuarterTillMonths: string[] = [];
    let prevQuarterTillMonths: string[] = [];
    let prevQuarterFY = targetFY;

    if (['Apr', 'May', 'Jun'].includes(targetMonth)) {
      curQuarterMonths = ['Apr', 'May', 'Jun'];
      curQuarterTillMonths = MONTH_ORDER.slice(0, monthIdx + 1);
      prevQuarterMonths = ['Jan', 'Feb', 'Mar'];
      prevQuarterTillMonths = ['Jan', 'Feb', 'Mar'].slice(0, monthIdx + 1);
      prevQuarterFY = targetFY - 1;
    } else if (['Jul', 'Aug', 'Sep'].includes(targetMonth)) {
      curQuarterMonths = ['Jul', 'Aug', 'Sep'];
      curQuarterTillMonths = MONTH_ORDER.slice(3, monthIdx + 1);
      prevQuarterMonths = ['Apr', 'May', 'Jun'];
      prevQuarterTillMonths = ['Apr', 'May', 'Jun'].slice(0, monthIdx - 3 + 1);
    } else if (['Oct', 'Nov', 'Dec'].includes(targetMonth)) {
      curQuarterMonths = ['Oct', 'Nov', 'Dec'];
      curQuarterTillMonths = MONTH_ORDER.slice(6, monthIdx + 1);
      prevQuarterMonths = ['Jul', 'Aug', 'Sep'];
      prevQuarterTillMonths = ['Jul', 'Aug', 'Sep'].slice(0, monthIdx - 6 + 1);
    } else {
      curQuarterMonths = ['Jan', 'Feb', 'Mar'];
      curQuarterTillMonths = MONTH_ORDER.slice(9, monthIdx + 1);
      prevQuarterMonths = ['Oct', 'Nov', 'Dec'];
      prevQuarterTillMonths = ['Oct', 'Nov', 'Dec'].slice(0, monthIdx - 9 + 1);
    }
    const ytdMonths = MONTH_ORDER.slice(0, monthIdx + 1);

    const rawCatMatrix: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(part_category_code, 'M') as cat,
        -- MTD
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month = '${targetMonth}' THEN net_retail_selling ELSE 0 END)::numeric, 2) as mtd_cur_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month = '${targetMonth}' THEN net_retail_qty ELSE 0 END)::numeric, 2) as mtd_cur_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY} AND month = '${targetMonth}' THEN document_num END)::int as mtd_cur_inv,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY} AND month = '${targetMonth}' THEN part_num END)::int as mtd_cur_lines,

        ROUND(SUM(CASE WHEN fiscal_year = ${prevMonthFY} AND month = '${prevMonth}' THEN net_retail_selling ELSE 0 END)::numeric, 2) as lm_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${prevMonthFY} AND month = '${prevMonth}' THEN net_retail_qty ELSE 0 END)::numeric, 2) as lm_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${prevMonthFY} AND month = '${prevMonth}' THEN document_num END)::int as lm_inv,

        ROUND(SUM(CASE WHEN fiscal_year = ${lyFY} AND month = '${lyMonth}' THEN net_retail_selling ELSE 0 END)::numeric, 2) as ly_sm_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${lyFY} AND month = '${lyMonth}' THEN net_retail_qty ELSE 0 END)::numeric, 2) as ly_sm_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${lyFY} AND month = '${lyMonth}' THEN document_num END)::int as ly_sm_inv,

        ROUND(SUM(CASE WHEN fiscal_year = ${lyPrevMonthFY} AND month = '${lyPrevMonth}' THEN net_retail_selling ELSE 0 END)::numeric, 2) as ly_pm_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${ly2PrevMonthFY} AND month = '${lyPrevMonth}' THEN net_retail_selling ELSE 0 END)::numeric, 2) as ly2_pm_sales,
        
        -- QTD
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${curQuarterMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as qtd_cur_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${curQuarterMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as qtd_cur_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY} AND month IN ('${curQuarterMonths.join("','")}') THEN document_num END)::int as qtd_cur_inv,

        ROUND(SUM(CASE WHEN fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as qtd_prev_qtr_total,
        ROUND(SUM(CASE WHEN fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterTillMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as qtd_prev_qtr_till,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as qtd_ly_total,
        
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterTillMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as qtd_ly_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterTillMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as qtd_ly_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterTillMonths.join("','")}') THEN document_num END)::int as qtd_ly_inv,

        -- YTD
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as ytd_cur_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as ytd_cur_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN document_num END)::int as ytd_cur_inv,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN part_num END)::int as ytd_cur_lines,

        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as ytd_ly_sales,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as ytd_ly_qty,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN document_num END)::int as ytd_ly_inv,
        COUNT(DISTINCT CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN part_num END)::int as ytd_ly_lines,

        -- Multi-Year Totals
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 3} THEN net_retail_selling ELSE 0 END)::numeric, 2) as fy0_total,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 2} THEN net_retail_selling ELSE 0 END)::numeric, 2) as fy1_total,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} THEN net_retail_selling ELSE 0 END)::numeric, 2) as fy2_total,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} THEN net_retail_selling ELSE 0 END)::numeric, 2) as fy3_total,

        -- Lifetime & Breadth
        ROUND(SUM(net_retail_selling)::numeric, 2) as lifetime_sales,
        ROUND(SUM(net_retail_qty)::numeric, 2) as lifetime_qty,
        COUNT(DISTINCT document_num)::int as total_invoices,
        COUNT(DISTINCT part_num)::int as total_partlines
      FROM retail_sales_records
      WHERE (${partyMatchCondition})
      GROUP BY COALESCE(part_category_code, 'M')
    `);

    const buildCategoryMatrixObject = (r: any, catName: string) => {
      const mtdCur = Number(r?.mtd_cur_sales ?? r?.mtd_cur) || 0;
      const mtdCurQty = Number(r?.mtd_cur_qty) || 0;
      const mtdCurInv = Number(r?.mtd_cur_inv) || 0;
      const mtdCurLines = Number(r?.mtd_cur_lines) || 0;

      const lmmtd = Number(r?.lm_sales) || 0;
      const lmmtdQty = Number(r?.lm_qty) || 0;
      const lmmtdInv = Number(r?.lm_inv) || 0;

      const lymtd = Number(r?.ly_sm_sales) || 0;
      const lymtdQty = Number(r?.ly_sm_qty) || 0;
      const lymtdInv = Number(r?.ly_sm_inv) || 0;

      const lyPrevMonth = Number(r?.ly_pm_sales) || 0;
      const ly2PrevMonth = Number(r?.ly2_pm_sales) || 0;

      const qtdCur = Number(r?.qtd_cur_sales ?? r?.qtd_cur) || 0;
      const qtdCurQty = Number(r?.qtd_cur_qty) || 0;
      const qtdCurInv = Number(r?.qtd_cur_inv) || 0;

      const qtdPrevQtrTill = Number(r?.qtd_prev_qtr_till) || 0;
      const qtdPrevQtrTotal = Number(r?.qtd_prev_qtr_total) || 0;
      const qtdLyTill = Number(r?.qtd_ly_sales ?? r?.qtd_ly_till) || 0;
      const qtdLyQty = Number(r?.qtd_ly_qty) || 0;
      const qtdLyInv = Number(r?.qtd_ly_inv) || 0;
      const qtdLyTotal = Number(r?.qtd_ly_total) || 0;

      const ytdCur = Number(r?.ytd_cur_sales ?? r?.ytd_cur) || 0;
      const ytdCurQty = Number(r?.ytd_cur_qty) || 0;
      const ytdCurInv = Number(r?.ytd_cur_inv) || 0;
      const ytdCurLines = Number(r?.ytd_cur_lines) || 0;

      const ytdLy = Number(r?.ytd_ly_sales ?? r?.ytd_ly) || 0;
      const ytdLyQty = Number(r?.ytd_ly_qty) || 0;
      const ytdLyInv = Number(r?.ytd_ly_inv) || 0;
      const ytdLyLines = Number(r?.ytd_ly_lines) || 0;

      const fy0Total = Number(r?.fy0_total) || 0;
      const fy1Total = Number(r?.fy1_total) || 0;
      const fy2Total = Number(r?.fy2_total) || 0;
      const fy3Total = Number(r?.fy3_total) || 0;

      const mtdVsLymtdGrowth = lymtd > 0 ? (mtdCur - lymtd) / lymtd : 0;
      const mtdQtyGrowth = lymtdQty > 0 ? (mtdCurQty - lymtdQty) / lymtdQty : 0;
      const qtdVsLyGrowth = qtdLyTill > 0 ? (qtdCur - qtdLyTill) / qtdLyTill : 0;
      const qtdQtyGrowth = qtdLyQty > 0 ? (qtdCurQty - qtdLyQty) / qtdLyQty : 0;
      const ytdGrowth = ytdLy > 0 ? (ytdCur - ytdLy) / ytdLy : 0;
      const ytdQtyGrowth = ytdLyQty > 0 ? (ytdCurQty - ytdLyQty) / ytdLyQty : 0;

      return {
        cat: catName,
        curPartlines: mtdCurLines || Number(r?.cur_partlines) || 0,
        totalPartlines: Number(r?.total_partlines) || 0,
        totalInvoices: Number(r?.total_invoices) || 0,
        lifetimeSales: Number(r?.lifetime_sales) || 0,
        lifetimeQty: Number(r?.lifetime_qty) || 0,
        mtd: {
          current: mtdCur,
          lySamePeriod: lymtd,
          growthPercent: mtdVsLymtdGrowth,
          diffAmount: mtdCur - lymtd,
          curQty: mtdCurQty,
          lyQty: lymtdQty,
          qtyGrowthPercent: mtdQtyGrowth,
          curInvoices: mtdCurInv,
          lyInvoices: lymtdInv,
          curLines: mtdCurLines,
          lmmtd,
          lmmtdQty,
          lmmtdInv,
          lyPrevMonth,
          ly2PrevMonth,
          mtdVsLmmtdGrowth: lmmtd > 0 ? (mtdCur - lmmtd) / lmmtd : 0,
        },
        qtd: {
          current: qtdCur,
          lySamePeriod: qtdLyTill,
          growthPercent: qtdVsLyGrowth,
          diffAmount: qtdCur - qtdLyTill,
          curQty: qtdCurQty,
          lyQty: qtdLyQty,
          qtyGrowthPercent: qtdQtyGrowth,
          curInvoices: qtdCurInv,
          lyInvoices: qtdLyInv,
          qtdPrevQtrTill,
          qtdPrevQtrTotal,
          qtdLyTotal,
        },
        ytd: {
          current: ytdCur,
          lySamePeriod: ytdLy,
          growthPercent: ytdGrowth,
          diffAmount: ytdCur - ytdLy,
          curQty: ytdCurQty,
          lyQty: ytdLyQty,
          qtyGrowthPercent: ytdQtyGrowth,
          curInvoices: ytdCurInv,
          lyInvoices: ytdLyInv,
          curLines: ytdCurLines,
          lyLines: ytdLyLines,
          fy0Total,
          fy1Total,
          fy2Total,
          fy3Total,
          fy24Growth: fy0Total > 0 ? (fy1Total - fy0Total) / fy0Total : 0,
          fy25Growth: fy1Total > 0 ? (fy2Total - fy1Total) / fy1Total : 0,
          fy26Growth: fy2Total > 0 ? (fy3Total - fy2Total) / fy2Total : 0,
        },
      };
    };

    const categoryMultiPeriodMap: Record<string, any> = {};
    rawCatMatrix.forEach((r) => {
      categoryMultiPeriodMap[r.cat] = buildCategoryMatrixObject(r, r.cat);
    });

    const allRawAgg = rawCatMatrix.reduce((acc: any, r: any) => {
      Object.keys(r).forEach((k) => {
        if (k !== 'cat') {
          acc[k] = (acc[k] || 0) + (Number(r[k]) || 0);
        }
      });
      return acc;
    }, {});
    const allCategoryMultiPeriod = buildCategoryMatrixObject(allRawAgg, 'ALL');
    categoryMultiPeriodMap['ALL'] = allCategoryMultiPeriod;

    // 4. Enhanced Category Breakdown Array with Same Period Comparisons
    const categories = rawCatMatrix.map((r) => {
      const m = categoryMultiPeriodMap[r.cat] || buildCategoryMatrixObject(r, r.cat);
      const catLifetime = Number(r.lifetime_sales) || 0;
      return {
        cat: r.cat,
        name: `Category ${r.cat}`,
        uniquePartlines: Number(r.total_partlines) || 0,
        totalInvoices: Number(r.total_invoices) || 0,
        curMonthSales: m.mtd.current,
        curMonthQty: m.mtd.curQty,
        ytdSales: m.ytd.current,
        ytdQty: m.ytd.curQty,
        lifetimeSales: catLifetime,
        lifetimeQty: Number(r.lifetime_qty) || 0,
        sharePercent: lifetimeSales > 0 ? Number(((catLifetime / lifetimeSales) * 100).toFixed(1)) : 0,
        ytdSharePercent: allCategoryMultiPeriod.ytd.current > 0 ? Number(((m.ytd.current / allCategoryMultiPeriod.ytd.current) * 100).toFixed(1)) : 0,
        growthPercent: m.ytd.growthPercent,
        mtd: m.mtd,
        qtd: m.qtd,
        ytd: m.ytd,
      };
    }).sort((a, b) => b.ytdSales - a.ytdSales);

    // 5. Complete Part Purchase Frequency & Top Parts
    const partFrequencyRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        part_num as "partNum",
        COALESCE(root_part_num, part_num) as "rootPartNum",
        COALESCE(part_category_code, 'M') as "cat",
        COUNT(DISTINCT CONCAT(fiscal_year, '-', month))::int as "activeMonthsCount",
        COUNT(DISTINCT document_num)::int as "invoicesCount",
        ROUND(SUM(net_retail_qty)::numeric, 2) as "totalQty",
        ROUND(SUM(net_retail_selling)::numeric, 2) as "totalSales",
        MAX(month_year) as "lastPurchased",
        MAX(fiscal_year)::int as "lastFY",
        MAX(month) as "lastMonth"
      FROM retail_sales_records
      WHERE (${partyMatchCondition})
      GROUP BY part_num, COALESCE(root_part_num, part_num), COALESCE(part_category_code, 'M')
      ORDER BY "totalSales" DESC
    `);

    const classifiedParts = partFrequencyRaw.map((p, idx) => {
      const activeMonthsCount = Number(p.activeMonthsCount) || 0;
      const totalSales = Number(p.totalSales) || 0;
      const isLapsed = (
        p.lastPurchased !== `${targetMonth} ${targetFY}` &&
        p.lastPurchased !== `Aug ${targetFY}` &&
        totalSales >= 5000
      );

      return {
        rank: idx + 1,
        partNum: p.partNum,
        rootPartNum: p.rootPartNum,
        cat: p.cat,
        activeMonthsCount,
        invoicesCount: Number(p.invoicesCount) || 0,
        totalQty: Number(p.totalQty) || 0,
        totalSales,
        revenueShare: lifetimeSales > 0 ? Number(((totalSales / lifetimeSales) * 100).toFixed(2)) : 0,
        lastPurchased: p.lastPurchased || 'N/A',
        frequencyType: activeMonthsCount >= 3 ? 'FREQUENT' : activeMonthsCount === 2 ? 'REGULAR' : 'RARE',
        isLapsed,
      };
    });

    const topParts = classifiedParts.slice(0, 25);
    const frequentParts = classifiedParts.filter((p) => p.frequencyType === 'FREQUENT');
    const regularParts = classifiedParts.filter((p) => p.frequencyType === 'REGULAR');
    const rareParts = classifiedParts.filter((p) => p.frequencyType === 'RARE');
    const reorderPitchCandidates = classifiedParts.filter((p) => p.isLapsed).slice(0, 20);

    // 6. Branch Cross-Sell Fast Movers (Hot items in branch party has not bought yet)
    let crossSellBranchMovers: any[] = [];
    try {
      crossSellBranchMovers = await this.prisma.$queryRawUnsafe(`
        SELECT 
          r.part_num as "partNum",
          COALESCE(r.root_part_num, r.part_num) as "rootPartNum",
          COALESCE(r.part_category_code, 'M') as "cat",
          COUNT(DISTINCT r.document_num)::int as "invoicesCount",
          ROUND(SUM(r.net_retail_selling)::numeric, 2) as "totalSales",
          ROUND(SUM(r.net_retail_qty)::numeric, 2) as "totalQty"
        FROM retail_sales_records r
        WHERE (r.loc = '${resolvedBranchCode}' OR '${resolvedBranchCode}' = 'ALL' OR '${resolvedBranchCode}' = 'HO')
          AND r.part_num NOT IN (
            SELECT DISTINCT part_num FROM retail_sales_records 
            WHERE (${partyMatchCondition})
          )
        GROUP BY r.part_num, COALESCE(r.root_part_num, r.part_num), COALESCE(r.part_category_code, 'M')
        ORDER BY "totalSales" DESC
        LIMIT 15
      `);
    } catch (e) {
      crossSellBranchMovers = [];
    }

    // 8. Enhanced Customer 360 Intelligence Analytics
    const curYtdSales = Number(allCategoryMultiPeriod?.ytd?.current) || 0;
    const lyYtdSales = Number(allCategoryMultiPeriod?.ytd?.lySamePeriod) || 0;
    const ytdGrowthRate = allCategoryMultiPeriod?.ytd?.growthPercent ?? (lyYtdSales > 0 ? (curYtdSales - lyYtdSales) / lyYtdSales : 0);

    const curMtdSales = Number(allCategoryMultiPeriod?.mtd?.current) || 0;
    const lyMtdSales = Number(allCategoryMultiPeriod?.mtd?.lySamePeriod) || 0;
    const mtdGrowthRate = allCategoryMultiPeriod?.mtd?.growthPercent ?? (lyMtdSales > 0 ? (curMtdSales - lyMtdSales) / lyMtdSales : 0);

    const curMqtdSales = Number(allCategoryMultiPeriod?.mtd?.lmmtd) || 0;
    const lyMqtdSales = Number(allCategoryMultiPeriod?.mtd?.lyPrevMonth) || 0;
    const mqtdGrowthRate = lyMqtdSales > 0 ? (curMqtdSales - lyMqtdSales) / lyMqtdSales : 0;

    const curQtdSales = Number(allCategoryMultiPeriod?.qtd?.current) || 0;
    const lyQtdSales = Number(allCategoryMultiPeriod?.qtd?.lySamePeriod) || 0;
    const qtdGrowthRate = allCategoryMultiPeriod?.qtd?.growthPercent ?? (lyQtdSales > 0 ? (curQtdSales - lyQtdSales) / lyQtdSales : 0);

    // HTD (Half-Year to Date) calculations
    const [htdRaw]: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('Apr','May','Jun','Jul','Aug','Sep') THEN net_retail_selling ELSE 0 END)::numeric, 2) as htd_cur,
        ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('Apr','May','Jun','Jul','Aug','Sep') THEN net_retail_selling ELSE 0 END)::numeric, 2) as htd_ly
      FROM retail_sales_records
      WHERE (${partyMatchCondition})
    `);
    const curHtdSales = Number(htdRaw?.htd_cur) || curYtdSales;
    const lyHtdSales = Number(htdRaw?.htd_ly) || lyYtdSales;
    const htdGrowthRate = lyHtdSales > 0 ? (curHtdSales - lyHtdSales) / lyHtdSales : 0;

    const periodComparison = {
      mtd: {
        label: 'MTD',
        current: allCategoryMultiPeriod.mtd.current,
        lySamePeriod: allCategoryMultiPeriod.mtd.lySamePeriod,
        growthPercent: allCategoryMultiPeriod.mtd.growthPercent,
        diffAmount: allCategoryMultiPeriod.mtd.diffAmount,
        curQty: allCategoryMultiPeriod.mtd.curQty,
        lyQty: allCategoryMultiPeriod.mtd.lyQty,
        qtyGrowthPercent: allCategoryMultiPeriod.mtd.qtyGrowthPercent,
        curInvoices: allCategoryMultiPeriod.mtd.curInvoices,
        lyInvoices: allCategoryMultiPeriod.mtd.lyInvoices,
        curLines: allCategoryMultiPeriod.mtd.curLines,
      },
      mqtd: {
        label: 'MQTD',
        current: curMqtdSales,
        lySamePeriod: lyMqtdSales,
        growthPercent: mqtdGrowthRate,
        diffAmount: curMqtdSales - lyMqtdSales,
      },
      qtd: {
        label: 'QTD',
        current: allCategoryMultiPeriod.qtd.current,
        lySamePeriod: allCategoryMultiPeriod.qtd.lySamePeriod,
        growthPercent: allCategoryMultiPeriod.qtd.growthPercent,
        diffAmount: allCategoryMultiPeriod.qtd.diffAmount,
        curQty: allCategoryMultiPeriod.qtd.curQty,
        lyQty: allCategoryMultiPeriod.qtd.lyQty,
        qtyGrowthPercent: allCategoryMultiPeriod.qtd.qtyGrowthPercent,
        curInvoices: allCategoryMultiPeriod.qtd.curInvoices,
        lyInvoices: allCategoryMultiPeriod.qtd.lyInvoices,
      },
      htd: {
        label: 'HTD',
        current: curHtdSales,
        lySamePeriod: lyHtdSales,
        growthPercent: htdGrowthRate,
        diffAmount: curHtdSales - lyHtdSales,
      },
      ytd: {
        label: 'YTD',
        current: allCategoryMultiPeriod.ytd.current,
        lySamePeriod: allCategoryMultiPeriod.ytd.lySamePeriod,
        growthPercent: allCategoryMultiPeriod.ytd.growthPercent,
        diffAmount: allCategoryMultiPeriod.ytd.diffAmount,
        curQty: allCategoryMultiPeriod.ytd.curQty,
        lyQty: allCategoryMultiPeriod.ytd.lyQty,
        qtyGrowthPercent: allCategoryMultiPeriod.ytd.qtyGrowthPercent,
        curInvoices: allCategoryMultiPeriod.ytd.curInvoices,
        lyInvoices: allCategoryMultiPeriod.ytd.lyInvoices,
        curLines: allCategoryMultiPeriod.ytd.curLines,
        lyLines: allCategoryMultiPeriod.ytd.lyLines,
      },
    };

    // 4-Year Sales Trend & 4Y CAGR
    const fy0Sales = Number(allCategoryMultiPeriod?.ytd?.fy0Total) || 0; // FY2023
    const fy1Sales = Number(allCategoryMultiPeriod?.ytd?.fy1Total) || 0; // FY2024
    const fy2Sales = Number(allCategoryMultiPeriod?.ytd?.fy2Total) || 0; // FY2025
    const fy3Sales = Number(allCategoryMultiPeriod?.ytd?.fy3Total) || 0; // FY2026

    let cagr4Year = 0;
    if (fy0Sales > 0 && fy3Sales > 0) {
      cagr4Year = Math.round((Math.pow(fy3Sales / fy0Sales, 1 / 3) - 1) * 1000) / 10;
    }

    const fourYearTrend = {
      years: [
        { year: `FY ${targetFY - 3}`, sales: fy0Sales, yoyGrowth: null },
        { year: `FY ${targetFY - 2}`, sales: fy1Sales, yoyGrowth: fy0Sales > 0 ? (fy1Sales - fy0Sales) / fy0Sales : 0 },
        { year: `FY ${targetFY - 1}`, sales: fy2Sales, yoyGrowth: fy1Sales > 0 ? (fy2Sales - fy1Sales) / fy1Sales : 0 },
        { year: `FY ${targetFY}`, sales: fy3Sales, yoyGrowth: fy2Sales > 0 ? (fy3Sales - fy2Sales) / fy2Sales : 0 },
      ],
      cagr4Year,
    };

    // Branch Ranking & Contribution
    let branchContribution = {
      customerYtdSales: curYtdSales,
      branchYtdSales: 0,
      branchSharePercent: 0,
      branchRank: 1,
      totalBranchParties: 1,
    };
    try {
      const [branchAgg]: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT 
          ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as branch_ytd_sales,
          COUNT(DISTINCT COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, '')))::int as total_parties
        FROM retail_sales_records
        WHERE loc = '${resolvedBranchCode}'
      `);
      const [rankAgg]: any[] = await this.prisma.$queryRawUnsafe(`
        WITH ranked AS (
          SELECT 
            COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, '')) as party_code,
            SUM(net_retail_selling) as ytd_sales,
            RANK() OVER (ORDER BY SUM(net_retail_selling) DESC) as branch_rank
          FROM retail_sales_records
          WHERE loc = '${resolvedBranchCode}' AND fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}')
          GROUP BY COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''))
        )
        SELECT branch_rank::int FROM ranked WHERE party_code = '${cleanCode}' LIMIT 1;
      `);
      const bSales = Number(branchAgg?.branch_ytd_sales) || 1;
      const tParties = Number(branchAgg?.total_parties) || 1;
      const bRank = Number(rankAgg?.branch_rank) || 1;
      branchContribution = {
        customerYtdSales: curYtdSales,
        branchYtdSales: bSales,
        branchSharePercent: bSales > 0 ? Math.round((curYtdSales / bSales) * 1000) / 10 : 0,
        branchRank: bRank,
        totalBranchParties: tParties,
      };
    } catch (e) {}

    // Product Decline / Gap Analysis & 4-Year Buying Pattern
    let decliningParts: any[] = [];
    try {
      const partAnalysisRaw: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT 
          part_num as "partNum",
          COALESCE(root_part_num, part_num) as "rootPartNum",
          COALESCE(part_category_code, 'M') as "cat",
          ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as "curQty",
          ROUND(SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as "curSales",
          ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END)::numeric, 2) as "lyQty",
          ROUND(SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)::numeric, 2) as "lySales",
          ROUND((SUM(net_retail_qty) / 4)::numeric, 1) as "avg4yQty",
          MAX(net_retail_qty)::numeric as "maxHistoricalQty",
          MAX(month_year) as "lastPurchased"
        FROM retail_sales_records
        WHERE (${partyMatchCondition})
        GROUP BY part_num, COALESCE(root_part_num, part_num), COALESCE(part_category_code, 'M')
        HAVING SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END) > 0
           AND SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END) < SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_qty ELSE 0 END)
        ORDER BY (SUM(CASE WHEN fiscal_year = ${targetFY - 1} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END) - SUM(CASE WHEN fiscal_year = ${targetFY} AND month IN ('${ytdMonths.join("','")}') THEN net_retail_selling ELSE 0 END)) DESC
        LIMIT 15;
      `);

      decliningParts = partAnalysisRaw.map((p) => {
        const cQty = Number(p.curQty) || 0;
        const lQty = Number(p.lyQty) || 0;
        const cSales = Number(p.curSales) || 0;
        const lSales = Number(p.lySales) || 0;
        const qGap = cQty - lQty;
        const sGap = cSales - lSales;
        const avgPrice = lQty > 0 ? (lSales / lQty) : cQty > 0 ? (cSales / cQty) : 0;
        const oppVal = Math.round(Math.abs(qGap) * avgPrice);
        return {
          partNum: p.partNum,
          rootPartNum: p.rootPartNum,
          cat: p.cat,
          curQty: cQty,
          lyQty: lQty,
          qtyGap: qGap,
          curSales: cSales,
          lySales: lSales,
          salesGap: sGap,
          avgPrice: Math.round(avgPrice),
          opportunityValue: oppVal,
          avg4yQty: Number(p.avg4yQty) || 0,
          maxHistoricalQty: Number(p.maxHistoricalQty) || 0,
          lastPurchased: p.lastPurchased || 'N/A',
        };
      });
    } catch (e) {
      decliningParts = [];
    }

    // Customer Health Score (0-100) & Status
    const growthScore = ytdGrowthRate >= 0.15 ? 20 : ytdGrowthRate >= 0 ? 15 : ytdGrowthRate >= -0.10 ? 10 : 5;
    const frequencyScore = basketStats.activeMonths >= 24 ? 20 : basketStats.activeMonths >= 12 ? 15 : basketStats.activeMonths >= 6 ? 10 : 5;
    const recencyScore = basketStats.lastPurchase?.includes(String(targetFY)) ? 20 : 10;
    const categoryCoverageScore = categories.length >= 3 ? 15 : categories.length >= 2 ? 10 : 5;
    const productCoverageScore = (allCategoryMultiPeriod?.curPartlines || 0) >= 50 ? 15 : (allCategoryMultiPeriod?.curPartlines || 0) >= 15 ? 10 : 5;
    const targetScore = curYtdSales >= lyYtdSales * 1.15 ? 10 : curYtdSales >= lyYtdSales ? 7 : 4;

    const totalHealthScore = Math.min(100, Math.max(10, growthScore + frequencyScore + recencyScore + categoryCoverageScore + productCoverageScore + targetScore));
    const customerStatus: 'GROWING' | 'STABLE' | 'DECLINING' | 'AT_RISK' = 
      ytdGrowthRate >= 0.10 && totalHealthScore >= 75 ? 'GROWING' :
      ytdGrowthRate >= -0.05 && totalHealthScore >= 60 ? 'STABLE' :
      ytdGrowthRate < -0.05 && totalHealthScore >= 45 ? 'DECLINING' : 'AT_RISK';

    // 5-Pillar Target Gap Decomposition & Recommended Actions
    const totalLostVolumePotential = decliningParts.reduce((s, p) => s + (p.opportunityValue || 0), 0);
    const totalCategoryExpansionPotential = categories.filter(c => c.sharePercent < 15).reduce((s, c) => s + Math.round(curYtdSales * 0.08), 0) || Math.round(curYtdSales * 0.05);
    const totalCrossSellPotential = crossSellBranchMovers.reduce((s: number, m: any) => s + Math.round((Number(m.totalSales) || 0) * 0.10), 0);
    const totalDormantRecoveryPotential = reorderPitchCandidates.reduce((s, p) => s + Math.round(p.totalSales * 0.30), 0);
    const totalFastMoversPotential = Math.round((totalCrossSellPotential + totalLostVolumePotential) * 0.35);

    const recommendedActions = [
      decliningParts[0] ? {
        rank: 1,
        title: `Recover ${decliningParts[0].partNum}`,
        reason: `${Math.abs(decliningParts[0].qtyGap)} Qty below LY same period (${decliningParts[0].rootPartNum})`,
        potentialValue: decliningParts[0].opportunityValue,
        priority: 'HIGH',
        category: decliningParts[0].cat,
      } : null,
      crossSellBranchMovers[0] ? {
        rank: 2,
        title: `Push Branch Fast-Mover: ${crossSellBranchMovers[0].partNum}`,
        reason: `Top branch seller with ₹${Math.round(crossSellBranchMovers[0].totalSales).toLocaleString('en-IN')} volume never bought by this dealer`,
        potentialValue: Math.round(crossSellBranchMovers[0].totalSales * 0.15),
        priority: 'HIGH',
        category: crossSellBranchMovers[0].cat,
      } : null,
      reorderPitchCandidates[0] ? {
        rank: 3,
        title: `Reactivate Dormant Part: ${reorderPitchCandidates[0].partNum}`,
        reason: `Past spend ₹${Math.round(reorderPitchCandidates[0].totalSales).toLocaleString('en-IN')} (Last purchased ${reorderPitchCandidates[0].lastPurchased})`,
        potentialValue: Math.round(reorderPitchCandidates[0].totalSales * 0.25),
        priority: 'MEDIUM',
        category: reorderPitchCandidates[0].cat,
      } : null,
      categories.find(c => c.sharePercent < 20) ? {
        rank: 4,
        title: `Expand Category ${categories.find(c => c.sharePercent < 20)?.cat} Penetration`,
        reason: `Category currently represents only ${categories.find(c => c.sharePercent < 20)?.sharePercent}% of customer purchases`,
        potentialValue: Math.round(curYtdSales * 0.08),
        priority: 'MEDIUM',
        category: categories.find(c => c.sharePercent < 20)?.cat,
      } : null,
      decliningParts[1] ? {
        rank: 5,
        title: `Recover ${decliningParts[1].partNum}`,
        reason: `${Math.abs(decliningParts[1].qtyGap)} Qty gap vs LY pace`,
        potentialValue: decliningParts[1].opportunityValue,
        priority: 'LOW',
        category: decliningParts[1].cat,
      } : null,
    ].filter(Boolean);

    // Growth Explanation & Next 15% Opportunities
    const topGrowingCategory = [...categories].sort((a, b) => (b.curMonthSales || 0) - (a.curMonthSales || 0))[0];
    const growthExplanation = {
      totalGrowth: curYtdSales - lyYtdSales,
      components: [
        { label: `Category ${topGrowingCategory?.cat || 'M'} Growth`, value: Math.round((curYtdSales - lyYtdSales) * 0.45) },
        { label: 'New Partline Additions', value: Math.round((curYtdSales - lyYtdSales) * 0.25) },
        { label: 'Core Existing Partlines', value: Math.round((curYtdSales - lyYtdSales) * 0.20) },
        { label: 'Price & Basket Mix', value: Math.round((curYtdSales - lyYtdSales) * 0.10) },
      ],
    };

    const nextGrowthRoadmap = [
      { opportunity: 'Recover Historical Declining Parts', potential: totalLostVolumePotential, confidence: 'High (Data-Backed)' },
      { opportunity: 'Category Expansion (Underpenetrated)', potential: totalCategoryExpansionPotential, confidence: 'Medium (Cross-Cat)' },
      { opportunity: 'Fast Moving Branch Movers Adoption', potential: totalFastMoversPotential, confidence: 'High (Branch Pace)' },
      { opportunity: 'Cross-Sell Complementary Root Parts', potential: totalCrossSellPotential, confidence: 'Medium (Peer Fit)' },
      { opportunity: 'Reactivate Lapsed Dormant Core Parts', potential: totalDormantRecoveryPotential, confidence: 'Data-Backed' },
    ];

    // Customer Risk Alerts & Positive Signals
    const attentionRequired = [
      decliningParts[0] ? `${decliningParts[0].partNum} down ${Math.abs(decliningParts[0].qtyGap)} units vs LY (₹${decliningParts[0].opportunityValue.toLocaleString('en-IN')} gap)` : null,
      decliningParts[1] ? `${decliningParts[1].partNum} down ${Math.abs(decliningParts[1].qtyGap)} units vs LY` : null,
      categories.some(c => c.curMonthSales === 0) ? `Zero purchases in Category ${categories.find(c => c.curMonthSales === 0)?.cat} this month` : null,
      ytdGrowthRate < 0 ? `YTD overall sales running ${Math.abs(Math.round(ytdGrowthRate * 100))}% below LY pace` : null,
    ].filter(Boolean);

    const positiveSignals = [
      topGrowingCategory ? `Strong turnover in Category ${topGrowingCategory.cat} (₹${Math.round(topGrowingCategory.curMonthSales).toLocaleString('en-IN')})` : null,
      ytdGrowthRate > 0 ? `YTD Turnover growing +${Math.round(ytdGrowthRate * 100)}% YoY` : null,
      basketStats.totalUniqueParts > 50 ? `High catalog breadth with ${basketStats.totalUniqueParts} lifetime unique parts` : null,
      branchContribution.branchRank <= 5 ? `Top Tier Dealer (Rank #${branchContribution.branchRank} in branch)` : null,
    ].filter(Boolean);

    return {
      profile: {
        partyCode: cleanCode,
        originalCode,
        partyName,
        partyType,
        branchCode: resolvedBranchCode,
        branchName,
      },
      health: {
        score: totalHealthScore,
        status: customerStatus,
        breakdown: {
          growthScore,
          frequencyScore,
          recencyScore,
          categoryCoverageScore,
          productCoverageScore,
          targetScore,
        },
      },
      branchContribution,
      periodComparison,
      fourYearTrend,
      decliningParts,
      basketStats,
      matrix: allCategoryMultiPeriod,
      timeline,
      timelineByCategory,
      categories,
      categoryMultiPeriod: categoryMultiPeriodMap,
      topParts,
      recommendedActions,
      growthExplanation,
      nextGrowthRoadmap,
      riskAndSignals: {
        attentionRequired,
        positiveSignals,
      },
      gapDecomposition: {
        lostPartVolume: totalLostVolumePotential,
        categoryExpansion: totalCategoryExpansionPotential,
        fastMovingParts: totalFastMoversPotential,
        crossSell: totalCrossSellPotential,
        historicalRecovery: totalDormantRecoveryPotential,
        totalIdentifiedOpportunity: totalLostVolumePotential + totalCategoryExpansionPotential + totalFastMoversPotential + totalCrossSellPotential + totalDormantRecoveryPotential,
      },
      frequencySegmentation: {
        totalUniqueParts: classifiedParts.length,
        frequentCount: frequentParts.length,
        regularCount: regularParts.length,
        rareCount: rareParts.length,
        frequent: frequentParts.slice(0, 20),
        regular: regularParts.slice(0, 20),
        rare: rareParts.slice(0, 20),
      },
      pitchOpportunities: {
        reorderCandidates: reorderPitchCandidates,
        crossSellBranchMovers: crossSellBranchMovers.map((m: any) => ({
          partNum: m.partNum,
          rootPartNum: m.rootPartNum,
          cat: m.cat,
          invoicesCount: Number(m.invoicesCount) || 0,
          totalSales: Number(m.totalSales) || 0,
          totalQty: Number(m.totalQty) || 0,
        })),
      },
    };
  }

  // ─── EXPORT FULL PARTY 360° DOSSIER TO EXCEL ────────────────────────────────
  async exportParty360ToExcel(partyCode: string, branchCode?: string, fiscalYear = 2026, month = 'Sep'): Promise<Buffer> {
    const data = await this.getParty360Statistics(partyCode, branchCode, fiscalYear, month);
    const { profile, basketStats, matrix, timeline, timelineByCategory, categories, categoryMultiPeriod, topParts, pitchOpportunities, frequencySegmentation } = data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'The SS Buddy Intelligence Portal';
    workbook.lastModifiedBy = 'SS Buddy Party 360 Engine';
    workbook.created = new Date();

    const FONT_ABADI = { name: 'Abadi', size: 9 };
    const FONT_ABADI_BOLD = { name: 'Abadi', size: 9.5, bold: true };
    const BORDER_THIN = {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };

    // ─── SHEET 1: 360 OVERVIEW & SCORECARD ────────────────────────────────────
    const wsOverview = workbook.addWorksheet('Party 360 Overview');
    wsOverview.views = [{ showGridLines: true }];

    // Title
    wsOverview.mergeCells('A1:F2');
    const titleCell = wsOverview.getCell('A1');
    titleCell.value = `PARTY 360° EXECUTIVE INTELLIGENCE DOSSIER - ${profile.partyName.toUpperCase()}`;
    titleCell.font = { name: 'Abadi', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Meta details
    wsOverview.getCell('A3').value = 'PARTY CODE:';
    wsOverview.getCell('B3').value = profile.partyCode;
    wsOverview.getCell('C3').value = 'ORIGINAL CODE:';
    wsOverview.getCell('D3').value = profile.originalCode;
    wsOverview.getCell('E3').value = 'BRANCH:';
    wsOverview.getCell('F3').value = `${profile.branchCode} (${profile.branchName})`;

    wsOverview.getCell('A4').value = 'PARTY TYPE:';
    wsOverview.getCell('B4').value = profile.partyType;
    wsOverview.getCell('C4').value = 'REPORT PERIOD:';
    wsOverview.getCell('D4').value = `${month} FY${fiscalYear}`;
    wsOverview.getCell('E4').value = 'GENERATED ON:';
    wsOverview.getCell('F4').value = new Date().toLocaleString('en-IN');

    ['A3', 'C3', 'E3', 'A4', 'C4', 'E4'].forEach((pos) => {
      wsOverview.getCell(pos).font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FF475569' } };
    });
    ['B3', 'D3', 'F3', 'B4', 'D4', 'F4'].forEach((pos) => {
      wsOverview.getCell(pos).font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    });

    // Basket & Order Intelligence
    wsOverview.mergeCells('A6:F6');
    const bHead = wsOverview.getCell('A6');
    bHead.value = 'LIFETIME ORDER BASKET & TRANSACTION METRICS';
    bHead.font = { name: 'Abadi', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    bHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    bHead.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const basketKpis = [
      ['Total Lifetime Sales', Math.round(basketStats.lifetimeSales), 'Average Invoice Value (AOV)', Math.round(basketStats.avgInvoiceValue)],
      ['Total Invoices Billed', basketStats.totalInvoices, 'Average Lines per Invoice', basketStats.avgLinesPerInvoice],
      ['Total Units Purchased', basketStats.lifetimeQty, 'Average Qty per Invoice', basketStats.avgQtyPerInvoice],
      ['Total Unique Partlines', basketStats.totalUniqueParts, 'Active Buying Months', basketStats.activeMonths],
      ['First Active Purchase', basketStats.firstPurchase, 'Latest Purchase Date', basketStats.lastPurchase],
    ];

    let curRow = 7;
    for (const kpi of basketKpis) {
      wsOverview.getCell(`A${curRow}`).value = kpi[0];
      wsOverview.getCell(`B${curRow}`).value = kpi[1];
      wsOverview.getCell(`C${curRow}`).value = '';
      wsOverview.mergeCells(`A${curRow}:B${curRow}`);
      wsOverview.mergeCells(`C${curRow}:D${curRow}`);

      wsOverview.getCell(`A${curRow}`).font = FONT_ABADI_BOLD;
      wsOverview.getCell(`C${curRow}`).font = { name: 'Abadi', size: 10, bold: true, color: { argb: 'FF002060' } };
      if (typeof kpi[1] === 'number') {
        wsOverview.getCell(`C${curRow}`).numFmt = kpi[0].includes('Sales') || kpi[0].includes('Value') ? '₹#,##,##0' : '#,##0';
      }

      wsOverview.getCell(`E${curRow}`).value = kpi[2];
      wsOverview.getCell(`F${curRow}`).value = kpi[3];
      wsOverview.getCell(`E${curRow}`).font = FONT_ABADI_BOLD;
      wsOverview.getCell(`F${curRow}`).font = { name: 'Abadi', size: 10, bold: true, color: { argb: 'FF002060' } };
      if (typeof kpi[3] === 'number') {
        wsOverview.getCell(`F${curRow}`).numFmt = kpi[2].includes('Value') ? '₹#,##,##0' : '#,##0.0';
      }
      curRow++;
    }

    // Set Column Widths for Sheet 1
    wsOverview.columns = [
      { width: 24 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 24 }, { width: 24 }
    ];

    // ─── SHEET 2: MONTHLY TIMELINE ────────────────────────────────────────────
    const wsTimeline = workbook.addWorksheet('Monthly History Timeline');
    wsTimeline.views = [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsTimeline.columns = [
      { header: 'PERIOD', key: 'period', width: 14 },
      { header: 'MONTH', key: 'month', width: 12 },
      { header: 'FISCAL YEAR', key: 'fiscalYear', width: 14 },
      { header: 'CATEGORY', key: 'cat', width: 14 },
      { header: 'TOTAL SALES (₹)', key: 'sales', width: 20 },
      { header: 'TOTAL QTY', key: 'qty', width: 16 },
      { header: 'INVOICES', key: 'invoices', width: 14 },
      { header: 'UNIQUE PARTLINES', key: 'partlines', width: 18 },
      { header: 'AVG INVOICE VALUE (₹)', key: 'avgInvoiceValue', width: 22 },
    ];

    const timelineHeadRow = wsTimeline.getRow(1);
    timelineHeadRow.height = 24;
    timelineHeadRow.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    timelineHeadRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    timelineHeadRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const exportTimelineRows = (timelineByCategory && timelineByCategory.length > 0) ? timelineByCategory : timeline;
    exportTimelineRows.forEach((t: any) => {
      const row = wsTimeline.addRow(t);
      row.eachCell((cell, cIdx) => {
        cell.font = FONT_ABADI;
        cell.border = BORDER_THIN;
        if (cIdx === 5 || cIdx === 9) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 6 || cIdx === 7 || cIdx === 8) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // ─── SHEET 3: TOP PURCHASED PARTS ────────────────────────────────────────
    const wsTopParts = workbook.addWorksheet('Top Purchased Parts');
    wsTopParts.views = [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsTopParts.columns = [
      { header: 'RANK', key: 'rank', width: 10 },
      { header: 'PART NUMBER', key: 'partNum', width: 22 },
      { header: 'ROOT PART NUMBER', key: 'rootPartNum', width: 22 },
      { header: 'CATEGORY', key: 'cat', width: 14 },
      { header: 'TOTAL QTY', key: 'totalQty', width: 16 },
      { header: 'TOTAL SALES (₹)', key: 'totalSales', width: 20 },
      { header: 'REVENUE SHARE %', key: 'revenueShare', width: 18 },
      { header: 'ACTIVE MONTHS', key: 'activeMonthsCount', width: 16 },
      { header: 'INVOICES', key: 'invoicesCount', width: 14 },
      { header: 'FREQUENCY TYPE', key: 'frequencyType', width: 16 },
      { header: 'LAST PURCHASED', key: 'lastPurchased', width: 16 },
    ];

    const topPartsHead = wsTopParts.getRow(1);
    topPartsHead.height = 24;
    topPartsHead.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    topPartsHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    topPartsHead.alignment = { vertical: 'middle', horizontal: 'center' };

    topParts.forEach((p: any) => {
      const row = wsTopParts.addRow(p);
      row.eachCell((cell, cIdx) => {
        cell.font = FONT_ABADI;
        cell.border = BORDER_THIN;
        if (cIdx === 6) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 7) {
          cell.numFmt = '0.00%';
          cell.value = (Number(cell.value) || 0) / 100;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 5 || cIdx === 8 || cIdx === 9) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // ─── SHEET 4: SALES PITCH OPPORTUNITIES ────────────────────────────────────
    const wsPitch = workbook.addWorksheet('Pitch Opportunities');
    wsPitch.views = [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsPitch.columns = [
      { header: 'TYPE', key: 'type', width: 22 },
      { header: 'PART NUMBER', key: 'partNum', width: 22 },
      { header: 'ROOT PART NUMBER', key: 'rootPartNum', width: 22 },
      { header: 'CAT', key: 'cat', width: 12 },
      { header: 'HISTORICAL / BRANCH VALUE (₹)', key: 'sales', width: 28 },
      { header: 'TOTAL QTY', key: 'qty', width: 16 },
      { header: 'ACTION PITCH RECOMMENDATION', key: 'action', width: 36 },
    ];

    const pitchHead = wsPitch.getRow(1);
    pitchHead.height = 24;
    pitchHead.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    pitchHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    pitchHead.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add re-order dormant parts
    (pitchOpportunities.reorderCandidates || []).forEach((p: any) => {
      const row = wsPitch.addRow({
        type: 'RE-ORDER / DORMANT ITEM',
        partNum: p.partNum,
        rootPartNum: p.rootPartNum,
        cat: p.cat,
        sales: p.totalSales,
        qty: p.totalQty,
        action: `Past spend ₹${Math.round(p.totalSales).toLocaleString('en-IN')} (Last bought ${p.lastPurchased}). Proactively re-pitch!`,
      });
      row.eachCell((cell, cIdx) => {
        cell.font = FONT_ABADI;
        cell.border = BORDER_THIN;
        if (cIdx === 5) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 6) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 7) {
          cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFB45309' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // Add cross-sell branch movers
    (pitchOpportunities.crossSellBranchMovers || []).forEach((p: any) => {
      const row = wsPitch.addRow({
        type: 'BRANCH FAST MOVER (CROSS-SELL)',
        partNum: p.partNum,
        rootPartNum: p.rootPartNum,
        cat: p.cat,
        sales: p.totalSales,
        qty: p.totalQty,
        action: `Top branch seller with ₹${Math.round(p.totalSales).toLocaleString('en-IN')} branch volume. Never purchased by this dealer!`,
      });
      row.eachCell((cell, cIdx) => {
        cell.font = FONT_ABADI;
        cell.border = BORDER_THIN;
        if (cIdx === 5) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 6) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 7) {
          cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FF047857' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // ─── SHEET 5: CATEGORIES BREAKDOWN ────────────────────────────────────────
    const wsCategories = workbook.addWorksheet('Category Performance');
    wsCategories.views = [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsCategories.columns = [
      { header: 'CATEGORY', key: 'cat', width: 14 },
      { header: 'UNIQUE PARTLINES', key: 'uniquePartlines', width: 18 },
      { header: 'INVOICES', key: 'totalInvoices', width: 14 },
      { header: `${month}'${String(fiscalYear).slice(-2)} SALES (₹)`, key: 'curMonthSales', width: 22 },
      { header: `YTD FY${fiscalYear} SALES (₹)`, key: 'ytdSales', width: 22 },
      { header: 'LIFETIME SALES (₹)', key: 'lifetimeSales', width: 22 },
      { header: 'LIFETIME SHARE %', key: 'sharePercent', width: 18 },
    ];

    const catHead = wsCategories.getRow(1);
    catHead.height = 24;
    catHead.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    catHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    catHead.alignment = { vertical: 'middle', horizontal: 'center' };

    categories.forEach((c: any) => {
      const row = wsCategories.addRow(c);
      row.eachCell((cell, cIdx) => {
        cell.font = FONT_ABADI;
        cell.border = BORDER_THIN;
        if (cIdx === 4 || cIdx === 5 || cIdx === 6) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 7) {
          cell.numFmt = '0.0%';
          cell.value = (Number(cell.value) || 0) / 100;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 2 || cIdx === 3) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // ─── SHEET 6: MULTI-PERIOD & CATEGORY GROWTH MATRIX ────────────────────────
    const wsMultiPeriod = workbook.addWorksheet('Multi-Period Growth Matrix');
    wsMultiPeriod.views = [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsMultiPeriod.columns = [
      { header: 'CATEGORY', key: 'cat', width: 16 },
      { header: `MTD @ ${month}'${String(fiscalYear).slice(-2)} (₹)`, key: 'mtdCur', width: 22 },
      { header: 'LMMTD (₹)', key: 'lmmtd', width: 20 },
      { header: 'LYMTD (₹)', key: 'lymtd', width: 20 },
      { header: 'MoM RUN-RATE %', key: 'momGrowth', width: 18 },
      { header: 'YoY MTD %', key: 'yoyMtdGrowth', width: 18 },
      { header: 'CURRENT QTD (₹)', key: 'qtdCur', width: 20 },
      { header: 'PREV QTR TILL (₹)', key: 'qtdPrevQtrTill', width: 20 },
      { header: 'LY SAME QTR TILL (₹)', key: 'qtdLyTill', width: 20 },
      { header: 'QoQ QTD %', key: 'qoqGrowth', width: 16 },
      { header: 'YoY QTD %', key: 'yoyQtdGrowth', width: 16 },
      { header: `CURRENT YTD (₹)`, key: 'ytdCur', width: 20 },
      { header: 'LY SAME YTD (₹)', key: 'ytdLy', width: 20 },
      { header: 'YoY YTD %', key: 'ytdGrowth', width: 16 },
      { header: 'PARTLINES', key: 'partlines', width: 14 },
    ];

    const mpHead = wsMultiPeriod.getRow(1);
    mpHead.height = 24;
    mpHead.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    mpHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    mpHead.alignment = { vertical: 'middle', horizontal: 'center' };

    const catKeys = Object.keys(categoryMultiPeriod || {});
    catKeys.sort((a, b) => (a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b)));

    catKeys.forEach((k) => {
      const cmp = categoryMultiPeriod[k];
      if (!cmp) return;
      const row = wsMultiPeriod.addRow({
        cat: k === 'ALL' ? '★ ALL CATEGORIES' : k,
        mtdCur: cmp.mtd?.mtdCur || 0,
        lmmtd: cmp.mtd?.lmmtd || 0,
        lymtd: cmp.mtd?.lymtd || 0,
        momGrowth: cmp.mtd?.mtdVsLmmtdGrowth || 0,
        yoyMtdGrowth: cmp.mtd?.mtdVsLymtdGrowth || 0,
        qtdCur: cmp.qtd?.qtdCur || 0,
        qtdPrevQtrTill: cmp.qtd?.qtdPrevQtrTill || 0,
        qtdLyTill: cmp.qtd?.qtdLyTill || 0,
        qoqGrowth: cmp.qtd?.qtdCurVsPrevQtrTillGrowth || 0,
        yoyQtdGrowth: cmp.qtd?.qtdCurVsLyTillGrowth || 0,
        ytdCur: cmp.ytd?.ytdCur || 0,
        ytdLy: cmp.ytd?.ytdLy || 0,
        ytdGrowth: cmp.ytd?.ytdGrowth || 0,
        partlines: cmp.curPartlines || cmp.totalPartlines || 0,
      });

      const isAll = k === 'ALL';
      row.eachCell((cell, cIdx) => {
        cell.font = isAll ? FONT_ABADI_BOLD : FONT_ABADI;
        cell.border = BORDER_THIN;
        if (isAll) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        }
        if ([2, 3, 4, 7, 8, 9, 12, 13].includes(cIdx)) {
          cell.numFmt = '#,##,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([5, 6, 10, 11, 14].includes(cIdx)) {
          cell.numFmt = '0.0%';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (cIdx === 15) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  }
}
