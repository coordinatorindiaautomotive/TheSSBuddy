// src/ledger/ledger.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
  ) {}

  async getPartyStatement(partyId: string, year: number, month: number) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { primaryBranch: true },
    });
    if (!party) throw new NotFoundException(`Party ${partyId} not found`);

    if (party.primaryBranchCode) {
      this.branchIsolation.validateBranchAccess(party.primaryBranchCode);
    }

    const [incentiveRecords, cashTransactions, snapshot] = await Promise.all([
      this.prisma.incentiveRecord.findMany({
        where: { partyId, year, month },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          partyId,
          transactionDate: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0, 23, 59, 59),
          },
        },
        orderBy: { transactionDate: 'asc' },
      }),
      this.prisma.ledgerSnapshot.findUnique({
        where: { partyId_year_month: { partyId, year, month } },
      }),
    ]);

    const openingBalance = snapshot ? Number(snapshot.openingBalance) : 0;
    const totalIncentiveCredit = incentiveRecords.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const totalCashDebit = cashTransactions
      .filter((c) => c.transactionType === 'CASH_OUT')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const totalCashCredit = cashTransactions
      .filter((c) => c.transactionType === 'CASH_IN')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const closingBalance = openingBalance + totalIncentiveCredit + totalCashCredit - totalCashDebit;

    return {
      party: { id: party.id, code: party.code, name: party.name, type: party.type },
      year,
      month,
      openingBalance,
      totalIncentiveCredit,
      totalCashCredit,
      totalCashDebit,
      closingBalance,
      snapshot,
      incentiveRecords,
      cashTransactions,
    };
  }

  async createSnapshot(partyId: string, year: number, month: number, createdBy: string) {
    const statement = await this.getPartyStatement(partyId, year, month);

    const lineItems = [
      ...statement.incentiveRecords.map((r) => ({
        type: 'INCENTIVE',
        id: r.id,
        amount: Number(r.netAmount),
        date: r.createdAt,
      })),
      ...statement.cashTransactions.map((c) => ({
        type: c.transactionType,
        id: c.id,
        amount: Number(c.amount),
        date: c.transactionDate,
      })),
    ];

    const snapshot = await this.prisma.ledgerSnapshot.upsert({
      where: { partyId_year_month: { partyId, year, month } },
      create: {
        partyId,
        year,
        month,
        openingBalance: statement.openingBalance,
        totalDebit: statement.totalCashDebit,
        totalCredit: statement.totalIncentiveCredit + statement.totalCashCredit,
        closingBalance: statement.closingBalance,
        lineItems,
        createdBy,
      },
      update: {
        openingBalance: statement.openingBalance,
        totalDebit: statement.totalCashDebit,
        totalCredit: statement.totalIncentiveCredit + statement.totalCashCredit,
        closingBalance: statement.closingBalance,
        lineItems,
        rowVersion: { increment: 1 },
        updatedBy: createdBy,
      },
    });

    await this.auditService.log({
      entityType: 'LedgerSnapshot',
      entityId: snapshot.id,
      action: 'UPDATE',
      newValues: snapshot,
      changedBy: createdBy,
    });

    return snapshot;
  }

  async compareSnapshots(
    partyId: string,
    period1: { year: number; month: number },
    period2: { year: number; month: number },
  ) {
    const [snap1, snap2] = await Promise.all([
      this.prisma.ledgerSnapshot.findUnique({
        where: { partyId_year_month: { partyId, year: period1.year, month: period1.month } },
      }),
      this.prisma.ledgerSnapshot.findUnique({
        where: { partyId_year_month: { partyId, year: period2.year, month: period2.month } },
      }),
    ]);

    if (!snap1 || !snap2) {
      throw new NotFoundException('One or both historical ledger snapshots were not found for comparison.');
    }

    const openDiff = Number(snap2.openingBalance) - Number(snap1.openingBalance);
    const creditDiff = Number(snap2.totalCredit) - Number(snap1.totalCredit);
    const debitDiff = Number(snap2.totalDebit) - Number(snap1.totalDebit);
    const closeDiff = Number(snap2.closingBalance) - Number(snap1.closingBalance);

    return {
      partyId,
      period1,
      period2,
      snapshot1: snap1,
      snapshot2: snap2,
      diff: {
        openingBalanceDiff: openDiff,
        totalCreditDiff: creditDiff,
        totalDebitDiff: debitDiff,
        closingBalanceDiff: closeDiff,
      },
    };
  }

  async exportLedgerToExcel(statement: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Ledger-${statement.party.code}`);

    sheet.addRow(['Party Code', statement.party.code]);
    sheet.addRow(['Party Name', statement.party.name]);
    sheet.addRow(['Period', `${statement.year}-${statement.month}`]);
    sheet.addRow(['Opening Balance', statement.openingBalance]);
    sheet.addRow(['Closing Balance', statement.closingBalance]);
    sheet.addRow([]);

    sheet.addRow(['Type', 'Date / Ref', 'Description / Scheme', 'Amount']);
    statement.incentiveRecords.forEach((r: any) => {
      sheet.addRow(['INCENTIVE_CREDIT', r.createdAt, r.partCategoryCode || 'N/A', Number(r.netAmount)]);
    });
    statement.cashTransactions.forEach((c: any) => {
      sheet.addRow([c.transactionType, c.transactionDate, c.referenceNo || 'N/A', Number(c.amount)]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
  }
}
