// src/bank-imports/bank-imports.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';
import { parse as parseCsv } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BankImportsService {
  private readonly logger = new Logger(BankImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
    private readonly periodLocks: PeriodLocksService,
  ) {}

  async parseAndStageFile(
    fileBuffer: any,
    fileName: string,
    branchCode: string,
    userId: string,
  ) {
    this.branchIsolation.validateBranchAccess(branchCode);

    let rows: Array<Record<string, any>> = [];
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.csv')) {
      const csvString = fileBuffer.toString('utf-8');
      rows = parseCsv(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('Excel workbook contains no sheets');
      }

      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text?.trim() || `col_${colNumber}`;
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber] || `col_${colNumber}`;
          rowData[header] = cell.text;
        });
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      });
    } else {
      throw new BadRequestException('Unsupported file format. Please upload CSV or Excel file.');
    }

    if (rows.length === 0) {
      throw new BadRequestException('Uploaded file is empty or contains no data rows.');
    }

    const batchId = uuidv4();

    return this.prisma.executeInTransaction(async (tx) => {
      let validCount = 0;
      let invalidCount = 0;

      const stagingDataList = rows.map((row) => {
        const rawAmount = row['amount'] || row['Amount'] || row['AMOUNT'] || row['Txn Amount'];
        const rawDate = row['transactionDate'] || row['Transaction Date'] || row['Date'] || row['Txn Date'];
        const refNo = row['referenceNo'] || row['Reference No'] || row['Ref No'] || row['Cheque No'] || row['UTR'];
        const partyCode = row['partyCode'] || row['Party Code'] || row['Dealer Code'] || row['Customer Code'];

        const amount = parseFloat(rawAmount);
        const isValidAmount = !isNaN(amount) && amount > 0;
        const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());

        const errors: string[] = [];
        if (!isValidAmount) errors.push('Invalid or missing amount');
        if (!isValidDate) errors.push('Invalid or missing transaction date');

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        return {
          sourceType: 'BANK_STATEMENT',
          batchId,
          status: (isValid ? 'STAGING' : 'FAILED') as any,
          amount: isValidAmount ? amount : null,
          transactionDate: isValidDate ? new Date(rawDate) : null,
          referenceNo: refNo ? String(refNo).trim() : null,
          partyCode: partyCode ? String(partyCode).trim() : null,
          branchCode,
          payload: row,
          validationErrors: errors.length > 0 ? (errors as any) : undefined,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
          createdBy: userId,
        };
      });

      await tx.rawStagingRecord.createMany({
        data: stagingDataList,
      });

      const importLog = await tx.importLog.create({
        data: {
          batchId,
          sourceType: 'BANK_STATEMENT',
          fileName,
          totalRows: rows.length,
          validRows: validCount,
          invalidRows: invalidCount,
          committedRows: 0,
          status: 'STAGING',
          createdBy: userId,
        },
      });

      await this.auditService.log({
        entityType: 'ImportLog',
        entityId: importLog.id,
        action: 'CREATE',
        newValues: { batchId, fileName, totalRows: rows.length },
        changedBy: userId,
      });

      return {
        batchId,
        fileName,
        totalRows: rows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        status: 'STAGING',
      };
    });
  }

  async getPreview(batchId: string, pagination: any) {
    const importLog = await this.prisma.importLog.findUnique({
      where: { batchId },
    });
    if (!importLog) throw new NotFoundException(`Import batch ${batchId} not found`);

    const where = { batchId, sourceType: 'BANK_STATEMENT' };
    const { skip, take } = getPaginationParams(pagination);

    const [items, totalCount] = await Promise.all([
      this.prisma.rawStagingRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.rawStagingRecord.count({ where }),
    ]);

    return {
      importLog,
      ...buildPaginatedResponse(items, totalCount, pagination.page || 1, pagination.pageSize || 50),
    };
  }

  async commitImport(batchId: string, userId: string) {
    const importLog = await this.prisma.importLog.findUnique({
      where: { batchId },
    });
    if (!importLog) throw new NotFoundException(`Import batch ${batchId} not found`);
    if (importLog.status === 'COMMITTED') {
      throw new BadRequestException('Import batch has already been committed.');
    }

    const validRecords = await this.prisma.rawStagingRecord.findMany({
      where: { batchId, status: 'STAGING' },
    });

    if (validRecords.length === 0) {
      throw new BadRequestException('No valid staging records to commit in this batch.');
    }

    const firstRecord = validRecords[0];
    const branchCode = firstRecord.branchCode || 'HEAD';
    this.branchIsolation.validateBranchAccess(branchCode);

    return this.prisma.executeInTransaction(async (tx) => {
      let committedCount = 0;

      for (const rec of validRecords) {
        if (!rec.amount || !rec.transactionDate) continue;

        const txDate = new Date(rec.transactionDate);
        const year = txDate.getFullYear();
        const month = txDate.getMonth() + 1;

        await this.periodLocks.requirePeriodOpen('CASH', year, month, branchCode);

        let partyId: string | null = null;
        if (rec.partyCode) {
          const party = await tx.party.findUnique({ where: { code: rec.partyCode } });
          if (party) partyId = party.id;
        }

        const cashTx = await tx.cashTransaction.create({
          data: {
            transactionType: 'CASH_IN',
            branchCode: branchCode,
            partyId,
            amount: rec.amount,
            transactionDate: txDate,
            referenceNo: rec.referenceNo || `BANK-IMP-${rec.id.substring(0, 8)}`,
            description: `Bank import statement batch ${batchId}`,
            reconciliationStatus: 'UNRECONCILED',
            reconciledWithId: rec.id,
            createdBy: userId,
          },
        });

        await tx.rawStagingRecord.update({
          where: { id: rec.id },
          data: {
            status: 'COMMITTED',
            committedEntityId: cashTx.id,
            committedEntityType: 'CashTransaction',
            committedAt: new Date(),
            updatedBy: userId,
          },
        });

        committedCount++;
      }

      await tx.importLog.update({
        where: { batchId },
        data: {
          status: 'COMMITTED',
          committedRows: committedCount,
          committedAt: new Date(),
          updatedBy: userId,
        },
      });

      await this.auditService.log({
        entityType: 'ImportLog',
        entityId: importLog.id,
        action: 'UPDATE',
        oldValues: { status: importLog.status },
        newValues: { status: 'COMMITTED', committedRows: committedCount },
        changedBy: userId,
      });

      await this.cacheService.invalidateByTags([`branch:${branchCode}`]);

      return {
        batchId,
        status: 'COMMITTED',
        committedRows: committedCount,
      };
    });
  }

  async rollbackImport(batchId: string, userId: string) {
    const importLog = await this.prisma.importLog.findUnique({
      where: { batchId },
    });
    if (!importLog) throw new NotFoundException(`Import batch ${batchId} not found`);
    if (importLog.status !== 'COMMITTED') {
      throw new BadRequestException('Only COMMITTED import batches can be rolled back.');
    }

    const committedRecords = await this.prisma.rawStagingRecord.findMany({
      where: { batchId, status: 'COMMITTED' },
    });

    return this.prisma.executeInTransaction(async (tx) => {
      const entityIdsToDelete = committedRecords
        .map((r) => r.committedEntityId)
        .filter((id): id is string => !!id);

      if (entityIdsToDelete.length > 0) {
        await tx.cashTransaction.deleteMany({
          where: { id: { in: entityIdsToDelete } },
        });
      }

      await tx.rawStagingRecord.updateMany({
        where: { batchId },
        data: {
          status: 'ROLLED_BACK',
          rolledBackAt: new Date(),
          updatedBy: userId,
        },
      });

      await tx.importLog.update({
        where: { batchId },
        data: {
          status: 'ROLLED_BACK',
          rolledBackAt: new Date(),
          updatedBy: userId,
        },
      });

      await this.auditService.log({
        entityType: 'ImportLog',
        entityId: importLog.id,
        action: 'UPDATE',
        oldValues: { status: 'COMMITTED' },
        newValues: { status: 'ROLLED_BACK', rolledBackRows: committedRecords.length },
        changedBy: userId,
      });

      return {
        batchId,
        status: 'ROLLED_BACK',
        rolledBackRows: committedRecords.length,
      };
    });
  }
}