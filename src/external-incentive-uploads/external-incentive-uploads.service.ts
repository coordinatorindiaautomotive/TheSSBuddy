// src/external-incentive-uploads/external-incentive-uploads.service.ts
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
export class ExternalIncentiveUploadsService {
  private readonly logger = new Logger(ExternalIncentiveUploadsService.name);

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
        const partyCode = row['partyCode'] || row['Party Code'] || row['Dealer Code'];
        const year = parseInt(row['year'] || row['Year'] || new Date().getFullYear());
        const month = parseInt(row['month'] || row['Month'] || (new Date().getMonth() + 1));
        const baseAmount = parseFloat(row['baseAmount'] || row['Base Amount'] || row['Sales Amount'] || '0');
        const incentiveAmount = parseFloat(row['incentiveAmount'] || row['Incentive Amount'] || row['Amount'] || '0');
        const partCategoryCode = row['partCategoryCode'] || row['Category Code'] || row['Category'];

        const errors: string[] = [];
        if (!partyCode) errors.push('Missing partyCode');
        if (isNaN(year) || year < 2000 || year > 2100) errors.push('Invalid year');
        if (isNaN(month) || month < 1 || month > 12) errors.push('Invalid month');
        if (isNaN(baseAmount) || baseAmount < 0) errors.push('Invalid base amount');
        if (isNaN(incentiveAmount) || incentiveAmount < 0) errors.push('Invalid incentive amount');

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        return {
          sourceType: 'EXTERNAL_INCENTIVE',
          batchId,
          status: (isValid ? 'STAGING' : 'FAILED') as any,
          amount: isValid ? incentiveAmount : null,
          transactionDate: new Date(year, month - 1, 15),
          partyCode: partyCode ? String(partyCode).trim() : null,
          branchCode,
          payload: {
            ...row,
            year,
            month,
            baseAmount,
            incentiveAmount,
            partCategoryCode: partCategoryCode ? String(partCategoryCode).trim() : null,
          },
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
          sourceType: 'EXTERNAL_INCENTIVE',
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
        newValues: { batchId, fileName, totalRows: rows.length, sourceType: 'EXTERNAL_INCENTIVE' },
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

    const where = { batchId, sourceType: 'EXTERNAL_INCENTIVE' };
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
        const payload = (rec.payload as any) || {};
        const year = payload.year;
        const month = payload.month;
        const baseAmount = payload.baseAmount;
        const incentiveAmount = payload.incentiveAmount;
        const partCategoryCode = payload.partCategoryCode;

        await this.periodLocks.requirePeriodOpen('INCENTIVE', year, month, branchCode);

        const party = await tx.party.findUnique({ where: { code: rec.partyCode! } });
        if (!party) {
          this.logger.warn(`Skipping staging row ${rec.id}: Party code ${rec.partyCode} not found`);
          continue;
        }

        const incRecord = await tx.incentiveRecord.create({
          data: {
            partyId: party.id,
            year,
            month,
            branchCode,
            partCategoryCode: partCategoryCode || null,
            incentiveSource: 'EXTERNAL_UPLOAD',
            recordType: 'MANUALLY_UPLOADED',
            status: 'DRAFT',
            baseAmount,
            incentiveRate: baseAmount > 0 ? (incentiveAmount / baseAmount) * 100 : 0,
            calculatedAmount: incentiveAmount,
            tdsAmount: 0,
            netAmount: incentiveAmount,
            createdBy: userId,
          },
        });

        await tx.rawStagingRecord.update({
          where: { id: rec.id },
          data: {
            status: 'COMMITTED',
            committedEntityId: incRecord.id,
            committedEntityType: 'IncentiveRecord',
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
        await tx.incentiveRecord.deleteMany({
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
