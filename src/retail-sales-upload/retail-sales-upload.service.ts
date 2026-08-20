// src/retail-sales-upload/retail-sales-upload.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { parse as parseCsv } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

import { Readable } from 'stream';

// ─── Canonical Header Mapping ───────────────────────────────────────────────
const CANONICAL_MAP: Record<string, string> = {
  // Consignee
  consignee: 'consignee',
  consigneecode: 'consignee',

  // Dealer Code
  dealercode: 'dealerCode',
  dealer: 'dealerCode',

  // Loc
  loc: 'loc',
  location: 'loc',

  // Part Category Code
  partcategorycode: 'partCategoryCode',
  partcategory: 'partCategoryCode',
  catcode: 'partCategoryCode',

  // Part Num
  partnum: 'partNum',
  partno: 'partNum',
  partnumber: 'partNum',
  part: 'partNum',

  // Root Part Num
  rootpartnum: 'rootPartNum',
  rootpartno: 'rootPartNum',
  rootpartnumber: 'rootPartNum',

  // Day
  day: 'day',

  // Fiscal Year
  fiscalyear: 'fiscalYear',
  fy: 'fiscalYear',

  // Month
  month: 'month',

  // Month Year
  monthyear: 'monthYear',
  period: 'monthYear',

  // Cons Party Code
  conspartycode: 'consPartyCode',
  consigneepartycode: 'consPartyCode',
  partycode: 'consPartyCode',

  // Cons Party Name
  conspartyname: 'consPartyName',
  consigneepartyname: 'consPartyName',
  partyname: 'consPartyName',

  // Party Type
  partytype: 'partyType',

  // Document Num
  documentnum: 'documentNum',
  docnum: 'documentNum',
  docno: 'documentNum',
  documentno: 'documentNum',
  invoicenum: 'documentNum',
  invoiceno: 'documentNum',

  // Remarks
  remarks: 'remarks',
  remark: 'remarks',
  comments: 'remarks',

  // Net Retail Qty
  netretailqty: 'netRetailQty',
  netqty: 'netRetailQty',
  qty: 'netRetailQty',
  quantity: 'netRetailQty',

  // Net Retail Selling
  netretailselling: 'netRetailSelling',
  netselling: 'netRetailSelling',
  sellingprice: 'netRetailSelling',
  sellingamount: 'netRetailSelling',

  // Discount Amount
  discountamount: 'discountAmount',
  discount: 'discountAmount',

  // Net Retail DDL
  netretailddl: 'netRetailDdl',
  netddl: 'netRetailDdl',
  ddl: 'netRetailDdl',
};

function normalizeHeaderKey(header: string): string {
  if (!header) return '';
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CANONICAL_MAP[clean] ?? header.trim();
}

function toDecimal(val: any): number | null {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function toString(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  return String(val).trim();
}

function toInt(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val));
  return isNaN(n) ? null : n;
}

export function extractStringValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if ('text' in val) return String(val.text || '');
    if ('result' in val) return String(val.result || '');
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r: any) => r.text || '').join('');
    }
  }
  return String(val || '');
}

export function normalizePartyType(
  rawType: any,
  dealerCode?: string,
  consPartyCode?: string,
  consignee?: string,
): string {
  const strVal = extractStringValue(rawType).trim();
  const t = strVal.toUpperCase();
  const d = extractStringValue(dealerCode).trim().toUpperCase();
  const c = extractStringValue(consPartyCode).trim().toUpperCase();
  const cg = extractStringValue(consignee).trim().toUpperCase();

  // Rule 1: MSZ or 10912NYI -> MASS
  if (t === 'MSZ' || d === 'MSZ' || c === 'MSZ' || cg === 'MSZ' || d === '10912NYI' || c === '10912NYI' || cg === '10912NYI') {
    return 'MASS';
  }

  // Rule 2: OTHERS -> WALK-IN CUSTOMER
  if (t === 'OTHERS' || t === 'OTHER' || t === '[OBJECT OBJECT]') {
    return 'WALK-IN CUSTOMER';
  }

  if (!t || t === '-' || t === 'N/A' || t === 'NA') {
    return 'WALK-IN CUSTOMER';
  }

  return strVal;
}

import { ReportsService } from '../reports/reports.service';

@Injectable()
export class RetailSalesUploadService {
  private readonly logger = new Logger(RetailSalesUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  // ─── Robust Multi-Engine File Parser ──────────────────────────────────────
  private async parseFile(
    fileBuffer: Buffer | ArrayBuffer,
    fileName: string,
  ): Promise<Array<Record<string, any>>> {
    const lower = fileName.toLowerCase();
    const buffer = Buffer.from(fileBuffer as any);

    // Engine 1: CSV via csv-parse
    if (lower.endsWith('.csv')) {
      try {
        const raw = parseCsv(buffer.toString('utf-8').replace(/^\uFEFF/, ''), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }) as Array<Record<string, any>>;

        return raw.map((row) => {
          const normalized: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) {
            normalized[normalizeHeaderKey(k)] = v;
          }
          return normalized;
        });
      } catch (err) {
        this.logger.warn(`csv-parse failed, falling back to Excel parser: ${err.message}`);
      }
    }

    // Engine 2: Streaming ExcelJS reader for memory-efficient processing of large .xlsx files
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      try {
        const stream = Readable.from(buffer);
        const workbookReader = new (ExcelJS as any).stream.xlsx.WorkbookReader(stream, {
          entries: 'emit',
          sharedStrings: 'cache',
          worksheets: 'emit',
        });

        const rows: Array<Record<string, any>> = [];
        let headers: string[] = [];

        for await (const worksheetReader of workbookReader) {
          let rowCount = 0;
          for await (const row of worksheetReader) {
            rowCount++;
            const values: any[] = Array.isArray(row.values) ? row.values : [];

            if (rowCount === 1) {
              headers = values.map((val) => normalizeHeaderKey(String(val ?? '')));
              continue;
            }

            const obj: Record<string, any> = {};
            for (let col = 1; col < values.length; col++) {
              const key = headers[col];
              if (key) {
                const val = values[col];
                obj[key] = typeof val === 'object' && val !== null && 'result' in val ? val.result : val;
              }
            }

            if (Object.keys(obj).length > 0) {
              rows.push(obj);
            }
          }
          break; // Only process first sheet
        }

        if (rows.length > 0) {
          return rows;
        }
      } catch (err) {
        this.logger.warn(`ExcelJS streaming reader failed for ${fileName}, falling back to XLSX.read: ${err.message}`);
      }
    }

    // Engine 3: XLSX (SheetJS) fallback for binary Excel (.xls) or non-standard sheets
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('No sheets found in workbook.');
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false,
      });

      return rawRows.map((row) => {
        const normalized: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          normalized[normalizeHeaderKey(k)] = v;
        }
        return normalized;
      });
    } catch (err) {
      this.logger.error(`Excel parsing failed: ${err.message}`);
      throw new BadRequestException(
        `Failed to parse spreadsheet file "${fileName}". Ensure it is a valid .csv, .xlsx, or .xls file.`,
      );
    }
  }

  // ─── Detect all unique monthYear values in the rows ───────────────────────
  private detectPeriods(rows: Array<Record<string, any>>): string[] {
    const periods = new Set<string>();
    for (const row of rows) {
      let my = toString(row['monthYear']);
      // Fallback: auto-generate monthYear from month + fiscalYear if missing
      if (!my) {
        const m = toString(row['month']);
        const fy = toInt(row['fiscalYear']);
        if (m && fy) {
          my = `${m} ${fy}`;
          row['monthYear'] = my;
        }
      }
      if (my) periods.add(my);
    }
    return [...periods];
  }

  // ─── Main upload handler: REWRITE mode ───────────────────────────────────
  async uploadAndRewrite(
    fileBuffer: Buffer | ArrayBuffer,
    fileName: string,
    userId: string,
  ) {
    this.logger.log(`Retail sales upload started: ${fileName}`);

    const rows = await this.parseFile(fileBuffer, fileName);
    if (rows.length === 0) {
      throw new BadRequestException('File is empty or contains no data rows.');
    }

    // Populate missing monthYear where possible
    const periods = this.detectPeriods(rows);

    // Validate required columns exist in sample row
    const sample = rows[0];
    const required = ['consignee', 'dealerCode', 'partNum', 'documentNum', 'monthYear'];
    const missing = required.filter((k) => !(k in sample) || sample[k] === undefined);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}. ` +
        `Expected headers (or equivalents): Consignee, Dealer Code, Part Num, Document Num, Month Year`,
      );
    }

    if (periods.length === 0) {
      throw new BadRequestException('No valid Month Year values found in the file.');
    }

    const batchId = uuidv4();

    // ── Rewrite operation ────────────────────────────────────────────────
    // 1. Delete existing records for ALL periods found in the upload
    const deleteResult = await this.prisma.retailSalesRecord.deleteMany({
      where: { monthYear: { in: periods } },
    });
    const deletedRows = deleteResult.count;
    this.logger.log(`Deleted ${deletedRows} existing records for periods: ${periods.join(', ')}`);

    // 2. Build insert batch (skip rows with missing key fields)
    const toInsert: any[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const consignee = toString(row['consignee']);
      const dealerCode = toString(row['dealerCode']);
      const partNum = toString(row['partNum']);
      const documentNum = toString(row['documentNum']);
      let monthYear = toString(row['monthYear']);

      if (!monthYear) {
        const m = toString(row['month']);
        const fy = toInt(row['fiscalYear']);
        if (m && fy) monthYear = `${m} ${fy}`;
      }

      if (!consignee || !dealerCode || !partNum || !documentNum || !monthYear) {
        skipped.push(
          `Row skipped (missing key fields): ${JSON.stringify(row).slice(0, 120)}`,
        );
        continue;
      }

      toInsert.push({
        uploadBatchId: batchId,
        consignee,
        dealerCode,
        loc: toString(row['loc']),
        partCategoryCode: toString(row['partCategoryCode']),
        partNum,
        rootPartNum: toString(row['rootPartNum']),
        day: toString(row['day']),
        fiscalYear: toInt(row['fiscalYear']),
        month: toString(row['month']),
        monthYear,
        consPartyCode: toString(row['consPartyCode']),
        consPartyName: toString(row['consPartyName']),
        partyType: normalizePartyType(row['partyType'], dealerCode, row['consPartyCode'], consignee),
        documentNum,
        remarks: toString(row['remarks']),
        netRetailQty: toDecimal(row['netRetailQty']),
        netRetailSelling: toDecimal(row['netRetailSelling']),
        discountAmount: toDecimal(row['discountAmount']),
        netRetailDdl: toDecimal(row['netRetailDdl']),
        createdBy: userId,
      });
    }

    if (skipped.length > 0) {
      this.logger.warn(`${skipped.length} rows skipped due to missing key fields.`);
    }

    // 3. Bulk insert in chunks of 10000 for maximum performance
    let insertedRows = 0;
    if (toInsert.length > 0) {
      const CHUNK = 10000;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const res = await this.prisma.retailSalesRecord.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        insertedRows += res.count;
      }
    }

    // 4. Automatically sync unique parties to party_master and detect new parties
    const syncRes = await this.autoSyncPartiesToPartyMaster(toInsert, userId);

    // 5. Write upload log
    const log = await this.prisma.retailSalesUploadLog.create({
      data: {
        batchId,
        fileName: fileName.slice(0, 500),
        monthYear: periods.join(', ').slice(0, 500),
        totalRows: rows.length,
        insertedRows,
        deletedRows,
        status: 'DONE',
        createdBy: userId,
      },
    });

    const result = {
      batchId,
      fileName,
      periods,
      totalRows: rows.length,
      insertedRows,
      deletedRows,
      skippedRows: rows.length - toInsert.length,
      status: 'DONE' as const,
      uploadLogId: log.id,
      newPartiesCount: syncRes.addedCount,
      newParties: syncRes.newParties,
      updatedPartiesCount: syncRes.updatedCount,
    };

    // 6. Automatically recalculate Target vs Achievement cache for uploaded periods
    try {
      for (const p of periods) {
        const [m, y] = p.split(' ');
        if (m && y) {
          this.reportsService.refreshTargetVsAchievementCache(Number(y), m).catch((e) => {
            this.logger.warn(`Target vs Achievement background cache refresh error: ${e.message}`);
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not trigger Target vs Achievement cache refresh: ${err.message}`);
    }

    this.logger.log(`Upload complete: batch=${batchId}, inserted=${result.insertedRows}, deleted=${result.deletedRows}, newParties=${result.newPartiesCount}`);
    return result;
  }

  // ─── Auto-sync uploaded parties to party_master table ─────────────────────
  private async autoSyncPartiesToPartyMaster(
    rows: Array<Record<string, any>>,
    userId: string,
  ): Promise<{ addedCount: number; updatedCount: number; newParties: any[] }> {
    try {
      const partyMap = new Map<string, {
        code: string;
        name: string;
        type: string;
        loc: string;
        sales: number;
      }>();

      for (const r of rows) {
        const code = (r.consPartyCode ? String(r.consPartyCode).trim() : '');
        const name = (r.consPartyName ? String(r.consPartyName).trim() : '');
        const type = normalizePartyType(r.partyType, r.dealerCode, r.consPartyCode, r.consignee);
        const loc = (r.loc ? String(r.loc).trim() : 'ALWAR-SPR');
        const sales = Number(r.netRetailSelling || 0);

        if (!code || code === '-' || code === 'N/A' || code === 'NA' || type.toLowerCase().includes('walk')) {
          continue;
        }

        const existing = partyMap.get(code);
        if (existing) {
          existing.sales += sales;
        } else {
          partyMap.set(code, {
            code,
            name: name || code,
            type,
            loc,
            sales,
          });
        }
      }

      if (partyMap.size === 0) {
        return { addedCount: 0, updatedCount: 0, newParties: [] };
      }

      const partyCodes = Array.from(partyMap.keys());
      const existingInDb = await this.prisma.partyMaster.findMany({
        where: { consPartyCode: { in: partyCodes } },
        select: { id: true, consPartyCode: true, totalSales: true },
      });
      const existingSet = new Set(existingInDb.map((p) => p.consPartyCode));

      const newParties: any[] = [];
      let updatedCount = 0;
      const syncedAt = new Date();

      for (const [code, item] of partyMap.entries()) {
        if (!existingSet.has(code)) {
          await this.prisma.partyMaster.create({
            data: {
              consPartyCode: item.code,
              consPartyName: item.name,
              partyType: item.type,
              baseLoc: item.loc,
              totalSales: item.sales,
              incentiveType: 'Slab-Based',
              isActive: true,
              lastSyncedAt: syncedAt,
              createdBy: userId,
            },
          });
          newParties.push({
            code: item.code,
            name: item.name,
            type: item.type,
            baseLoc: item.loc,
          });

          // Ensure entry in parties table too
          const existingParty = await this.prisma.party.findUnique({ where: { code: item.code } });
          if (!existingParty) {
            await this.prisma.party.create({
              data: {
                code: item.code,
                name: item.name,
                type: 'DEALER',
                primaryBranchCode: item.loc,
                isActive: true,
                createdBy: userId,
              },
            }).catch(() => null);
          }
        } else {
          await this.prisma.partyMaster.update({
            where: { consPartyCode: code },
            data: {
              consPartyName: item.name,
              baseLoc: item.loc,
              partyType: item.type,
              totalSales: item.sales,
              lastSyncedAt: syncedAt,
            },
          });
          updatedCount++;
        }
      }

      if (newParties.length > 0) {
        const title = `🎉 ${newParties.length} New Parties Registered from Sales Upload`;
        const previewNames = newParties.slice(0, 4).map((p) => `${p.name} (${p.code})`).join(', ');
        const body = `${newParties.length} new unique parties were detected and registered in Party Master: ${previewNames}${newParties.length > 4 ? ` and ${newParties.length - 4} more` : ''}.`;

        await this.prisma.announcement.create({
          data: {
            title,
            body,
            scope: 'ALL',
            isActive: true,
            createdBy: userId,
          },
        }).catch((err) => this.logger.warn(`Failed to create announcement: ${err.message}`));

        await this.prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title,
            body,
            link: '/parties',
            metadata: { newParties: newParties.slice(0, 20) },
          },
        }).catch((err) => this.logger.warn(`Failed to create notification: ${err.message}`));

        this.logger.log(`[AutoSync] Added ${newParties.length} new parties to Party Master.`);
      }

      return { addedCount: newParties.length, updatedCount, newParties };
    } catch (err) {
      this.logger.error(`Error in autoSyncPartiesToPartyMaster: ${err.message}`, err.stack);
      return { addedCount: 0, updatedCount: 0, newParties: [] };
    }
  }

  // ─── Get upload history ───────────────────────────────────────────────────
  async getUploadHistory(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.retailSalesUploadLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.retailSalesUploadLog.count(),
    ]);
    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Delete Upload Batch (Rollback) ───────────────────────────────────────
  async deleteBatch(batchId: string) {
    const log = await this.prisma.retailSalesUploadLog.findUnique({
      where: { batchId },
    });
    if (!log) throw new NotFoundException(`Upload batch ${batchId} not found.`);

    const deletedRecords = await this.prisma.retailSalesRecord.deleteMany({
      where: { uploadBatchId: batchId },
    });

    await this.prisma.retailSalesUploadLog.delete({
      where: { batchId },
    });

    return {
      message: `Batch ${batchId} successfully rolled back. Deleted ${deletedRecords.count} records.`,
      batchId,
      deletedRecordsCount: deletedRecords.count,
    };
  }

  // ─── Get records with overall sum metrics ────────────────────────────────
  async getRecords(query: {
    monthYear?: string;
    dealerCode?: string;
    consignee?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.monthYear) where.monthYear = query.monthYear;
    if (query.dealerCode) where.dealerCode = { contains: query.dealerCode, mode: 'insensitive' };
    if (query.consignee) where.consignee = { contains: query.consignee, mode: 'insensitive' };

    const [items, total, aggregate] = await Promise.all([
      this.prisma.retailSalesRecord.findMany({
        where,
        orderBy: [{ monthYear: 'desc' }, { dealerCode: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.retailSalesRecord.count({ where }),
      this.prisma.retailSalesRecord.aggregate({
        where,
        _sum: {
          netRetailQty: true,
          netRetailSelling: true,
          discountAmount: true,
          netRetailDdl: true,
        },
      }),
    ]);

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totals: {
        totalQty: aggregate._sum.netRetailQty || 0,
        totalSelling: aggregate._sum.netRetailSelling || 0,
        totalDiscount: aggregate._sum.discountAmount || 0,
        totalDdl: aggregate._sum.netRetailDdl || 0,
      },
    };
  }

  // ─── Summary by period ────────────────────────────────────────────────────
  async getSummary(monthYear?: string) {
    const where: any = {};
    if (monthYear) where.monthYear = monthYear;

    const agg = await this.prisma.retailSalesRecord.groupBy({
      by: ['monthYear', 'dealerCode'],
      where,
      _sum: {
        netRetailQty: true,
        netRetailSelling: true,
        discountAmount: true,
        netRetailDdl: true,
      },
      _count: { id: true },
      orderBy: [{ monthYear: 'desc' }, { dealerCode: 'asc' }],
    });

    return agg.map((r) => ({
      monthYear: r.monthYear,
      dealerCode: r.dealerCode,
      rowCount: r._count.id,
      totalQty: r._sum.netRetailQty,
      totalSelling: r._sum.netRetailSelling,
      totalDiscount: r._sum.discountAmount,
      totalDdl: r._sum.netRetailDdl,
    }));
  }

  // ─── Get distinct periods available ──────────────────────────────────────
  async getAvailablePeriods() {
    const result = await this.prisma.retailSalesRecord.findMany({
      distinct: ['monthYear'],
      select: { monthYear: true },
      orderBy: { monthYear: 'desc' },
    });
    return result.map((r) => r.monthYear);
  }

  // ─── Generate Sample Upload Template ──────────────────────────────────────
  async generateTemplate(format: 'csv' | 'xlsx' = 'xlsx'): Promise<Buffer> {
    const headers = [
      'Consignee',
      'Dealer Code',
      'Loc',
      'Part Category Code',
      'Part Num',
      'Root Part Num',
      'Day',
      'Fiscal Year',
      'Month',
      'Month Year',
      'Cons Party Code',
      'Cons Party Name',
      'Party Type',
      'Document Num',
      'Remarks',
      'Net Retail Qty',
      'Net Retail Selling',
      'Discount Amount',
      'Net Retail DDL',
    ];

    const sampleRows = [
      [
        'RJ06111',
        'RJ06',
        'VBZ',
        'M',
        '81851M84010',
        '81850-84010',
        '4',
        2026,
        'Jun',
        'Jun 2026',
        'TRJ060236685',
        'SPIFFY AUTOMART PRIVATE LIMITED',
        'TRADER/RETAILER',
        'RS/26014049',
        '-',
        1,
        292.79,
        40.99,
        235.55,
      ],
      [
        'RJ06K71',
        'RJ06',
        'JSK',
        'M',
        '09482M00551',
        '09482-00427',
        '27',
        2026,
        'Jun',
        'Jun 2026',
        '-',
        'KRATIKA AUTO',
        'WALK-IN CUSTOMER',
        'CSI/26005668',
        '-',
        4,
        264.4,
        21.15,
        222.8,
      ],
    ];

    if (format === 'csv') {
      const csvLines = [
        headers.join(','),
        ...sampleRows.map((r) =>
          r.map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(','),
        ),
      ];
      return Buffer.from(csvLines.join('\n'), 'utf-8');
    }

    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Retail Sales Template');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
