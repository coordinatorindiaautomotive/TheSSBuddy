// src/cash-management/cash-management.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class CashManagementService {
  private readonly logger = new Logger(CashManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
    private readonly periodLocks: PeriodLocksService,
  ) {}

  async createTransaction(data: any, createdBy: string) {
    const branchCode = data.branchCode;
    this.branchIsolation.validateBranchAccess(branchCode);

    const txDate = new Date(data.transactionDate);
    const year = txDate.getFullYear();
    const month = txDate.getMonth() + 1;

    // Check period lock
    await this.periodLocks.requirePeriodOpen('CASH', year, month, branchCode);

    return this.prisma.executeInTransaction(async (tx) => {
      const transaction = await tx.cashTransaction.create({
        data: {
          transactionType: data.transactionType,
          branchCode,
          partyId: data.partyId || null,
          costCenter: data.costCenter || null,
          amount: data.amount,
          transactionDate: txDate,
          referenceNo: data.referenceNo || null,
          description: data.description || null,
          createdBy,
        },
      });

      await this.auditService.log({
        entityType: 'CashTransaction',
        entityId: transaction.id,
        action: 'CREATE',
        newValues: transaction,
        changedBy: createdBy,
      });

      await this.cacheService.invalidateByTags(
        CacheService.buildBranchPeriodTags(branchCode, year, month),
      );

      return transaction;
    });
  }

  async reconcile(
    transactionId: string,
    stagingRecordId: string,
    reconciledBy: string,
  ) {
    const transaction = await this.prisma.cashTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');

    const staging = await this.prisma.rawStagingRecord.findUnique({
      where: { id: stagingRecordId },
    });
    if (!staging) throw new NotFoundException('Staging record not found');

    const updated = await this.prisma.cashTransaction.update({
      where: { id: transactionId },
      data: {
        reconciliationStatus: 'RECONCILED',
        reconciledWithId: stagingRecordId,
        reconciledAt: new Date(),
        updatedBy: reconciledBy,
      },
    });

    await this.cacheService.invalidateByTags(
      CacheService.buildBranchPeriodTags(
        transaction.branchCode,
        transaction.transactionDate.getFullYear(),
        transaction.transactionDate.getMonth() + 1,
      ),
    );

    return updated;
  }

  async getUnreconciled(filter: any) {
    const where: any = {
      reconciliationStatus: 'UNRECONCILED',
    };
    this.branchIsolation.mergeBranchFilter(where);

    if (filter.transactionType) where.transactionType = filter.transactionType;
    if (filter.costCenter) where.costCenter = filter.costCenter;
    if (filter.dateFrom) where.transactionDate = { ...((where.transactionDate as any) || {}), gte: new Date(filter.dateFrom) };
    if (filter.dateTo) where.transactionDate = { ...((where.transactionDate as any) || {}), lte: new Date(filter.dateTo) };

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        where,
        include: { party: { select: { id: true, code: true, name: true } } },
        skip, take,
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.cashTransaction.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async closeCashPeriod(year: number, month: number, branchCode: string, closedBy: string) {
    return this.periodLocks.closePeriod('CASH', year, month, branchCode, closedBy);
  }
}