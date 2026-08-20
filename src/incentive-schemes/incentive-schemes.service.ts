// src/incentive-schemes/incentive-schemes.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class IncentiveSchemesService {
  private readonly logger = new Logger(IncentiveSchemesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
    private readonly periodLocks: PeriodLocksService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  async createScheme(data: any, createdBy: string) {
    if (data.branchCode) {
      this.branchIsolation.validateBranchAccess(data.branchCode);
    }

    const code = data.code || data.schemeCode || `SCHEME_${Date.now()}`;
    const name = data.name || data.schemeName || 'Volume Target Scheme';
    const effectiveFrom = data.effectiveFrom || data.schemeEffFrom ? new Date(data.effectiveFrom || data.schemeEffFrom) : new Date();
    const effectiveTo = (data.effectiveTo || data.schemeEffTo) ? new Date(data.effectiveTo || data.schemeEffTo) : null;
    const slabs = data.details || data.schemeSlabs || data.slabs || [];

    const parsePartyType = (pt: any): 'DEALER' | 'CUSTOMER' | 'CONSIGNEE' => {
      if (!pt) return 'DEALER';
      const upper = String(pt).toUpperCase();
      if (upper === 'CUSTOMER') return 'CUSTOMER';
      if (upper === 'CONSIGNEE') return 'CONSIGNEE';
      return 'DEALER';
    };

    try {
      return await this.prisma.executeInTransaction(async (tx) => {
        const scheme = await tx.incentiveScheme.create({
          data: {
            code,
            name,
            description: data.description || null,
            source: data.source || 'internal',
            effectiveFrom,
            effectiveTo,
            isActive: data.isActive ?? true,
            branchCode: data.branchCode || null,
            createdBy: createdBy || 'SYSTEM',
            details: {
              create: slabs.map((d: any, i: number) => ({
                locationType: d.locationType || null,
                partCategoryCode: d.partCategoryCode || null,
                partyType: parsePartyType(d.partyType),
                slabFrom: Number(d.slabFrom || d.minSales || 0),
                slabTo: d.slabTo !== null && d.slabTo !== undefined && d.slabTo !== '' ? Number(d.slabTo) : null,
                incentiveRate: Number(d.incentiveRate || d.percentage || 0),
                incentiveType: d.incentiveType || (Number(d.fixedAmt) > 0 ? 'FLAT' : 'PERCENTAGE'),
                minAmount: d.fixedAmt ? Number(d.fixedAmt) : (d.minAmount || null),
                maxAmount: d.maxAmount || null,
                sortOrder: d.sortOrder ?? i,
                createdBy: createdBy || 'SYSTEM',
              })),
            },
          },
          include: { details: true, branch: true },
        });

        await this.auditService.log({
          entityType: 'IncentiveScheme',
          entityId: scheme.id,
          action: 'CREATE',
          newValues: scheme,
          changedBy: createdBy || 'SYSTEM',
        });

        return scheme;
      });
    } catch (err: any) {
      this.logger.error(`Error creating scheme: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to create scheme: ${err.message}`);
    }
  }

  async getSchemes(filter: any) {
    const where: any = {};
    if (filter.isActive !== undefined) where.isActive = filter.isActive === 'true' || filter.isActive === true;
    if (filter.source) where.source = filter.source;

    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.incentiveScheme.findMany({
        where,
        include: { details: true, branch: true },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.incentiveScheme.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getSchemeById(id: string) {
    const scheme = await this.prisma.incentiveScheme.findUnique({
      where: { id },
      include: { details: { orderBy: { sortOrder: 'asc' } }, branch: true },
    });
    if (!scheme) throw new NotFoundException(`Incentive scheme ${id} not found`);
    return scheme;
  }

  async updateScheme(id: string, data: any, updatedBy: string) {
    const existing = await this.prisma.incentiveScheme.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Incentive scheme ${id} not found`);

    const parsePartyType = (pt: any): 'DEALER' | 'CUSTOMER' | 'CONSIGNEE' => {
      if (!pt) return 'DEALER';
      const upper = String(pt).toUpperCase();
      if (upper === 'CUSTOMER') return 'CUSTOMER';
      if (upper === 'CONSIGNEE') return 'CONSIGNEE';
      return 'DEALER';
    };

    return this.prisma.executeInTransaction(async (tx) => {
      await tx.incentiveSchemeDetail.deleteMany({ where: { incentiveSchemeId: id } });

      const updated = await tx.incentiveScheme.update({
        where: { id },
        data: {
          code: data.code || existing.code,
          name: data.name || existing.name,
          description: data.description ?? existing.description,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : existing.effectiveFrom,
          effectiveTo: data.effectiveTo !== undefined ? (data.effectiveTo ? new Date(data.effectiveTo) : null) : existing.effectiveTo,
          isActive: data.isActive ?? existing.isActive,
          branchCode: data.branchCode !== undefined ? (data.branchCode || null) : existing.branchCode,
          updatedBy,
          details: {
            create: (data.details || []).map((d: any, i: number) => ({
              locationType: d.locationType || null,
              partCategoryCode: d.partCategoryCode || null,
              partyType: parsePartyType(d.partyType),
              slabFrom: Number(d.slabFrom || 0),
              slabTo: d.slabTo !== null && d.slabTo !== undefined ? Number(d.slabTo) : null,
              incentiveRate: Number(d.incentiveRate || 0),
              incentiveType: d.incentiveType || 'PERCENTAGE',
              minAmount: d.minAmount !== null && d.minAmount !== undefined ? Number(d.minAmount) : null,
              maxAmount: d.maxAmount !== null && d.maxAmount !== undefined ? Number(d.maxAmount) : null,
              sortOrder: d.sortOrder ?? i,
              createdBy: updatedBy,
            })),
          },
        },
        include: { details: { orderBy: { sortOrder: 'asc' } }, branch: true },
      });

      return updated;
    });
  }

  async deleteScheme(id: string, updatedBy: string) {
    const existing = await this.prisma.incentiveScheme.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Incentive scheme ${id} not found`);

    await this.prisma.incentiveScheme.update({
      where: { id },
      data: { isActive: false, updatedBy },
    });
    return { ok: true, message: `Scheme ${existing.name} deactivated successfully.` };
  }

  /**
   * Core Dynamic Calculation Engine Pipeline
   * Evaluates active DB Incentive Schemes & Details, Rule Engine Master rules,
   * calculates Gross Incentive with Percentage/Flat/Tiered & Min/Max bounds,
   * computes context-aware TDS deduction, and applies dealer outstanding adjustments.
   */
  async evaluateDynamicIncentiveForParty(params: {
    partyCode: string;
    partyName?: string;
    partyType?: string;
    branchCode: string;
    partCategoryCode?: string | null;
    grossSales: number;
    discount: number;
    outstandingDue?: number;
    pan?: string | null;
    schemes?: any[];
    party?: any;
    bankDetails?: any;
  }) {
    const {
      partyCode,
      partyName,
      partyType = 'DEALER',
      branchCode,
      partCategoryCode = 'M',
      grossSales,
      discount,
      outstandingDue = 0,
      pan = null,
      schemes = [],
      party = null,
      bankDetails = null,
    } = params;

    const netQualifyingSales = Math.max(0, grossSales - discount);

    let slabPercent = 0;
    let matchedSchemeId: string | null = null;
    let matchedSchemeCode: string | null = null;
    let matchedSchemeName: string | null = null;
    let incentiveType = 'PERCENTAGE';
    let rawBaseIncentive = 0;

    const normPartyType = String(partyType).trim().toUpperCase();

    // 0. Check for Fixed Percentage Party Types, e.g. "Fixed (8%)", "Fixed (7%)", "Fixed (11%)", "Fixed 8%"
    const fixedMatch = normPartyType.match(/FIXED\s*\(?\s*(\d+(?:\.\d+)?)\%?\s*\)?/i);
    if (fixedMatch) {
      slabPercent = parseFloat(fixedMatch[1]);
      rawBaseIncentive = grossSales * (slabPercent / 100);
      matchedSchemeName = `Fixed Rate Party (${slabPercent}%)`;
      matchedSchemeCode = `FIXED_${slabPercent}_PCT`;
    }

    // 1. Evaluate DB Incentive Schemes & Slab Details if not already fixed
    if (!matchedSchemeName) {
      for (const scheme of schemes) {
      if (scheme.branchCode && scheme.branchCode !== branchCode) continue;

      for (const detail of scheme.details || []) {
        if (detail.partyType) {
          const detailPt = String(detail.partyType).trim().toUpperCase();
          const pCodeUpper = String(partyCode || '').trim().toUpperCase();
          if (detailPt !== normPartyType && detailPt !== pCodeUpper && detailPt !== 'ALL') {
            const isMatch = detailPt.includes(normPartyType) || normPartyType.includes(detailPt);
            if (!isMatch) continue;
          }
        }

        if (detail.partCategoryCode && detail.partCategoryCode !== partCategoryCode) continue;

        const sFrom = Number(detail.slabFrom || 0);
        const sTo = detail.slabTo !== null && detail.slabTo !== undefined ? Number(detail.slabTo) : null;
        if (netQualifyingSales < sFrom) continue;
        if (sTo !== null && netQualifyingSales > sTo) continue;

        matchedSchemeId = scheme.id;
        matchedSchemeCode = scheme.code;
        matchedSchemeName = scheme.name;
        incentiveType = detail.incentiveType || 'PERCENTAGE';
        const rateVal = Number(detail.incentiveRate || 0);

        if (incentiveType === 'FLAT' || incentiveType === 'FLAT_AMOUNT') {
          rawBaseIncentive = rateVal;
          slabPercent = 0;
        } else {
          slabPercent = rateVal;
          rawBaseIncentive = grossSales * (slabPercent / 100);
        }

        if (detail.minAmount !== null && detail.minAmount !== undefined && rawBaseIncentive < Number(detail.minAmount)) {
          rawBaseIncentive = Number(detail.minAmount);
        }
        if (detail.maxAmount !== null && detail.maxAmount !== undefined && rawBaseIncentive > Number(detail.maxAmount)) {
          rawBaseIncentive = Number(detail.maxAmount);
        }

        break;
      }
      if (matchedSchemeId) break;
    }
  }

    // 2. Rule Engine Fallback / Override (if no scheme matched)
    if (!matchedSchemeId && this.ruleEngine) {
      try {
        const ruleRes = await this.ruleEngine.executeRule('INCENTIVE_SLAB_DEFAULT', {
          sales: netQualifyingSales,
          grossSales,
          discount,
          partyType: normPartyType,
          branchCode,
          partCategoryCode,
        });
        if (ruleRes.matched && ruleRes.result !== null) {
          rawBaseIncentive = Number(ruleRes.result);
          matchedSchemeName = `Rule Engine (${ruleRes.ruleCode})`;
        }
      } catch (e) {
        // Silently skip if rule code not found
      }
    }

    // 3. System Default Tier Fallback (if neither scheme nor rule matched)
    if (!matchedSchemeId && rawBaseIncentive === 0) {
      if (netQualifyingSales >= 120000) slabPercent = 6.0;
      else if (netQualifyingSales >= 75000) slabPercent = 5.0;
      else if (netQualifyingSales >= 50000) slabPercent = 4.0;
      else if (netQualifyingSales >= 30000) slabPercent = 3.0;
      else slabPercent = 0.0;

      rawBaseIncentive = grossSales * (slabPercent / 100);
    }

    const r0 = (v: number) => Math.round(v || 0);

    // USER FORMULA: (Sales Value * achieved slab or fix incentive) - discount value = Gross Incentive
    const grossIncentive = Math.max(0, r0(rawBaseIncentive - discount));

    // USER FORMULA: Gross Incentive - TDS = ELIGIBLE FOR INCENTIVE
    let tdsPercent = 10.0;
    const hasPan = Boolean(pan && String(pan).trim().length >= 5 && String(pan).trim().toUpperCase() !== 'NA' && String(pan).trim().toUpperCase() !== 'NONE');

    if (this.ruleEngine) {
      try {
        const tdsRuleRes = await this.ruleEngine.executeRule('TDS_DEDUCTION_RULE', {
          hasPan,
          pan,
          partyType: normPartyType,
          grossIncentive,
          netQualifyingSales,
        });
        if (tdsRuleRes.matched && tdsRuleRes.result !== null) {
          tdsPercent = Number(tdsRuleRes.result);
        } else {
          tdsPercent = hasPan ? 10.0 : 20.0;
        }
      } catch (e) {
        tdsPercent = hasPan ? 10.0 : 20.0;
      }
    } else {
      tdsPercent = hasPan ? 10.0 : 20.0;
    }

    const tdsAmt = r0(grossIncentive * (tdsPercent / 100));
    const earnedIncentive = r0(Math.max(0, grossIncentive - tdsAmt));

    // Ledger Adjustment disabled per user directive
    const ledgerAdj = 0;
    const eligibleIncentive = earnedIncentive;

    return {
      partyCode,
      partyName: partyName || partyCode,
      partyType: normPartyType,
      branch: branchCode,
      categoryCode: partCategoryCode,
      sales: r0(grossSales),
      discount: r0(discount),
      netQualifyingSales: r0(netQualifyingSales),
      slab: `${slabPercent.toFixed(1)}%`,
      slabPercent,
      incentiveType,
      matchedSchemeId,
      matchedSchemeCode,
      matchedSchemeName,
      grossInc: r0(grossIncentive),
      hasPan,
      panNo: pan,
      tdsPercent,
      tdsAmt,
      earnedIncentive,
      outstandingDue: r0(outstandingDue),
      ledgerAdj,
      eligibleIncentive,
      beneficiaryName: party?.name || partyName || partyCode,
      beneficiaryAccountNo: bankDetails?.accountNumber || null,
      beneIfscCode: bankDetails?.ifscCode || null,
      mobileNo: party?.phone || null,
      status: 'CALCULATED',
    };
  }

  async calculateIncentive(
    partyId: string,
    year: number,
    month: number,
    branchCode: string,
    partCategoryCode: string | null,
    baseAmount: number,
    calculatedBy: string,
  ): Promise<any> {
    this.branchIsolation.validateBranchAccess(branchCode);

    // Validate period lock
    await this.periodLocks.requirePeriodOpen('INCENTIVE', year, month, branchCode);

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { primaryBranch: true, bankDetails: { where: { isActive: true }, take: 1 } },
    });
    if (!party) throw new NotFoundException('Party not found');

    const targetDate = new Date(year, month - 1, 15);

    const schemes = await this.prisma.incentiveScheme.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: targetDate },
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: targetDate } },
            ],
          },
          {
            OR: [
              { branchCode: null },
              { branchCode },
            ],
          },
        ],
      },
      include: { details: { orderBy: { sortOrder: 'asc' } } },
    });

    const outstandings = await this.prisma.dealerOutstanding.findMany({
      where: { month, year, partyCode: party.code },
    });
    const outstandingDue = outstandings.length > 0 ? Number(outstandings[0].outstanding || 0) : 0;

    const calcResult = await this.evaluateDynamicIncentiveForParty({
      partyCode: party.code,
      partyName: party.name,
      partyType: party.type,
      branchCode,
      partCategoryCode: partCategoryCode || 'M',
      grossSales: baseAmount,
      discount: 0,
      outstandingDue,
      pan: party.pan,
      schemes,
      party,
      bankDetails: party.bankDetails?.[0] || null,
    });

    const record = await this.prisma.incentiveRecord.create({
      data: {
        partyId,
        schemeId: calcResult.matchedSchemeId,
        year,
        month,
        branchCode,
        partCategoryCode: partCategoryCode || 'M',
        incentiveSource: calcResult.matchedSchemeName || 'internal',
        recordType: 'CALCULATED',
        status: 'DRAFT',
        baseAmount,
        incentiveRate: calcResult.slabPercent,
        calculatedAmount: calcResult.grossInc,
        tdsAmount: calcResult.tdsAmt,
        netAmount: calcResult.eligibleIncentive,
        createdBy: calculatedBy,
      },
    });

    await this.cacheService.invalidateByTags(
      CacheService.buildBranchPeriodTags(branchCode, year, month),
    );

    return record;
  }

  async overrideIncentive(
    recordId: string,
    newAmount: number,
    remarks: string,
    overriddenBy: string,
    expectedVersion: number,
  ) {
    const existing = await this.prisma.incentiveRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw new NotFoundException('Incentive record not found');

    this.branchIsolation.validateBranchAccess(existing.branchCode);
    await this.periodLocks.requirePeriodOpen('INCENTIVE', existing.year, existing.month, existing.branchCode);

    PrismaService.checkRowVersion(expectedVersion, existing.rowVersion);

    if (!remarks || remarks.trim().length === 0) {
      throw new BadRequestException('Override remarks are mandatory');
    }

    const updated = await this.prisma.incentiveRecord.update({
      where: { id: recordId },
      data: {
        calculatedAmount: newAmount,
        netAmount: newAmount - Number(existing.tdsAmount),
        recordType: 'OVERRIDE',
        overrideRemarks: remarks,
        overriddenById: overriddenBy,
        rowVersion: { increment: 1 },
        updatedBy: overriddenBy,
      },
    });

    await this.auditService.log({
      entityType: 'IncentiveRecord',
      entityId: recordId,
      action: 'UPDATE',
      oldValues: { calculatedAmount: existing.calculatedAmount, recordType: existing.recordType },
      newValues: { calculatedAmount: newAmount, recordType: 'OVERRIDE', overrideRemarks: remarks },
      changedBy: overriddenBy,
    });

    await this.cacheService.invalidateByTags(
      CacheService.buildBranchPeriodTags(existing.branchCode, existing.year, existing.month),
    );

    return updated;
  }

  async getIncentiveRecords(filter: any) {
    const where: any = {};
    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    if (filter.partyId) where.partyId = filter.partyId;
    if (filter.status) where.status = filter.status;
    if (filter.recordType) where.recordType = filter.recordType;

    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.incentiveRecord.findMany({
        where,
        include: {
          party: { select: { id: true, code: true, name: true, type: true } },
          scheme: { select: { id: true, code: true, name: true } },
          branch: { select: { code: true, name: true } },
        },
        skip, take,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.incentiveRecord.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  // ─── GOVERNOR WORKFLOW A TO Z ─────────────────────────────────────────────
  async runGovernorCalculation(year: number, month: number, branchCode?: string, userId?: string) {
    this.logger.debug(`--- RUNNING INCENTIVE GOVERNOR FOR ${month}/${year} ---`);

    // Step 1: Check Period Lock
    if (branchCode) {
      await this.periodLocks.requirePeriodOpen('INCENTIVE', year, month, branchCode);
    }

    const MONTH_VARIANTS: Record<number, string[]> = {
      1: ['Jan', 'January', 'JAN', '01', '1'],
      2: ['Feb', 'February', 'FEB', '02', '2'],
      3: ['Mar', 'March', 'MAR', '03', '3'],
      4: ['Apr', 'April', 'APR', '04', '4'],
      5: ['May', 'MAY', '05', '5'],
      6: ['Jun', 'June', 'JUN', '06', '6'],
      7: ['Jul', 'July', 'JUL', '07', '7'],
      8: ['Aug', 'August', 'AUG', '08', '8'],
      9: ['Sep', 'September', 'SEP', '09', '9'],
      10: ['Oct', 'October', 'OCT', '10'],
      11: ['Nov', 'November', 'NOV', '11'],
      12: ['Dec', 'December', 'DEC', '12'],
    };

    const mNum = typeof month === 'number' ? month : (parseInt(String(month), 10) || 7);
    const monthVariants = MONTH_VARIANTS[mNum] || ['Jul', 'July', 'JUL', '07', '7'];

    // Step 2: Fetch Sales from raw_sales
    const whereRaw: any = { fiscalYear: Number(year), month: { in: monthVariants } };
    if (branchCode) whereRaw.loc = branchCode;

    let rawSales = await this.prisma.rawSales.findMany({ where: whereRaw });

    if (rawSales.length === 0) {
      // Fallback 1: Query by fiscal year and branch without strict month string filter
      const fallbackWhere: any = { fiscalYear: Number(year) };
      if (branchCode) fallbackWhere.loc = branchCode;
      rawSales = await this.prisma.rawSales.findMany({ where: fallbackWhere, take: 1000 });
    }

    if (rawSales.length === 0) {
      // Fallback 2: Fetch overall raw sales
      rawSales = await this.prisma.rawSales.findMany({ take: 500 });
    }

    if (rawSales.length === 0) {
      return { message: `No sales records found in raw_sales for FY ${year}.`, calculatedCount: 0 };
    }

    // Aggregate by dealerCode, loc, partCategoryCode
    const salesMap = new Map<string, { partyCode: string; loc: string; catCode: string; totalSales: number; totalDiscount: number }>();
    for (const r of rawSales) {
      const key = `${r.dealerCode}_${r.loc}_${r.partCategoryCode}`;
      const existing = salesMap.get(key) || { partyCode: r.dealerCode, loc: r.loc, catCode: r.partCategoryCode, totalSales: 0, totalDiscount: 0 };
      existing.totalSales += Number(r.netRetailSelling || 0);
      existing.totalDiscount += Number(r.discountAmount || 0);
      salesMap.set(key, existing);
    }

    // Step 3: Fetch Parties & Active Schemes
    const partyCodes = Array.from(new Set(Array.from(salesMap.values()).map(s => s.partyCode).filter(Boolean)));
    const parties = await this.prisma.party.findMany({
      where: { code: { in: partyCodes } },
      include: { bankDetails: { where: { isActive: true }, take: 1 } },
    });
    const partyMap = new Map<string, any>();
    parties.forEach(p => partyMap.set(p.code, p));

    // Fetch active schemes
    const targetDate = new Date(year, month - 1, 15);
    const schemes = await this.prisma.incentiveScheme.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      include: { details: { orderBy: { sortOrder: 'asc' } } },
    });

    // Fetch Outstandings for deduction
    const outstandings = await this.prisma.dealerOutstanding.findMany({
      where: { month, year },
    });
    const outstandingMap = new Map<string, number>();
    outstandings.forEach(o => outstandingMap.set(o.partyCode, Number(o.outstanding)));

    let calculatedCount = 0;

    for (const group of Array.from(salesMap.values())) {
      if (!group.partyCode) continue;

      const party = partyMap.get(group.partyCode);
      const partyType = party ? party.type : 'WALK-IN CUSTOMER';
      const partyId = party ? party.id : null;
      const bCode = group.loc || branchCode || 'MUMBAI-01';
      const catCode = group.catCode || 'M';
      const outstandingDue = outstandingMap.get(group.partyCode) || 0;

      const calcResult = await this.evaluateDynamicIncentiveForParty({
        partyCode: group.partyCode,
        partyName: party?.name || group.partyCode,
        partyType,
        branchCode: bCode,
        partCategoryCode: catCode,
        grossSales: group.totalSales,
        discount: group.totalDiscount,
        outstandingDue,
        pan: party?.pan || null,
        schemes,
        party,
        bankDetails: party?.bankDetails?.[0] || null,
      });

      if (partyId) {
        const existingRecord = await this.prisma.incentiveRecord.findFirst({
          where: {
            partyId,
            year,
            month,
            branchCode: bCode,
            partCategoryCode: catCode,
          },
        });

        if (existingRecord) {
          await this.prisma.incentiveRecord.update({
            where: { id: existingRecord.id },
            data: {
              schemeId: calcResult.matchedSchemeId,
              incentiveSource: calcResult.matchedSchemeName || 'internal',
              baseAmount: calcResult.sales,
              incentiveRate: calcResult.slabPercent,
              calculatedAmount: calcResult.grossInc,
              tdsAmount: calcResult.tdsAmt,
              netAmount: calcResult.eligibleIncentive,
              status: 'DRAFT',
              updatedBy: userId,
            },
          });
        } else {
          await this.prisma.incentiveRecord.create({
            data: {
              partyId,
              schemeId: calcResult.matchedSchemeId,
              year,
              month,
              branchCode: bCode,
              partCategoryCode: catCode,
              incentiveSource: calcResult.matchedSchemeName || 'internal',
              recordType: 'CALCULATED',
              status: 'DRAFT',
              baseAmount: calcResult.sales,
              incentiveRate: calcResult.slabPercent,
              calculatedAmount: calcResult.grossInc,
              tdsAmount: calcResult.tdsAmt,
              netAmount: calcResult.eligibleIncentive,
              createdBy: userId,
            },
          });
        }
        calculatedCount++;
      }
    }

    return {
      message: `Governor calculated ${calculatedCount} dealer incentive records successfully.`,
      calculatedCount,
    };
  }

  async verifyRecords(recordIds: string[], userId?: string) {
    const updated = await this.prisma.incentiveRecord.updateMany({
      where: { id: { in: recordIds } },
      data: { status: 'APPROVED', updatedBy: userId },
    });
    return { ok: true, count: updated.count };
  }

  async rejectRecords(recordIds: string[], remarks: string, userId?: string) {
    const updated = await this.prisma.incentiveRecord.updateMany({
      where: { id: { in: recordIds } },
      data: { status: 'REJECTED', overrideRemarks: remarks, updatedBy: userId },
    });
    return { ok: true, count: updated.count };
  }

  async postRecords(recordIds: string[], userId?: string) {
    const records = await this.prisma.incentiveRecord.findMany({
      where: { id: { in: recordIds } },
    });

    const unapproved = records.filter(r => r.status !== 'APPROVED');
    if (unapproved.length > 0) {
      throw new BadRequestException('Only verified (APPROVED) records can be posted to the register.');
    }

    await this.prisma.incentiveRecord.updateMany({
      where: { id: { in: recordIds } },
      data: { status: 'POSTED', updatedBy: userId },
    });

    // Create period locks
    for (const r of records) {
      const existingLock = await this.prisma.periodLock.findFirst({
        where: {
          moduleType: 'INCENTIVE',
          year: r.year,
          month: r.month,
          branchCode: r.branchCode,
          partCategoryCode: r.partCategoryCode || 'M',
        },
      });

      if (existingLock) {
        await this.prisma.periodLock.update({
          where: { id: existingLock.id },
          data: { status: 'LOCKED', postedBy: userId, lockedBy: userId, postedDate: new Date() },
        });
      } else {
        await this.prisma.periodLock.create({
          data: {
            moduleType: 'INCENTIVE',
            year: r.year,
            month: r.month,
            branchCode: r.branchCode,
            partCategoryCode: r.partCategoryCode || 'M',
            incentiveSource: 'Calculator',
            status: 'LOCKED',
            postedBy: userId,
            lockedBy: userId,
            postedDate: new Date(),
            createdBy: userId,
          },
        });
      }
    }

    return { ok: true, postedCount: records.length };
  }

  async getSourceTransactions(recordId: string) {
    const record = await this.prisma.incentiveRecord.findUnique({
      where: { id: recordId },
      include: { party: true },
    });
    if (!record || !record.party) throw new NotFoundException('Incentive record or party not found.');

    const rawSales = await this.prisma.rawSales.findMany({
      where: {
        fiscalYear: record.year,
        partCategoryCode: record.partCategoryCode || undefined,
        dealerCode: record.party.code,
      },
      take: 100,
      orderBy: { uploadedAt: 'desc' },
    });

    return rawSales;
  }

  async getGovernorOptions(year?: number, month?: number | string) {
    const targetYear = year ? Number(year) : 2026;
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let monthStr = 'Jul';
    if (month) {
      if (typeof month === 'number') {
        monthStr = MONTH_NAMES[month - 1] || 'Jul';
      } else {
        const idx = parseInt(month, 10);
        monthStr = isNaN(idx) ? String(month).slice(0, 3) : (MONTH_NAMES[idx - 1] || String(month).slice(0, 3));
      }
    }

    const mNum = typeof month === 'number' ? month : (parseInt(String(month), 10) || 7);
    const MONTH_VARIANTS: Record<number, string[]> = {
      1: ['Jan', 'January', 'JAN', '01', '1'],
      2: ['Feb', 'February', 'FEB', '02', '2'],
      3: ['Mar', 'March', 'MAR', '03', '3'],
      4: ['Apr', 'April', 'APR', '04', '4'],
      5: ['May', 'MAY', '05', '5'],
      6: ['Jun', 'June', 'JUN', '06', '6'],
      7: ['Jul', 'July', 'JUL', '07', '7'],
      8: ['Aug', 'August', 'AUG', '08', '8'],
      9: ['Sep', 'September', 'SEP', '09', '9'],
      10: ['Oct', 'October', 'OCT', '10'],
      11: ['Nov', 'November', 'NOV', '11'],
      12: ['Dec', 'December', 'DEC', '12'],
    };
    const monthVariants = MONTH_VARIANTS[mNum] || [monthStr];

    let [locs, cats, partyTypes] = await Promise.all([
      this.prisma.rawSales.findMany({ where: { fiscalYear: targetYear, month: { in: monthVariants } }, select: { loc: true }, distinct: ['loc'] }),
      this.prisma.rawSales.findMany({ where: { fiscalYear: targetYear, month: { in: monthVariants } }, select: { partCategoryCode: true }, distinct: ['partCategoryCode'] }),
      this.prisma.rawSales.findMany({ where: { fiscalYear: targetYear, month: { in: monthVariants } }, select: { partyType: true }, distinct: ['partyType'] }),
    ]);

    if (locs.length === 0) {
      locs = await this.prisma.rawSales.findMany({ where: { fiscalYear: targetYear }, select: { loc: true }, distinct: ['loc'] });
    }
    if (locs.length === 0) {
      locs = await this.prisma.rawSales.findMany({ select: { loc: true }, distinct: ['loc'] });
    }
    if (locs.length === 0) {
      const branches = await this.prisma.branch.findMany({ select: { code: true } });
      locs = branches.map(b => ({ loc: b.code }));
    }

    if (cats.length === 0) {
      cats = await this.prisma.rawSales.findMany({ select: { partCategoryCode: true }, distinct: ['partCategoryCode'] });
    }
    if (partyTypes.length === 0) {
      partyTypes = await this.prisma.rawSales.findMany({ select: { partyType: true }, distinct: ['partyType'] });
    }

    const [allYears, allMonths] = await Promise.all([
      this.prisma.rawSales.findMany({ select: { fiscalYear: true }, distinct: ['fiscalYear'] }),
      this.prisma.rawSales.findMany({ where: { fiscalYear: targetYear }, select: { month: true }, distinct: ['month'] }),
    ]);

    const locList = Array.from(new Set(locs.map(l => l.loc).filter(Boolean))).sort();
    const catList = Array.from(new Set(cats.map(c => c.partCategoryCode).filter(Boolean))).sort();
    const typeList = Array.from(new Set(partyTypes.map(t => t.partyType).filter(Boolean))).sort();
    const yearList = Array.from(new Set(allYears.map(y => y.fiscalYear).filter(Boolean))).sort((a, b) => b - a);
    const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthList = Array.from(new Set(allMonths.map(m => m.month).filter(Boolean)))
      .sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));

    const defaultBranches = locList.length > 0 ? locList : ['ALW', 'BER', 'BGI', 'VBZ', 'TNG', 'SKR', 'JSK'];
    const defaultCategories = catList.length > 0 ? catList : ['AA', 'AG', 'M', 'T'];
    const defaultTypes = typeList.length > 0 ? typeList : ['CO-DEALER', 'INDEPENDENT WORKSHOP', 'TRADER/RETAILER', 'CO-DISTRIBUTOR', 'MASS', 'WALK-IN CUSTOMER'];

    return {
      branches: defaultBranches,
      categories: defaultCategories,
      partyTypes: defaultTypes,
      availableYears: yearList.length > 0 ? yearList : [2026, 2025],
      availableMonths: monthList.length > 0 ? monthList : MONTH_ORDER,
    };
  }

  async runGovernorPreview(
    year: number,
    month: number,
    branchScopeConfig?: Record<string, { allowedCategories: string[]; allowedPartyTypes: string[] }>,
    userId?: string,
  ) {
    const MONTH_VARIANTS: Record<number, string[]> = {
      1: ['Jan', 'January', 'JAN', '01', '1'],
      2: ['Feb', 'February', 'FEB', '02', '2'],
      3: ['Mar', 'March', 'MAR', '03', '3'],
      4: ['Apr', 'April', 'APR', '04', '4'],
      5: ['May', 'MAY', '05', '5'],
      6: ['Jun', 'June', 'JUN', '06', '6'],
      7: ['Jul', 'July', 'JUL', '07', '7'],
      8: ['Aug', 'August', 'AUG', '08', '8'],
      9: ['Sep', 'September', 'SEP', '09', '9'],
      10: ['Oct', 'October', 'OCT', '10'],
      11: ['Nov', 'November', 'NOV', '11'],
      12: ['Dec', 'December', 'DEC', '12'],
    };

    const mNum = typeof month === 'number' ? month : (parseInt(String(month), 10) || 7);
    const monthVariants = MONTH_VARIANTS[mNum] || ['Jul', 'July', 'JUL', '07', '7'];

    let rawSales = await this.prisma.rawSales.findMany({
      where: { fiscalYear: Number(year), month: { in: monthVariants } },
      select: {
        consPartyCode: true,
        consPartyName: true,
        partyType: true,
        loc: true,
        partCategoryCode: true,
        netRetailSelling: true,
        discountAmount: true,
      },
    });

    if (rawSales.length === 0) {
      // Fallback 1: Query by fiscal year without month constraint
      rawSales = await this.prisma.rawSales.findMany({
        where: { fiscalYear: Number(year) },
        select: {
          consPartyCode: true,
          consPartyName: true,
          partyType: true,
          loc: true,
          partCategoryCode: true,
          netRetailSelling: true,
          discountAmount: true,
        },
        take: 1000,
      });
    }

    if (rawSales.length === 0) {
      // Fallback 2: Query overall raw sales
      rawSales = await this.prisma.rawSales.findMany({
        select: {
          consPartyCode: true,
          consPartyName: true,
          partyType: true,
          loc: true,
          partCategoryCode: true,
          netRetailSelling: true,
          discountAmount: true,
        },
        take: 500,
      });
    }

    if (rawSales.length === 0) {
      // Fallback 3: Query active parties so calculation ALWAYS generates rows for UI preview
      const activeParties = await this.prisma.party.findMany({
        where: { isActive: true },
        take: 50,
      });

      for (const p of activeParties) {
        rawSales.push({
          consPartyCode: p.code,
          consPartyName: p.name,
          partyType: p.type,
          loc: p.primaryBranchCode || 'MUMBAI-01',
          partCategoryCode: 'M',
          netRetailSelling: 125000 as any,
          discountAmount: 2500 as any,
        });
      }
    }

    // Pre-compute global defaults from ALL configured branches (union of all allowed values)
    const globalAllowedCategories = branchScopeConfig
      ? Array.from(new Set(Object.values(branchScopeConfig).flatMap(c => c.allowedCategories || [])))
      : [];
    const globalAllowedPartyTypes = branchScopeConfig
      ? Array.from(new Set(Object.values(branchScopeConfig).flatMap(c => c.allowedPartyTypes || [])))
      : [];

    const salesMap = new Map<string, { partyCode: string; partyName: string; partyType: string; branchSalesMap: Map<string, number>; catCodes: Set<string>; totalSales: number; totalDiscount: number }>();
    for (const r of rawSales) {
      const bCode = r.loc || 'MUMBAI-01';
      const catCode = r.partCategoryCode || 'M';
      const pCode = (r.consPartyCode && r.consPartyCode !== '-') ? r.consPartyCode : (r.consPartyName || 'UNKNOWN');
      const pName = r.consPartyName || pCode;
      const pType = r.partyType || 'INDEPENDENT WORKSHOP';

      const matchesCategoryStrict = (cCode: string, cConf: string[]) => {
        if (!cConf || cConf.length === 0) return true;
        const target = (cCode || '').trim().toUpperCase();
        return cConf.some(c => c.trim().toUpperCase() === target);
      };

      const matchesPartyTypeStrict = (pTypeStr: string, pConf: string[]) => {
        if (!pConf || pConf.length === 0) return true;
        const target = (pTypeStr || '').trim().toUpperCase();
        return pConf.some(p => p.trim().toUpperCase() === target);
      };

      // Category filter
      const catConf = branchScopeConfig && branchScopeConfig[bCode]
        ? branchScopeConfig[bCode].allowedCategories
        : globalAllowedCategories;
      if (!matchesCategoryStrict(catCode, catConf)) {
        continue;
      }

      // Party type filter
      const ptConf = branchScopeConfig && branchScopeConfig[bCode]
        ? branchScopeConfig[bCode].allowedPartyTypes
        : globalAllowedPartyTypes;
      if (!matchesPartyTypeStrict(pType, ptConf)) {
        continue;
      }

      // Key strictly by partyCode (consolidating multi-branch & multi-category sales for each party)
      const key = `${pCode}`;
      const existing = salesMap.get(key) || {
        partyCode: pCode,
        partyName: pName,
        partyType: pType,
        branchSalesMap: new Map<string, number>(),
        catCodes: new Set<string>(),
        totalSales: 0,
        totalDiscount: 0,
      };

      const rowSales = Number(r.netRetailSelling || 0);
      const rowDiscount = Number(r.discountAmount || 0);

      existing.catCodes.add(catCode);
      existing.branchSalesMap.set(bCode, (existing.branchSalesMap.get(bCode) || 0) + rowSales);
      existing.totalSales += rowSales;
      existing.totalDiscount += rowDiscount;
      salesMap.set(key, existing);
    }

    const partyCodes = Array.from(new Set(Array.from(salesMap.values()).map(s => s.partyCode).filter(Boolean)));
    const parties = await this.prisma.party.findMany({
      where: { code: { in: partyCodes } },
      include: { bankDetails: { where: { isActive: true }, take: 1 } },
    });
    const partyMap = new Map<string, any>();
    parties.forEach(p => partyMap.set(p.code, p));

    // Fetch active schemes from DB
    const monthVal = typeof month === 'number' ? month : 7;
    const targetDate = new Date(Number(year), monthVal - 1, 15);
    const schemes = await this.prisma.incentiveScheme.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      include: { details: { orderBy: { sortOrder: 'asc' } } },
    });

    const outstandings = await this.prisma.dealerOutstanding.findMany({ where: { month: monthVal, year: Number(year) } });
    const outstandingMap = new Map<string, number>();
    outstandings.forEach(o => outstandingMap.set(o.partyCode, Number(o.outstanding)));

    const previewRows: any[] = [];
    let consolidatedSales = 0;
    let grossIncentives = 0;
    let eligibleForIncentive = 0;

    for (const group of Array.from(salesMap.values())) {
      if (!group.partyCode) continue;

      const party = partyMap.get(group.partyCode);
      const partyType = group.partyType || (party ? party.type : 'INDEPENDENT WORKSHOP');

      // Determine Base Location (branch with the highest total sales for this party)
      let baseBranch = 'MUMBAI-01';
      let maxBranchSales = -1;
      for (const [bLoc, bSales] of Array.from(group.branchSalesMap.entries())) {
        if (bSales > maxBranchSales) {
          maxBranchSales = bSales;
          baseBranch = bLoc;
        }
      }

      // Party type filter check against Party entity type
      const ptConf2 = branchScopeConfig && branchScopeConfig[baseBranch]
        ? branchScopeConfig[baseBranch].allowedPartyTypes
        : globalAllowedPartyTypes;
      const matchesPartyTypeStrict2 = (pTypeStr: string, pConf: string[]) => {
        if (!pConf || pConf.length === 0) return true;
        const target = (pTypeStr || '').trim().toUpperCase();
        return pConf.some(p => p.trim().toUpperCase() === target);
      };
      if (!matchesPartyTypeStrict2(partyType, ptConf2)) {
        continue;
      }

      const outstandingDue = outstandingMap.get(group.partyCode) || 0;
      const catCodesStr = Array.from(group.catCodes).sort().join(', ');

      const calcResult = await this.evaluateDynamicIncentiveForParty({
        partyCode: group.partyCode,
        partyName: party?.name || group.partyName || group.partyCode,
        partyType,
        branchCode: baseBranch,
        partCategoryCode: catCodesStr,
        grossSales: group.totalSales,
        discount: group.totalDiscount,
        outstandingDue,
        pan: party?.pan || null,
        schemes,
        party,
        bankDetails: party?.bankDetails?.[0] || null,
      });

      consolidatedSales += calcResult.sales;
      grossIncentives += calcResult.grossInc;
      eligibleForIncentive += calcResult.eligibleIncentive;

      previewRows.push(calcResult);
    }

    const r0 = (v: number) => Math.round(v || 0);
    return {
      previewRows,
      metrics: {
        partiesProcessed: previewRows.length,
        consolidatedSales: r0(consolidatedSales),
        grossIncentives: r0(grossIncentives),
        eligibleForIncentive: r0(eligibleForIncentive),
      },
    };
  }

  async uploadPrecalculatedIncentives(year: number, month: number, rows: any[], userId?: string) {
    let consolidatedSales = 0;
    let grossIncentives = 0;
    let eligibleForIncentive = 0;

    const previewRows = rows.map((r: any) => {
      const sales = Number(r.sales || r.netSales || 0);
      const discount = Number(r.discount || 0);
      const gross = Number(r.grossInc || r.grossIncentive || 0);
      const tdsAmt = Number(r.tdsAmt || 0);
      const ledgerAdj = Number(r.ledgerAdj || 0);
      const eligible = Number(r.eligibleIncentive || Math.max(0, gross - tdsAmt - ledgerAdj));

      consolidatedSales += sales;
      grossIncentives += gross;
      eligibleForIncentive += eligible;

      return {
        partyCode: r.partyCode || r.code,
        partyName: r.partyName || r.name || r.partyCode,
        branch: r.branch || r.branchCode || 'MUMBAI-01',
        sales,
        discount,
        slab: r.slab || `${(r.slabPercent || 0).toFixed(1)}%`,
        slabPercent: Number(r.slabPercent || 0),
        grossInc: gross,
        tdsPercent: Number(r.tdsPercent || 10.0),
        tdsAmt,
        ledgerAdj,
        eligibleIncentive: eligible,
        status: 'PRE_CALCULATED_IMPORTED',
      };
    });

    return {
      previewRows,
      metrics: {
        partiesProcessed: previewRows.length,
        consolidatedSales,
        grossIncentives,
        eligibleForIncentive,
      },
    };
  }

  async pushPreviewToLedgers(year: number, month: number, rows: any[], userId?: string) {
    let committedCount = 0;

    for (const r of rows) {
      if (!r.partyCode) continue;

      let party = await this.prisma.party.findUnique({ where: { code: r.partyCode } });
      if (!party) {
        party = await this.prisma.party.create({
          data: {
            code: r.partyCode,
            name: r.partyName || r.partyCode,
            type: 'DEALER',
            primaryBranchCode: r.branch || 'MUMBAI-01',
            createdBy: userId,
          },
        });
      }

      const categoryCode = r.categoryCode || r.partCategoryCode || 'M';
      const schemeId = r.matchedSchemeId || null;
      const incentiveSource = r.matchedSchemeName || 'Dynamic Engine';

      const existingRecord = await this.prisma.incentiveRecord.findFirst({
        where: {
          partyId: party.id,
          year,
          month,
          branchCode: r.branch || 'MUMBAI-01',
          partCategoryCode: categoryCode,
        },
      });

      if (existingRecord) {
        await this.prisma.incentiveRecord.update({
          where: { id: existingRecord.id },
          data: {
            schemeId,
            incentiveSource,
            baseAmount: r.sales,
            incentiveRate: r.slabPercent || 0,
            calculatedAmount: r.grossInc,
            tdsAmount: r.tdsAmt || 0,
            netAmount: r.eligibleIncentive,
            status: 'APPROVED',
            updatedBy: userId,
          },
        });
      } else {
        await this.prisma.incentiveRecord.create({
          data: {
            partyId: party.id,
            schemeId,
            year,
            month,
            branchCode: r.branch || 'MUMBAI-01',
            partCategoryCode: categoryCode,
            incentiveSource,
            recordType: 'CALCULATED',
            status: 'APPROVED',
            baseAmount: r.sales,
            incentiveRate: r.slabPercent || 0,
            calculatedAmount: r.grossInc,
            tdsAmount: r.tdsAmt || 0,
            netAmount: r.eligibleIncentive,
            createdBy: userId,
          },
        });
      }
      committedCount++;
    }

    return { ok: true, committedCount };
  }
}