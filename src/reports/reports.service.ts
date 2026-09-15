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

    // Quarters
    let curQuarterMonths = ['Jul', 'Aug', 'Sep'];
    let curQuarterTillMonths = ['Jul', 'Aug', 'Sep'];
    let prevQuarterMonths = ['Apr', 'May', 'Jun'];
    let prevQuarterTillMonths = ['Apr', 'May', 'Jun'];
    let prevQuarterFY = targetFY;

    if (monthIdx <= 2) {
      curQuarterMonths = ['Apr', 'May', 'Jun'];
      curQuarterTillMonths = MONTH_ORDER.slice(0, monthIdx + 1);
      prevQuarterMonths = ['Jan', 'Feb', 'Mar'];
      prevQuarterTillMonths = ['Jan', 'Feb', 'Mar'];
      prevQuarterFY = targetFY - 1;
    } else if (monthIdx >= 3 && monthIdx <= 5) {
      curQuarterMonths = ['Jul', 'Aug', 'Sep'];
      curQuarterTillMonths = MONTH_ORDER.slice(3, monthIdx + 1);
      prevQuarterMonths = ['Apr', 'May', 'Jun'];
      prevQuarterTillMonths = ['Apr', 'May', 'Jun'];
      prevQuarterFY = targetFY;
    } else if (monthIdx >= 6 && monthIdx <= 8) {
      curQuarterMonths = ['Oct', 'Nov', 'Dec'];
      curQuarterTillMonths = MONTH_ORDER.slice(6, monthIdx + 1);
      prevQuarterMonths = ['Jul', 'Aug', 'Sep'];
      prevQuarterTillMonths = ['Jul', 'Aug', 'Sep'];
      prevQuarterFY = targetFY;
    } else {
      curQuarterMonths = ['Jan', 'Feb', 'Mar'];
      curQuarterTillMonths = MONTH_ORDER.slice(9, monthIdx + 1);
      prevQuarterMonths = ['Oct', 'Nov', 'Dec'];
      prevQuarterTillMonths = ['Oct', 'Nov', 'Dec'];
      prevQuarterFY = targetFY;
    }

    const ytdMonths = MONTH_ORDER.slice(0, monthIdx + 1);
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

    const rawRows: any[] = await this.prisma.$queryRawUnsafe(`
      WITH 
      cur_month AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          MAX(COALESCE(cons_party_name, dealer_code)) AS party_name, 
          COALESCE(party_type, 'TRADER/RETAILER') AS party_type,
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
      qtd_cur AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS qtd_cur_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY} AND month IN ('${curQuarterMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      qtd_prev_qtr_total AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS qtd_prev_qtr_total_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      qtd_prev_qtr_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS qtd_prev_qtr_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${prevQuarterFY} AND month IN ('${prevQuarterTillMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      qtd_ly_total AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS qtd_ly_total_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterMonths.join("','")}')
          ${branchSqlClause}
          ${catSqlClause}
        GROUP BY loc, COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-'), COALESCE(part_category_code, 'M')
      ),
      qtd_ly_till AS (
        SELECT 
          COALESCE(loc, 'HO') AS branch_code, 
          COALESCE(NULLIF(cons_party_code, ''), NULLIF(dealer_code, ''), '-') AS party_code, 
          COALESCE(part_category_code, 'M') AS cat,
          ROUND(SUM(net_retail_selling)::numeric, 2) AS qtd_ly_till_sales
        FROM retail_sales_records
        WHERE fiscal_year = ${targetFY - 1} AND month IN ('${curQuarterTillMonths.join("','")}')
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
          ROUND(SUM(CASE WHEN fiscal_year = ${fy1} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy1_total,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy2} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy2_total,
          ROUND(SUM(CASE WHEN fiscal_year = ${fy3} THEN net_retail_selling ELSE 0 END)::numeric, 2) AS fy3_total
        FROM retail_sales_records
        WHERE fiscal_year IN (${fy1}, ${fy2}, ${fy3})
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
      all_parties AS (
        SELECT branch_code, party_code, cat FROM cur_month
        UNION
        SELECT branch_code, party_code, cat FROM last_month
        UNION
        SELECT branch_code, party_code, cat FROM ly_same_month
      )
      SELECT 
        ap.branch_code AS "branchCode",
        ap.party_code AS "partyCode",
        ap.cat AS "partCategoryCode",
        COALESCE(NULLIF(cm.party_name, '-'), NULLIF(ly.party_name, '-'), ap.party_code) AS "partyName",
        COALESCE(NULLIF(cm.party_type, '-'), NULLIF(ly.party_type, '-'), 'TRADER/RETAILER') AS "partyType",
        COALESCE(cm.cur_sales, 0) AS "curSales",
        COALESCE(lm.lm_sales, 0) AS "lmSales",
        COALESCE(ly.ly_sm_sales, 0) AS "lySameMonthSales",
        COALESCE(lp.ly_pm_sales, 0) AS "lyPrevMonthSales",
        COALESCE(l2p.ly2_pm_sales, 0) AS "ly2PrevMonthSales",
        COALESCE(qc.qtd_cur_sales, 0) AS "qtdCurSales",
        COALESCE(qp.qtd_prev_qtr_total_sales, 0) AS "qtdPrevQtrTotalSales",
        COALESCE(qpt.qtd_prev_qtr_till_sales, 0) AS "qtdPrevQtrTillSales",
        COALESCE(qlt.qtd_ly_total_sales, 0) AS "qtdLyTotalSales",
        COALESCE(ql.qtd_ly_till_sales, 0) AS "qtdLyTillSales",
        COALESCE(yc.ytd_cur_sales, 0) AS "ytdCurSales",
        COALESCE(yl.ytd_ly_sales, 0) AS "ytdLySales",
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
      LEFT JOIN ly_prev_month lp ON ap.branch_code = lp.branch_code AND ap.party_code = lp.party_code AND ap.cat = lp.cat
      LEFT JOIN ly2_prev_month l2p ON ap.branch_code = l2p.branch_code AND ap.party_code = l2p.party_code AND ap.cat = l2p.cat
      LEFT JOIN qtd_cur qc ON ap.branch_code = qc.branch_code AND ap.party_code = qc.party_code AND ap.cat = qc.cat
      LEFT JOIN qtd_prev_qtr_total qp ON ap.branch_code = qp.branch_code AND ap.party_code = qp.party_code AND ap.cat = qp.cat
      LEFT JOIN qtd_prev_qtr_till qpt ON ap.branch_code = qpt.branch_code AND ap.party_code = qpt.party_code AND ap.cat = qpt.cat
      LEFT JOIN qtd_ly_total qlt ON ap.branch_code = qlt.branch_code AND ap.party_code = qlt.party_code AND ap.cat = qlt.cat
      LEFT JOIN qtd_ly_till ql ON ap.branch_code = ql.branch_code AND ap.party_code = ql.party_code AND ap.cat = ql.cat
      LEFT JOIN ytd_cur yc ON ap.branch_code = yc.branch_code AND ap.party_code = yc.party_code AND ap.cat = yc.cat
      LEFT JOIN ytd_ly yl ON ap.branch_code = yl.branch_code AND ap.party_code = yl.party_code AND ap.cat = yl.cat
      LEFT JOIN fy_totals ft ON ap.branch_code = ft.branch_code AND ap.party_code = ft.party_code AND ap.cat = ft.cat
      LEFT JOIN target_bases tb ON ap.branch_code = tb.branch_code AND ap.party_code = tb.party_code AND ap.cat = tb.cat
      LEFT JOIN dealer_targets dt ON ap.party_code = dt.party_code AND dt.year = ${targetFY} AND dt.month = ${monthIdx + 1} AND dt.part_category_code = ap.cat
      ORDER BY COALESCE(cm.cur_sales, lm.lm_sales, ly.ly_sm_sales, 0) DESC;
    `);

    // Master maps
    const [parties, partyMasters, branches] = await Promise.all([
      this.prisma.party.findMany({ select: { code: true, name: true, type: true } }),
      this.prisma.partyMaster.findMany({ select: { consPartyCode: true, originalCode: true, consPartyName: true } }),
      this.prisma.branch.findMany({ select: { code: true, name: true } }),
    ]);
    const partyMap = new Map<string, any>();
    parties.forEach((p) => partyMap.set(p.code.toUpperCase(), p));
    const partyMasterMap = new Map<string, any>();
    partyMasters.forEach((pm) => partyMasterMap.set(pm.consPartyCode.toUpperCase(), pm));
    const branchMap = new Map<string, string>();
    branches.forEach((b) => branchMap.set(b.code.toUpperCase(), b.name));

    // Consolidate if ALL categories
    let processedRows: any[] = [];
    if (!catFilter || catFilter === 'ALL') {
      const consolidatedMap = new Map<string, any>();
      for (const r of rawRows) {
        const key = `${r.branchCode}_${r.partyCode}`;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            branchCode: r.branchCode,
            partyCode: r.partyCode,
            partCategoryCode: 'ALL',
            partyName: r.partyName,
            partyType: r.partyType,
            curSales: 0,
            uniquePartlines: 0,
            lmSales: 0,
            lySameMonthSales: 0,
            lyPrevMonthSales: 0,
            ly2PrevMonthSales: 0,
            qtdCurSales: 0,
            qtdPrevQtrTotalSales: 0,
            qtdPrevQtrTillSales: 0,
            qtdLyTotalSales: 0,
            qtdLyTillSales: 0,
            ytdCurSales: 0,
            ytdLySales: 0,
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
        item.qtdCurSales += Number(r.qtdCurSales) || 0;
        item.qtdPrevQtrTotalSales += Number(r.qtdPrevQtrTotalSales) || 0;
        item.qtdPrevQtrTillSales += Number(r.qtdPrevQtrTillSales) || 0;
        item.qtdLyTotalSales += Number(r.qtdLyTotalSales) || 0;
        item.qtdLyTillSales += Number(r.qtdLyTillSales) || 0;
        item.ytdCurSales += Number(r.ytdCurSales) || 0;
        item.ytdLySales += Number(r.ytdLySales) || 0;
        item.fy1Total += Number(r.fy1Total) || 0;
        item.fy2Total += Number(r.fy2Total) || 0;
        item.fy3Total += Number(r.fy3Total) || 0;
        item.lastQuarterAvg += Number(r.lastQuarterAvg) || 0;
        item.lastFyAvg += Number(r.lastFyAvg) || 0;
        if (Number(r.adminDefinedTarget) > 0) item.adminDefinedTarget += Number(r.adminDefinedTarget);
      }
      processedRows = Array.from(consolidatedMap.values());
    } else {
      processedRows = rawRows;
    }

    if (metadata?.partyType && metadata.partyType !== 'ALL') {
      const pTypes = metadata.partyType.split(',').map((t: string) => t.trim().toUpperCase());
      processedRows = processedRows.filter((r) => {
        const pt = (partyMap.get(r.partyCode.toUpperCase())?.type || r.partyType || '').toUpperCase();
        return pTypes.includes(pt);
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
      const k = `${st.branchCode.toUpperCase()}_${st.partyCode.toUpperCase()}_${(st.partCategoryCode || 'ALL').toUpperCase()}`;
      snapshotMap.set(k, st);
      const kAll = `${st.branchCode.toUpperCase()}_${st.partyCode.toUpperCase()}_ALL`;
      if (!snapshotMap.has(kAll)) {
        snapshotMap.set(kAll, {
          branchCode: st.branchCode,
          partyCode: st.partyCode,
          partCategoryCode: 'ALL',
          weightedBase: 0,
          recommendedTarget: 0,
          adminDefinedTarget: 0,
          finalTarget: 0,
        });
      }
      const allObj = snapshotMap.get(kAll);
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
      const partyType = pMaster?.type || r.partyType || 'TRADER/RETAILER';
      const branchName = branchMap.get(r.branchCode.toUpperCase()) || r.branchCode;

      const curSales = Number(r.curSales) || 0;
      const uniquePartlines = Number(r.uniquePartlines) || 0;
      const lmSales = Number(r.lmSales) || 0;
      const lySameMonthSales = Number(r.lySameMonthSales) || 0;
      const lyPrevMonthSales = Number(r.lyPrevMonthSales) || 0;
      const ly2PrevMonthSales = Number(r.ly2PrevMonthSales) || 0;

      const qtdCurSales = Number(r.qtdCurSales) || 0;
      const qtdPrevQtrTotalSales = Number(r.qtdPrevQtrTotalSales) || 0;
      const qtdPrevQtrTillSales = Number(r.qtdPrevQtrTillSales) || 0;
      const qtdLyTotalSales = Number(r.qtdLyTotalSales) || 0;
      const qtdLyTillSales = Number(r.qtdLyTillSales) || 0;

      const ytdCurSales = Number(r.ytdCurSales) || 0;
      const ytdLySales = Number(r.ytdLySales) || 0;

      const fy1Total = Number(r.fy1Total) || 0;
      const fy2Total = Number(r.fy2Total) || 0;
      const fy3Total = Number(r.fy3Total) || 0;

      const lqAvg = Number(r.lastQuarterAvg) || 0;
      const lfyAvg = Number(r.lastFyAvg) || 0;

      const snapKey = `${r.branchCode.toUpperCase()}_${r.partyCode.toUpperCase()}_${(r.partCategoryCode || 'ALL').toUpperCase()}`;
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

      const mtdLyGrowth = ly2PrevMonthSales > 0 ? ((lyPrevMonthSales - ly2PrevMonthSales) / ly2PrevMonthSales) : 0;
      const mtdLmGrowth = lyPrevMonthSales > 0 ? ((lmSales - lyPrevMonthSales) / lyPrevMonthSales) : 0;
      const mtdCurGrowth = lySameMonthSales > 0 ? ((curSales - lySameMonthSales) / lySameMonthSales) : 0;

      const qtdAug25Growth = qtdLyTotalSales > 0 ? ((qtdLyTillSales - qtdLyTotalSales) / qtdLyTotalSales) : 0;
      const qtdAug26Growth = qtdLyTillSales > 0 ? ((qtdPrevQtrTillSales - qtdLyTillSales) / qtdLyTillSales) : 0;
      const qtdCurGrowth = qtdLyTotalSales > 0 ? ((qtdCurSales - qtdLyTotalSales) / qtdLyTotalSales) : 0;

      const ytdGrowth = ytdLySales > 0 ? ((ytdCurSales - ytdLySales) / ytdLySales) : 0;

      const fy24Growth = fy1Total > 0 ? ((fy2Total - fy1Total) / fy1Total) : 0;
      const fy25Growth = fy2Total > 0 ? ((fy3Total - fy2Total) / fy2Total) : 0;

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

        // MTD
        lmSales,
        lySameMonthSales,
        mtdAug25: lyPrevMonthSales,
        mtdAug26: lmSales,
        mtdSep26: curSales,
        mtdAug25Growth: mtdLyGrowth,
        mtdAug26Growth: mtdLmGrowth,
        mtdSep26Growth: mtdCurGrowth,

        // QTD
        qtdQ2LyTotal: qtdLyTotalSales,
        qtdQ2LyTill: qtdLyTillSales,
        qtdQ1CurTotal: qtdPrevQtrTotalSales,
        qtdQ1CurTill: qtdPrevQtrTillSales,
        qtdQ2Cur: qtdCurSales,
        qtdAug25Growth,
        qtdAug26Growth,
        qtdSep26Growth: qtdCurGrowth,

        // YTD & 3-Year
        ytdLy: ytdLySales,
        ytdCur: ytdCurSales,
        ytdGrowth,
        fy1Total,
        fy2Total,
        fy3Total,
        fy24Growth,
        fy25Growth,

        // Target & Fulfillment
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

    calculatedRows.sort((a, b) => b.mtdSep26 - a.mtdSep26 || b.lmSales - a.lmSales);
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
      const totalSales = calculatedRows.reduce((s: number, x: any) => s + (Number(x.mtdSep26) || Number(x.currentSales) || 0), 0);
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

    // Fetch party master mappings for originalCode
    const partyMasters = await this.prisma.partyMaster.findMany({
      select: { consPartyCode: true, originalCode: true },
    });
    const partyMasterMap = new Map();
    partyMasters.forEach((pm) => partyMasterMap.set(pm.consPartyCode.toUpperCase(), pm.originalCode));

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
      const originalCode = partyMasterMap.get(r.partyCode.toUpperCase()) || r.partyCode || '-';

      return {
        id: r.id || `${r.partyCode}_${r.branchCode}_${index}`,
        rank: index + 1,
        branchCode: r.branchCode,
        branchName: r.branchName || r.branchCode,
        partyCode: r.partyCode,
        originalCode,
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

  async exportReportToExcel(reportName: string, data: any[], metadata: any = {}): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'The SS Buddy Intelligence Portal';
    workbook.lastModifiedBy = 'SS Buddy Corporate System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const isTargetVsAchievement = reportName.toLowerCase().includes('target');

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

      let curQuarterName = 'Q2';
      let prevQuarterName = 'Q1';
      let prevQuarterFY = targetFY;

      if (monthIdx <= 2) {
        curQuarterName = 'Q1';
        prevQuarterName = 'Q4';
        prevQuarterFY = targetFY - 1;
      } else if (monthIdx >= 3 && monthIdx <= 5) {
        curQuarterName = 'Q2';
        prevQuarterName = 'Q1';
        prevQuarterFY = targetFY;
      } else if (monthIdx >= 6 && monthIdx <= 8) {
        curQuarterName = 'Q3';
        prevQuarterName = 'Q2';
        prevQuarterFY = targetFY;
      } else {
        curQuarterName = 'Q4';
        prevQuarterName = 'Q3';
        prevQuarterFY = targetFY;
      }

      const fy1 = targetFY - 2;
      const fy2 = targetFY - 1;
      const fy3 = targetFY;

      const worksheet = workbook.addWorksheet('Target & Growth Matrix', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
        pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 },
      });

      const NAVY_BANNER = 'FF002B55';
      const NAVY_HEADER = 'FF003366';
      const BLUE_MTD = 'FF0284C7';
      const INDIGO_QTD = 'FF4F46E5';
      const PURPLE_YTD = 'FF7C3AED';
      const EMERALD_TARGET = 'FF059669';

      const GRAY_LIGHT = 'FFF8FAFC';
      const GRAY_BORDER = 'FFE2E8F0';
      const GREEN_FILL = 'FFDCFCE7';
      const GREEN_TEXT = 'FF166534';
      const AMBER_FILL = 'FFFEF3C7';
      const AMBER_TEXT = 'FF92400E';
      const RED_FILL = 'FFFEE2E2';
      const RED_TEXT = 'FF991B1B';

      const TOTAL_COLS = 35;
      const shortYear = String(targetFY).slice(-2);
      const prevShortYear = String(targetFY - 1).slice(-2);
      const twoPrevShortYear = String(targetFY - 2).slice(-2);
      const prevMonthShortYear = String(prevMonthFY).slice(-2);

      // ─── ROW 1: TITLE BANNER ───────────────────────────────────────────
      worksheet.mergeCells(1, 1, 1, TOTAL_COLS);
      const titleRow = worksheet.getRow(1);
      titleRow.height = 34;
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = 'MARUTI SUZUKI — COMPREHENSIVE DEALER PERFORMANCE, GROWTH & TARGET INTELLIGENCE';
      titleCell.font = { name: 'Abadi', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_BANNER } };

      // ─── ROW 2: SUB-BANNER ─────────────────────────────────────────────
      worksheet.mergeCells(2, 1, 2, TOTAL_COLS);
      const metaRow = worksheet.getRow(2);
      metaRow.height = 20;
      const metaCell = worksheet.getCell(2, 1);
      const printDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const categoryLabel = catFilter || 'ALL Categories';
      const branchLabel = branchFilter || 'ALL Branches';
      metaCell.value = `Period: ${targetMonth}'${shortYear} (FY${targetFY})   |   Category: ${categoryLabel}   |   Branch: ${branchLabel}   |   Generated: ${printDate}   |   Classification: STRICTLY CONFIDENTIAL`;
      metaCell.font = { name: 'Abadi', size: 9, italic: true, bold: true, color: { argb: 'FFD1D5DB' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1C30' } };

      // ─── ROW 3: KPI SUMMARY STATS ──────────────────────────────────────
      worksheet.mergeCells(3, 1, 3, TOTAL_COLS);
      const kpiRow = worksheet.getRow(3);
      kpiRow.height = 22;
      const totalTarget = calculatedRows.reduce((s, x) => s + (x.finalTarget || 0), 0);
      const totalSales = calculatedRows.reduce((s, x) => s + (x.mtdSep26 || 0), 0);
      const overallAch = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
      const achievedCount = calculatedRows.filter((x) => x.achievementPercent >= 1.0).length;
      const onTrackCount = calculatedRows.filter((x) => x.achievementPercent >= 0.70 && x.achievementPercent < 1.0).length;
      const underCount = calculatedRows.filter((x) => x.achievementPercent < 0.70).length;
      const totalUniquePartlines = calculatedRows.reduce((s, x) => s + (x.uniquePartlines || 0), 0);

      const kpiCell = worksheet.getCell(3, 1);
      kpiCell.value = `TOTAL DEALERS: ${calculatedRows.length}   |   UNIQUE PARTLINES: ${totalUniquePartlines.toLocaleString('en-IN')}   |   ACHIEVED (>=100%): ${achievedCount}   |   ON-TRACK (70-99%): ${onTrackCount}   |   UNDER (<70%): ${underCount}   |   TOTAL TARGET: ${(totalTarget / 100000).toFixed(2)} L   |   TOTAL SALES: ${(totalSales / 100000).toFixed(2)} L   |   OVERALL ACH: ${overallAch.toFixed(1)}%`;
      kpiCell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
      kpiCell.alignment = { vertical: 'middle', horizontal: 'center' };
      kpiCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

      // ─── ROW 4: SECTION GROUP BANDS ────────────────────────────────────
      // Group 1: Cols 1-9 (Dealer & Branch Identification)
      worksheet.mergeCells(4, 1, 4, 9);
      const g1 = worksheet.getCell(4, 1);
      g1.value = '1. DEALER & BRANCH IDENTIFICATION';
      g1.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      g1.alignment = { vertical: 'middle', horizontal: 'center' };
      g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };

      // Group 2: Cols 10-16 (MTD Performance & Growth - Deduplicated)
      worksheet.mergeCells(4, 10, 4, 16);
      const g2 = worksheet.getCell(4, 10);
      g2.value = `2. MTD PERFORMANCE & GROWTH (@ ${targetMonth}'${shortYear})`;
      g2.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      g2.alignment = { vertical: 'middle', horizontal: 'center' };
      g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_MTD } };

      // Group 3: Cols 17-22 (QTD Performance & Quarterly Growth - Deduplicated)
      worksheet.mergeCells(4, 17, 4, 22);
      const g3 = worksheet.getCell(4, 17);
      g3.value = `3. QTD PERFORMANCE & QUARTERLY GROWTH (${curQuarterName} FY${prevShortYear}-${shortYear})`;
      g3.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      g3.alignment = { vertical: 'middle', horizontal: 'center' };
      g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_QTD } };

      // Group 4: Cols 23-30 (YTD & 3-Year Historical Growth)
      worksheet.mergeCells(4, 23, 4, 30);
      const g4 = worksheet.getCell(4, 23);
      g4.value = `4. YTD & 3-YEAR HISTORICAL SALES TOTALS (FY${twoPrevShortYear} - FY${shortYear})`;
      g4.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      g4.alignment = { vertical: 'middle', horizontal: 'center' };
      g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE_YTD } };

      // Group 5: Cols 31-35 (Target & Fulfillment)
      worksheet.mergeCells(4, 31, 4, 35);
      const g5 = worksheet.getCell(4, 31);
      g5.value = '5. TARGET & FULFILLMENT';
      g5.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      g5.alignment = { vertical: 'middle', horizontal: 'center' };
      g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_TARGET } };

      worksheet.getRow(4).height = 22;

      // ─── ROW 5: DETAILED COLUMN HEADERS ────────────────────────────────
      const headers = [
        // 1. Core Dimensions (1-9)
        { key: 'rank', label: 'SR #', width: 7, align: 'center', bg: NAVY_HEADER },
        { key: 'branchCode', label: 'BRANCH CODE', width: 13, align: 'center', bg: NAVY_HEADER },
        { key: 'branchName', label: 'BRANCH NAME', width: 24, align: 'left', bg: NAVY_HEADER },
        { key: 'partyCode', label: 'PARTY CODE', width: 16, align: 'center', bg: NAVY_HEADER },
        { key: 'originalCode', label: 'ORIGINAL CODE', width: 16, align: 'center', bg: NAVY_HEADER },
        { key: 'partyName', label: 'PARTY / DEALER NAME', width: 32, align: 'left', bg: NAVY_HEADER },
        { key: 'partyType', label: 'PARTY TYPE', width: 20, align: 'center', bg: NAVY_HEADER },
        { key: 'partCategoryCode', label: 'CAT', width: 10, align: 'center', bg: NAVY_HEADER },
        { key: 'uniquePartlines', label: 'UNIQUE PARTLINE', width: 15, align: 'center', bg: NAVY_HEADER },

        // 2. MTD Performance (10-16) - Clean & Deduplicated
        { key: 'mtdAug25', label: `MTD @ ${prevMonth}'${prevShortYear}`, width: 16, align: 'right', bg: 'FF0369A1' },
        { key: 'lySameMonthSales', label: `LY ${targetMonth}'${prevShortYear} Total`, width: 16, align: 'right', bg: 'FF0369A1' },
        { key: 'lmSales', label: `LM ${prevMonth}'${prevMonthShortYear} Total`, width: 16, align: 'right', bg: 'FF0369A1' },
        { key: 'mtdSep26', label: `MTD @ ${targetMonth}'${shortYear}`, width: 16, align: 'right', bg: 'FF0369A1' },
        { key: 'mtdAug25Growth', label: `MTD @ ${prevMonth}'${prevShortYear} Growth%`, width: 15, align: 'center', bg: 'FF075985' },
        { key: 'mtdAug26Growth', label: `MTD @ ${prevMonth}'${prevMonthShortYear} Growth%`, width: 15, align: 'center', bg: 'FF075985' },
        { key: 'mtdSep26Growth', label: `MTD @ ${targetMonth}'${shortYear} Growth%`, width: 15, align: 'center', bg: 'FF075985' },

        // 3. QTD Performance (17-22) - Clean & Deduplicated
        { key: 'qtdQ2LyTotal', label: `QTD @ ${curQuarterName} FY${twoPrevShortYear}-${prevShortYear} (Total)`, width: 18, align: 'right', bg: 'FF4338CA' },
        { key: 'qtdQ1CurTotal', label: `QTD @ ${prevQuarterName} FY${prevShortYear}-${shortYear} (Total)`, width: 18, align: 'right', bg: 'FF4338CA' },
        { key: 'qtdQ2Cur', label: `QTD @ ${curQuarterName} FY${prevShortYear}-${shortYear}`, width: 18, align: 'right', bg: 'FF4338CA' },
        { key: 'qtdAug25Growth', label: `QTD @ ${prevMonth}'${prevShortYear} Growth%`, width: 15, align: 'center', bg: 'FF3730A3' },
        { key: 'qtdAug26Growth', label: `QTD @ ${prevMonth}'${prevMonthShortYear} Growth%`, width: 15, align: 'center', bg: 'FF3730A3' },
        { key: 'qtdSep26Growth', label: `QTD @ ${targetMonth}'${shortYear} Growth%`, width: 15, align: 'center', bg: 'FF3730A3' },

        // 4. YTD & 3-Year Totals (23-30)
        { key: 'ytdLy', label: `YTD @ FY${twoPrevShortYear}-${prevShortYear}`, width: 18, align: 'right', bg: 'FF6D28D9' },
        { key: 'ytdCur', label: `YTD @ FY${prevShortYear}-${shortYear}`, width: 18, align: 'right', bg: 'FF6D28D9' },
        { key: 'ytdGrowth', label: 'YTD Growth%', width: 14, align: 'center', bg: 'FF5B21B6' },
        { key: 'fy1Total', label: `FY ${targetFY - 2} Total`, width: 18, align: 'right', bg: 'FF6D28D9' },
        { key: 'fy2Total', label: `FY ${targetFY - 1} Total`, width: 18, align: 'right', bg: 'FF6D28D9' },
        { key: 'fy3Total', label: `FY ${targetFY} Total`, width: 18, align: 'right', bg: 'FF6D28D9' },
        { key: 'fy24Growth', label: `FY${twoPrevShortYear}-${prevShortYear} Growth%`, width: 15, align: 'center', bg: 'FF5B21B6' },
        { key: 'fy25Growth', label: `FY${prevShortYear}-${shortYear} Growth%`, width: 15, align: 'center', bg: 'FF5B21B6' },

        // 5. Target & Fulfillment (31-35)
        { key: 'weightedBase', label: 'WEIGHTED BASE', width: 18, align: 'right', bg: 'FF047857' },
        { key: 'recommendedTarget', label: 'RECOMMENDED TARGET', width: 18, align: 'right', bg: 'FF047857' },
        { key: 'finalTarget', label: `${targetMonth}'${shortYear} TARGET`, width: 18, align: 'right', bg: 'FF047857' },
        { key: 'achievementPercent', label: 'ACH %', width: 13, align: 'center', bg: 'FF065F46' },
        { key: 'status', label: 'STATUS', width: 16, align: 'center', bg: 'FF065F46' },
      ];

      const headerRow = worksheet.getRow(5);
      headerRow.height = 28;

      headers.forEach((h, idx) => {
        const colIdx = idx + 1;
        worksheet.getColumn(colIdx).width = h.width;
        const cell = headerRow.getCell(colIdx);
        cell.value = h.label;
        cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: h.align === 'left' ? 'left' : h.align === 'right' ? 'right' : 'center', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: NAVY_BANNER } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      // ─── DATA ROWS ─────────────────────────────────────────────────────
      let currentRowIdx = 6;
      calculatedRows.forEach((item, idx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 20;
        const isEven = idx % 2 === 0;
        const defaultBg = isEven ? 'FFFFFFFF' : GRAY_LIGHT;

        const rowValues = [
          idx + 1,
          item.branchCode || '-',
          (item.branchName || item.branchCode || '-').toUpperCase(),
          item.partyCode || '-',
          item.originalCode || '-',
          (item.partyName || '-').toUpperCase(),
          (item.partyType || 'TRADER/RETAILER').toUpperCase(),
          (item.partCategoryCode || 'ALL').toUpperCase(),
          item.uniquePartlines || 0,

          // MTD (10-16)
          item.mtdAug25,
          item.lySameMonthSales,
          item.lmSales,
          item.mtdSep26,
          item.mtdAug25Growth,
          item.mtdAug26Growth,
          item.mtdSep26Growth,

          // QTD (17-22)
          item.qtdQ2LyTotal,
          item.qtdQ1CurTotal,
          item.qtdQ2Cur,
          item.qtdAug25Growth,
          item.qtdAug26Growth,
          item.qtdSep26Growth,

          // YTD & 3-Year (23-30)
          item.ytdLy,
          item.ytdCur,
          item.ytdGrowth,
          item.fy1Total,
          item.fy2Total,
          item.fy3Total,
          item.fy24Growth,
          item.fy25Growth,

          // Target & Fulfillment (31-35)
          item.weightedBase,
          item.recommendedTarget,
          item.finalTarget,
          item.achievementPercent,
          item.status,
        ];

        rowValues.forEach((val, cIdx) => {
          const colIdx = cIdx + 1;
          const cell = row.getCell(colIdx);
          cell.value = val;
          cell.font = { name: 'Abadi', size: 9 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: headers[cIdx].align === 'left' ? 'left' : headers[cIdx].align === 'right' ? 'right' : 'center',
          };
          cell.border = {
            top: { style: 'thin', color: { argb: GRAY_BORDER } },
            bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
            left: { style: 'thin', color: { argb: GRAY_BORDER } },
            right: { style: 'thin', color: { argb: GRAY_BORDER } },
          };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };

          // Number Formatting without INR / ₹ sign
          const amountCols = [10, 11, 12, 13, 17, 18, 19, 23, 24, 26, 27, 28, 31, 32, 33];
          const percentCols = [14, 15, 16, 20, 21, 22, 25, 29, 30, 34];

          if (amountCols.includes(colIdx)) {
            cell.numFmt = '#,##,##0;[Red]-#,##,##0;"—"';
          } else if (colIdx === 9) {
            cell.numFmt = '#,##0';
            cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FF0F172A' } };
          } else if (percentCols.includes(colIdx)) {
            cell.numFmt = '0.0%';
            const pVal = Number(val) || 0;
            if (colIdx === 34) {
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
            } else {
              if (pVal > 0) {
                cell.font = { name: 'Abadi', size: 9, color: { argb: 'FF15803D' } };
              } else if (pVal < 0) {
                cell.font = { name: 'Abadi', size: 9, color: { argb: 'FFDC2626' } };
              }
            }
          } else if (colIdx === 35) {
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
          } else if (colIdx === 2 || colIdx === 4 || colIdx === 5) {
            cell.font = { name: 'Abadi', size: 9, bold: true, color: { argb: 'FF003366' } };
          }
        });

        currentRowIdx++;
      });

      // ─── GRAND TOTAL SUMMARY ROW ───────────────────────────────────────
      if (calculatedRows.length > 0) {
        const totalRow = worksheet.getRow(currentRowIdx);
        totalRow.height = 24;
        const firstDataRow = 6;
        const lastDataRow = currentRowIdx - 1;

        worksheet.mergeCells(currentRowIdx, 1, currentRowIdx, 8);
        const grandLabelCell = totalRow.getCell(1);
        grandLabelCell.value = `GRAND TOTAL (${calculatedRows.length} DEALERS)`;
        grandLabelCell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        grandLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        grandLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

        // Unique partlines total
        const partlineCell = totalRow.getCell(9);
        partlineCell.value = { formula: `SUM(I${firstDataRow}:I${lastDataRow})` };
        partlineCell.numFmt = '#,##0';
        partlineCell.alignment = { vertical: 'middle', horizontal: 'center' };
        partlineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        partlineCell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
        partlineCell.border = {
          top: { style: 'double', color: { argb: 'FF60A5FA' } },
          bottom: { style: 'medium', color: { argb: 'FF60A5FA' } },
        };

        const amountCols = [10, 11, 12, 13, 17, 18, 19, 23, 24, 26, 27, 28, 31, 32, 33];

        for (let c = 10; c <= TOTAL_COLS; c++) {
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
            cell.numFmt = '#,##,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            if (c === 33 || c === 13) {
              cell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
            }
          } else if (c === 34) {
            const targetCol = worksheet.getColumn(33).letter;
            const salesCol = worksheet.getColumn(13).letter;
            cell.value = { formula: `IF(${targetCol}${currentRowIdx}>0, ${salesCol}${currentRowIdx}/${targetCol}${currentRowIdx}, 0)` };
            cell.numFmt = '0.0%';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Abadi', size: 9.5, bold: true, color: { argb: 'FFFBBF24' } };
          } else if (c === 35) {
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
          from: { row: 5, column: 1 },
          to: { row: currentRowIdx - 1, column: TOTAL_COLS },
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
}
