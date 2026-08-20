// src/sales/sales.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { AuditService } from '../audit/audit.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { v4 as uuidv4 } from 'uuid';
import { parse as parseCsv } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
import { Readable } from 'stream';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly auditService: AuditService,
    private readonly periodLocks: PeriodLocksService,
  ) {}

  async parseAndStageSales(
    fileBuffer: Buffer,
    fileName: string,
    userId: string,
  ) {
    this.logger.debug('--- FAST DIRECT UPLOAD ---');
    this.logger.debug(`Buffer length: ${fileBuffer.length}`);
    const lowerName = fileName.toLowerCase();
    const batchId = uuidv4();

    // ─── STEP 1: Parse ALL rows into memory (no DB calls) ───────────────────
    const allRows: Record<string, any>[] = [];

    if (lowerName.endsWith('.csv')) {
      const csvString = fileBuffer.toString('utf-8');
      const rows = (parseCsv as any)(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      for (const row of rows) {
        allRows.push(row);
      }
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      this.logger.debug('Loading ZIP via jszip to extract metadata...');
      const zip = await JSZip.loadAsync(fileBuffer);

      const workbookXmlFile = zip.file('xl/workbook.xml');
      if (!workbookXmlFile) {
        throw new BadRequestException('xl/workbook.xml not found in Excel archive');
      }
      const workbookXmlText = await workbookXmlFile.async('text');

      const relsXmlFile = zip.file('xl/_rels/workbook.xml.rels');
      if (!relsXmlFile) {
        throw new BadRequestException('xl/_rels/workbook.xml.rels not found in Excel archive');
      }
      const relsXmlText = await relsXmlFile.async('text');

      // Extract sheet tags
      const sheetTags = workbookXmlText.match(/<sheet\s+[^>]*>/gi) || [];
      const sheets = sheetTags.map(tag => {
        const nameMatch = tag.match(/name=["']([^"']+)["']/i);
        const rIdMatch = tag.match(/r:id=["']([^"']+)["']/i);
        return {
          name: nameMatch ? nameMatch[1] : '',
          rId: rIdMatch ? rIdMatch[1] : '',
        };
      }).filter(s => s.name && s.rId);

      // Extract relationship tags
      const relTags = relsXmlText.match(/<Relationship\s+[^>]*>/gi) || [];
      const rels = relTags.map(tag => {
        const idMatch = tag.match(/Id=["']([^"']+)["']/i);
        const targetMatch = tag.match(/Target=["']([^"']+)["']/i);
        return {
          id: idMatch ? idMatch[1] : '',
          target: targetMatch ? targetMatch[1] : '',
        };
      }).filter(r => r.id && r.target);

      // Map targets to names
      const targetToNameMap = new Map<string, string>();
      for (const sheet of sheets) {
        const rel = rels.find(r => r.id === sheet.rId);
        if (rel) {
          targetToNameMap.set(rel.target.toLowerCase(), sheet.name);
        }
      }

      let matchedSheetName: string | null = null;
      for (const name of targetToNameMap.values()) {
        if (name.toLowerCase() === 'raw') {
          matchedSheetName = name;
          break;
        }
      }
      if (!matchedSheetName) {
        for (const name of targetToNameMap.values()) {
          if (name.toLowerCase() === 'summary') {
            matchedSheetName = name;
            break;
          }
        }
      }
      if (!matchedSheetName && targetToNameMap.size > 0) {
        matchedSheetName = targetToNameMap.values().next().value;
      }

      if (!matchedSheetName) {
        throw new BadRequestException('No worksheets found in the Excel file');
      }

      let targetPath: string | null = null;
      for (const [path, name] of targetToNameMap.entries()) {
        if (name === matchedSheetName) {
          targetPath = path;
          break;
        }
      }

      this.logger.debug(`Matched worksheet: ${matchedSheetName} (target path: ${targetPath})`);

      // Stream read the sheet using exceljs WorkbookReader
      const stream = Readable.from(fileBuffer);
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
        worksheets: 'emit',
        sharedStrings: 'cache',
        styles: 'ignore',
      });
      (workbookReader as any).model = { sheets: [] }; // Prevent the internal ExcelJS sheets TypeError crash

      for await (const worksheetReader of workbookReader) {
        const sheetPath = `worksheets/sheet${(worksheetReader as any).id}.xml`.toLowerCase();
        if (sheetPath === targetPath) {
          this.logger.debug(`Processing streaming worksheet: ${matchedSheetName}`);
          let headers: string[] = [];
          for await (const row of worksheetReader) {
            const rowNumber = row.number;
            if (rowNumber === 1) {
              row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                headers[colNumber] = cell.text?.trim() || `col_${colNumber}`;
              });
            } else {
              const rowData: Record<string, any> = {};
              row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const header = headers[colNumber] || `col_${colNumber}`;
                rowData[header] = cell.value !== null && typeof cell.value === 'object' && 'text' in cell.value
                  ? (cell.value as any).text
                  : cell.value;
              });
              if (Object.keys(rowData).length > 0) {
                allRows.push(rowData);
              }
            }
          }
        } else {
          // Empty iterator to discard skipped sheets
          for await (const _row of worksheetReader) { /* skip */ }
        }
      }
      this.logger.debug('Workbook read complete.');
    } else {
      throw new BadRequestException('Invalid file format. Upload CSV or Excel file.');
    }

    if (allRows.length === 0) throw new BadRequestException('No records found in file');

    this.logger.debug(`Parsed ${allRows.length} rows into memory. Starting transform...`);

    // ─── STEP 2: Pre-fetch existing parties & branches, then transform + validate ───
    const [existingParties, existingBranches] = await Promise.all([
      this.prisma.party.findMany({ select: { code: true } }),
      this.prisma.branch.findMany({ select: { code: true } }),
    ]);
    const partySet = new Set(existingParties.map(p => p.code));
    const branchSet = new Set(existingBranches.map(b => b.code));

    // Maps for new entities to bulk-insert
    const newParties = new Map<string, string>(); // code -> name
    const newBranches = new Set<string>();

    interface ValidRow {
      consignee: string;
      dealerCode: string;
      loc: string;
      partCategoryCode: string;
      partNum: string;
      rootPartNum: string;
      day: number;
      fiscalYear: number;
      month: string;
      monthYear: string;
      consPartyCode: string;
      consPartyName: string;
      partyType: string;
      documentNum: string | null;
      remarks: string | null;
      netRetailQty: number;
      netRetailSelling: number;
      discountAmount: number;
      netRetailDdl: number;
    }

    const validRows: ValidRow[] = [];
    let invalidCount = 0;

    for (const row of allRows) {
      const consignee = String(row['Consignee'] || row['consignee'] || '').trim();
      const dealerCode = String(row['Dealer Code'] || row['dealerCode'] || row['DealerCode'] || '').trim();
      const loc = String(row['Loc'] || row['loc'] || '').trim();
      const partCategoryCode = String(row['Part Category Code'] || row['partCategoryCode'] || '').trim();
      const partNum = String(row['Part Num'] || row['partNum'] || '').trim();
      const rootPartNum = String(row['Root Part Num'] || row['rootPartNum'] || '').trim();
      const day = parseInt(String(row['Day'] || row['day'] || '0'));
      const fiscalYear = parseInt(String(row['Fiscal Year'] || row['fiscalYear'] || '0'));
      const month = String(row['Month'] || row['month'] || '').trim();
      const monthYear = String(row['Month Year'] || row['monthYear'] || '').trim();
      const consPartyCode = String(row['Cons Party Code'] || row['consPartyCode'] || '').trim();
      const consPartyName = String(row['Cons Party Name'] || row['consPartyName'] || '').trim();
      let partyType = String(row['Party Type'] || row['partyType'] || '').trim();

      // Override: 10912NYI → MASS
      if (dealerCode === '10912NYI' || consPartyCode === '10912NYI' || consignee === '10912NYI') {
        partyType = 'MASS';
      }
      // Override: MSZ → MASS
      if (dealerCode === 'MSZ' || consPartyCode === 'MSZ') {
        partyType = 'MASS';
      }
      // Override: OTHERS → WALK-IN CUSTOMER
      if (partyType.toUpperCase() === 'OTHERS') {
        partyType = 'WALK-IN CUSTOMER';
      }

      const _rawDocNum = (row['Document Num'] || row['documentNum'])
        ? String(row['Document Num'] || row['documentNum']).trim()
        : null;
      const documentNum = (_rawDocNum && _rawDocNum !== '-' && _rawDocNum !== 'N/A') ? _rawDocNum : null;
      const remarks = (row['Remarks'] || row['remarks'])
        ? String(row['Remarks'] || row['remarks']).trim()
        : null;
      const netRetailQty = parseInt(String(row['Net Retail Qty'] || row['netRetailQty'] || '0'));
      const netRetailSelling = parseFloat(String(row['Net Retail Selling'] || row['netRetailSelling'] || '0'));
      const discountAmount = parseFloat(String(row['Discount Amount'] || row['discountAmount'] || '0'));
      const netRetailDdl = parseFloat(String(row['Net Retail DDL'] || row['netRetailDdl'] || '0'));

      // Validation
      const errors: string[] = [];
      if (!consignee) errors.push('Missing consignee');
      if (!dealerCode) {
        errors.push('Missing dealerCode');
      } else {
        if (!partySet.has(consPartyCode) && !newParties.has(consPartyCode)) {
          newParties.set(consPartyCode, `${(consPartyName || consPartyCode).slice(0, 300)}||${loc}`);
          partySet.add(consPartyCode);
        }
        if (consignee && !partySet.has(consignee) && !newParties.has(consignee)) {
          newParties.set(consignee, `${(consPartyName || consignee).slice(0, 300)}||${loc}`);
          partySet.add(consignee);
        }
      }
      if (!loc) {
        errors.push('Missing location (loc)');
      } else if (!branchSet.has(loc) && !newBranches.has(loc)) {
        // Queue for bulk upsert
        newBranches.add(loc);
        branchSet.add(loc);
      }
      if (!partNum) errors.push('Missing partNum');
      if (isNaN(day) || day < 1 || day > 31) errors.push('Invalid day');
      if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) errors.push('Invalid fiscal year');
      if (!month) errors.push('Missing month');
      if (isNaN(netRetailQty)) errors.push('Invalid net retail qty');
      if (isNaN(netRetailSelling)) errors.push('Invalid net retail selling');

      if (errors.length > 0) {
        invalidCount++;
      } else {
        validRows.push({
          consignee,
          dealerCode,
          loc,
          partCategoryCode,
          partNum,
          rootPartNum,
          day,
          fiscalYear,
          month,
          monthYear,
          consPartyCode,
          consPartyName,
          partyType,
          documentNum,
          remarks,
          netRetailQty,
          netRetailSelling: isNaN(netRetailSelling) ? 0 : netRetailSelling,
          discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
          netRetailDdl: isNaN(netRetailDdl) ? 0 : netRetailDdl,
        });
      }
    }

    this.logger.debug(`Transform complete: ${validRows.length} valid, ${invalidCount} invalid. New parties: ${newParties.size}, new branches: ${newBranches.size}`);

    // ─── STEP 3: Bulk upsert new parties (1 SQL) ────────────────────────────
    if (newParties.size > 0) {
      const partyValues = Array.from(newParties.entries())
        .map(([code, val]) => {
          const parts = val.split('||');
          const name = parts[0];
          const loc = parts[1] || '';

          const safeCode = code.replace(/'/g, "''");
          const safeName = name.replace(/'/g, "''");
          const safeBranch = loc.replace(/'/g, "''");
          
          // Determine subtype deterministically
          let subType = 'RO';
          if (code !== 'RJ06') {
            let hash = 0;
            for (let idx = 0; idx < code.length; idx++) {
              hash = code.charCodeAt(idx) + ((hash << 5) - hash);
            }
            const subtypes = ['RO', 'MW', 'AW'];
            subType = subtypes[Math.abs(hash) % subtypes.length];
          }
          
          return `('${safeCode}', '${safeName}', 'DEALER', '${subType}'::\"PartySubType\", '${safeBranch}', true, '${userId}', NOW(), NOW())`;
        })
        .join(',\n');

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO parties (code, name, type, sub_type, primary_branch_code, is_active, created_by, created_at, updated_at)
        VALUES ${partyValues}
        ON CONFLICT (code) DO UPDATE SET is_active = true, primary_branch_code = EXCLUDED.primary_branch_code, updated_at = NOW()
      `);
      this.logger.debug(`Bulk upserted ${newParties.size} new parties`);
    }

    // ─── STEP 4: Bulk upsert new branches (1 SQL) ────────────────────────────
    if (newBranches.size > 0) {
      const branchValues = Array.from(newBranches)
        .map(code => {
          const safeCode = code.replace(/'/g, "''");
          const safeName = `${code} Branch`.replace(/'/g, "''");
          return `('${safeCode}', '${safeName}', true, NOW(), NOW())`;
        })
        .join(',\n');

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO branches (code, name, is_active, created_at, updated_at)
        VALUES ${branchValues}
        ON CONFLICT (code) DO UPDATE SET is_active = true, updated_at = NOW()
      `);
      this.logger.debug(`Bulk upserted ${newBranches.size} new branches`);
    }

    // ─── STEP 5: Purge existing records for the months/years in the sheet ───
    let deletedCount = 0;
    const periodsToDelete = new Set<string>(); // Format: "Month_Year"
    for (const r of validRows) {
      periodsToDelete.add(`${r.month}_${r.fiscalYear}`);
    }

    if (periodsToDelete.size > 0) {
      const conditions = Array.from(periodsToDelete).map(p => {
        const [month, yearStr] = p.split('_');
        const safeMonth = month.replace(/'/g, "''");
        const safeYear = parseInt(yearStr);
        return `(month = '${safeMonth}' AND fiscal_year = ${safeYear})`;
      }).join(' OR ');

      this.logger.debug(`Purging existing raw_sales for conditions: ${conditions}`);
      deletedCount = await this.prisma.$executeRawUnsafe(`
        DELETE FROM raw_sales WHERE ${conditions}
      `);
      this.logger.log(`Purged ${deletedCount} existing records for month/year overwrite.`);
    }

    // ─── STEP 6: Conditionally drop indexes temporarily for massive files (>200k rows) ───
    const isHugeFile = validRows.length > 200000;
    if (isHugeFile) {
      this.logger.debug('Huge file detected. Dropping performance indexes on raw_sales temporarily...');
      const dropQueries = [
        'DROP INDEX IF EXISTS idx_raw_sales_period',
        'DROP INDEX IF EXISTS idx_raw_sales_consignee',
        'DROP INDEX IF EXISTS idx_raw_sales_loc',
        'DROP INDEX IF EXISTS idx_raw_sales_party_type',
        'DROP INDEX IF EXISTS idx_raw_sales_part_category',
        'DROP INDEX IF EXISTS idx_raw_sales_document_num'
      ];
      for (const q of dropQueries) {
        await this.prisma.$executeRawUnsafe(q);
      }
      this.logger.debug('Indexes dropped successfully. Starting fast heap insertion.');
    }

    // ─── STEP 7: Fast Bulk Insert in 15000-row chunks ───
    const CHUNK_SIZE = 15000;
    let insertedCount = 0;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);

      const valuesSql = chunk.map(r => {
        const esc = (s: string | null | undefined) =>
          s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

        const escNum = (n: number) => (isNaN(n) ? '0' : String(n));

        return `(
          gen_random_uuid(),
          ${esc(r.consignee)},
          ${esc(r.dealerCode)},
          ${esc(r.loc)},
          ${esc(r.partCategoryCode)},
          ${esc(r.partNum)},
          ${esc(r.rootPartNum)},
          ${escNum(r.day)},
          ${escNum(r.fiscalYear)},
          ${esc(r.month)},
          ${esc(r.monthYear)},
          ${esc(r.consPartyCode)},
          ${esc(r.consPartyName)},
          ${esc(r.partyType)},
          ${esc(r.documentNum)},
          ${esc(r.remarks)},
          ${escNum(r.netRetailQty)},
          ${escNum(r.netRetailSelling)},
          ${escNum(r.discountAmount)},
          ${escNum(r.netRetailDdl)},
          '${batchId}'::uuid,
          '${userId}'::uuid,
          NOW()
        )`;
      }).join(',\n');

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO raw_sales (
          id, consignee, dealer_code, loc, part_category_code, part_num, root_part_num,
          day, fiscal_year, month, month_year, cons_party_code, cons_party_name, party_type,
          document_num, remarks, net_retail_qty, net_retail_selling, discount_amount,
          net_retail_ddl, batch_id, uploaded_by, uploaded_at
        )
        VALUES ${valuesSql}
      `);

      insertedCount += chunk.length;
      this.logger.debug(`Inserted batch ${Math.ceil((i + chunk.length) / CHUNK_SIZE)} of ${Math.ceil(validRows.length / CHUNK_SIZE)} (${insertedCount}/${validRows.length})`);
    }

    // ─── STEP 8: Recreate performance indexes if they were dropped ───
    if (isHugeFile) {
      this.logger.debug('Recreating performance indexes on raw_sales...');
      const createQueries = [
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_period ON raw_sales(fiscal_year, month)',
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_consignee ON raw_sales(consignee)',
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_loc ON raw_sales(loc)',
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_party_type ON raw_sales(party_type)',
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_part_category ON raw_sales(part_category_code)',
        'CREATE INDEX IF NOT EXISTS idx_raw_sales_document_num ON raw_sales(document_num)'
      ];
      for (const q of createQueries) {
        await this.prisma.$executeRawUnsafe(q);
      }
      this.logger.debug('Indexes recreated successfully!');
    }

    // ─── STEP 6: Write single importLog with status=COMMITTED ───────────────
    const log = await this.prisma.importLog.create({
      data: {
        batchId,
        sourceType: 'SALES_UPLOAD',
        fileName,
        totalRows: allRows.length,
        validRows: validRows.length,
        invalidRows: invalidCount,
        status: 'COMMITTED',
        committedRows: insertedCount,
        committedAt: new Date(),
        createdBy: userId,
      },
    });

    this.logger.log(`Direct-committed batch ${batchId}: ${allRows.length} total, ${validRows.length} valid, ${invalidCount} invalid, ${insertedCount} upserted`);

    return {
      batchId,
      totalRows: allRows.length,
      validCount: validRows.length,
      invalidCount,
      committedCount: insertedCount,
      deletedCount: deletedCount,
      status: 'COMMITTED',
      log,
    };
  }

  async getPreview(batchId: string, query: SalesQueryDto) {
    const { skip, take } = getPaginationParams(query);
    const stagingWhere = { batchId, sourceType: 'SALES_UPLOAD' };

    let totalCount = await this.prisma.rawStagingRecord.count({ where: stagingWhere });
    let items: any[] = [];

    if (totalCount > 0) {
      items = await this.prisma.rawStagingRecord.findMany({
        where: stagingWhere,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      });
    } else {
      // Query raw_sales instead (Fast Direct Upload case)
      const salesWhere = { batchId };
      totalCount = await this.prisma.rawSales.count({ where: salesWhere });
      const salesItems = await this.prisma.rawSales.findMany({
        where: salesWhere,
        skip,
        take,
        orderBy: { uploadedAt: 'asc' },
      });

      // Map raw_sales records to staging-like items expected by the frontend
      items = salesItems.map(s => ({
        id: s.id,
        sourceType: 'SALES_UPLOAD',
        batchId: s.batchId,
        status: 'COMMITTED',
        amount: s.netRetailSelling,
        partyCode: s.consignee,
        branchCode: s.loc,
        payload: {
          'Cons Party Code': s.consPartyCode,
          'Cons Party Name': s.consPartyName,
          'Part Num': s.partNum,
          'Net Retail Selling': s.netRetailSelling,
        },
        errorMessage: null,
        createdAt: s.uploadedAt,
      }));
    }

    return buildPaginatedResponse(items, totalCount, query.page ?? 1, query.pageSize ?? 50);
  }

  async commitImport(batchId: string, userId: string) {
    const log = await this.prisma.importLog.findUnique({
      where: { batchId },
    });

    if (!log) throw new NotFoundException('Batch not found');
    
    // If the batch was already committed directly during upload (Fast Direct Upload),
    // return success to frontend directly instead of throwing an error.
    if (log.status === 'COMMITTED') {
      return {
        batchId,
        totalRows: log.totalRows,
        validCount: log.validRows,
        invalidCount: log.invalidRows,
        committedCount: log.committedRows ?? log.totalRows,
        status: 'COMMITTED',
        log,
      };
    }

    // Count valid records without loading them into memory
    const validCount = await this.prisma.rawStagingRecord.count({
      where: { batchId, status: 'VALIDATED' },
    });

    if (validCount === 0) {
      throw new BadRequestException('No valid records to commit in this batch');
    }

    // UPSERT: insert new records; if document_num already exists → overwrite (like .NET portal)
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO raw_sales (
        id, consignee, dealer_code, loc, part_category_code, part_num, root_part_num,
        day, fiscal_year, month, month_year, cons_party_code, cons_party_name, party_type,
        document_num, remarks, net_retail_qty, net_retail_selling, discount_amount,
        net_retail_ddl, batch_id, uploaded_by, uploaded_at
      )
      SELECT
        gen_random_uuid(),
        TRIM(COALESCE(payload->>'Consignee', payload->>'consignee', '')),
        TRIM(COALESCE(payload->>'Dealer Code', payload->>'dealerCode', payload->>'DealerCode', '')),
        TRIM(COALESCE(payload->>'Loc', payload->>'loc', '')),
        TRIM(COALESCE(payload->>'Part Category Code', payload->>'partCategoryCode', '')),
        TRIM(COALESCE(payload->>'Part Num', payload->>'partNum', '')),
        TRIM(COALESCE(payload->>'Root Part Num', payload->>'rootPartNum', '')),
        COALESCE(ROUND((NULLIF(payload->>'Day', ''))::numeric), 0)::int,
        COALESCE(ROUND((NULLIF(payload->>'Fiscal Year', ''))::numeric), 0)::int,
        TRIM(COALESCE(payload->>'Month', payload->>'month', '')),
        TRIM(COALESCE(payload->>'Month Year', payload->>'monthYear', '')),
        TRIM(COALESCE(payload->>'Cons Party Code', payload->>'consPartyCode', '')),
        TRIM(COALESCE(payload->>'Cons Party Name', payload->>'consPartyName', '')),
        TRIM(COALESCE(payload->>'Party Type', payload->>'partyType', '')),
        NULLIF(TRIM(COALESCE(payload->>'Document Num', payload->>'documentNum', '')), ''),
        NULLIF(TRIM(COALESCE(payload->>'Remarks', payload->>'remarks', '')), ''),
        COALESCE(ROUND((NULLIF(payload->>'Net Retail Qty', ''))::numeric), 0)::int,
        COALESCE((NULLIF(payload->>'Net Retail Selling', ''))::float, 0),
        COALESCE((NULLIF(payload->>'Discount Amount', ''))::float, 0),
        COALESCE((NULLIF(payload->>'Net Retail DDL', ''))::float, 0),
        $1::uuid,
        $2::uuid,
        NOW()
      FROM raw_staging_record
      WHERE batch_id = $1::uuid
        AND status = 'VALIDATED'
        AND source_type = 'SALES_UPLOAD'
      ON CONFLICT (document_num) WHERE document_num IS NOT NULL
      DO UPDATE SET
        consignee          = EXCLUDED.consignee,
        dealer_code        = EXCLUDED.dealer_code,
        loc                = EXCLUDED.loc,
        part_category_code = EXCLUDED.part_category_code,
        part_num           = EXCLUDED.part_num,
        root_part_num      = EXCLUDED.root_part_num,
        day                = EXCLUDED.day,
        fiscal_year        = EXCLUDED.fiscal_year,
        month              = EXCLUDED.month,
        month_year         = EXCLUDED.month_year,
        cons_party_code    = EXCLUDED.cons_party_code,
        cons_party_name    = EXCLUDED.cons_party_name,
        party_type         = EXCLUDED.party_type,
        remarks            = EXCLUDED.remarks,
        net_retail_qty     = EXCLUDED.net_retail_qty,
        net_retail_selling = EXCLUDED.net_retail_selling,
        discount_amount    = EXCLUDED.discount_amount,
        net_retail_ddl     = EXCLUDED.net_retail_ddl,
        batch_id           = EXCLUDED.batch_id,
        uploaded_by        = EXCLUDED.uploaded_by,
        uploaded_at        = NOW()
    `, batchId, userId);


    // Bulk update staging + log status — both are pure UPDATE with index on batch_id
    await this.prisma.$executeRawUnsafe(`
      UPDATE raw_staging_record
      SET status = 'COMMITTED', committed_at = NOW(), updated_by = $2::uuid, updated_at = NOW()
      WHERE batch_id = $1::uuid AND status = 'VALIDATED'
    `, batchId, userId);

    await this.prisma.importLog.update({
      where: { batchId },
      data: {
        status: 'COMMITTED',
        committedRows: validCount,
        committedAt: new Date(),
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      entityType: 'ImportLog',
      entityId: log.id,
      action: 'UPDATE',
      newValues: { batchId, committedCount: validCount },
      changedBy: userId,
    });

    return { batchId, committedCount: validCount };
  }

  async rollbackImport(batchId: string, userId: string) {
    const log = await this.prisma.importLog.findUnique({
      where: { batchId },
    });

    if (!log) throw new NotFoundException('Batch not found');
    if (log.status !== 'COMMITTED') {
      throw new BadRequestException('Can only rollback committed batches');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Delete rows from RAW_SALES
      await tx.rawSales.deleteMany({
        where: { batchId },
      });

      // Update staging records
      await tx.rawStagingRecord.updateMany({
        where: { batchId },
        data: {
          status: 'ROLLED_BACK',
          rolledBackAt: new Date(),
          updatedBy: userId,
        },
      });

      // Update log
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
        entityId: log.id,
        action: 'UPDATE',
        newValues: { batchId },
        changedBy: userId,
      });

      return { batchId, status: 'ROLLED_BACK' };
    });
  }

  async querySales(query: SalesQueryDto, userBranches: string[]) {
    const { skip, take } = getPaginationParams(query);
    const where: any = {};

    if (query.branchCode) {
      if (!userBranches.includes(query.branchCode)) {
        throw new BadRequestException(`No access to branch: ${query.branchCode}`);
      }
      where.loc = query.branchCode;
    } else {
      where.loc = { in: userBranches };
    }

    if (query.fiscalYear) {
      where.fiscalYear = query.fiscalYear;
    }
    if (query.month) {
      where.month = { contains: query.month, mode: 'insensitive' };
    }
    if (query.dealerCode) {
      where.dealerCode = query.dealerCode;
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.rawSales.findMany({
        where,
        skip,
        take,
        orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }, { day: 'desc' }],
      }),
      this.prisma.rawSales.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, query.page ?? 1, query.pageSize ?? 50);
  }

  async getUploadHistory(userBranches: string[], query: SalesQueryDto) {
    const { skip, take } = getPaginationParams(query);
    const where = { sourceType: 'SALES_UPLOAD' };

    const [items, totalCount] = await Promise.all([
      this.prisma.importLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.importLog.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, query.page ?? 1, query.pageSize ?? 50);
  }
}
