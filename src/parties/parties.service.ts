// src/parties/parties.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PartyFilterDto } from './dto/party-filter.dto';
import { getPaginationParams, buildPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PartiesService {
  private readonly logger = new Logger(PartiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  async create(dto: CreatePartyDto, createdBy: string): Promise<any> {
    // Validate branch access if primaryBranchCode specified
    if (dto.primaryBranchCode) {
      this.branchIsolation.validateBranchAccess(dto.primaryBranchCode);
    }

    // Check code uniqueness
    const existing = await this.prisma.party.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Party code already exists');

    return this.prisma.executeInTransaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          subType: dto.subType || 'REGULAR',
          primaryBranchCode: dto.primaryBranchCode,
          pan: dto.pan,
          gstIn: dto.gstIn,
          contactPerson: dto.contactPerson,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          createdBy,
        },
      });

      // Create bank details
      if (dto.bankDetails && dto.bankDetails.length > 0) {
        await tx.partyBankDetail.createMany({
          data: dto.bankDetails.map((bd, i) => ({
            partyId: party.id,
            bankName: bd.bankName,
            branchName: bd.branchName,
            accountNumber: bd.accountNumber,
            ifscCode: bd.ifscCode,
            accountType: bd.accountType,
            accountHolder: bd.accountHolder,
            isDefault: bd.isDefault ?? (i === 0),
            createdBy,
          })),
        });
      }

      // Create party mappings
      if (dto.mappings && dto.mappings.length > 0) {
        await tx.partyMapping.createMany({
          data: dto.mappings.map((m) => ({
            partyId: party.id,
            mappingType: m.mappingType,
            mappedValue: m.mappedValue,
            mappedLabel: m.mappedLabel,
            createdBy,
          })),
        });
      }

      await this.auditService.log({
        entityType: 'Party',
        entityId: party.id,
        action: 'CREATE',
        newValues: { ...party, bankDetails: dto.bankDetails, mappings: dto.mappings },
        changedBy: createdBy,
      });

      // Invalidate cache tags for affected branch
      if (dto.primaryBranchCode) {
        await this.cacheService.invalidateByTag(`branch:${dto.primaryBranchCode}`);
      }

      return party;
    });
  }

  async findAll(filter: PartyFilterDto): Promise<PaginatedResponse<any>> {
    const { skip, take } = getPaginationParams(filter);

    // Apply branch isolation
    const where: any = this.branchIsolation.mergeBranchFilter({}, 'primaryBranchCode');

    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
        { pan: { contains: filter.search, mode: 'insensitive' } },
        { gstIn: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.type) where.type = filter.type;
    if (filter.subType) where.subType = filter.subType;
    if (filter.branchCode) where.primaryBranchCode = filter.branchCode;
    if (filter.executiveCode) {
      where.mappings = {
        some: {
          mappingType: 'EXECUTIVE_ASSIGNMENT',
          mappedValue: filter.executiveCode,
        },
      };
    }

    where.isActive = true;

    const [items, totalCount] = await Promise.all([
      this.prisma.party.findMany({
        where,
        select: {
          id: true, code: true, name: true, type: true, subType: true,
          primaryBranchCode: true, pan: true, gstIn: true,
          contactPerson: true, phone: true, email: true,
          city: true, state: true, isActive: true, rowVersion: true,
          createdAt: true, updatedAt: true,
          primaryBranch: { select: { code: true, name: true } },
          _count: {
            select: {
              bankDetails: true,
              mappings: true,
              incentiveRecords: true,
            },
          },
        },
        skip,
        take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.party.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async findOne(id: string): Promise<any> {
    const where: any = { id };
    this.branchIsolation.mergeBranchFilter(where, 'primaryBranchCode');

    const party = await this.prisma.party.findFirst({
      where,
      include: {
        primaryBranch: { select: { code: true, name: true } },
        bankDetails: {
          where: { isActive: true },
          orderBy: { isDefault: 'desc' },
        },
        mappings: {
          where: { isActive: true },
        },
      },
    });

    if (!party) throw new NotFoundException('Party not found');
    return party;
  }

  async findByCode(code: string): Promise<any> {
    const where: any = { code };
    this.branchIsolation.mergeBranchFilter(where, 'primaryBranchCode');

    const party = await this.prisma.party.findFirst({
      where,
      include: {
        primaryBranch: { select: { code: true, name: true } },
        bankDetails: { where: { isActive: true } },
        mappings: { where: { isActive: true } },
      },
    });

    if (!party) throw new NotFoundException('Party not found');
    return party;
  }

  async update(id: string, dto: UpdatePartyDto, updatedBy: string): Promise<any> {
    const where: any = { id };
    this.branchIsolation.mergeBranchFilter(where, 'primaryBranchCode');

    const existing = await this.prisma.party.findFirst({
      where,
      include: {
        bankDetails: true,
        mappings: true,
      },
    });

    if (!existing) throw new NotFoundException('Party not found');

    // Optimistic concurrency check
    PrismaService.checkRowVersion(dto.rowVersion ?? existing.rowVersion, existing.rowVersion);

    return this.prisma.executeInTransaction(async (tx) => {
      const data: any = { updatedBy, rowVersion: { increment: 1 } };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.type !== undefined) data.type = dto.type;
      if (dto.subType !== undefined) data.subType = dto.subType;
      if (dto.primaryBranchCode !== undefined) {
        if (dto.primaryBranchCode) {
          this.branchIsolation.validateBranchAccess(dto.primaryBranchCode);
        }
        data.primaryBranchCode = dto.primaryBranchCode;
      }
      if (dto.pan !== undefined) data.pan = dto.pan;
      if (dto.gstIn !== undefined) data.gstIn = dto.gstIn;
      if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.address !== undefined) data.address = dto.address;
      if (dto.city !== undefined) data.city = dto.city;
      if (dto.state !== undefined) data.state = dto.state;
      if (dto.pincode !== undefined) data.pincode = dto.pincode;

      // Soft delete existing bank details and recreate
      if (dto.bankDetails !== undefined) {
        await tx.partyBankDetail.updateMany({
          where: { partyId: id },
          data: { isActive: false, updatedBy },
        });
        if (dto.bankDetails.length > 0) {
          await tx.partyBankDetail.createMany({
            data: dto.bankDetails.map((bd: any, i: number) => ({
              partyId: id,
              bankName: bd.bankName,
              branchName: bd.branchName,
              accountNumber: bd.accountNumber,
              ifscCode: bd.ifscCode,
              accountType: bd.accountType,
              accountHolder: bd.accountHolder,
              isDefault: bd.isDefault ?? (i === 0),
              createdBy: updatedBy,
            })),
          });
        }
      }

      // Soft delete existing mappings and recreate
      if (dto.mappings !== undefined) {
        await tx.partyMapping.updateMany({
          where: { partyId: id },
          data: { isActive: false, updatedBy },
        });
        if (dto.mappings.length > 0) {
          await tx.partyMapping.createMany({
            data: dto.mappings.map((m: any) => ({
              partyId: id,
              mappingType: m.mappingType,
              mappedValue: m.mappedValue,
              mappedLabel: m.mappedLabel,
              createdBy: updatedBy,
            })),
          });
        }
      }

      const party = await tx.party.update({
        where: { id },
        data,
      });

      const diff = AuditService.computeDiff(
        existing as any,
        party as any,
      );

      await this.auditService.log({
        entityType: 'Party',
        entityId: id,
        action: 'UPDATE',
        oldValues: diff.old,
        newValues: diff.new,
        changedBy: updatedBy,
      });

      // Invalidate cache
      await this.cacheService.invalidateByTags([
        `branch:${existing.primaryBranchCode}`,
        `branch:${dto.primaryBranchCode || existing.primaryBranchCode}`,
      ]);

      return party;
    });
  }

  async getMappings(partyId: string, mappingType?: string) {
    const where: any = { partyId, isActive: true };
    if (mappingType) where.mappingType = mappingType;

    return this.prisma.partyMapping.findMany({
      where,
      orderBy: { mappingType: 'asc' },
    });
  }

  async addMapping(partyId: string, mappingType: string, mappedValue: string, mappedLabel?: string, createdBy?: string) {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException('Party not found');

    return this.prisma.partyMapping.create({
      data: {
        partyId,
        mappingType: mappingType as any,
        mappedValue,
        mappedLabel,
        createdBy,
      },
    });
  }

  async getPartySummary(partyId: string): Promise<any> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { primaryBranch: true },
    });
    if (!party) throw new NotFoundException('Party not found');

    const allRecords = await this.prisma.incentiveRecord.findMany({
      where: { partyId: party.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    if (allRecords.length === 0) {
      return {
        partyId: party.id,
        partyCode: party.code,
        partyName: party.name,
        currentSale: 0,
        currentSlabPercent: 0,
        currentIncentive: 0,
        nextSlabPercent: 0,
        additionalPurchaseRequired: 0,
        nextIncentive: 0,
        growthMoM: 0,
        growthYoY: 0,
        progressPercent: 0,
        activeSlabs: [],
      };
    }

    const latest = allRecords[0];

    const prevMonth = latest.month === 1 ? 12 : latest.month - 1;
    const prevYear = latest.month === 1 ? latest.year - 1 : latest.year;
    const previous = allRecords.find(r => r.year === prevYear && r.month === prevMonth);
    const lastYear = allRecords.find(r => r.year === latest.year - 1 && r.month === latest.month);

    const growth = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? 100 : 0;
      return Number(Math.round(((curr - prev) / prev * 100) * 100) / 100);
    };

    const latestSale = Number(latest.baseAmount || 0);
    const prevSale = previous ? Number(previous.baseAmount || 0) : 0;
    const lySale = lastYear ? Number(lastYear.baseAmount || 0) : 0;

    const growthMoM = growth(latestSale, prevSale);
    const growthYoY = growth(latestSale, lySale);

    const currentIncentive = Number(latest.calculatedAmount || 0);
    const currentSlabPercent = latest.incentiveRate ? Number(latest.incentiveRate) * 100 : 0;

    let nextSlabPercent = 0;
    let additionalPurchaseRequired = 0;
    let nextIncentive = 0;
    let progressPercent = 100;
    let activeSlabs: any[] = [];

    const scheme = latest.schemeId
      ? await this.prisma.incentiveScheme.findUnique({
          where: { id: latest.schemeId },
          include: { details: { orderBy: { slabFrom: 'asc' } } },
        })
      : null;

    if (scheme) {
      activeSlabs = scheme.details.map(d => ({
        minAchievementPercent: Number(d.slabFrom),
        maxAchievementPercent: d.slabTo ? Number(d.slabTo) : 999999999,
        percentage: Number(d.incentiveRate) * 100,
        fixedAmount: d.minAmount ? Number(d.minAmount) : 0,
        ruleName: d.incentiveType,
      }));

      const currentDetail = scheme.details.find(
        d => latestSale >= Number(d.slabFrom) && (!d.slabTo || latestSale <= Number(d.slabTo))
      );

      const nextDetail = currentDetail
        ? scheme.details.find(d => Number(d.slabFrom) > Number(currentDetail.slabFrom))
        : scheme.details[0];

      if (nextDetail) {
        nextSlabPercent = Number(nextDetail.incentiveRate) * 100;
        const target = Number(nextDetail.slabFrom);
        additionalPurchaseRequired = Math.round(Math.max(0, target - latestSale));
        nextIncentive = Math.round(Math.max(0, (nextDetail.minAmount ? Number(nextDetail.minAmount) : 0) + (target * nextSlabPercent) / 100));
        progressPercent = target > 0 ? Number(Math.round((latestSale / target * 100) * 100) / 100) : 100;
      }
    }

    return {
      partyId: party.id,
      partyCode: party.code,
      partyName: party.name,
      currentSale: latestSale,
      currentSlabPercent,
      currentIncentive,
      nextSlabPercent,
      additionalPurchaseRequired,
      nextIncentive,
      growthMoM,
      growthYoY,
      progressPercent,
      activeSlabs,
    };
  }

  async getPartyHistory(partyId: string): Promise<any[]> {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException('Party not found');

    const records = await this.prisma.incentiveRecord.findMany({
      where: { partyId: party.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      take: 12,
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return records.map(r => {
      const gross = Number(r.calculatedAmount || 0);
      const tds = Number(r.tdsAmount || 0);
      const net = Number(r.netAmount || 0);
      const monthName = `${monthNames[r.month - 1]} ${r.year}`;

      return {
        monthName,
        month: r.month,
        year: r.year,
        sales: Number(r.baseAmount || 0),
        incentive: gross,
        slabPercent: r.incentiveRate ? Number(r.incentiveRate) * 100 : 0,
        tdsAmount: tds,
        netCreditedAmount: net,
        status: r.status,
        creditedOn: r.updatedAt.toISOString().slice(0, 10),
        utr: `UTR-${r.id.slice(0, 8).toUpperCase()}`,
      };
    });
  }

  async getAllPartyMappings() {
    return this.prisma.partyMapping.findMany({
      where: { isActive: true },
      include: {
        party: { select: { id: true, code: true, name: true, primaryBranchCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  async batchImportPartyMappings(items: Array<{ alternateCode: string; originalCode: string; partyName?: string; branchCode?: string }>, userId?: string) {
    let importedCount = 0;
    for (const item of items) {
      if (!item.alternateCode || !item.originalCode) continue;

      const party = await this.prisma.party.findUnique({
        where: { code: item.originalCode },
      });

      if (party) {
        await this.prisma.partyMapping.create({
          data: {
            partyId: party.id,
            mappingType: 'CODE_ALTERNATE',
            mappedValue: item.alternateCode,
            mappedLabel: item.partyName || `Alternate code for ${item.originalCode}`,
            createdBy: userId,
          },
        });
        importedCount++;
      }
    }
    return { ok: true, importedCount };
  }

  async lookupIfsc(ifscCode: string) {
    const code = (ifscCode || '').trim().toUpperCase();
    if (!code || code.length !== 11) {
      return { ok: false, message: 'Invalid IFSC code format (must be 11 characters)' };
    }

    try {
      const response = await fetch(`https://ifsc.razorpay.com/${code}`);
      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          ifsc: code,
          bankName: data.BANK || '',
          branchName: data.BRANCH || '',
          address: data.ADDRESS || '',
          city: data.CITY || '',
          state: data.STATE || '',
          micr: data.MICR || '',
        };
      }
    } catch (e) {
      // API fallback below
    }

    const prefix = code.substring(0, 4);
    const bankPrefixes: Record<string, string> = {
      PUNB: 'Punjab National Bank',
      UBIN: 'Union Bank of India',
      SBIN: 'State Bank of India',
      HDFC: 'HDFC Bank',
      ICIC: 'ICICI Bank',
      AXIS: 'Axis Bank',
      BARB: 'Bank of Baroda',
      BKID: 'Bank of India',
      CNRB: 'Canara Bank',
      IOBA: 'Indian Overseas Bank',
      CBIN: 'Central Bank of India',
      IDIB: 'Indian Bank',
      PSIB: 'Punjab & Sind Bank',
      UCOB: 'UCO Bank',
      KKBK: 'Kotak Mahindra Bank',
      YESB: 'Yes Bank',
      INDB: 'IndusInd Bank',
      MAHB: 'Bank of Maharashtra',
    };

    if (bankPrefixes[prefix]) {
      return {
        ok: true,
        ifsc: code,
        bankName: bankPrefixes[prefix],
        branchName: 'MAIN BRANCH',
      };
    }

    return { ok: false, message: 'IFSC code lookup failed' };
  }

  async getBankMasterRecords() {
    const parties = await this.prisma.party.findMany({
      where: { isActive: true },
      include: {
        bankDetails: {
          where: { isActive: true },
          orderBy: { isDefault: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    const records: Array<{
      partyId: string;
      partyCode: string;
      partyName: string;
      accountNumber: string;
      accountHolder: string;
      ifscCode: string;
      bankName: string;
      branchName: string;
      pan: string;
      mobile: string;
      bankDetailId?: string;
    }> = [];

    for (const p of parties) {
      if (p.bankDetails && p.bankDetails.length > 0) {
        for (const bd of p.bankDetails) {
          records.push({
            partyId: p.id,
            partyCode: p.code,
            partyName: p.name,
            accountNumber: bd.accountNumber || '',
            accountHolder: bd.accountHolder || p.name,
            ifscCode: bd.ifscCode || '',
            bankName: bd.bankName || '',
            branchName: bd.branchName || '',
            pan: p.pan || '',
            mobile: p.phone || '',
            bankDetailId: bd.id,
          });
        }
      } else {
        records.push({
          partyId: p.id,
          partyCode: p.code,
          partyName: p.name,
          accountNumber: '',
          accountHolder: p.name,
          ifscCode: '',
          bankName: '',
          branchName: '',
          pan: p.pan || '',
          mobile: p.phone || '',
        });
      }
    }

    return records;
  }

  async upsertBankMasterRecord(
    dto: {
      partyCode: string;
      accountNumber: string;
      accountHolder?: string;
      ifscCode?: string;
      bankName: string;
      branchName?: string;
      pan?: string;
      mobile?: string;
    },
    userId?: string,
  ) {
    const party = await this.prisma.party.findUnique({
      where: { code: dto.partyCode },
    });

    if (!party) {
      throw new Error(`Party with code ${dto.partyCode} not found`);
    }

    if (dto.pan !== undefined || dto.mobile !== undefined) {
      await this.prisma.party.update({
        where: { id: party.id },
        data: {
          ...(dto.pan !== undefined ? { pan: dto.pan } : {}),
          ...(dto.mobile !== undefined ? { phone: dto.mobile } : {}),
          updatedBy: userId,
        },
      });
    }

    const existing = await this.prisma.partyBankDetail.findFirst({
      where: { partyId: party.id, accountNumber: dto.accountNumber, isActive: true },
    });

    if (existing) {
      return this.prisma.partyBankDetail.update({
        where: { id: existing.id },
        data: {
          bankName: dto.bankName,
          branchName: dto.branchName,
          ifscCode: dto.ifscCode,
          accountHolder: dto.accountHolder || party.name,
          updatedBy: userId,
        },
      });
    } else {
      const count = await this.prisma.partyBankDetail.count({
        where: { partyId: party.id, isActive: true },
      });

      return this.prisma.partyBankDetail.create({
        data: {
          partyId: party.id,
          accountNumber: dto.accountNumber,
          accountHolder: dto.accountHolder || party.name,
          bankName: dto.bankName,
          branchName: dto.branchName,
          ifscCode: dto.ifscCode,
          isDefault: count === 0,
          createdBy: userId,
        },
      });
    }
  }

  // ─── PARTY MASTER TABLE METHODS ─────────────────────────────────────────

  /**
   * Fast read from the party_master table (simple SELECT — no raw_sales scan).
   * Returns all active non-walk-in parties, shape compatible with the frontend.
   */
  async getPartyMasterSsotRegistry(requestedBranch?: string): Promise<any[]> {
    // Delete any legacy dummy/hyphen records if present
    await this.prisma.partyMaster.deleteMany({
      where: {
        OR: [
          { consPartyCode: '-' },
          { consPartyCode: '' },
          { consPartyCode: 'N/A' },
          { consPartyCode: 'NA' },
          { consPartyCode: { startsWith: 'CONSPARTY-' } },
          { consPartyCode: { startsWith: 'raw-party-' } },
        ],
      },
    }).catch(() => null);

    const where: any = {
      consPartyCode: {
        notIn: ['-', '', 'N/A', 'NA', 'null', 'undefined'],
      },
      NOT: [
        { consPartyCode: { startsWith: '-' } },
        { consPartyCode: { startsWith: 'CONSPARTY-' } },
        { consPartyCode: { startsWith: 'raw-party-' } },
        { consPartyName: { startsWith: 'CONSPARTY-' } },
      ],
    };

    if (requestedBranch && requestedBranch !== 'ALL' && requestedBranch !== 'All Branches') {
      where.baseLoc = requestedBranch;
    } else {
      const branchFilter: any = {};
      this.branchIsolation.mergeBranchFilter(branchFilter, 'baseLoc');

      // If branch filter active, strictly exclude disabled/inactive parties for branch users
      if (Object.keys(branchFilter).length > 0) {
        where.isActive = true;
        Object.assign(where, branchFilter);
      }
    }

    const rows = await this.prisma.partyMaster.findMany({
      where,
      orderBy: { consPartyCode: 'asc' },
    });

    return rows.map((r) => ({
      id:                 r.id,
      code:               r.consPartyCode,
      name:               r.consPartyName,
      originalCode:       r.originalCode   || r.consPartyCode,
      primaryBranchCode:  r.baseLoc        || 'UTD',
      baseLoc:            r.baseLoc        || 'UTD',
      type:               r.partyType      || 'INDEPENDENT WORKSHOP',
      phone:              r.phone          || '-',
      pan:                r.pan            || '-',
      gstIn:              r.gstIn          || '-',
      salesExecutive:     r.salesExecutive || '-',
      incentiveType:      r.incentiveType,
      incentiveRule:      r.incentiveRule  || '-',
      accountHolder:      r.accountHolder  || 'Pending Setup',
      bankName:           r.bankName       || '-',
      branchName:         r.bankBranch     || '-',
      ifscCode:           r.ifscCode       || '-',
      accountNumber:      r.accountNumber  || '-',
      totalSales:         Number(r.totalSales || 0),
      lastSyncedAt:       r.lastSyncedAt,
      status:             r.isActive ? 'Active' : 'Disabled',
      isActive:           r.isActive !== false,
    }));
  }

  /**
   * Sync party_master from raw_sales.
   *  - Excludes: cons_party_code = '-' / '' and party_type ILIKE '%walk%in%'
   *  - On new code  → INSERT with raw_sales data
   *  - On existing  → UPDATE only base_loc, total_sales, party_type, cons_party_name, last_synced_at
   *                    (never overwrites manual fields: executive, bank, original_code, phone, pan, etc.)
   */
  async syncPartyMasterFromRawSales(triggeredBy?: string): Promise<{ added: number; updated: number; total: number }> {
    this.logger.log(`[PartyMaster] Starting sync from raw_sales (triggeredBy=${triggeredBy ?? 'manual'})`);

    // ── 1. Fetch distinct parties from raw_sales (excluding walk-ins / blank codes) ──
    const rawRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON (party_code, party_name)
        party_code    AS "consPartyCode",
        party_name    AS "consPartyName",
        loc           AS "baseLoc",
        party_type    AS "partyType",
        loc_sales     AS "totalSales"
      FROM (
        SELECT
          COALESCE(NULLIF(TRIM(CAST(cons_party_code AS TEXT)), ''), '-')      AS party_code,
          COALESCE(NULLIF(TRIM(CAST(cons_party_name AS TEXT)), ''), '-')      AS party_name,
          CAST(loc AS TEXT)                                                    AS loc,
          MAX(CAST(party_type AS TEXT))                                        AS party_type,
          SUM(net_retail_selling)                                              AS loc_sales
        FROM raw_sales
        WHERE
          TRIM(CAST(cons_party_code AS TEXT)) <> ''
          AND TRIM(CAST(cons_party_code AS TEXT)) <> '-'
          AND LOWER(CAST(party_type AS TEXT)) NOT LIKE '%walk%'
        GROUP BY
          COALESCE(NULLIF(TRIM(CAST(cons_party_code AS TEXT)), ''), '-'),
          COALESCE(NULLIF(TRIM(CAST(cons_party_name AS TEXT)), ''), '-'),
          CAST(loc AS TEXT)
      ) sub
      ORDER BY
        party_code ASC  NULLS LAST,
        party_name ASC  NULLS LAST,
        loc_sales  DESC NULLS LAST
    `);

    this.logger.log(`[PartyMaster] raw_sales returned ${rawRows.length} unique parties`);

    // ── 2. Load existing party_master codes ──
    const existing = await this.prisma.partyMaster.findMany({
      select: { id: true, consPartyCode: true, consPartyName: true },
    });
    const existingMap = new Map<string, string>(); // code -> id
    for (const e of existing) existingMap.set(e.consPartyCode, e.id);

    const syncedAt = new Date();
    let added = 0;
    let updated = 0;

    // ── 3. UPSERT in batches ──
    const BATCH = 500;
    for (let i = 0; i < rawRows.length; i += BATCH) {
      const batch = rawRows.slice(i, i + BATCH);

      await Promise.all(batch.map(async (row) => {
        const code  = (row.consPartyCode as string).trim();
        const name  = (row.consPartyName as string).trim();
        const loc   = (row.baseLoc  as string | null) ?? null;
        let type    = (row.partyType as string | null) ?? 'INDEPENDENT WORKSHOP';
        const uType = type.trim().toUpperCase();

        if (uType === 'MSZ' || code === 'MSZ' || code === '10912NYI') {
          type = 'MASS';
        } else if (uType === 'OTHERS' || uType === 'OTHER') {
          type = 'WALK-IN CUSTOMER';
        }

        const sales = Number(row.totalSales ?? 0);

        if (existingMap.has(code)) {
          // Existing → update only auto-derived fields, preserve manual ones
          await this.prisma.partyMaster.update({
            where:  { consPartyCode: code },
            data: {
              consPartyName: name,
              baseLoc:       loc,
              partyType:     type,
              totalSales:    sales,
              lastSyncedAt:  syncedAt,
            },
          });
          updated++;
        } else {
          // New → insert with defaults for manual fields
          await this.prisma.partyMaster.create({
            data: {
              consPartyCode: code,
              consPartyName: name,
              partyType:     type,
              baseLoc:       loc,
              totalSales:    sales,
              incentiveType: 'Slab-Based',
              isActive:      true,
              lastSyncedAt:  syncedAt,
              createdBy:     triggeredBy ?? undefined,
            },
          });
          added++;
        }
      }));
    }

    this.logger.log(`[PartyMaster] Sync complete — added: ${added}, updated: ${updated}`);
    return { added, updated, total: existing.length + added };
  }

  /**
   * Update manual fields on a party_master record (executive, bank, original_code, phone, PAN, etc.)
   * Raw_sales sync will never overwrite these.
   */
  async updatePartyMasterRecord(consPartyCode: string, dto: {
    originalCode?:    string;
    baseLoc?:         string;
    salesExecutive?:  string;
    phone?:           string;
    pan?:             string;
    gstIn?:           string;
    bankName?:        string;
    bankBranch?:      string;
    accountNumber?:   string;
    ifscCode?:        string;
    accountHolder?:   string;
    incentiveType?:   string;
    incentiveRule?:   string;
    isActive?:        boolean;
    updatedBy?:       string;
    updatedByUsername?: string;
    updaterRoles?:    string[];
  }): Promise<any> {
    const record = await this.prisma.partyMaster.findUnique({ where: { consPartyCode } });
    if (!record) throw new NotFoundException(`Party master record not found for code: ${consPartyCode}`);

    // Check if bank details or critical identification changed
    const hasBankChange =
      (dto.accountNumber !== undefined && dto.accountNumber !== record.accountNumber) ||
      (dto.ifscCode      !== undefined && dto.ifscCode      !== record.ifscCode) ||
      (dto.bankName      !== undefined && dto.bankName      !== record.bankName) ||
      (dto.accountHolder !== undefined && dto.accountHolder !== record.accountHolder) ||
      (dto.bankBranch    !== undefined && dto.bankBranch    !== record.bankBranch);

    const updated = await this.prisma.partyMaster.update({
      where: { consPartyCode },
      data: {
        ...(dto.originalCode   !== undefined && { originalCode:   dto.originalCode }),
        ...(dto.baseLoc        !== undefined && { baseLoc:        dto.baseLoc }),
        ...(dto.salesExecutive !== undefined && { salesExecutive: dto.salesExecutive }),
        ...(dto.phone          !== undefined && { phone:          dto.phone }),
        ...(dto.pan            !== undefined && { pan:            dto.pan }),
        ...(dto.gstIn          !== undefined && { gstIn:          dto.gstIn }),
        ...(dto.bankName       !== undefined && { bankName:       dto.bankName }),
        ...(dto.bankBranch     !== undefined && { bankBranch:     dto.bankBranch }),
        ...(dto.accountNumber  !== undefined && { accountNumber:  dto.accountNumber }),
        ...(dto.ifscCode       !== undefined && { ifscCode:       dto.ifscCode }),
        ...(dto.accountHolder  !== undefined && { accountHolder:  dto.accountHolder }),
        ...(dto.incentiveType  !== undefined && { incentiveType:  dto.incentiveType }),
        ...(dto.incentiveRule  !== undefined && { incentiveRule:  dto.incentiveRule }),
        ...(dto.isActive       !== undefined && { isActive:       dto.isActive }),
        ...(dto.updatedBy      !== undefined && { updatedBy:      dto.updatedBy }),
      },
    });

    // ── SEND SUPERADMIN NOTIFICATION ON BANK DETAILS UPDATE ─────────────────
    if (hasBankChange) {
      try {
        const updaterName = dto.updatedByUsername || 'Branch User';
        const partyName = record.consPartyName || record.consPartyCode;
        const branch = dto.baseLoc || record.baseLoc || 'General';

        const adminUsers = await this.prisma.user.findMany({
          where: {
            OR: [
              { roles: { some: { role: { name: { in: ['SuperAdmin', 'Admin', 'FinanceHead', 'Auditor'] } } } } },
              { username: 'admin' },
            ],
            isActive: true,
          },
          select: { id: true, username: true },
        });

        const newBankName = dto.bankName ?? record.bankName ?? '-';
        const newAccNum = dto.accountNumber ?? record.accountNumber ?? '-';
        const newIfsc = dto.ifscCode ?? record.ifscCode ?? '-';
        const newAccHolder = dto.accountHolder ?? record.accountHolder ?? '-';

        const title = `🏦 Bank Details Updated: ${partyName} (${branch})`;
        const body = `User "${updaterName}" updated bank details for ${partyName} [${record.consPartyCode}]: Bank: ${newBankName} | A/c: ${newAccNum} | IFSC: ${newIfsc} | Holder: ${newAccHolder}`;

        for (const admin of adminUsers) {
          // If the admin user himself updated, still send so all superadmins get notified
          await this.prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'ALERT',
              title,
              body,
              link: '/parties',
              metadata: {
                partyCode: record.consPartyCode,
                partyName,
                branch,
                updatedBy: updaterName,
                bankName: newBankName,
                accountNumber: newAccNum,
                ifscCode: newIfsc,
                accountHolder: newAccHolder,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
        this.logger.log(`[Party Master] Bank update notification sent to ${adminUsers.length} admin(s) for party ${consPartyCode}`);
      } catch (err: any) {
        this.logger.error(`[Party Master] Failed to send bank update notification: ${err.message}`);
      }
    }

    // ── CASCADE SYNC: If baseLoc changed, propagate to all related tables ──────
    if (dto.baseLoc !== undefined && dto.baseLoc !== record.baseLoc) {
      const newBranch = dto.baseLoc;
      this.logger.log(`[Party Master] baseLoc changed for ${consPartyCode}: ${record.baseLoc} → ${newBranch}. Cascading sync...`);

      await Promise.allSettled([

        // 1. Incentive Register Records (baseBranch)
        this.prisma.incentiveRegisterRecord.updateMany({
          where: { originalPartyCode: consPartyCode },
          data: { baseBranch: newBranch },
        }),

        // 2. Dealer Outstandings (branchCode)
        this.prisma.dealerOutstanding.updateMany({
          where: { partyCode: consPartyCode },
          data: { branchCode: newBranch },
        }),

        // 3. Dealer Targets (branchCode) — update only future/current records to avoid historical distortion
        this.prisma.dealerTarget.updateMany({
          where: { partyCode: consPartyCode },
          data: { branchCode: newBranch },
        }),

        // 4. TargetVsAchievementSnapshot (branchCode)
        this.prisma.targetVsAchievementSnapshot.updateMany({
          where: { partyCode: consPartyCode },
          data: { branchCode: newBranch },
        }),

        // 5. Party (primaryBranchCode) — keep the party table in sync
        this.prisma.party.updateMany({
          where: { code: consPartyCode },
          data: { primaryBranchCode: newBranch },
        }),

      ]);

      this.logger.log(`[Party Master] Cascade sync complete for ${consPartyCode} → ${newBranch}`);
    }

    if (dto.isActive !== undefined) {
      await this.prisma.party.updateMany({
        where: { code: consPartyCode },
        data: { isActive: dto.isActive },
      }).catch(() => null);
    }

    return updated;
  }

  /** @deprecated — was used before party_master table existed */
  private async _legacyGetPartyMasterSsotRegistry(): Promise<any[]> {
    let partyLocRows: any[] = [];
    try {
      // Fastest approach for large raw_sales: aggregate in subquery, then DISTINCT ON for top-loc per party
      partyLocRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT ON (party_code, party_name)
          party_code        AS "consPartyCode",
          party_name        AS "consPartyName",
          loc               AS "baseLoc",
          party_type        AS "partyType",
          loc_sales         AS "totalSales"
        FROM (
          SELECT
            COALESCE(NULLIF(CAST(cons_party_code AS TEXT), ''), '-')                AS party_code,
            COALESCE(NULLIF(CAST(cons_party_name AS TEXT), ''), 'Walk-In Customer') AS party_name,
            CAST(loc AS TEXT)                                                        AS loc,
            MAX(CAST(party_type AS TEXT))                                            AS party_type,
            SUM(net_retail_selling)                                                  AS loc_sales
          FROM raw_sales
          GROUP BY
            COALESCE(NULLIF(CAST(cons_party_code AS TEXT), ''), '-'),
            COALESCE(NULLIF(CAST(cons_party_name AS TEXT), ''), 'Walk-In Customer'),
            CAST(loc AS TEXT)
        ) sub
        ORDER BY
          party_code ASC NULLS LAST,
          party_name ASC NULLS LAST,
          loc_sales  DESC NULLS LAST
      `);
    } catch (err) {
      console.warn('Error querying raw_sales SSOT:', err);
    }

    // Fetch all existing parties from database to combine and sync
    const existingParties = await this.prisma.party.findMany({
      where: { isActive: true },
      include: {
        bankDetails: { where: { isActive: true }, orderBy: { isDefault: 'desc' } },
        mappings: { where: { isActive: true } },
      },
    });

    // Fetch all Party Bank Details from Bank Master table
    const bankMasterRecords = await this.prisma.partyBankDetail.findMany({
      where: { isActive: true },
      include: { party: true },
    });
    const bankMap = new Map<string, any>();
    for (const b of bankMasterRecords) {
      if (b.party?.code) bankMap.set(b.party.code, b);
    }

    // Fetch Party Mappings (Alternate Code / Executive Mappings)
    const partyMappings = await this.prisma.partyMapping.findMany({
      where: { isActive: true },
    });
    const altCodeMap = new Map<string, string>(); // partyId -> originalCode
    const execMap = new Map<string, string>(); // partyId -> executiveName
    for (const m of partyMappings) {
      if ((m.mappingType as string) === 'CODE_ALTERNATE' || (m.mappingType as string) === 'ALTERNATE_CODE') altCodeMap.set(m.partyId, m.mappedValue);
      if ((m.mappingType as string) === 'EXECUTIVE_ASSIGNMENT') execMap.set(m.partyId, m.mappedValue);
    }

    const resultMap = new Map<string, any>();
    let idCounter = 1;

    // Add from RAW_SALES first (SSOT)
    for (const row of partyLocRows) {
      const code = row.consPartyCode || '-';
      const name = row.consPartyName || 'WALK-IN CUSTOMER';
      const key = `${code}::${name}`;

      const existingParty = existingParties.find((p) => p.code === code || p.name === name);
      const bankDetail = bankMap.get(code) || (existingParty?.bankDetails?.[0]);
      const origCode = (existingParty?.id && altCodeMap.get(existingParty.id)) || existingParty?.code || code;
      const salesExec = (existingParty?.id && execMap.get(existingParty.id)) || '-';

      resultMap.set(key, {
        id: existingParty?.id || `raw-party-${idCounter++}`,
        code: code,
        name: name,
        originalCode: origCode,
        primaryBranchCode: row.baseLoc || 'UTD',
        baseLoc: row.baseLoc || 'UTD',
        type: row.partyType || existingParty?.type || (code === '-' ? 'WALK-IN CUSTOMER' : 'INDEPENDENT WORKSHOP'),
        phone: existingParty?.phone || '-',
        salesExecutive: salesExec,
        incentiveType: 'Slab-Based',
        accountHolder: bankDetail?.accountHolder || (bankDetail?.bankName ? (bankDetail.accountHolder || name) : 'Pending Setup'),
        bankName: bankDetail?.bankName || '-',
        branchName: bankDetail?.branchName || '-',
        ifscCode: bankDetail?.ifscCode || '-',
        accountNumber: bankDetail?.accountNumber || '-',
        pan: bankDetail?.pan || existingParty?.pan || '-',
        totalSales: Number(row.totalSales || 0),
        status: 'Active',
      });
    }

    // Add remaining DB parties that don't have RAW_SALES records yet
    for (const p of existingParties) {
      const key = `${p.code}::${p.name}`;
      if (!resultMap.has(key)) {
        const bankDetail = bankMap.get(p.code) || p.bankDetails?.[0];
        const origCode = altCodeMap.get(p.id) || p.code;
        const salesExec = execMap.get(p.id) || '-';

        resultMap.set(key, {
          id: p.id,
          code: p.code,
          name: p.name,
          originalCode: origCode,
          primaryBranchCode: p.primaryBranchCode || 'UTD',
          baseLoc: p.primaryBranchCode || 'UTD',
          type: p.type || 'INDEPENDENT WORKSHOP',
          phone: p.phone || '-',
          salesExecutive: salesExec,
          incentiveType: 'Slab-Based',
          accountHolder: bankDetail?.accountHolder || (bankDetail?.bankName ? p.name : 'Pending Setup'),
          bankName: bankDetail?.bankName || '-',
          branchName: bankDetail?.branchName || '-',
          ifscCode: bankDetail?.ifscCode || '-',
          accountNumber: bankDetail?.accountNumber || '-',
          pan: bankDetail?.pan || p.pan || '-',
          totalSales: 0,
          status: 'Active',
        });
      }
    }

    return Array.from(resultMap.values());
  }
}