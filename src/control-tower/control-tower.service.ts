// src/control-tower/control-tower.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

@Injectable()
export class ControlTowerService {
  private readonly logger = new Logger(ControlTowerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  async getOperationalControlTower(year?: number, month?: number) {
    const yr = Number(year) || new Date().getFullYear();
    const mo = Number(month) || (new Date().getMonth() + 1);

    const whereBranch = this.branchIsolation.getBranchFilter('branchCode');

    const [
      branches,
      periodLocks,
      unreconciledCount,
      pendingWorkflows,
      postedIncentives,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { code: true, name: true, region: true },
      }),
      this.prisma.periodLock.findMany({
        where: { year: yr, month: mo },
      }),
      this.prisma.cashTransaction.count({
        where: { ...whereBranch, reconciliationStatus: 'UNRECONCILED' },
      }),
      this.prisma.workflowInstance.count({
        where: { status: 'IN_PROGRESS' },
      }),
      this.prisma.incentiveRecord.aggregate({
        where: { ...whereBranch, year: yr, month: mo, status: 'POSTED' },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    const branchStatusMap = branches.map((b) => {
      const incLock = periodLocks.find((l) => l.branchCode === b.code && l.moduleType === 'INCENTIVE');
      const cashLock = periodLocks.find((l) => l.branchCode === b.code && l.moduleType === 'CASH');

      return {
        branchCode: b.code,
        branchName: b.name,
        region: b.region,
        incentivePeriodStatus: incLock?.status || 'OPEN',
        cashPeriodStatus: cashLock?.status || 'OPEN',
      };
    });

    return {
      year: yr,
      month: mo,
      summary: {
        totalBranches: branches.length,
        totalUnreconciledCashTx: unreconciledCount,
        pendingWorkflowCount: pendingWorkflows,
        postedIncentiveAmount: Number(postedIncentives._sum.netAmount || 0),
        postedIncentiveCount: postedIncentives._count,
      },
      branchStatuses: branchStatusMap,
    };
  }

  async getCustomer360(partyIdOrCode: string) {
    const party = await this.prisma.party.findFirst({
      where: {
        OR: [
          { id: partyIdOrCode.length === 36 ? partyIdOrCode : undefined },
          { code: partyIdOrCode },
        ].filter(Boolean) as any,
      },
      include: {
        primaryBranch: true,
        bankDetails: true,
        mappings: true,
      },
    });

    if (!party) throw new NotFoundException(`Party ${partyIdOrCode} not found`);

    if (party.primaryBranchCode) {
      this.branchIsolation.validateBranchAccess(party.primaryBranchCode);
    }

    const [
      incentiveRecords,
      performances,
      ledgerSnapshots,
      communicationLogs,
      cashTransactions,
    ] = await Promise.all([
      this.prisma.incentiveRecord.findMany({
        where: { partyId: party.id },
        include: { scheme: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 20,
      }),
      this.prisma.dealerMonthlyPerformance.findMany({
        where: { partyId: party.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
      this.prisma.ledgerSnapshot.findMany({
        where: { partyId: party.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 6,
      }),
      this.prisma.messageLog.findMany({
        where: { recipientId: party.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.cashTransaction.findMany({
        where: { partyId: party.id },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      }),
    ]);

    const totalIncentiveEarned = incentiveRecords.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const latestPerformance = performances[0];

    return {
      partyMaster: party,
      summaryStats: {
        totalIncentiveEarned,
        currentOutstandingAmount: latestPerformance ? Number(latestPerformance.outstandingAmount) : 0,
        latestMonthlySales: latestPerformance ? Number(latestPerformance.salesAmount) : 0,
        totalCommunicationCount: communicationLogs.length,
      },
      incentiveRecords,
      performances,
      ledgerSnapshots,
      cashTransactions,
      communicationLogs,
    };
  }
}
