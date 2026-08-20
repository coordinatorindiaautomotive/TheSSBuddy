import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GovernorRule {
  branch: string;
  categories: string[];
  partyTypes: string[];
}

export interface CalculateGovernorDto {
  year: number;
  month: number;
  monthName?: string;
  rules: GovernorRule[];
  executedBy?: string;
}

export interface CommitPeriodDto {
  year: number;
  month: number;
  committedBy: string;
  selectedIds?: string[];
}

export interface ReopenPeriodDto {
  year: number;
  month: number;
  reopenedBy: string;
  reason: string;
}

@Injectable()
export class IncentiveGovernorService {
  constructor(private readonly prisma: PrismaService) {}

  // Fast Dynamic Master Lists for Governor Builder (Branches, Part Categories, Party Types)
  async getGovernorMasters() {
    // Exact dynamic queries from DB
    const [dbBranches, partyBaseLocs, retailCategories, partyMasterTypes] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.partyMaster.findMany({
        select: { baseLoc: true },
        distinct: ['baseLoc'],
      }),
      this.prisma.retailSalesRecord.findMany({
        select: { partCategoryCode: true },
        distinct: ['partCategoryCode'],
      }),
      this.prisma.partyMaster.findMany({
        select: { partyType: true },
        distinct: ['partyType'],
      }),
    ]);

    const branchSet = new Set<string>();
    dbBranches.forEach((b) => b.code && branchSet.add(b.code.trim()));
    partyBaseLocs.forEach((p) => p.baseLoc && branchSet.add(p.baseLoc.trim()));
    const branches = Array.from(branchSet).filter(Boolean).sort();

    const catSet = new Set<string>();
    retailCategories.forEach((c) => c.partCategoryCode && catSet.add(c.partCategoryCode.trim()));
    const categories = Array.from(catSet).filter(Boolean).sort();

    const typeSet = new Set<string>();
    partyMasterTypes.forEach((pt) => pt.partyType && typeSet.add(pt.partyType.trim()));
    const partyTypes = Array.from(typeSet).filter(Boolean).sort();

    return {
      branches,
      categories,
      partyTypes,
    };
  }

  // Dynamic Active Periods — always shows rolling 15-month window + any DB-existing months
  async getAvailablePeriods() {
    const [periodControls, distinctRecords] = await Promise.all([
      this.prisma.incentiveGovernorPeriodControl.findMany({
        select: { year: true, month: true, monthName: true, status: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.incentiveRegisterRecord.findMany({
        select: { year: true, month: true },
        distinct: ['year', 'month'],
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    ]);

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periodMap = new Map<string, { m: number; y: number; label: string; hasData: boolean }>();

    // 1. Add DB-existing periods (from PeriodControl)
    periodControls.forEach((p) => {
      const key = `${p.month}-${p.year}`;
      const label = `${MONTH_NAMES[p.month - 1]} ${p.year}`;
      periodMap.set(key, { m: p.month, y: p.year, label, hasData: true });
    });

    // 2. Add DB-existing periods (from IncentiveRegisterRecord)
    distinctRecords.forEach((r) => {
      const key = `${r.month}-${r.year}`;
      if (!periodMap.has(key)) {
        const label = `${MONTH_NAMES[r.month - 1]} ${r.year}`;
        periodMap.set(key, { m: r.month, y: r.year, label, hasData: true });
      }
    });

    // 3. Always add a rolling window: last 12 months + current + next 3 months
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    for (let offset = -12; offset <= 3; offset++) {
      let m = currentMonth + offset;
      let y = currentYear;
      if (m <= 0) { m += 12; y -= 1; }
      if (m > 12) { m -= 12; y += 1; }
      const key = `${m}-${y}`;
      if (!periodMap.has(key)) {
        const label = `${MONTH_NAMES[m - 1]} ${y}`;
        periodMap.set(key, { m, y, label, hasData: false });
      }
    }

    // Sort descending by year then month
    return Array.from(periodMap.values()).sort((a, b) =>
      b.y !== a.y ? b.y - a.y : b.m - a.m
    );
  }

  // 1. Get Period Control Status & Info
  async getPeriodStatus(year: number, month: number) {
    let control = await this.prisma.incentiveGovernorPeriodControl.findUnique({
      where: {
        year_month_governor_unique: { year, month },
      },
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || `Month ${month}`;

    if (!control) {
      return {
        year,
        month,
        monthName,
        processingMethod: 'DYNAMIC',
        status: 'NOT_PROCESSED',
        governorRules: [],
        totalEligibleParties: 0,
        totalNrs: 0,
        totalDiscount: 0,
        grossIncentive: 0,
        finalIncentive: 0,
      };
    }

    return control;
  }

  // 2. Dynamic Incentive Governor Calculation Engine
  async calculateDynamicIncentives(dto: CalculateGovernorDto) {
    const year = Number(dto?.year) || 2026;
    const month = Number(dto?.month) || 6;
    let rules = dto?.rules;
    const executedBy = dto?.executedBy || 'System Admin';

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      const masters = await this.getGovernorMasters();
      rules = masters.branches.map((b) => ({
        branch: b,
        categories: ['M', 'AA'],
        partyTypes: ['INDEPENDENT WORKSHOP'],
      }));
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = dto?.monthName || monthNames[month - 1] || `Month ${month}`;

    // Check period lock status
    const periodControl = await this.prisma.incentiveGovernorPeriodControl.findUnique({
      where: { year_month_governor_unique: { year, month } },
    });

    if (periodControl && (periodControl.status === 'COMMITTED' || periodControl.status === 'LOCKED')) {
      throw new ForbiddenException(
        `Incentive Period ${monthName} ${year} is COMMITTED/LOCKED. You must unlock/reopen the period before recalculating.`
      );
    }

    const startTime = Date.now();

    // Step 1: Identify eligible parties from PartyMaster based on Party Master Base Branch & Party Types
    const eligiblePartyCodes: string[] = [];
    const searchCodeToTargetCodeMap = new Map<string, string>();
    const partyMasterMap = new Map<string, any>();
    const ruleMatchMap = new Map<string, { branch: string; categories: string[]; partyType: string }>();

    for (const rule of rules) {
      const { branch, categories, partyTypes } = rule;
      if (!branch || !categories?.length || !partyTypes?.length) continue;

      // Expand synonym partyTypes for DB matching
      const expandedTypes: string[] = [];
      for (const pt of partyTypes) {
        expandedTypes.push(pt);
        const u = pt.toUpperCase().trim();
        if (u === 'IW' || u.includes('INDEPENDENT WORKSHOP')) {
          expandedTypes.push('IW', 'INDEPENDENT WORKSHOP', 'Independent Workshop', 'MWS');
        } else if (u.includes('WALK-IN') || u.includes('WALKIN')) {
          expandedTypes.push('Walk-in', 'WALK-IN CUSTOMER', 'WALK-IN', 'OTHERS');
        } else if (u.includes('TRADER') || u.includes('RETAILER')) {
          expandedTypes.push('Trader', 'TRADER/RETAILER', 'RETAILER');
        } else if (u === 'MASS' || u.includes('MASS')) {
          expandedTypes.push('MASS', 'MSZ');
        } else if (u.includes('CO-DEALER') || u.includes('CODEALER')) {
          expandedTypes.push('CO-DEALER', 'Co-Dealer', 'CODEALER');
        }
      }

      const uniqueTypes = Array.from(new Set(expandedTypes));

      const parties = await this.prisma.partyMaster.findMany({
        where: {
          baseLoc: branch, // PARTY MASTER BASE BRANCH ONLY
          partyType: { in: uniqueTypes },
          isActive: true,
        },
      });

      for (const p of parties) {
        const targetCode = p.originalCode || p.consPartyCode;
        eligiblePartyCodes.push(targetCode);
        partyMasterMap.set(targetCode, p);
        ruleMatchMap.set(targetCode, { branch, categories, partyType: p.partyType || partyTypes[0] });

        searchCodeToTargetCodeMap.set(p.consPartyCode, targetCode);
        if (p.originalCode) {
          searchCodeToTargetCodeMap.set(p.originalCode, targetCode);
        }
      }
    }

    if (eligiblePartyCodes.length === 0) {
      return {
        success: true,
        message: 'No active parties matched the Governor eligibility criteria.',
        year,
        month,
        totalParties: 0,
        totalNrs: 0,
        totalDiscount: 0,
        grossIncentive: 0,
        finalIncentive: 0,
        records: [],
      };
    }

    // Step 2: Database-level aggregation from RETAIL_SALES_RECORDS by ORIGINAL CODE
    const allSelectedCategories = Array.from(
      new Set(rules.flatMap((r) => r.categories))
    );
    const allSearchCodes = Array.from(searchCodeToTargetCodeMap.keys());

    const monthShortStr = monthNames[month - 1]?.substring(0, 3) || '';
    const exactMonthYearStr = `${monthShortStr} ${year}`;

    // Strict Month & Year Filter Condition for retail_sales_records
    const periodWhere: any = {
      consPartyCode: { in: allSearchCodes },
      partCategoryCode: { in: allSelectedCategories },
    };

    if (month > 0 && year > 0) {
      periodWhere.OR = [
        { monthYear: { equals: exactMonthYearStr, mode: 'insensitive' } },
        { monthYear: { contains: exactMonthYearStr, mode: 'insensitive' } },
      ];
    } else if (year > 0) {
      periodWhere.monthYear = { contains: year.toString(), mode: 'insensitive' };
    }

    // Primary DB SQL Aggregation from retail_sales_records (Filtered strictly by selected Month & Year)
    const retailAggregates = await this.prisma.retailSalesRecord.groupBy({
      by: ['consPartyCode'],
      where: periodWhere,
      _sum: {
        netRetailSelling: true,
        discountAmount: true,
      },
    });

    const salesMap = new Map<string, { nrs: number; discount: number }>();
    for (const agg of retailAggregates) {
      if (agg.consPartyCode) {
        const targetCode = searchCodeToTargetCodeMap.get(agg.consPartyCode) || agg.consPartyCode;
        const current = salesMap.get(targetCode) || { nrs: 0, discount: 0 };
        current.nrs += Number(agg._sum.netRetailSelling || 0);
        current.discount += Number(agg._sum.discountAmount || 0);
        salesMap.set(targetCode, current);
      }
    }

    // Fallback/Union with RawSales (Strictly matching Month & Year)
    const rawWhere: any = {
      consPartyCode: { in: allSearchCodes },
      partCategoryCode: { in: allSelectedCategories },
    };
    if (month > 0 && year > 0) {
      rawWhere.OR = [
        { monthYear: { equals: exactMonthYearStr, mode: 'insensitive' } },
        { monthYear: { contains: exactMonthYearStr, mode: 'insensitive' } },
      ];
    } else if (year > 0) {
      rawWhere.fiscalYear = year;
    }

    const rawAggregates = await this.prisma.rawSales.groupBy({
      by: ['consPartyCode'],
      where: rawWhere,
      _sum: {
        netRetailSelling: true,
        discountAmount: true,
      },
    });

    for (const agg of rawAggregates) {
      if (agg.consPartyCode) {
        const targetCode = searchCodeToTargetCodeMap.get(agg.consPartyCode) || agg.consPartyCode;
        if (!salesMap.has(targetCode)) {
          const current = salesMap.get(targetCode) || { nrs: 0, discount: 0 };
          current.nrs += Number(agg._sum.netRetailSelling || 0);
          current.discount += Number(agg._sum.discountAmount || 0);
          salesMap.set(targetCode, current);
        }
      }
    }

    // Step 3: Calculation & Validation Engine
    const calculatedRecords: any[] = [];
    let totalNrs = 0;
    let totalDiscount = 0;
    let totalGrossIncentive = 0;
    let totalFinalIncentive = 0;
    const batchId = `GOV-${year}-${month < 10 ? '0' + month : month}-${Date.now()}`;

    // Fetch Incentive Schemes / Slabs for reference
    const schemeDetails = await this.prisma.incentiveSchemeDetail.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    let transactingPartiesCount = 0;

    for (const code of Array.from(new Set(eligiblePartyCodes))) {
      const party = partyMasterMap.get(code);
      const ruleInfo = ruleMatchMap.get(code);
      const sales = salesMap.get(code) || { nrs: 0, discount: 0 };

      const nrs = Math.max(0, sales.nrs);
      const discount = Math.max(0, sales.discount);

      if (nrs > 0) {
        transactingPartiesCount++;
      }

      // Determine Incentive Rate strictly from Party Master or DB Scheme Details
      const incentiveType = party.incentiveType || 'Slab-Based';
      let applicableRate = 0;
      let applicableSlab = 'N/A';
      let grossIncentive = 0;

      if (nrs > 0) {
        // Priority 1: Custom rate specified in Party Master (party.incentiveRule)
        if (party.incentiveRule && !isNaN(parseFloat(party.incentiveRule))) {
          applicableRate = parseFloat(party.incentiveRule);
          applicableSlab = `${applicableRate}%`;
        } else {
          // Priority 2: Database Incentive Scheme Slabs (from incentive_scheme_details)
          const matchingSlab = schemeDetails.find(
            (sd) =>
              Number(sd.slabFrom) <= nrs &&
              (sd.slabTo === null || Number(sd.slabTo) >= nrs)
          );

          if (matchingSlab) {
            applicableRate = Number(matchingSlab.incentiveRate);
            applicableSlab = `${applicableRate}%`;
          } else {
            // Default Tier matching DB scheme (0-29.9k: 0%, 30k-49.9k: 3%, 50k-74.9k: 4%, 75k-119.9k: 5%, 120k+: 6%)
            if (nrs >= 120000) {
              applicableRate = 6.0;
            } else if (nrs >= 75000) {
              applicableRate = 5.0;
            } else if (nrs >= 50000) {
              applicableRate = 4.0;
            } else if (nrs >= 30000) {
              applicableRate = 3.0;
            } else {
              applicableRate = 0.0;
            }
            applicableSlab = `${applicableRate}%`;
          }
        }

        grossIncentive = Math.round((nrs * applicableRate) / 100);
      }

      // Non-negotiable formula: Final Incentive = MAX(Gross Incentive - Total Discount, 0)
      const finalIncentive = Math.round(Math.max(0, grossIncentive - discount));

      // Validation status engine
      const validationErrors: string[] = [];
      if (!party.consPartyCode) validationErrors.push('Missing Original Party Code');
      if (!party.baseLoc) validationErrors.push('Missing Party Master Base Branch');
      if (!party.isActive) validationErrors.push('Party is marked Inactive in Master');
      if (nrs === 0) validationErrors.push('No sales in selected period');
      if (discount > grossIncentive) validationErrors.push('Discount exceeds Gross Incentive (Final set to ₹0)');

      const validationStatus =
        nrs === 0
          ? 'NO_SALES'
          : validationErrors.length === 0
          ? 'VALID'
          : discount > grossIncentive
          ? 'WARNING'
          : 'INVALID';

      totalNrs += nrs;
      totalDiscount += discount;
      totalGrossIncentive += grossIncentive;
      totalFinalIncentive += finalIncentive;

      calculatedRecords.push({
        id: party.id || code,
        governorBatchId: batchId,
        year,
        month,
        monthName,
        consPartyCode: party.consPartyCode,
        originalPartyCode: party.originalCode || party.consPartyCode,
        consPartyName: party.consPartyName || party.name || 'Unknown Customer',
        partyName: party.consPartyName || party.name || 'Unknown Customer',
        baseLoc: party.baseLoc,
        baseBranch: party.baseLoc || ruleInfo?.branch || 'UNKNOWN',
        partyType: party.partyType || ruleInfo?.partyType || 'INDEPENDENT WORKSHOP',
        appliedBranchRule: ruleInfo?.branch || party.baseLoc,
        appliedCategories: ruleInfo?.categories || [],
        salesNrs: nrs,
        nrs: nrs,
        discountAmount: discount,
        totalDiscount: discount,
        incentiveRule: applicableSlab,
        incentiveType,
        incentiveRate: applicableRate,
        applicableRate,
        applicableSlab,
        grossIncentive: Math.round(grossIncentive * 100) / 100,
        finalIncentive: Math.round(finalIncentive * 100) / 100,
        processingMethod: 'DYNAMIC',
        validationStatus,
        validationErrors: validationErrors,
        status: 'DRAFT',
        createdBy: executedBy,
        calculationDetails: {
          nrsFormula: 'SUM(retail_sales_records.netRetailSelling)',
          discountFormula: 'SUM(retail_sales_records.discountAmount)',
          grossFormula: `${nrs.toLocaleString('en-IN')} × ${applicableRate}%`,
          netFormula: `MAX(${grossIncentive.toLocaleString('en-IN')} - ${discount.toLocaleString('en-IN')}, 0)`,
        },
      });
    }

    // Step 4: Persist Draft Records & Update Period Control
    await this.prisma.incentiveRegisterRecord.deleteMany({
      where: { year, month, processingMethod: 'DYNAMIC', status: 'DRAFT' },
    });

    if (calculatedRecords.length > 0) {
      const dbRecords = calculatedRecords.map((r) => ({
        governorBatchId: r.governorBatchId,
        year: r.year,
        month: r.month,
        monthName: r.monthName,
        originalPartyCode: r.originalPartyCode,
        partyName: r.partyName,
        baseBranch: r.baseBranch,
        partyType: r.partyType,
        nrs: r.nrs,
        totalDiscount: r.totalDiscount,
        incentiveType: r.incentiveType,
        applicableRate: r.applicableRate,
        applicableSlab: r.applicableSlab,
        grossIncentive: r.grossIncentive,
        finalIncentive: r.finalIncentive,
        processingMethod: 'DYNAMIC',
        validationStatus: r.validationStatus,
        validationErrors: r.validationErrors,
        status: 'DRAFT',
        createdBy: executedBy,
      }));

      await this.prisma.incentiveRegisterRecord.createMany({
        data: dbRecords,
      });
    }

    const updatedControl = await this.prisma.incentiveGovernorPeriodControl.upsert({
      where: { year_month_governor_unique: { year, month } },
      update: {
        status: 'PREVIEW',
        processingMethod: 'DYNAMIC',
        governorRules: rules as any,
        batchId,
        totalEligibleParties: calculatedRecords.length,
        totalNrs,
        totalDiscount,
        grossIncentive: totalGrossIncentive,
        finalIncentive: totalFinalIncentive,
      },
      create: {
        year,
        month,
        monthName,
        status: 'PREVIEW',
        processingMethod: 'DYNAMIC',
        governorRules: rules as any,
        batchId,
        totalEligibleParties: calculatedRecords.length,
        totalNrs,
        totalDiscount,
        grossIncentive: totalGrossIncentive,
        finalIncentive: totalFinalIncentive,
      },
    });

    // Step 5: Audit Log
    await this.prisma.incentiveGovernorAuditLog.create({
      data: {
        batchId,
        year,
        month,
        action: 'CALCULATION_EXECUTED',
        performedBy: executedBy,
        details: {
          rulesCount: rules.length,
          totalParties: calculatedRecords.length,
          totalNrs,
          totalDiscount,
          grossIncentive: totalGrossIncentive,
          finalIncentive: totalFinalIncentive,
          executionTimeMs: Date.now() - startTime,
        },
      },
    });

    return {
      success: true,
      batchId,
      periodControl: updatedControl,
      summary: {
        totalParties: calculatedRecords.length,
        totalNrs: Math.round(totalNrs),
        totalDiscount: Math.round(totalDiscount),
        grossIncentive: Math.round(totalGrossIncentive),
        finalIncentive: Math.round(totalFinalIncentive),
        executionTimeMs: Date.now() - startTime,
      },
      records: calculatedRecords,
    };
  }

  // 3. Get Preview Records for Period
  async getPreviewRecords(year: number, month: number) {
    const periodControl = await this.getPeriodStatus(year, month);
    const records = await this.prisma.incentiveRegisterRecord.findMany({
      where: { year, month },
      orderBy: [{ finalIncentive: 'desc' }, { partyName: 'asc' }],
    });

    return {
      periodControl,
      records,
    };
  }

  // 4. Commit Incentive Period (Lock Month)
  async commitIncentivePeriod(dto: CommitPeriodDto) {
    const { year, month, committedBy, selectedIds } = dto;

    const control = await this.prisma.incentiveGovernorPeriodControl.findUnique({
      where: { year_month_governor_unique: { year, month } },
    });

    if (!control) {
      throw new NotFoundException(`No incentive calculation draft found for period ${month}/${year}.`);
    }

    if (control.status === 'COMMITTED' || control.status === 'LOCKED') {
      throw new BadRequestException(`Period ${month}/${year} is already COMMITTED and LOCKED.`);
    }

    // Update IncentiveRegisterRecord statuses to COMMITTED
    const whereClause: any = { year, month };
    if (selectedIds && selectedIds.length > 0) {
      whereClause.id = { in: selectedIds };
    }

    await this.prisma.incentiveRegisterRecord.updateMany({
      where: whereClause,
      data: { status: 'COMMITTED' },
    });

    // Update Period Control to COMMITTED / LOCKED
    const updatedControl = await this.prisma.incentiveGovernorPeriodControl.update({
      where: { year_month_governor_unique: { year, month } },
      data: {
        status: 'COMMITTED',
        committedAt: new Date(),
        committedBy,
      },
    });

    // Audit Log
    await this.prisma.incentiveGovernorAuditLog.create({
      data: {
        batchId: control.batchId,
        year,
        month,
        action: 'PERIOD_LOCKED',
        performedBy: committedBy,
        details: {
          processingMethod: control.processingMethod,
          totalEligibleParties: control.totalEligibleParties,
          finalIncentive: control.finalIncentive,
          message: 'Period locked for normal recalculation & upload.',
        },
      },
    });

    return {
      success: true,
      message: `Incentive Period ${control.monthName} ${year} successfully COMMITTED and LOCKED.`,
      periodControl: updatedControl,
    };
  }

  // 5. Pre-Calculated Incentive Upload Engine
  async uploadPrecalculatedIncentives(
    year: number,
    month: number,
    records: any[],
    uploadedBy: string
  ) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || `Month ${month}`;

    const control = await this.prisma.incentiveGovernorPeriodControl.findUnique({
      where: { year_month_governor_unique: { year, month } },
    });

    if (control && (control.status === 'COMMITTED' || control.status === 'LOCKED')) {
      throw new ForbiddenException(
        `Period ${monthName} ${year} is already COMMITTED/LOCKED under method ${control.processingMethod}. Unlock before uploading.`
      );
    }

    const batchId = `PRE-${year}-${month < 10 ? '0' + month : month}-${Date.now()}`;
    let totalNrs = 0;
    let totalDiscount = 0;
    let totalGrossIncentive = 0;
    let totalFinalIncentive = 0;

    // Pre-fetch PartyMaster mapping to fill partyType and baseBranch if missing
    const partyCodes = records
      .map((r) => String(r['Cons Party Code'] || r['Cons Party Code'] || r.originalPartyCode || r.PartyCode || r['Party Code'] || '').trim().toUpperCase())
      .filter(Boolean);

    const dbParties = await this.prisma.partyMaster.findMany({
      where: { consPartyCode: { in: partyCodes } },
      select: { consPartyCode: true, partyType: true, baseLoc: true, consPartyName: true },
    });
    const partyMasterMap = new Map<string, { partyType: string; baseLoc: string; name: string }>();
    dbParties.forEach((p) => {
      partyMasterMap.set(p.consPartyCode.trim().toUpperCase(), {
        partyType: p.partyType || 'IW',
        baseLoc: p.baseLoc || 'ALW',
        name: p.consPartyName || '',
      });
    });

    const formattedRecords = records.map((r) => {
      // Flexible property finder
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
          // Try case-insensitive matching
          const foundKey = Object.keys(r).find((objKey) => objKey.trim().toLowerCase() === k.trim().toLowerCase());
          if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null && r[foundKey] !== '') {
            return r[foundKey];
          }
        }
        return undefined;
      };

      const partyCode = String(
        getVal('Cons Party Code', 'Party Code', 'originalPartyCode', 'PartyCode', 'Original Party Code', 'Debit narration', 'debit_narration', 'party_code') || ''
      ).trim();

      if (!partyCode || partyCode.toUpperCase() === 'PRE-PARTY' || partyCode.toUpperCase() === 'UNDEFINED') {
        return null;
      }

      const pmInfo = partyMasterMap.get(partyCode.toUpperCase());

      const partyName = String(
        getVal('Cons Party Name', 'Party Name', 'partyName', 'PartyName', 'Name', 'Beneficiary Name', 'Customer Name', 'Customer') || pmInfo?.name || 'Customer'
      ).trim();

      // baseBranch: ALWAYS prefer Party Master baseLoc (SSOT).
      // Excel 'Location' column is only a fallback if Party Master has no baseLoc.
      const excelLocation = String(
        getVal('Location', 'Loc', 'baseBranch', 'Branch', 'Base Branch', 'Branch Code', 'base_branch') || ''
      ).trim();
      const baseBranch = (pmInfo?.baseLoc || excelLocation || 'ALW').trim();

      const partyType = String(
        getVal('partyType', 'PartyType', 'Party Type', 'Eligible Party Type', 'party_type') || pmInfo?.partyType || 'IW'
      ).trim();

      const nrs = Number(getVal('Net Retail Selling', 'Sale Value', 'Sales Value', 'nrs', 'NRS', 'Sales NRS', 'Sales NRS (₹)', 'nrs_amount') || 0);
      const discount = Number(getVal('Discount Amount', 'On Bill Discount', 'totalDiscount', 'TotalDiscount', 'Total Discount', 'Total Discount (₹)', 'discount') || 0);

      let slabRaw = String(getVal('Slab', 'Achievment %', 'Achievement %', 'Ach %', 'Slab %', 'applicableSlab', 'Incentive Scheme / Slab', 'applicable_slab') || '').trim();
      let rateNum = parseFloat(slabRaw.replace('%', '')) || 0;
      let applicableSlab = '';

      if (rateNum > 0 && rateNum < 1) {
        rateNum = Math.round(rateNum * 100 * 100) / 100;
        applicableSlab = `${rateNum}%`;
      } else if (rateNum >= 1) {
        applicableSlab = `${rateNum}%`;
      } else if (slabRaw && slabRaw.includes('%')) {
        applicableSlab = slabRaw;
      } else {
        applicableSlab = '0%';
      }

      if (!applicableSlab || applicableSlab.toLowerCase().includes('custom') || applicableSlab.toLowerCase().includes('pre-calculated')) {
        applicableSlab = rateNum > 0 ? `${rateNum}%` : '0%';
      }

      const explicitIncVal = getVal('Incentive Value', 'Incentive', 'Incentive ', 'finalIncentive', 'FinalIncentive', 'Final Incentive', 'grossIncentive', 'Gross Incentive');

      let gross = 0;
      let finalInc = 0;

      if (explicitIncVal !== undefined && explicitIncVal !== null && explicitIncVal !== '') {
        const parsedVal = Math.round(parseFloat(String(explicitIncVal)) || 0);
        if (parsedVal > 0) {
          gross = parsedVal;
          finalInc = Math.max(0, gross - discount);
        } else {
          gross = rateNum > 0 ? Math.round((nrs * rateNum) / 100) : 0;
          finalInc = Math.max(0, gross - discount);
        }
      } else if (rateNum > 0) {
        gross = Math.round((nrs * rateNum) / 100);
        finalInc = Math.max(0, gross - discount);
      }

      totalNrs += nrs;
      totalDiscount += discount;
      totalGrossIncentive += gross;
      totalFinalIncentive += finalInc;

      return {
        governorBatchId: batchId,
        year,
        month,
        monthName,
        originalPartyCode: partyCode,
        partyName,
        baseBranch,
        partyType,
        nrs,
        totalDiscount: discount,
        incentiveType: rateNum > 0 ? `${rateNum}% Scheme` : 'Flat Scheme',
        applicableRate: rateNum,
        applicableSlab,
        grossIncentive: gross,
        finalIncentive: finalInc,
        processingMethod: 'PRE_CALCULATED',
        validationStatus: 'VALID',
        status: 'DRAFT',
        createdBy: uploadedBy,
      };
    }).filter(Boolean) as any[];

    // Delete existing invalid PRE-PARTY records if any
    await this.prisma.incentiveRegisterRecord.deleteMany({
      where: { originalPartyCode: 'PRE-PARTY' },
    });

    await this.prisma.incentiveRegisterRecord.deleteMany({
      where: { year, month, processingMethod: 'PRE_CALCULATED', status: 'DRAFT' },
    });

    await this.prisma.incentiveRegisterRecord.createMany({
      data: formattedRecords,
    });

    const updatedControl = await this.prisma.incentiveGovernorPeriodControl.upsert({
      where: { year_month_governor_unique: { year, month } },
      update: {
        status: 'PREVIEW',
        processingMethod: 'PRE_CALCULATED',
        batchId,
        totalEligibleParties: formattedRecords.length,
        totalNrs,
        totalDiscount,
        grossIncentive: totalGrossIncentive,
        finalIncentive: totalFinalIncentive,
      },
      create: {
        year,
        month,
        monthName,
        status: 'PREVIEW',
        processingMethod: 'PRE_CALCULATED',
        batchId,
        totalEligibleParties: formattedRecords.length,
        totalNrs,
        totalDiscount,
        grossIncentive: totalGrossIncentive,
        finalIncentive: totalFinalIncentive,
      },
    });

    await this.prisma.incentiveGovernorAuditLog.create({
      data: {
        batchId,
        year,
        month,
        action: 'EXCEL_UPLOADED',
        performedBy: uploadedBy,
        details: { recordsCount: formattedRecords.length, totalFinalIncentive },
      },
    });

    return {
      success: true,
      batchId,
      periodControl: updatedControl,
      totalUploaded: formattedRecords.length,
    };
  }

  // 6. Reopen Incentive Period (Authorized Action)
  async reopenPeriod(dto: ReopenPeriodDto) {
    const { year, month, reopenedBy, reason } = dto;

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A valid audit reason (min 5 characters) is required to reopen a locked period.');
    }

    const control = await this.prisma.incentiveGovernorPeriodControl.findUnique({
      where: { year_month_governor_unique: { year, month } },
    });

    if (!control) {
      throw new NotFoundException(`Period ${month}/${year} does not exist.`);
    }

    const updatedControl = await this.prisma.incentiveGovernorPeriodControl.update({
      where: { year_month_governor_unique: { year, month } },
      data: {
        status: 'REOPENED',
        reopenedAt: new Date(),
        reopenedBy,
        reopenReason: reason,
      },
    });

    await this.prisma.incentiveRegisterRecord.updateMany({
      where: { year, month },
      data: { status: 'DRAFT' },
    });

    await this.prisma.incentiveGovernorAuditLog.create({
      data: {
        batchId: control.batchId,
        year,
        month,
        action: 'PERIOD_REOPENED',
        performedBy: reopenedBy,
        details: { reason, previousStatus: control.status },
      },
    });

    return {
      success: true,
      message: `Incentive Period ${control.monthName} ${year} has been REOPENED.`,
      periodControl: updatedControl,
    };
  }

  // 7. Upload Bank Payout Transfer File (Bank Portal Reconciliation)
  async uploadBankPayoutExcel(
    fileBuffer: Buffer,
    year: number,
    month: number,
    fileName: string,
    uploadedBy: string,
  ) {
    const xlsx = require('xlsx');
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      throw new BadRequestException('The uploaded file contains no data rows.');
    }

    const headerRow = rows[0].map((h: any) => String(h || '').trim());

    const findColIdx = (possibleNames: string[]) => {
      return headerRow.findIndex((h: string) =>
        possibleNames.some((p) => h.toLowerCase().includes(p.toLowerCase()))
      );
    };

    const partyCodeIdx = findColIdx(['Debit narration', 'debit_narration', 'party_code', 'partycode', 'Cons Party Code']);
    const amountIdx = findColIdx(['Amount', 'transferred_amount', 'payout_amount', 'Incentive']);
    const pymtDateIdx = findColIdx(['Pymt_Date', 'Acct_Debit_date', 'payment_date', 'date']);
    const beneNameIdx = findColIdx(['Beneficiary Name', 'beneficiary_name', 'account_holder', 'Cons Party Name']);
    const beneAccIdx = findColIdx(['Beneficiary Account No', 'beneficiary_account_no', 'account_no']);
    const ifscIdx = findColIdx(['Bene_IFSC_Code', 'ifsc_code', 'ifsc']);
    const statusIdx = findColIdx(['STATUS', 'status', 'Current Step', 'step']);
    const utrIdx = findColIdx(['UTR NO', 'utr_no', 'utr']);

    if (partyCodeIdx === -1) {
      throw new BadRequestException('Column "Debit narration" (Party Code) was not found in the uploaded Excel file.');
    }

    const batchId = `PAYOUT_${year}_${month}_${Date.now()}`;
    let matchedCount = 0;
    let autoCreatedCount = 0;
    let creditPartyCount = 0;
    let totalTransferred = 0;

    // 1. Fetch all Register Records for this month/year
    const registerRecords = await this.prisma.incentiveRegisterRecord.findMany({
      where: { year, month },
    });

    const recordMap = new Map<string, typeof registerRecords[0]>();
    registerRecords.forEach((r) => {
      recordMap.set(r.originalPartyCode.trim().toUpperCase(), r);
    });

    const bankFilePartyCodesSet = new Set<string>();

    // 2. Fetch PartyMaster info for auto-creating missing records
    const allExcelPartyCodes = rows.slice(1).map(r => String(r[partyCodeIdx] || '').trim().toUpperCase()).filter(Boolean);
    const dbParties = await this.prisma.partyMaster.findMany({
      where: { consPartyCode: { in: allExcelPartyCodes } },
      select: { consPartyCode: true, consPartyName: true, partyType: true, baseLoc: true },
    });
    const partyMasterMap = new Map<string, { name: string; partyType: string; baseLoc: string }>();
    dbParties.forEach((p) => {
      partyMasterMap.set(p.consPartyCode.trim().toUpperCase(), {
        name: p.consPartyName || '',
        partyType: p.partyType || 'IW',
        baseLoc: p.baseLoc || 'ALW',
      });
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month - 1] || `Month ${month}`;

    // 3. Process each row in the uploaded Bank Excel
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawPartyCode = String(row[partyCodeIdx] || '').trim();
      if (!rawPartyCode) continue;

      const partyCodeKey = rawPartyCode.toUpperCase();
      bankFilePartyCodesSet.add(partyCodeKey);

      const amount = amountIdx !== -1 ? Math.round(parseFloat(String(row[amountIdx] || 0)) || 0) : 0;
      const pymtDate = pymtDateIdx !== -1 ? String(row[pymtDateIdx] || '').trim() : '';
      const accountHolder = beneNameIdx !== -1 ? String(row[beneNameIdx] || '').trim() : '';
      const accountNo = beneAccIdx !== -1 ? String(row[beneAccIdx] || '').trim() : '';
      const ifscCode = ifscIdx !== -1 ? String(row[ifscIdx] || '').trim() : '';
      const statusRaw = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : 'Paid';
      const utrNo = utrIdx !== -1 ? String(row[utrIdx] || '').trim() : '';

      let payoutStatus = 'Paid';
      const statusLower = statusRaw.toLowerCase();
      if (statusLower.includes('success') || statusLower.includes('paid')) {
        payoutStatus = 'Success';
      } else if (statusLower.includes('reverse') || statusLower.includes('fail') || statusLower.includes('reject')) {
        payoutStatus = 'Reversed';
      }

      const existingRecord = recordMap.get(partyCodeKey);

      if (existingRecord) {
        await this.prisma.incentiveRegisterRecord.update({
          where: { id: existingRecord.id },
          data: {
            payoutStatus,
            transferredAmount: amount,
            transferDate: pymtDate,
            accountHolder,
            accountNo,
            ifscCode,
            utrNo,
            payoutBatchId: batchId,
          },
        });
        matchedCount++;
        totalTransferred += amount;
      } else {
        // Auto-create missing party record in Register
        const pmInfo = partyMasterMap.get(partyCodeKey);
        const newPartyName = accountHolder || pmInfo?.name || `Party ${rawPartyCode}`;
        const newBranch = pmInfo?.baseLoc || 'ALW';
        const newPartyType = pmInfo?.partyType || 'IW';

        const newRecord = await this.prisma.incentiveRegisterRecord.create({
          data: {
            governorBatchId: batchId,
            year,
            month,
            monthName,
            originalPartyCode: rawPartyCode,
            partyName: newPartyName,
            baseBranch: newBranch,
            partyType: newPartyType,
            nrs: 0,
            totalDiscount: 0,
            incentiveType: 'Bank Transfer Auto-Created',
            applicableSlab: 'Direct Bank Payout',
            grossIncentive: amount,
            finalIncentive: amount,
            payoutStatus,
            transferredAmount: amount,
            transferDate: pymtDate,
            accountHolder,
            accountNo,
            ifscCode,
            utrNo,
            payoutBatchId: batchId,
            processingMethod: 'BANK_TRANSFER_AUTO',
            status: 'COMMITTED',
            createdBy: uploadedBy,
          },
        });

        recordMap.set(partyCodeKey, newRecord);
        autoCreatedCount++;
        totalTransferred += amount;
      }
    }

    // 4. Requirement 1: Parties in Register BUT NOT in Bank File -> Check Dealer Outstanding
    const dbOutstandings = await this.prisma.dealerOutstanding.findMany({
      where: {
        outstanding: { gt: 0 },
      },
      select: { partyCode: true, outstanding: true },
    });

    const outstandingSet = new Set<string>();
    dbOutstandings.forEach((o) => {
      if (o.partyCode) outstandingSet.add(o.partyCode.trim().toUpperCase());
    });

    for (const [codeKey, record] of recordMap.entries()) {
      if (!bankFilePartyCodesSet.has(codeKey)) {
        if (outstandingSet.has(codeKey)) {
          await this.prisma.incentiveRegisterRecord.update({
            where: { id: record.id },
            data: {
              payoutStatus: 'Credit Party',
              payoutBatchId: batchId,
            },
          });
          creditPartyCount++;
        } else if (!record.payoutStatus) {
          await this.prisma.incentiveRegisterRecord.update({
            where: { id: record.id },
            data: {
              payoutStatus: 'Pending',
              payoutBatchId: batchId,
            },
          });
        }
      }
    }

    await this.prisma.incentiveGovernorAuditLog.create({
      data: {
        batchId,
        year,
        month,
        action: 'BANK_PAYOUT_RECONCILED',
        performedBy: uploadedBy,
        details: {
          fileName,
          matchedCount,
          autoCreatedCount,
          creditPartyCount,
          totalTransferred,
        },
      },
    });

    return {
      success: true,
      batchId,
      totalRows: rows.length - 1,
      matchedCount,
      autoCreatedCount,
      creditPartyCount,
      totalTransferred,
    };
  }

  // 8. Get Audit Trail
  async getAuditTrail(year: number, month: number) {
    return this.prisma.incentiveGovernorAuditLog.findMany({
      where: { year, month },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 9. Sync baseBranch in IncentiveRegisterRecord from Party Master baseLoc (SSOT fix)
  // Optionally filter by partyCode to fix just one party, or leave blank to fix all.
  async syncBranchFromPartyMaster(partyCode?: string) {
    // 1. Fetch all relevant party master records
    const parties = await this.prisma.partyMaster.findMany({
      where: {
        ...(partyCode ? { consPartyCode: partyCode.trim().toUpperCase() } : {}),
        baseLoc: { not: null },
        isActive: true,
      },
      select: { consPartyCode: true, baseLoc: true },
    });

    if (parties.length === 0) {
      return { success: false, message: 'No matching party found in Party Master', updatedCount: 0 };
    }

    let updatedCount = 0;
    const details: { partyCode: string; oldBranch: string; newBranch: string }[] = [];

    for (const pm of parties) {
      const newBranch = pm.baseLoc!;

      // Find all register records for this party with a different baseBranch
      const stale = await this.prisma.incentiveRegisterRecord.findMany({
        where: {
          originalPartyCode: pm.consPartyCode,
          NOT: { baseBranch: newBranch },
        },
        select: { id: true, baseBranch: true },
      });

      if (stale.length > 0) {
        await this.prisma.incentiveRegisterRecord.updateMany({
          where: { originalPartyCode: pm.consPartyCode },
          data: { baseBranch: newBranch },
        });
        stale.forEach((r) => details.push({ partyCode: pm.consPartyCode, oldBranch: r.baseBranch, newBranch }));
        updatedCount += stale.length;
      }
    }

    return {
      success: true,
      message: updatedCount > 0
        ? `Synced baseBranch for ${updatedCount} register record(s) from Party Master`
        : 'All records already up to date — no changes needed',
      updatedCount,
      details,
    };
  }
}
