// src/outstanding/outstanding.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { PartyType } from '@prisma/client';
import * as ExcelJS from 'exceljs';

@Injectable()
export class OutstandingService {
  private readonly logger = new Logger(OutstandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
    private readonly configService: ConfigService,
  ) {}

  async getOutstandingMaster(month?: number, year?: number, branchFilter?: string) {
    let m = month;
    let y = year;

    if (!m || !y) {
      const latest = await this.prisma.dealerOutstanding.findFirst({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      if (latest) {
        m = latest.month;
        y = latest.year;
      } else {
        const d = new Date();
        m = d.getMonth() + 1;
        y = d.getFullYear();
      }
    }

    const where: any = { month: m, year: y };

    // Apply Row-Level Branch Isolation boundaries
    this.branchIsolation.mergeBranchFilter(where, 'branchCode', branchFilter);

    const items = await this.prisma.dealerOutstanding.findMany({
      where,
      orderBy: { partyCode: 'asc' },
    });

    // Pair items with branch names
    const branchCodes = Array.from(new Set(items.map(it => it.branchCode)));
    const branches = await this.prisma.branch.findMany({
      where: { code: { in: branchCodes } },
      select: { code: true, name: true },
    });
    const branchMap = new Map<string, string>();
    branches.forEach(b => branchMap.set(b.code, b.name));

    return items.map(it => ({
      ...it,
      branchName: branchMap.get(it.branchCode) || it.branchCode,
    }));
  }

  async uploadExcel(fileBuffer: any, rewrite: boolean, month?: number, year?: number, userId?: string) {
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    const monthLabel = `${new Date(targetYear, targetMonth - 1).toLocaleString('en-US', { month: 'long' })} ${targetYear}`;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheet = workbook.worksheets[0];

    // 1. Dynamic Header Row Scanning
    let headerRowIndex = 1;
    let codeCol = 0;
    let outstandingCol = 0;
    let colLess7 = 0;
    let col7To14 = 0;
    let col14To21 = 0;
    let col21To28 = 0;
    let col28To35 = 0;
    let col35To50 = 0;
    let col50To80 = 0;
    let colMore80 = 0;

    for (let r = 1; r <= 10; r++) {
      const row = sheet.getRow(r);
      const cells: Record<string, number> = {};
      row.eachCell((cell, colNumber) => {
        const val = (cell.value || '').toString().trim();
        if (val) {
          cells[val] = colNumber;
        }
      });

      // Find Code Column
      let cCol = 0;
      for (const key of ["Particulars", "Party Code", "Dealer Code", "PartyCode", "DealerCode", "Code", "Ledger Name", "Ledger", "Name"]) {
        const matchKey = Object.keys(cells).find(k => k.toLowerCase() === key.toLowerCase());
        if (matchKey) {
          cCol = cells[matchKey];
          break;
        }
      }

      // Find Outstanding Column
      let oCol = 0;
      for (const key of ["Pending Bills", "Outstanding", "Balance", "Closing Balance", "Outstanding Balance", "Amt", "Amount", "Closing"]) {
        const matchKey = Object.keys(cells).find(k => k.toLowerCase() === key.toLowerCase());
        if (matchKey) {
          oCol = cells[matchKey];
          break;
        }
      }

      if (cCol !== 0 && oCol !== 0) {
        headerRowIndex = r;
        codeCol = cCol;
        outstandingCol = oCol;

        // Scan aging columns in header row
        Object.entries(cells).forEach(([key, colNumber]) => {
          const normKey = key.replace(/\s+/g, '').replace(/[()]/g, '').toLowerCase();
          if (normKey.includes('<7days') || normKey.includes('less7days') || normKey === '<7') colLess7 = colNumber;
          else if (normKey.includes('7to14') || normKey.includes('7-14')) col7To14 = colNumber;
          else if (normKey.includes('14to21') || normKey.includes('14-21')) col14To21 = colNumber;
          else if (normKey.includes('21to28') || normKey.includes('21-28')) col21To28 = colNumber;
          else if (normKey.includes('28to35') || normKey.includes('28-35')) col28To35 = colNumber;
          else if (normKey.includes('35to50') || normKey.includes('35-50')) col35To50 = colNumber;
          else if (normKey.includes('50to80') || normKey.includes('50-80')) col50To80 = colNumber;
          else if (normKey.includes('>80days') || normKey.includes('more80days') || normKey === '>80') colMore80 = colNumber;
        });
        break;
      }
    }

    if (codeCol === 0 || outstandingCol === 0) {
      throw new BadRequestException("Invalid file structure. Excel sheet must contain a Code/Name column and an Outstanding/Balance column in the first 10 rows.");
    }

    const uploadLogs: string[] = [];
    uploadLogs.push(`[Excel] Resolved Header on Row ${headerRowIndex}. Code Column = Col ${codeCol}, Outstanding Column = Col ${outstandingCol}. Mode: ${rewrite ? "Overwrite/Rewrite" : "Accumulate/Merge"}`);

    // Load active dealers from database
    const parties: any[] = await this.prisma.party.findMany({
      where: { isActive: true },
    });

    const parseCellDecimal = (cell: ExcelJS.Cell): number => {
      if (!cell || cell.value === null || cell.value === undefined) return 0;
      if (typeof cell.value === 'number') return cell.value;
      if (typeof cell.value === 'object' && 'result' in cell.value) {
        return Number((cell.value as any).result) || 0;
      }
      const str = cell.value.toString().trim();
      if (!str) return 0;
      const isCredit = str.toLowerCase().includes('cr') || str.startsWith('-');
      const cleanStr = str.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleanStr);
      if (isNaN(parsed)) return 0;
      return isCredit ? -Math.abs(parsed) : parsed;
    };

    if (rewrite) {
      await this.prisma.dealerOutstanding.deleteMany({
        where: { year: targetYear, month: targetMonth },
      });
      uploadLogs.push(`[Prisma] Cleaned existing outstandings for ${monthLabel}`);
    }

    const activeOutstandings = new Map<string, any>();
    if (!rewrite) {
      const existing = await this.prisma.dealerOutstanding.findMany({
        where: { year: targetYear, month: targetMonth },
      });
      existing.forEach(o => activeOutstandings.set(o.partyCode.toLowerCase(), o));
    }

    let updatedCount = 0;
    const rowCount = sheet.rowCount;

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      const codeVal = (row.getCell(codeCol).value || '').toString().trim();
      if (!codeVal) continue;
      if (codeVal.toLowerCase() === 'total' || codeVal.toLowerCase() === 'grand total') continue;

      let matchCode = codeVal;
      let matchName = codeVal;
      const parenMatch = codeVal.match(/\(([^)]+)\)/);
      if (parenMatch) {
        matchCode = parenMatch[1].trim();
        matchName = codeVal.substring(0, parenMatch.index).trim();
      }

      let party = parties.find(p => p.code.toLowerCase() === matchCode.toLowerCase());
      if (!party && matchName) {
        party = parties.find(p => p.name.toLowerCase() === matchName.toLowerCase());
      }

      if (!party) {
        const truncatedCode = matchCode.substring(0, 40);
        let baseBranchCode = 'MUMBAI-01';
        if (matchCode.toLowerCase().includes('rj06') || matchName.toLowerCase().includes('rj06')) {
          baseBranchCode = 'TNG';
        } else if (matchCode.toLowerCase().includes('rj05') || matchName.toLowerCase().includes('rj05')) {
          baseBranchCode = 'ALW';
        }

        party = await this.prisma.party.create({
          data: {
            code: truncatedCode,
            name: matchName,
            type: PartyType.DEALER,
            primaryBranchCode: baseBranchCode,
          },
        });
        parties.push(party);
        uploadLogs.push(`[Excel-Create] Dynamic Dealer Registered: Code '${truncatedCode}', Name '${matchName}' under Branch ${baseBranchCode}`);
      }

      const currentParty = party!;
      const parsedOutstanding = parseCellDecimal(row.getCell(outstandingCol));
      const parsedLess7 = colLess7 > 0 ? parseCellDecimal(row.getCell(colLess7)) : 0;
      const parsed7To14 = col7To14 > 0 ? parseCellDecimal(row.getCell(col7To14)) : 0;
      const parsed14To21 = col14To21 > 0 ? parseCellDecimal(row.getCell(col14To21)) : 0;
      const parsed21To28 = col21To28 > 0 ? parseCellDecimal(row.getCell(col21To28)) : 0;
      const parsed28To35 = col28To35 > 0 ? parseCellDecimal(row.getCell(col28To35)) : 0;
      const parsed35To50 = col35To50 > 0 ? parseCellDecimal(row.getCell(col35To50)) : 0;
      const parsed50To80 = col50To80 > 0 ? parseCellDecimal(row.getCell(col50To80)) : 0;
      const parsedMore80 = colMore80 > 0 ? parseCellDecimal(row.getCell(colMore80)) : 0;

      const key = currentParty.code.toLowerCase();
      if (activeOutstandings.has(key)) {
        const existing = activeOutstandings.get(key);
        const updated = await this.prisma.dealerOutstanding.update({
          where: { id: existing.id },
          data: {
            outstanding: existing.outstanding + parsedOutstanding,
            outstandingLess7Days: (existing.outstandingLess7Days || 0) + parsedLess7,
            outstanding7To14Days: (existing.outstanding7To14Days || 0) + parsed7To14,
            outstanding14To21Days: (existing.outstanding14To21Days || 0) + parsed14To21,
            outstanding21To28Days: (existing.outstanding21To28Days || 0) + parsed21To28,
            outstanding28To35Days: (existing.outstanding28To35Days || 0) + parsed28To35,
            outstanding35To50Days: (existing.outstanding35To50Days || 0) + parsed35To50,
            outstanding50To80Days: (existing.outstanding50To80Days || 0) + parsed50To80,
            outstandingMore80Days: (existing.outstandingMore80Days || 0) + parsedMore80,
            syncedAt: new Date(),
          },
        });
        activeOutstandings.set(key, updated);
        updatedCount++;
        uploadLogs.push(`[Excel] Dealer: ${currentParty.code} | Added: ₹${parsedOutstanding.toLocaleString()} | Total: ₹${updated.outstanding.toLocaleString()}`);
      } else {
        const created = await this.prisma.dealerOutstanding.create({
          data: {
            month: targetMonth,
            year: targetYear,
            monthLabel,
            partyCode: currentParty.code,
            partyName: currentParty.name,
            branchCode: currentParty.primaryBranchCode || 'MUMBAI-01',
            outstanding: parsedOutstanding,
            outstandingLess7Days: parsedLess7,
            outstanding7To14Days: parsed7To14,
            outstanding14To21Days: parsed14To21,
            outstanding21To28Days: parsed21To28,
            outstanding28To35Days: parsed28To35,
            outstanding35To50Days: parsed35To50,
            outstanding50To80Days: parsed50To80,
            outstandingMore80Days: parsedMore80,
            syncedAt: new Date(),
            createdBy: userId || 'system',
          },
        });
        activeOutstandings.set(key, created);
        updatedCount++;
        uploadLogs.push(`[Excel] Dealer: ${currentParty.code} | Set Outstanding: ₹${parsedOutstanding.toLocaleString()}`);
      }

      // Upsert DealerMonthlyPerformance outstandingAmount for dashboard reporting
      await this.prisma.dealerMonthlyPerformance.upsert({
        where: {
          partyId_branchCode_year_month_partCategoryCode: {
            partyId: currentParty.id,
            branchCode: currentParty.primaryBranchCode || 'MUMBAI-01',
            year: targetYear,
            month: targetMonth,
            partCategoryCode: '',
          },
        },
        update: {
          outstandingAmount: parsedOutstanding,
        },
        create: {
          partyId: currentParty.id,
          branchCode: currentParty.primaryBranchCode || 'MUMBAI-01',
          year: targetYear,
          month: targetMonth,
          partCategoryCode: '',
          outstandingAmount: parsedOutstanding,
          salesAmount: 0,
          salesQuantity: 0,
        },
      });
    }

    await this.auditService.log({
      entityType: 'DealerOutstanding',
      entityId: `${targetYear}-${targetMonth}`,
      action: 'UPDATE',
      newValues: { updatedCount, monthLabel },
      changedBy: userId,
    });

    return { success: true, count: updatedCount, logs: uploadLogs };
  }

  async syncTallyOutstanding(month?: number, year?: number) {
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    const monthLabel = `${new Date(targetYear, targetMonth - 1).toLocaleString('en-US', { month: 'long' })} ${targetYear}`;
    let tallyUrl = this.configService.get<string>('TALLY_URL') || 'http://localhost:9000';
    if (!tallyUrl.startsWith('http://') && !tallyUrl.startsWith('https://')) {
      tallyUrl = `http://${tallyUrl}`;
    }
    const logs: string[] = [];

    logs.push(`[Tally-SOAP] Initializing Tally ERP 9 SOAP connection...`);
    logs.push(`[Tally-SOAP] Target endpoint: ${tallyUrl}`);

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const fromStr = `${targetYear}0101`;
    const toStr = `${targetYear}${targetMonth.toString().padStart(2, '0')}${daysInMonth.toString().padStart(2, '0')}`;
    const periodEnd = new Date(targetYear, targetMonth - 1, daysInMonth);

    const xmlPayload = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Bills Receivable</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>${fromStr}</SVFROMDATE>
          <SVTODATE>${toStr}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

    logs.push(`[Tally-SOAP] Sending 'Bills Receivable' SOAP XML query (as-of ${periodEnd.toISOString().split('T')[0]})...`);

    let responseXml = '';
    let isRealConnectionSuccess = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout (Tally ERP 9 can take up to 30-120s for Bills Receivable)

      const res = await fetch(tallyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Accept': 'text/xml, application/xml',
        },
        body: xmlPayload,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        logs.push(`[Tally-SOAP ERROR] Tally server returned HTTP status ${res.status} ${res.statusText}`);
      } else {
        responseXml = await res.text();
        isRealConnectionSuccess = true;
        logs.push(`[Tally-SOAP] Received ${responseXml.length} bytes from Tally server.`);
      }
    } catch (err: any) {
      logs.push(`[Tally-SOAP ERROR] Cannot connect to Tally server at ${tallyUrl}`);
      logs.push(`[Diagnostic Cause] ${err.message || 'Connection refused or timeout'}`);
      logs.push(`[Troubleshooting Check-list]:`);
      logs.push(` 1. Open Tally ERP 9 / TallyPrime on ${tallyUrl}`);
      logs.push(` 2. Enable ODBC/HTTP XML Server (F12 → Advanced Configuration → Enable Tally Server/ODBC → Yes, Port: 9000)`);
      logs.push(` 3. Ensure company is loaded in Tally`);
      logs.push(` 4. Ensure Windows Firewall allows port 9000 inbound traffic on 172.20.25.5`);
    }

    // Fetch active parties
    const parties = await this.prisma.party.findMany({ select: { id: true, code: true, name: true, primaryBranchCode: true } });
    logs.push(`[Tally-Reconcile] Fetched ${parties.length} active dealers from portal registry...`);

    let syncCount = 0;

    if (isRealConnectionSuccess && responseXml.length > 0) {
      // Parse real XML
      const byCode = new Map<string, any>();
      const blockRegex = /<BILLFIXED[\s\S]*?<\/BILLFIXED>\s*(?:<BILLCL[^>]*>([\s\S]*?)<\/BILLCL>)?/gi;
      let match;
      let billCount = 0;

      while ((match = blockRegex.exec(responseXml)) !== null) {
        const blockContent = match[0];
        const clStr = match[1]?.trim() || "0";
        const clAmt = parseFloat(clStr.replace(/[^\d.-]/g, '')) || 0;
        const pendingAmt = Math.abs(clAmt);

        const partyMatch = blockContent.match(/<BILLPARTY[^>]*>([\s\S]*?)<\/BILLPARTY>/i);
        const partyRaw = partyMatch ? partyMatch[1].trim() : '';
        if (!partyRaw) continue;

        let partyCode = '';
        const parenMatch = partyRaw.match(/\(([^)]+)\)/);
        if (parenMatch) {
          partyCode = parenMatch[1].trim();
        } else {
          partyCode = partyRaw;
        }

        const dateMatch = blockContent.match(/<BILLDATE[^>]*>([\s\S]*?)<\/BILLDATE>/i);
        const dateRaw = dateMatch ? dateMatch[1].trim() : '';
        let billDate: Date | null = null;
        if (dateRaw) {
          if (dateRaw.length === 8 && /^\d{8}$/.test(dateRaw)) {
            const y = parseInt(dateRaw.substring(0, 4));
            const m = parseInt(dateRaw.substring(4, 6)) - 1;
            const d = parseInt(dateRaw.substring(6, 8));
            billDate = new Date(y, m, d);
          } else {
            const d = new Date(dateRaw);
            if (!isNaN(d.getTime())) billDate = d;
          }
        }

        let days = 0;
        if (billDate) {
          const diffTime = periodEnd.getTime() - billDate.getTime();
          days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        }

        const normKey = partyCode.toLowerCase();
        if (!byCode.has(normKey)) {
          byCode.set(normKey, {
            partyCode,
            total: 0, less7: 0, days7To14: 0, days14To21: 0, days21To28: 0, days28To35: 0, days35To50: 0, days50To80: 0, more80: 0
          });
        }

        const item = byCode.get(normKey)!;
        item.total += pendingAmt;
        if (days < 7) item.less7 += pendingAmt;
        else if (days < 14) item.days7To14 += pendingAmt;
        else if (days < 21) item.days14To21 += pendingAmt;
        else if (days < 28) item.days21To28 += pendingAmt;
        else if (days < 35) item.days28To35 += pendingAmt;
        else if (days < 50) item.days35To50 += pendingAmt;
        else if (days < 80) item.days50To80 += pendingAmt;
        else item.more80 += pendingAmt;

        billCount++;
      }

      logs.push(`[Tally-SOAP] Parsed ${billCount} bills for ${byCode.size} unique parties from Tally response.`);

      for (const p of parties) {
        const item = byCode.get(p.code.toLowerCase());
        if (!item || item.total <= 0) continue;

        await this.prisma.dealerOutstanding.upsert({
          where: {
            partyCode_year_month: {
              partyCode: p.code,
              year: targetYear,
              month: targetMonth,
            },
          },
          update: {
            partyName: p.name,
            branchCode: p.primaryBranchCode || 'MUMBAI-01',
            outstanding: item.total,
            outstandingLess7Days: item.less7,
            outstanding7To14Days: item.days7To14,
            outstanding14To21Days: item.days14To21,
            outstanding21To28Days: item.days21To28,
            outstanding28To35Days: item.days28To35,
            outstanding35To50Days: item.days35To50,
            outstanding50To80Days: item.days50To80,
            outstandingMore80Days: item.more80,
            syncedAt: new Date(),
          },
          create: {
            month: targetMonth,
            year: targetYear,
            monthLabel,
            partyCode: p.code,
            partyName: p.name,
            branchCode: p.primaryBranchCode || 'MUMBAI-01',
            outstanding: item.total,
            outstandingLess7Days: item.less7,
            outstanding7To14Days: item.days7To14,
            outstanding14To21Days: item.days14To21,
            outstanding21To28Days: item.days21To28,
            outstanding28To35Days: item.days28To35,
            outstanding35To50Days: item.days35To50,
            outstanding50To80Days: item.days50To80,
            outstandingMore80Days: item.more80,
            syncedAt: new Date(),
            createdBy: 'tally_sync_service',
          },
        });

        syncCount++;
        logs.push(`[Tally-Sync] Matched & Updated '${p.code}' | Balance: ₹${item.total.toLocaleString()} | Overdue (>80d): ₹${item.more80.toLocaleString()}`);
      }
    }

    logs.push(`[Tally-SOAP] Sync pipeline finished. Total records synced: ${syncCount}`);

    return { ok: isRealConnectionSuccess, logs };
  }
}
