// src/period-locks/period-locks.service.ts
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { PeriodModuleType, PeriodStatus } from '@prisma/client';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PeriodLocksService {
  private readonly logger = new Logger(PeriodLocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  async checkPeriodStatus(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode?: string | null,
    partCategoryCode?: string | null,
    incentiveSource?: string | null,
  ): Promise<PeriodStatus> {
    const lock = await this.prisma.periodLock.findUnique({
      where: {
        moduleType_year_month_branchCode_partCategoryCode_incentiveSource: {
          moduleType,
          year,
          month,
          branchCode: branchCode || null,
          partCategoryCode: partCategoryCode || null,
          incentiveSource: incentiveSource || null,
        } as any,
      },
    });

    return lock?.status || 'OPEN';
  }

  async requirePeriodOpen(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode?: string | null,
  ): Promise<void> {
    const status = await this.checkPeriodStatus(moduleType, year, month, branchCode);
    if (status !== 'OPEN') {
      throw new BadRequestException(
        `Period is ${status.toLowerCase()} for ${moduleType} ${year}-${month}${branchCode ? ` branch ${branchCode}` : ''}. No modifications allowed.`,
      );
    }
  }

  async lockPeriod(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode: string | null,
    partCategoryCode?: string | null,
    incentiveSource?: string | null,
    lockedBy?: string,
  ) {
    const lock = await this.prisma.periodLock.upsert({
      where: {
        moduleType_year_month_branchCode_partCategoryCode_incentiveSource: {
          moduleType,
          year,
          month,
          branchCode: branchCode || null,
          partCategoryCode: partCategoryCode || null,
          incentiveSource: incentiveSource || null,
        } as any,
      },
      create: {
        moduleType,
        year,
        month,
        branchCode,
        partCategoryCode: partCategoryCode || null,
        incentiveSource: incentiveSource || null,
        status: 'LOCKED',
        lockedBy,
        lockedDate: new Date(),
        createdBy: lockedBy,
      },
      update: {
        status: 'LOCKED',
        lockedBy,
        lockedDate: new Date(),
        updatedBy: lockedBy,
      },
    });

    await this.invalidateCache(moduleType, year, month, branchCode);
    return lock;
  }

  async unlockPeriod(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode: string | null,
    reason: string,
    remarks?: string,
    unlockedBy?: string,
  ) {
    const lock = await this.prisma.periodLock.findUnique({
      where: {
        moduleType_year_month_branchCode_partCategoryCode_incentiveSource: {
          moduleType,
          year,
          month,
          branchCode: branchCode || null,
          partCategoryCode: null,
          incentiveSource: null,
        } as any,
      },
    });

    if (!lock) throw new NotFoundException('Period lock not found');
    if (lock.status === 'OPEN') throw new BadRequestException('Period is already open');

    const updated = await this.prisma.periodLock.update({
      where: { id: lock.id },
      data: {
        status: 'OPEN',
        unlockReason: reason,
        unlockRemarks: remarks,
        updatedBy: unlockedBy,
      },
    });

    await this.auditService.log({
      entityType: 'PeriodLock',
      entityId: updated.id,
      action: 'UPDATE',
      oldValues: { status: lock.status },
      newValues: { status: 'OPEN', unlockReason: reason },
      changedBy: unlockedBy,
    });

    await this.invalidateCache(moduleType, year, month, branchCode);
    return updated;
  }

  async closePeriod(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode: string | null,
    closedBy?: string,
  ) {
    const lock = await this.prisma.periodLock.findUnique({
      where: {
        moduleType_year_month_branchCode_partCategoryCode_incentiveSource: {
          moduleType,
          year,
          month,
          branchCode: branchCode || null,
          partCategoryCode: null,
          incentiveSource: null,
        } as any,
      },
    });

    if (!lock) throw new NotFoundException('Period lock not found');
    if (lock.status === 'CLOSED') throw new BadRequestException('Period is already closed');

    const updated = await this.prisma.periodLock.update({
      where: { id: lock.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy,
        updatedBy: closedBy,
      },
    });

    await this.invalidateCache(moduleType, year, month, branchCode);
    return updated;
  }

  async getPeriodLocks(filter: any) {
    const where: any = {};
    if (filter.moduleType) where.moduleType = filter.moduleType;
    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    this.branchIsolation.mergeBranchFilter(where);

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.periodLock.findMany({
        where,
        include: { branch: { select: { code: true, name: true } }, locker: { select: { id: true, fullName: true } } },
        skip, take,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.periodLock.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  private async invalidateCache(
    moduleType: PeriodModuleType,
    year: number,
    month: number,
    branchCode: string | null,
  ) {
    const tags = CacheService.buildBranchPeriodTags(branchCode, year, month);
    tags.push(`period-lock:${moduleType}`);
    await this.cacheService.invalidateByTags(tags);
  }
}